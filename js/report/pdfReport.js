// Geração do relatório final em PDF (biblioteca global `pdfMake`, carregada via CDN no index.html).
// Estrutura obrigatória: RESUMO GERAL, depois EMPREGADOS (só registros dessa origem),
// depois CONTRIBUINTES (só registros dessa origem) — nunca misturados na mesma tabela.
window.CF = window.CF || {};
CF.report = CF.report || {};

(function () {
  "use strict";

  const SITUACAO_COLOR = {
    "SEM ALTERAÇÃO": "#444444",
    "AUMENTO NA FOLHA": "#1a7a3c",
    "REDUÇÃO NA FOLHA": "#b3261e",
    "NOVO NA FOLHA": "#1a5c9c",
    "NÃO IDENTIFICADO NO MÊS ATUAL": "#8a6d00"
  };

  function money(v) {
    return v == null ? "—" : CF.utils.formatMoneyBR(v);
  }

  function diff(v) {
    if (v == null) return "—";
    const sign = v > 0 ? "+ " : v < 0 ? "- " : "";
    return sign + CF.utils.formatMoneyBR(Math.abs(v));
  }

  // EMPREGADOS mostra "COLABORADORES" na coluna de nome; CONTRIBUINTES mostra
  // "Sócio/Administrador" — mesmo dado (nome da pessoa), rótulo diferente por seção.
  function buildSectionTable(titulo, resultados, resumo) {
    const nomeColuna = titulo === "EMPREGADOS" ? "COLABORADORES" : "Sócio/Administrador";
    const header = [
      { text: "Empresa", style: "th" },
      { text: "CNPJ", style: "th" },
      { text: nomeColuna, style: "th" },
      { text: "Código", style: "th" },
      { text: "Mês anterior", style: "th", alignment: "right" },
      { text: "Mês atual", style: "th", alignment: "right" },
      { text: "Diferença", style: "th", alignment: "right" },
      { text: "Situação", style: "th" }
    ];

    const body = resultados.map((r) => [
      { text: r.empresaNome || "—", fontSize: 8 },
      { text: r.cnpj || "—", fontSize: 8 },
      { text: r.nome || "—", fontSize: 8 },
      { text: r.codigo || "—", fontSize: 8 },
      { text: money(r.valorAnterior), fontSize: 8, alignment: "right" },
      { text: money(r.valorAtual), fontSize: 8, alignment: "right" },
      { text: diff(r.diferenca), fontSize: 8, alignment: "right" },
      { text: r.situacao, fontSize: 8, color: SITUACAO_COLOR[r.situacao] || "#000000", bold: true }
    ]);

    return [
      { text: titulo, style: "h2", margin: [0, 16, 0, 6] },
      resultados.length
        ? {
            table: {
              headerRows: 1,
              widths: ["16%", "13%", "20%", "7%", "11%", "11%", "11%", "*"],
              body: [header, ...body]
            },
            layout: {
              fillColor: (rowIndex) => (rowIndex === 0 ? "#e8f0ed" : rowIndex % 2 === 0 ? "#f7f8f9" : null)
            }
          }
        : { text: "Nenhuma divergência encontrada nesta seção.", italics: true, color: "#666666" },
      {
        text: `RESUMO — ${titulo}`,
        style: "h3",
        margin: [0, 12, 0, 4]
      },
      {
        ul: [
          `Total analisado: ${resumo.totalAnalisado}`,
          `Sem alteração: ${resumo.semAlteracao}`,
          `Aumentos: ${resumo.aumentos}`,
          `Reduções: ${resumo.reducoes}`,
          `Novos: ${resumo.novos}`,
          `Não identificados no mês atual: ${resumo.naoIdentificados}`
        ],
        fontSize: 9
      }
    ];
  }

  function gerarDocDefinition(extracaoAnterior, extracaoAtual, comparacao) {
    const dataAnalise = new Date().toLocaleString("pt-BR");
    const compAnterior = extracaoAnterior.competencia ? extracaoAnterior.competencia.label : "—";
    const compAtual = extracaoAtual.competencia ? extracaoAtual.competencia.label : "—";

    const totalEmpregados = comparacao.empregados.resumo.totalAnalisado;
    const totalContribuintes = comparacao.contribuintes.resumo.totalAnalisado;

    return {
      pageOrientation: "landscape",
      pageMargins: [30, 40, 30, 40],
      content: [
        { text: "RELATÓRIO DE CONFERÊNCIA DE FOLHA", style: "h1" },
        {
          columns: [
            { text: `Competência anterior: ${compAnterior}`, fontSize: 10 },
            { text: `Competência atual: ${compAtual}`, fontSize: 10 },
            { text: `Data da análise: ${dataAnalise}`, fontSize: 10, alignment: "right" }
          ],
          margin: [0, 4, 0, 14]
        },
        { text: "RESUMO GERAL", style: "h2" },
        {
          ul: [
            `Total de registros EMPREGADOS analisados: ${totalEmpregados}`,
            `Total de registros CONTRIBUINTES analisados: ${totalContribuintes}`,
            `Total geral: ${totalEmpregados + totalContribuintes}`
          ],
          margin: [0, 4, 0, 10]
        },
        ...buildSectionTable("EMPREGADOS", comparacao.empregados.divergencias, comparacao.empregados.resumo),
        { text: "", pageBreak: "before" },
        ...buildSectionTable("CONTRIBUINTES", comparacao.contribuintes.divergencias, comparacao.contribuintes.resumo)
      ],
      styles: {
        h1: { fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
        h2: { fontSize: 13, bold: true },
        h3: { fontSize: 11, bold: true },
        th: { bold: true, fontSize: 8.5, color: "#1f2430" }
      },
      defaultStyle: { fontSize: 9 }
    };
  }

  function nomeArquivo(extracaoAnterior, extracaoAtual) {
    const a = extracaoAnterior.competencia ? extracaoAnterior.competencia.label.replace("/", "-") : "SEMDATA";
    const b = extracaoAtual.competencia ? extracaoAtual.competencia.label.replace("/", "-") : "SEMDATA";
    return `Conferencia_Folha_${a}_${b}.pdf`;
  }

  function baixarPdf(extracaoAnterior, extracaoAtual, comparacao) {
    if (typeof pdfMake === "undefined") {
      throw new Error("Biblioteca de geração de PDF (pdfmake) não carregou. Verifique sua conexão com a internet e recarregue a página.");
    }
    const docDefinition = gerarDocDefinition(extracaoAnterior, extracaoAtual, comparacao);
    pdfMake.createPdf(docDefinition).download(nomeArquivo(extracaoAnterior, extracaoAtual));
  }

  // ---- Relatório de 3 meses ----
  const SITUACAO_COLOR_TRES = {
    "SEM ALTERAÇÃO": "#444444",
    "VARIAÇÃO NA FOLHA": "#1a7a3c",
    "NOVO NA FOLHA": "#1a5c9c"
  };

  function buildSectionTableTres(titulo, bloco, labels) {
    const nomeColuna = titulo === "EMPREGADOS" ? "COLABORADORES" : "Sócio/Administrador";
    const header = [
      { text: "Empresa", style: "th" },
      { text: "CNPJ", style: "th" },
      { text: nomeColuna, style: "th" },
      { text: "Código", style: "th" },
      ...labels.map((l) => ({ text: l, style: "th", alignment: "right" })),
      { text: `Dif. ${labels[0]} → ${labels[1]}`, style: "th", alignment: "right" },
      { text: `Dif. ${labels[1]} → ${labels[2]}`, style: "th", alignment: "right" },
      { text: "Situação", style: "th" }
    ];

    const body = bloco.divergencias.map((r) => [
      { text: r.empresaNome || "—", fontSize: 7.5 },
      { text: r.cnpj || "—", fontSize: 7.5 },
      { text: r.nome || "—", fontSize: 7.5 },
      { text: r.codigo || "—", fontSize: 7.5 },
      ...r.valores.map((v) => ({ text: money(v), fontSize: 7.5, alignment: "right" })),
      { text: diff(r.diferenca12), fontSize: 7.5, alignment: "right" },
      { text: diff(r.diferenca23), fontSize: 7.5, alignment: "right" },
      { text: r.situacao, fontSize: 7.5, color: SITUACAO_COLOR_TRES[r.situacao] || "#8a6d00", bold: true }
    ]);

    const resumo = bloco.resumo;
    return [
      { text: titulo, style: "h2", margin: [0, 16, 0, 6] },
      bloco.divergencias.length
        ? {
            table: {
              headerRows: 1,
              widths: ["13%", "11%", "15%", "6%", "8%", "8%", "8%", "8%", "8%", "*"],
              body: [header, ...body]
            },
            layout: {
              fillColor: (rowIndex) => (rowIndex === 0 ? "#e8f0ed" : rowIndex % 2 === 0 ? "#f7f8f9" : null)
            }
          }
        : { text: "Nenhuma divergência encontrada nesta seção.", italics: true, color: "#666666" },
      { text: `RESUMO — ${titulo}`, style: "h3", margin: [0, 12, 0, 4] },
      {
        ul: [
          `Total analisado: ${resumo.totalAnalisado}`,
          `Sem alteração: ${resumo.semAlteracao}`,
          `Variações: ${resumo.variacoes}`,
          `Novos: ${resumo.novos}`,
          `Não identificados no último mês: ${resumo.naoIdentificados}`,
          `Ausentes em mês intermediário: ${resumo.ausentesIntermediario}`
        ],
        fontSize: 9
      }
    ];
  }

  function gerarDocDefinitionTres(extracoes, comparacao) {
    const labels = CF.ui.render.labelsCompetencias(extracoes);
    const totalEmpregados = comparacao.empregados.resumo.totalAnalisado;
    const totalContribuintes = comparacao.contribuintes.resumo.totalAnalisado;

    return {
      pageOrientation: "landscape",
      pageMargins: [30, 40, 30, 40],
      content: [
        { text: "RELATÓRIO DE CONFERÊNCIA DE FOLHA — 3 MESES", style: "h1" },
        {
          columns: [
            { text: `Competências: ${labels.join(" → ")}`, fontSize: 10 },
            { text: `Data da análise: ${new Date().toLocaleString("pt-BR")}`, fontSize: 10, alignment: "right" }
          ],
          margin: [0, 4, 0, 14]
        },
        { text: "RESUMO GERAL", style: "h2" },
        {
          ul: [
            `Total de registros EMPREGADOS analisados: ${totalEmpregados}`,
            `Total de registros CONTRIBUINTES analisados: ${totalContribuintes}`,
            `Total geral: ${totalEmpregados + totalContribuintes}`
          ],
          margin: [0, 4, 0, 10]
        },
        ...buildSectionTableTres("EMPREGADOS", comparacao.empregados, labels),
        { text: "", pageBreak: "before" },
        ...buildSectionTableTres("CONTRIBUINTES", comparacao.contribuintes, labels)
      ],
      styles: {
        h1: { fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
        h2: { fontSize: 13, bold: true },
        h3: { fontSize: 11, bold: true },
        th: { bold: true, fontSize: 8, color: "#1f2430" }
      },
      defaultStyle: { fontSize: 9 }
    };
  }

  function baixarPdfTres(extracoes, comparacao) {
    if (typeof pdfMake === "undefined") {
      throw new Error("Biblioteca de geração de PDF (pdfmake) não carregou. Verifique sua conexão com a internet e recarregue a página.");
    }
    const labels = CF.ui.render.labelsCompetencias(extracoes).map((l) => l.replace("/", "-"));
    pdfMake.createPdf(gerarDocDefinitionTres(extracoes, comparacao)).download(`Conferencia_Folha_3_Meses_${labels.join("_")}.pdf`);
  }

  CF.report.pdfReport = { baixarPdf, gerarDocDefinition, nomeArquivo, baixarPdfTres, gerarDocDefinitionTres };
})();
