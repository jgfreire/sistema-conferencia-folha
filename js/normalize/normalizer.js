// Orquestra a normalização de um arquivo já lido por um extrator: segmenta por empresa (CNPJ),
// localiza EMPREGADOS/CONTRIBUINTES dentro de cada empresa e monta o resultado final do arquivo.
// Um arquivo pode conter mais de uma empresa (relatório consolidado do escritório).
window.CF = window.CF || {};
CF.normalize = CF.normalize || {};

(function () {
  "use strict";

  // Cada empresa nova costuma começar com uma linha "Empresa: ..." seguida, poucas linhas
  // depois, do CNPJ. Marcar o início do bloco na linha "Empresa:" (não no CNPJ) evita que o
  // fim do bloco da empresa ANTERIOR "vaze" para dentro do cabeçalho da próxima empresa —
  // que é exatamente o que causava linhas como "Empresa: OUTRA LTDA Página: 2 / 31" sendo
  // reportadas como "não reconhecidas" na seção da empresa errada.
  // Algumas "empresas" no relatório real são pessoa física (autônomo/MEI), identificadas por
  // CPF em vez de CNPJ — mesma estrutura visual, só troca o rótulo. O CPF só é aceito quando a
  // linha está explicitamente rotulada "CPF:" (ao contrário do CNPJ, que é mais distintivo e
  // seguro de reconhecer sem exigir o rótulo).
  function findIdentifierNear(rows, startIdx) {
    for (let j = startIdx; j < Math.min(rows.length, startIdx + 6); j++) {
      const line = rows[j].join(" ");
      const cnpj = CF.utils.findCNPJ(line);
      if (cnpj) return cnpj;
      if (/^CPF\s*:/i.test(line)) {
        const cpf = CF.utils.findCPF(line);
        if (cpf) return cpf;
      }
    }
    return null;
  }

  function findEmpresaLabelStarts(rows) {
    const starts = [];
    rows.forEach((row, i) => {
      if (/^Empresa\s*:/i.test(row.join(" "))) {
        const cnpj = findIdentifierNear(rows, i);
        if (cnpj) starts.push({ i, cnpj });
      }
    });
    return starts;
  }

  function findCompanyBlocks(rows) {
    let hits = findEmpresaLabelStarts(rows);
    if (!hits.length) {
      rows.forEach((row, i) => {
        const cnpj = CF.utils.findCNPJ(row.join(" "));
        if (cnpj) hits.push({ i, cnpj });
      });
    }
    if (!hits.length) return null;

    const blocksRaw = hits.map((h, k) => ({
      cnpj: h.cnpj,
      headerRowIdx: h.i,
      startRow: h.i,
      endRow: k + 1 < hits.length ? hits[k + 1].i : rows.length
    }));

    // Junta blocos consecutivos do mesmo CNPJ (ex.: CNPJ repetido em cabeçalho de cada página).
    const merged = [];
    blocksRaw.forEach((b) => {
      const last = merged[merged.length - 1];
      if (last && last.cnpj === b.cnpj) {
        last.endRow = b.endRow;
      } else {
        merged.push(Object.assign({}, b));
      }
    });

    return merged.map((b) => Object.assign({}, b, { rows: rows.slice(b.startRow, b.endRow) }));
  }

  const NON_NAME_LABEL_RE = /^(competencia|competência|referencia|referência|periodo|período|data|pagina|página|relatorio|relatório|total|totais|resumo)\b/i;

  function extractEmpresaLabel(line) {
    const m = line.match(/(?:raz[aã]o\s*social|empresa)[:\s]+(.+)$/i);
    return m ? m[1].trim() : null;
  }

  // Olha para trás a partir da linha do CNPJ, mas para assim que cruzar um marcador de seção
  // (EMPREGADOS/CONTRIBUINTES/etc.) ou o CNPJ de outra empresa — sinal de que já entrou no
  // bloco da empresa anterior.
  function guessRazaoSocial(rows, headerRowIdx, cnpj) {
    const candidates = [];
    for (let i = headerRowIdx; i >= Math.max(0, headerRowIdx - 5); i--) {
      const row = rows[i];
      if (!row) continue;
      if (i !== headerRowIdx) {
        if (CF.normalize.genericScanner.isBoundaryLine(row)) break;
        const otherCnpj = CF.utils.findCNPJ(row.join(" "));
        if (otherCnpj && otherCnpj !== cnpj) break;
      }
      candidates.push(row.join(" "));
    }

    for (const line of candidates) {
      const label = extractEmpresaLabel(line.replace(cnpj, "").replace(/CNPJ[:\s]*[\d./\-]*/i, ""));
      if (label && label.length >= 3) return label;
    }

    for (const line of candidates) {
      const cleaned = line
        .replace(cnpj, "")
        .replace(/CNPJ[:\s]*[\d./\-]*/i, "")
        .replace(/^[\s:\-–]+|[\s:\-–]+$/g, "")
        .trim();
      if (!cleaned || cleaned.length < 3) continue;
      if (NON_NAME_LABEL_RE.test(cleaned)) continue;
      if (!/[A-Za-zÀ-ÿ]{3,}/.test(cleaned)) continue;
      return cleaned;
    }
    return null;
  }

  // Decide se vale a pena avisar sobre uma seção com 0 registros extraídos, usando o resumo
  // ("Empregados: N") como fonte de certeza quando ele existe:
  //  - resumo bate com o extraído (inclusive 0 = 0) → confirmado correto, sem aviso;
  //  - resumo diverge do extraído → falha de leitura confirmada, aviso com os dois números;
  //  - sem resumo disponível → não há como ter certeza; mantém o aviso cauteloso de antes.
  function checarSecaoVazia(nomeSecao, scan, esperadoPeloResumo, empresaLabel, avisos) {
    if (!scan.encontrada) return;
    const extraido = scan.registros.length;

    if (esperadoPeloResumo != null) {
      if (esperadoPeloResumo !== extraido) {
        avisos.push(
          `Empresa ${empresaLabel}: o resumo da empresa indica ${esperadoPeloResumo} registro(s) em ${nomeSecao}, mas apenas ${extraido} foram extraídos. A conferência não pode ser considerada confiável para esta empresa.`
        );
      }
      return;
    }

    if (extraido === 0) {
      avisos.push(
        `Empresa ${empresaLabel}: foi identificada a seção ${nomeSecao}, porém nenhum registro foi extraído (sem resumo da empresa para confirmar se a seção é realmente vazia). A conferência não pode ser considerada confiável para esta empresa.`
      );
    }
  }

  function normalize(extractorOutput, arquivoMeta) {
    const avisos = (extractorOutput.avisos || []).slice();
    const erros = [];

    if (extractorOutput.precisaVisao) {
      erros.push(
        "Este arquivo parece ser uma digitalização (sem texto selecionável). A leitura deste tipo de arquivo depende de OCR, que ainda não está configurado neste sistema."
      );
      return {
        arquivo: arquivoMeta,
        empresas: [],
        competencia: null,
        totalEmpregados: 0,
        totalContribuintes: 0,
        avisos,
        erros
      };
    }

    const rows = extractorOutput.rows || [];
    const competencia = CF.utils.findCompetencia(extractorOutput.rawText || "");
    if (competencia && competencia.confianca === "baixa") {
      avisos.push(
        `A competência (${competencia.label}) foi identificada por um padrão genérico no texto, não por um rótulo explícito ("Competência:"). Confira manualmente.`
      );
    }

    let companyBlocks = findCompanyBlocks(rows);
    if (!companyBlocks) {
      companyBlocks = [{ cnpj: null, headerRowIdx: 0, rows }];
    }

    const empresas = [];

    companyBlocks.forEach((block) => {
      const cnpj = block.cnpj;
      const razaoSocial = cnpj ? guessRazaoSocial(rows, block.headerRowIdx, cnpj) : null;
      const empresaLabel = razaoSocial || cnpj || "(empresa não identificada)";

      const empScan = CF.normalize.genericScanner.scanEmpregados(block.rows);
      const contScan = CF.normalize.genericScanner.scanContribuintes(block.rows);
      const resumo = CF.normalize.genericScanner.parseResumoCounts(block.rows);

      // Nem toda empresa tem as duas seções — isso é normal e não gera aviso algum (ver
      // `secaoEmpregadosEncontrada`/`secaoContribuintesEncontrada`, que ficam simplesmente false).
      // Só avisamos quando o sistema tem alguma indicação concreta de que faltou extrair dado que
      // realmente existe: ou o cabeçalho da seção foi encontrado mas nada foi extraído dela, ou o
      // resumo da própria empresa (linha "Empregados: N"/"Contribuintes: N") diverge da contagem
      // extraída — este segundo caso é a fonte de certeza que confirma (ou descarta) o primeiro.
      checarSecaoVazia("EMPREGADOS", empScan, resumo.empregados, empresaLabel, avisos);
      checarSecaoVazia("CONTRIBUINTES", contScan, resumo.contribuintes, empresaLabel, avisos);
      empScan.linhasNaoReconhecidas.forEach((l) =>
        avisos.push(`Linha não identificada com segurança na seção EMPREGADOS (${empresaLabel}): "${l}"`)
      );
      contScan.linhasNaoReconhecidas.forEach((l) =>
        avisos.push(`Linha não identificada com segurança na seção CONTRIBUINTES (${empresaLabel}): "${l}"`)
      );

      const tag = (rec, origem) =>
        Object.assign({}, rec, { cnpj, empresaNome: razaoSocial, origem, tipo: "PRO_LABORE" });

      empresas.push({
        cnpj,
        razaoSocial,
        empregados: empScan.registros.map((r) => tag(r, "EMPREGADOS")),
        contribuintes: contScan.registros.map((r) => tag(r, "CONTRIBUINTES")),
        secaoEmpregadosEncontrada: empScan.encontrada,
        secaoContribuintesEncontrada: contScan.encontrada
      });
    });

    if (!empresas.some((e) => e.cnpj)) {
      erros.push("Não foi possível identificar o CNPJ de nenhuma empresa neste arquivo.");
    }
    if (!competencia) {
      erros.push("Não foi possível identificar a competência (mês/ano) deste arquivo.");
    }

    const totalEmpregados = empresas.reduce((s, e) => s + e.empregados.length, 0);
    const totalContribuintes = empresas.reduce((s, e) => s + e.contribuintes.length, 0);

    if (totalEmpregados + totalContribuintes === 0) {
      erros.push("Nenhum registro de EMPREGADOS ou CONTRIBUINTES foi encontrado neste arquivo.");
    }

    return {
      arquivo: arquivoMeta,
      empresas,
      competencia,
      totalEmpregados,
      totalContribuintes,
      avisos,
      erros
    };
  }

  CF.normalize.normalize = normalize;
})();
