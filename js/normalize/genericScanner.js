// Localiza as seções EMPREGADOS e CONTRIBUINTES dentro de um conjunto de linhas (rows) e
// extrai os registros (código, nome, valor) de cada uma. Funciona sobre o formato comum
// { rows: string[][] } produzido por qualquer extrator (PDF, planilha, CSV/TXT, ou futuramente OCR) —
// a lógica de negócio abaixo não sabe nem precisa saber de onde vieram as linhas.
window.CF = window.CF || {};
CF.normalize = CF.normalize || {};

(function () {
  "use strict";

  const SECTION_KEYWORDS = {
    empregados: ["EMPREGADO"],
    contribuintes: ["CONTRIBUINTE"]
  };
  // Palavras usadas apenas para delimitar o FIM de um bloco EMPREGADOS/CONTRIBUINTES
  // (ex.: a seção termina quando aparece "ESTAGIÁRIOS" ou um "TOTAL"). O sistema não
  // extrai nem classifica o conteúdo dessas outras seções.
  const OTHER_BOUNDARY_KEYWORDS = ["ESTAGIARIO", "TOTAL GERAL", "TOTAIS", "RESUMO", "AUTONOMO"];

  function normLine(tokens) {
    return CF.utils.stripAccents(tokens.join(" ").toUpperCase());
  }

  // Cabeçalho de seção é só a palavra ("EMPREGADOS", "CONTRIBUINTES"), sem número junto.
  // Isso evita confundir com a linha de RESUMO ("Empregados: 8"), que tem o mesmo texto
  // mas é uma contagem, não o início da seção.
  function isHeaderRow(tokens, keywords) {
    if (!tokens.length || tokens.length > 6) return false;
    const line = normLine(tokens);
    if (/\d/.test(line)) return false;
    return keywords.some((k) => line.includes(k));
  }

  // Textos administrativos/rodapé que aparecem em quebras de página de relatórios reais
  // (ex.: "ANAPOLIS, 27/08/2026", "Responsável:", "Página: 2 / 31", cabeçalho de empresa
  // repetido). Nunca são registros — nem devem ser tratados como "linha não reconhecida".
  function isBoilerplateRow(tokens) {
    if (!tokens.length) return false;
    const line = normLine(tokens);
    if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(line)) return true;
    if (line.includes("RESPONSAVEL")) return true;
    if (line.includes("LICENCIADO")) return true;
    if (line.includes("PAGINA")) return true;
    if (/^EMPRESA\s*:/.test(line)) return true;
    if (/^CNPJ\s*:/.test(line)) return true;
    if (/^CPF\s*:/.test(line)) return true;
    if (/^COMPETENCIA\s*:/.test(line)) return true;
    if (/^CALCULO\s*:/.test(line)) return true;
    // Linha de resumo por empresa: no relatório real, "Empregados: 8 Estagiários: 0
    // Contribuintes: 2 Total da Empresa: 19.937,89" vem tudo numa linha só (mais de 6
    // tokens) — sem esta checagem específica, ela escapa do corte por tamanho abaixo e
    // acaba sendo lida como se fosse mais um registro (o valor total virando "valor de
    // uma pessoa").
    if (line.includes("TOTAL DA EMPRESA")) return true;
    return false;
  }

  function isAnyBoundaryRow(tokens) {
    if (!tokens.length) return false;
    if (isBoilerplateRow(tokens)) return true;
    if (tokens.length > 6) return false;
    const line = normLine(tokens);
    return (
      SECTION_KEYWORDS.empregados.some((k) => line.includes(k)) ||
      SECTION_KEYWORDS.contribuintes.some((k) => line.includes(k)) ||
      OTHER_BOUNDARY_KEYWORDS.some((k) => line.includes(k))
    );
  }

  function findAllHeaderIdx(rows, keywords) {
    const idxs = [];
    rows.forEach((row, i) => {
      if (isHeaderRow(row, keywords)) idxs.push(i);
    });
    return idxs;
  }

  function extractBlock(rows, startIdx) {
    let end = rows.length;
    for (let i = startIdx + 1; i < rows.length; i++) {
      if (isAnyBoundaryRow(rows[i])) {
        end = i;
        break;
      }
    }
    return rows.slice(startIdx + 1, end);
  }

  function parseRecordFromRow(tokens) {
    if (!tokens.length) return null;

    let valorIdx = -1;
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (CF.utils.looksLikeMoney(tokens[i])) {
        valorIdx = i;
        break;
      }
    }
    if (valorIdx === -1) return null;

    const valorTexto = tokens[valorIdx];
    const valor = CF.utils.parseMoneyBR(valorTexto);
    if (valor == null) return null;

    let rest = tokens.slice(0, valorIdx);
    let codigo = null;
    if (rest.length && /^\d{1,6}$/.test(rest[0])) {
      codigo = rest[0];
      rest = rest.slice(1);
    }

    // Descarta símbolos de moeda soltos (ex.: "R$" como token separado antes do valor),
    // que de outra forma seriam incluídos no nome por conterem uma letra ("R").
    const nomeTokens = rest.filter((t) => /[A-Za-zÀ-ÿ]/.test(t) && !/^R\$$/i.test(t));
    const nome = nomeTokens.join(" ").trim();
    if (!nome) return null;

    return { codigo, nome, valorTexto, valor, linhaOriginal: tokens.join(" ") };
  }

  function scanSection(rows, keywords) {
    const headerIdxs = findAllHeaderIdx(rows, keywords);
    if (!headerIdxs.length) {
      return { encontrada: false, registros: [], linhasNaoReconhecidas: [] };
    }

    const registros = [];
    const linhasNaoReconhecidas = [];

    headerIdxs.forEach((idx) => {
      const block = extractBlock(rows, idx);
      block.forEach((row) => {
        const rec = parseRecordFromRow(row);
        if (rec) {
          registros.push(rec);
        } else if (!isBoilerplateRow(row) && row.some((t) => /\d/.test(t))) {
          // linha com dígitos que não foi possível interpretar com segurança: nunca inventar, apenas avisar.
          linhasNaoReconhecidas.push(row.join(" "));
        }
      });
    });

    return { encontrada: true, registros, linhasNaoReconhecidas };
  }

  // Lê a linha de resumo por empresa. No relatório real ela vem tudo numa linha só:
  // "Empregados: 8 Estagiários: 0 Contribuintes: 2 Total da Empresa: 19.937,89" — por isso
  // primeiro localizamos ESSA linha específica (âncora: "total da empresa", que não aparece
  // em nenhum outro lugar do relatório) e só então extraímos os números de dentro dela. Nunca
  // procurar os rótulos soltos no documento inteiro: "Contribuintes" (cabeçalho da seção,
  // sem número) seguido futuramente por um código de registro poderia ser lido por engano
  // como se fosse a contagem do resumo.
  const RESUMO_FIELD_RE = {
    empregados: /empregados\s*:?\s*(\d+)/,
    contribuintes: /contribuintes\s*:?\s*(\d+)/,
    estagiarios: /estagiarios\s*:?\s*(\d+)/
  };

  function parseResumoCounts(rows) {
    const resumo = { empregados: null, contribuintes: null, estagiarios: null };
    const resumoRow = rows.find((row) => normLine(row).includes("TOTAL DA EMPRESA"));
    if (!resumoRow) return resumo;

    const line = CF.utils.stripAccents(resumoRow.join(" ").toLowerCase());
    Object.keys(RESUMO_FIELD_RE).forEach((campo) => {
      const m = line.match(RESUMO_FIELD_RE[campo]);
      if (m) resumo[campo] = parseInt(m[1], 10);
    });
    return resumo;
  }

  CF.normalize.genericScanner = {
    scanEmpregados(rows) {
      return scanSection(rows, SECTION_KEYWORDS.empregados);
    },
    scanContribuintes(rows) {
      return scanSection(rows, SECTION_KEYWORDS.contribuintes);
    },
    isBoundaryLine: isAnyBoundaryRow,
    parseResumoCounts
  };
})();
