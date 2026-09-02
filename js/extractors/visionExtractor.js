// Extrator de visão (fotos e PDFs digitalizados) via Claude (API da Anthropic).
//
// Adaptado do extrator fornecido pelo usuário, calibrado para o relatório
// "RELAÇÃO GERAL DOS LÍQUIDOS". O prompt e toda a lógica de validação continuam rodando
// aqui no navegador — só a chamada de rede que carrega a chave da API foi movida para
// POST /api/vision/extract (server/src/controllers/visionController.js), que é quem de
// fato conhece a ANTHROPIC_API_KEY. O navegador nunca vê essa chave.
//
// Ao final, converte o resultado estruturado (já validado: CNPJ com dígito verificador,
// contagem de EMPREGADOS/CONTRIBUINTES batendo com o resumo da empresa, seções
// presentes/ausentes) para o MESMO contrato { rawText, rows, sourceMeta, avisos } usado
// pelos outros extratores —
// assim o restante do sistema (normalize/compare/report) não precisa saber que a origem
// foi uma IA de visão em vez de um PDF nativo ou uma planilha.
window.CF = window.CF || {};
CF.extractors = CF.extractors || {};

(function () {
  "use strict";

  const MODEL = "claude-sonnet-5";
  const BACKEND_VISION_URL = "/api/vision/extract";
  const MAX_TOKENS = 12000;
  const MIN_CONFIDENCE = 0.9;

  /* ============================================================
   * ERROS
   * ========================================================== */

  class VisionExtractionError extends Error {
    constructor(message, details, code) {
      super(message);
      this.name = "VisionExtractionError";
      this.details = details || {};
      this.code = code || null;
    }
  }

  /* ============================================================
   * UTILITÁRIOS
   * ========================================================== */

  function parseBrazilianMoney(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
    }
    if (value == null) return null;

    let text = String(value).trim().replace(/\s/g, "").replace(/^R\$/i, "");
    if (!text) return null;

    text = text.replace(/\./g, "").replace(",", ".");
    const number = Number(text);
    return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
  }

  function roundMoney(value) {
    return Number(Number(value).toFixed(2));
  }

  function normalizeCNPJ(cnpj) {
    return cnpj ? String(cnpj).replace(/\D/g, "").trim() : "";
  }

  function formatCNPJ(digits) {
    if (!digits || digits.length !== 14) return digits || "";
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
  }

  function isValidCNPJ(cnpj) {
    const value = normalizeCNPJ(cnpj);
    if (value.length !== 14) return false;
    if (/^(\d)\1+$/.test(value)) return false;

    let sum = 0;
    let weight = 5;
    for (let i = 0; i < 12; i++) {
      sum += Number(value[i]) * weight;
      weight--;
      if (weight === 1) weight = 9;
    }
    let digit = (sum * 10) % 11;
    if (digit === 10) digit = 0;
    if (digit !== Number(value[12])) return false;

    sum = 0;
    weight = 6;
    for (let i = 0; i < 13; i++) {
      sum += Number(value[i]) * weight;
      weight--;
      if (weight === 1) weight = 9;
    }
    digit = (sum * 10) % 11;
    if (digit === 10) digit = 0;
    return digit === Number(value[13]);
  }

  async function fileToBase64(file) {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const CHUNK = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }

  function resolveMediaType(file, fileType) {
    const name = (file.name || "").toLowerCase();
    if (fileType === "pdf" || name.endsWith(".pdf")) {
      return { blockType: "document", mediaType: "application/pdf" };
    }
    if (name.endsWith(".png")) return { blockType: "image", mediaType: "image/png" };
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return { blockType: "image", mediaType: "image/jpeg" };
    if (name.endsWith(".webp")) return { blockType: "image", mediaType: "image/webp" };
    if (name.endsWith(".gif")) return { blockType: "image", mediaType: "image/gif" };
    throw new VisionExtractionError(`Formato não suportado pela leitura de visão: "${file.name}".`);
  }

  /* ============================================================
   * LIMPEZA DO JSON RETORNADO PELA IA
   * ========================================================== */

  function extractJsonFromText(text) {
    if (!text) throw new VisionExtractionError("Claude não retornou conteúdo.");

    let cleaned = String(text).trim();
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

    try {
      return JSON.parse(cleaned);
    } catch (_) {
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      if (first >= 0 && last > first) {
        try {
          return JSON.parse(cleaned.slice(first, last + 1));
        } catch (error) {
          throw new VisionExtractionError("Resposta da visão não contém JSON válido.", {
            original: cleaned.slice(0, 2000),
            parseError: error.message
          });
        }
      }
      throw new VisionExtractionError("Resposta da visão não contém JSON válido.", {
        original: cleaned.slice(0, 2000)
      });
    }
  }

  /* ============================================================
   * NORMALIZAÇÃO DE REGISTROS
   * ========================================================== */

  function normalizeRecord(record, categoria, pagina) {
    if (!record || typeof record !== "object") {
      throw new VisionExtractionError("Registro inválido retornado pela visão.", { categoria, pagina });
    }
    const codigo = record.codigo != null ? String(record.codigo).trim() : "";
    const nome = record.nome != null ? String(record.nome).trim() : "";
    const valor = parseBrazilianMoney(record.valor);

    if (!codigo) throw new VisionExtractionError("Registro sem código.", { categoria, nome, pagina });
    if (!nome) throw new VisionExtractionError("Registro sem nome.", { categoria, codigo, pagina });
    if (valor == null) throw new VisionExtractionError("Registro com valor inválido.", { categoria, codigo, nome, pagina });

    return { codigo, nome, valor };
  }

  /* ============================================================
   * VALIDAÇÃO DE EMPRESA / PÁGINA
   * ========================================================== */

  function validateCompany(company, page) {
    if (!company || typeof company !== "object") {
      throw new VisionExtractionError("Empresa não identificada.", { page });
    }
    if (!company.nome || !String(company.nome).trim()) {
      throw new VisionExtractionError("Nome da empresa não identificado.", { page });
    }
    if (!company.cnpj) {
      throw new VisionExtractionError("CNPJ não identificado.", { empresa: company.nome, page });
    }
    if (!isValidCNPJ(company.cnpj)) {
      throw new VisionExtractionError("CNPJ identificado, porém inválido.", { empresa: company.nome, cnpj: company.cnpj, page });
    }
    if (!company.competencia) {
      throw new VisionExtractionError("Competência não identificada.", { empresa: company.nome, cnpj: company.cnpj, page });
    }
  }

  function validatePage(pageData) {
    if (!pageData || typeof pageData !== "object") {
      throw new VisionExtractionError("Página inválida retornada pela visão.");
    }
    const pageNumber = Number(pageData.pagina);
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      throw new VisionExtractionError("Número da página inválido.", { pagina: pageData.pagina });
    }

    validateCompany(pageData.empresa, pageNumber);

    const empregados = Array.isArray(pageData.empregados) ? pageData.empregados : [];
    const contribuintes = Array.isArray(pageData.contribuintes) ? pageData.contribuintes : [];

    if (!pageData.secoes_encontradas || typeof pageData.secoes_encontradas !== "object") {
      throw new VisionExtractionError("A visão não informou quais seções foram encontradas.", { pagina: pageNumber });
    }
    const encontrouEmpregados = pageData.secoes_encontradas.empregados === true;
    const encontrouContribuintes = pageData.secoes_encontradas.contribuintes === true;

    if (encontrouEmpregados && empregados.length === 0 && Number(pageData.resumo && pageData.resumo.empregados) > 0) {
      throw new VisionExtractionError("Seção EMPREGADOS encontrada, mas os registros não foram extraídos.", {
        pagina: pageNumber,
        esperado: pageData.resumo.empregados
      });
    }
    if (encontrouContribuintes && contribuintes.length === 0 && Number(pageData.resumo && pageData.resumo.contribuintes) > 0) {
      throw new VisionExtractionError("Seção CONTRIBUINTES encontrada, mas os registros não foram extraídos.", {
        pagina: pageNumber,
        esperado: pageData.resumo.contribuintes
      });
    }

    const normalizedEmpregados = empregados.map((r) => normalizeRecord(r, "EMPREGADOS", pageNumber));
    const normalizedContribuintes = contribuintes.map((r) => normalizeRecord(r, "CONTRIBUINTES", pageNumber));

    const esperadoEmpregados = Number(pageData.resumo && pageData.resumo.empregados);
    const esperadoContribuintes = Number(pageData.resumo && pageData.resumo.contribuintes);

    if (Number.isFinite(esperadoEmpregados) && normalizedEmpregados.length !== esperadoEmpregados) {
      throw new VisionExtractionError("Quantidade de EMPREGADOS extraídos não confere com o resumo.", {
        pagina: pageNumber,
        extraidos: normalizedEmpregados.length,
        esperado: esperadoEmpregados
      });
    }
    if (Number.isFinite(esperadoContribuintes) && normalizedContribuintes.length !== esperadoContribuintes) {
      throw new VisionExtractionError("Quantidade de CONTRIBUINTES extraídos não confere com o resumo.", {
        pagina: pageNumber,
        extraidos: normalizedContribuintes.length,
        esperado: esperadoContribuintes
      });
    }

    // Não validar soma(EMPREGADOS)+soma(CONTRIBUINTES) contra "Total da Empresa": esse total é
    // da folha de pagamento inteira (inclui Estagiários e qualquer outra categoria fora das
    // duas que este sistema trata), não a soma só das duas seções extraídas — comparar os dois
    // sempre diverge quando há estagiário com valor, o que não é um erro de leitura. A validação
    // que já cobre isso corretamente são as contagens acima (esperadoEmpregados/esperadoContribuintes).

    const confidence = Number(pageData.confianca_geral);
    if (Number.isFinite(confidence) && confidence < MIN_CONFIDENCE) {
      throw new VisionExtractionError("Confiança da leitura abaixo do mínimo permitido.", {
        pagina: pageNumber,
        confianca: confidence,
        minimo: MIN_CONFIDENCE
      });
    }
    if (pageData.revisao_necessaria === true) {
      throw new VisionExtractionError("A leitura desta página foi sinalizada como necessitando revisão manual.", {
        pagina: pageNumber,
        problemas: pageData.problemas || []
      });
    }

    return {
      pagina: pageNumber,
      empresa: { nome: pageData.empresa.nome, cnpj: normalizeCNPJ(pageData.empresa.cnpj), competencia: pageData.empresa.competencia },
      empregados: normalizedEmpregados,
      contribuintes: normalizedContribuintes
    };
  }

  /* ============================================================
   * AGRUPAMENTO POR EMPRESA (várias páginas podem ser da mesma empresa)
   * ========================================================== */

  function validateDocument(pages) {
    if (!Array.isArray(pages) || pages.length === 0) {
      throw new VisionExtractionError("Nenhuma página foi extraída.");
    }

    const companies = new Map();
    pages.forEach((page) => {
      const cnpj = page.empresa.cnpj;
      if (!companies.has(cnpj)) {
        companies.set(cnpj, {
          nome: page.empresa.nome,
          cnpj,
          competencia: page.empresa.competencia,
          empregados: [],
          contribuintes: []
        });
      }
      const company = companies.get(cnpj);
      company.empregados.push(...page.empregados);
      company.contribuintes.push(...page.contribuintes);
    });

    return { paginas: pages, empresas: Array.from(companies.values()), totalPaginas: pages.length };
  }

  /* ============================================================
   * PROMPT DE EXTRAÇÃO
   * ========================================================== */

  function buildExtractionPrompt() {
    return `
Você é um extrator documental especializado no relatório brasileiro:

"RELAÇÃO GERAL DOS LÍQUIDOS"

Sua função é EXCLUSIVAMENTE extrair os dados do documento.

NÃO faça análise contábil.
NÃO calcule pró-labore.
NÃO crie valores.
NÃO estime valores.
NÃO complete informações ausentes.

====================================================
ESTRUTURA DO DOCUMENTO
====================================================

O documento normalmente contém:

RELAÇÃO GERAL DOS LÍQUIDOS

Código Nome do empregado Valor

Empresa: ...
CNPJ: ...
Cálculo: Folha Mensal
Competência: MM/AAAA

Depois podem aparecer:

Empregados

e/ou:

Contribuintes

Cada seção contém registros:

CÓDIGO
NOME
VALOR

No final existe um resumo semelhante a:

Empregados: X
Estagiários: X
Contribuintes: X
Total da Empresa: R$ X

====================================================
REGRA ABSOLUTAMENTE OBRIGATÓRIA
====================================================

EMPREGADOS E CONTRIBUINTES SÃO DUAS SEÇÕES DISTINTAS.

Você deve extrair AS DUAS.

Nunca ignorar EMPREGADOS.

Nunca ignorar CONTRIBUINTES.

Se uma empresa possuir:

Empregados: 8

e:

Contribuintes: 2

devem ser retornados:

8 registros em empregados

e:

2 registros em contribuintes.

Não misture as duas listas.

====================================================
CLASSIFICAÇÃO
====================================================

Para este sistema:

EMPREGADOS = PRO_LABORE

CONTRIBUINTES = PRO_LABORE

Não existe classificação:

"PRO_LABORE_VARIAVEL"

Não crie campo de variável.

Não interprete CONTRIBUINTES como variável.

Não interprete EMPREGADOS como funcionários descartáveis.

====================================================
RESUMO
====================================================

O resumo NÃO é a fonte principal dos registros.

Os registros individuais devem ser extraídos das tabelas.

O resumo serve somente para validação.

Exemplo:

Empregados: 8
Contribuintes: 2

significa que devem existir:

8 registros extraídos em empregados

2 registros extraídos em contribuintes.

====================================================
VALORES
====================================================

Os valores usam padrão brasileiro.

Exemplos:

1.442,69
2.885,38
19.937,89

Nunca confundir:

1.442,69

com:

144269

O valor deve ser retornado numericamente como:

1442.69

====================================================
COMPETÊNCIA
====================================================

Utilize EXCLUSIVAMENTE o campo:

"Competência:"

Não utilizar a data de emissão como competência.

====================================================
CNPJ
====================================================

O CNPJ deve ser extraído exatamente do campo:

"CNPJ:"

Não inventar CNPJ.

====================================================
CÓDIGO
====================================================

O primeiro número do registro é o código.

Exemplo:

55 ANDREIA NASCIMENTO FELICIANO SILVA 1.445,59

significa:

codigo = "55"
nome = "ANDREIA NASCIMENTO FELICIANO SILVA"
valor = 1445.59

====================================================
NOMES
====================================================

Se o nome estiver quebrado visualmente em mais de uma linha,
reconstruir o nome completo.

Não remover partes do nome.

====================================================
PÁGINAS
====================================================

O documento pode ter mais de uma página. Processar TODAS as páginas recebidas,
retornando um elemento em "paginas" para CADA página, na ordem em que aparecem,
numeradas a partir de 1.

Não parar após encontrar uma empresa.

Não parar após encontrar CONTRIBUINTES.

Não parar após encontrar EMPREGADOS.

====================================================
RODAPÉS
====================================================

Ignorar textos administrativos como:

ANAPOLIS, ...
Responsável:
Sistema licenciado para WS CONTABILIDADE LTDA

Eles não são registros.

====================================================
IMPORTANTE SOBRE ERROS
====================================================

Se uma informação estiver ilegível ou ambígua:

NÃO ADIVINHE.

Retorne, na página afetada:

"revisao_necessaria": true

e descreva o problema em "problemas".

====================================================
SAÍDA
====================================================

Retorne SOMENTE JSON válido, no formato abaixo (um elemento em "paginas" por página do documento):

{
  "documento": "RELACAO_GERAL_DOS_LIQUIDOS",
  "paginas": [
    {
      "pagina": 1,

      "empresa": {
        "nome": "...",
        "cnpj": "...",
        "competencia": "MM/AAAA",
        "calculo": "Folha Mensal"
      },

      "secoes_encontradas": {
        "empregados": true,
        "contribuintes": true
      },

      "empregados": [
        { "codigo": "55", "nome": "NOME COMPLETO", "valor": 1445.59 }
      ],

      "contribuintes": [
        { "codigo": "363", "nome": "NOME COMPLETO", "valor": 2885.38 }
      ],

      "resumo": {
        "empregados": 8,
        "estagiarios": 0,
        "contribuintes": 2,
        "total_empresa": 19937.89
      },

      "confianca_geral": 0.99,

      "revisao_necessaria": false,

      "problemas": []
    }
  ]
}

IMPORTANTE:

Se não existir a seção EMPREGADOS numa página, use:

"empregados": []

e:

"empregados": false

em "secoes_encontradas".

Se não existir a seção CONTRIBUINTES numa página, use:

"contribuintes": []

e:

"contribuintes": false

em "secoes_encontradas".

NUNCA confunda "seção não existente" com "seção existente mas não lida".
`;
  }

  /* ============================================================
   * CHAMADA CLAUDE
   * ========================================================== */

  async function callClaudeVision({ documentBase64, mediaType, blockType, prompt }) {
    const documentBlock =
      blockType === "document"
        ? { type: "document", source: { type: "base64", media_type: mediaType, data: documentBase64 } }
        : { type: "image", source: { type: "base64", media_type: mediaType, data: documentBase64 } };

    const body = {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0,
      system:
        "Você é um sistema de extração documental de alta precisão.\n\nSua prioridade é:\n1. fidelidade ao documento;\n2. não inventar dados;\n3. preservar categorias;\n4. identificar erros;\n5. retornar JSON válido.\n\nNunca preencha informação que não esteja presente.",
      messages: [{ role: "user", content: [documentBlock, { type: "text", text: prompt }] }]
    };

    // A chave da API mora só no servidor (server/src/controllers/visionController.js) —
    // o navegador nunca a vê. `credentials: "same-origin"` garante que o cookie de sessão
    // seja enviado, já que este endpoint exige autenticação.
    const response = await fetch(BACKEND_VISION_URL, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const message = (data && data.error) || `HTTP ${response.status}`;
      throw new VisionExtractionError(message, { status: response.status });
    }

    const data = await response.json();
    const textParts = Array.isArray(data.content)
      ? data.content.filter((p) => p.type === "text").map((p) => p.text).join("\n")
      : "";
    if (!textParts) throw new VisionExtractionError("A visão não retornou texto de extração.");

    return extractJsonFromText(textParts);
  }

  /* ============================================================
   * CONVERSÃO PARA O CONTRATO COMUM DE EXTRATORES
   * ========================================================== */

  function tokenize(line) {
    return line.split(/\s+/).filter(Boolean);
  }

  function buildExtractorOutput(documento) {
    const rows = [];
    const rawTextParts = [];

    documento.empresas.forEach((empresa) => {
      const linhas = [`Empresa: ${empresa.nome}`, `CNPJ: ${formatCNPJ(empresa.cnpj)}`, `Competencia: ${empresa.competencia}`];
      linhas.forEach((l) => {
        rows.push(tokenize(l));
        rawTextParts.push(l);
      });

      if (empresa.empregados.length) {
        rows.push(["EMPREGADOS"]);
        rawTextParts.push("EMPREGADOS");
        empresa.empregados.forEach((r) => {
          const linha = `${r.codigo} ${r.nome} ${r.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          rows.push(tokenize(linha));
          rawTextParts.push(linha);
        });
      }
      if (empresa.contribuintes.length) {
        rows.push(["CONTRIBUINTES"]);
        rawTextParts.push("CONTRIBUINTES");
        empresa.contribuintes.forEach((r) => {
          const linha = `${r.codigo} ${r.nome} ${r.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          rows.push(tokenize(linha));
          rawTextParts.push(linha);
        });
      }
    });

    return {
      rawText: rawTextParts.join("\n"),
      rows,
      sourceMeta: { tipo: "vision", paginas: documento.totalPaginas },
      avisos: []
    };
  }

  /* ============================================================
   * API PÚBLICA (contrato comum: extract(file, fileType))
   * ========================================================== */

  async function extract(file, fileType) {
    const { blockType, mediaType } = resolveMediaType(file, fileType);
    const documentBase64 = await fileToBase64(file);
    const prompt = buildExtractionPrompt();

    const raw = await callClaudeVision({ documentBase64, mediaType, blockType, prompt });

    const rawPaginas = Array.isArray(raw.paginas) ? raw.paginas : raw.pagina != null ? [raw] : null;
    if (!rawPaginas) {
      throw new VisionExtractionError("A visão não retornou nenhuma página reconhecível.");
    }

    const paginasValidadas = rawPaginas.map(validatePage);
    const documento = validateDocument(paginasValidadas);
    return buildExtractorOutput(documento);
  }

  CF.extractors.vision = {
    configurado: true,
    extract,
    VisionExtractionError,
    // Exposto apenas para testes/depuração — não usar fora deste módulo.
    _internal: { validatePage, validateDocument, buildExtractorOutput, isValidCNPJ, parseBrazilianMoney }
  };
})();
