// Leitura de arquivos PDF via PDF.js (biblioteca global `pdfjsLib`, carregada via CDN no index.html).
// Reconstrói linhas/colunas a partir da posição dos itens de texto na página.
window.CF = window.CF || {};
CF.extractors = CF.extractors || {};

(function () {
  "use strict";

  const Y_TOLERANCE = 3;

  function groupTextItemsIntoRows(items) {
    const sorted = items
      .filter((it) => it.str && it.str.trim())
      .slice()
      .sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);

    const rows = [];
    let currentY = null;
    let current = [];

    sorted.forEach((it) => {
      const y = it.transform[5];
      if (currentY === null || Math.abs(y - currentY) <= Y_TOLERANCE) {
        current.push(it);
        if (currentY === null) currentY = y;
      } else {
        if (current.length) rows.push(finalizeRow(current));
        current = [it];
        currentY = y;
      }
    });
    if (current.length) rows.push(finalizeRow(current));
    return rows;
  }

  function finalizeRow(items) {
    items.sort((a, b) => a.transform[4] - b.transform[4]);
    const tokens = [];
    items.forEach((it) => {
      String(it.str).split(/\s+/).filter(Boolean).forEach((tok) => tokens.push(tok));
    });
    return tokens;
  }

  async function extractPdf(file) {
    if (typeof pdfjsLib === "undefined") {
      throw new Error("Biblioteca de leitura de PDF (PDF.js) não carregou. Verifique sua conexão com a internet e recarregue a página.");
    }
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

    const allRows = [];
    const rawTextParts = [];
    let totalChars = 0;
    const numPages = pdf.numPages;

    for (let p = 1; p <= numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      totalChars += content.items.reduce((s, it) => s + (it.str ? it.str.length : 0), 0);
      const rows = groupTextItemsIntoRows(content.items);
      rows.forEach((r) => allRows.push(r));
      rawTextParts.push(rows.map((r) => r.join(" ")).join("\n"));
    }

    const avgCharsPerPage = totalChars / Math.max(numPages, 1);
    const provavelmenteDigitalizado = avgCharsPerPage < CF.config.minTextCharsPerPageThreshold;

    const avisos = [];
    if (provavelmenteDigitalizado) {
      avisos.push(
        "O PDF parece ser digitalizado (poucas ou nenhuma camada de texto selecionável). A leitura deste tipo de arquivo depende de OCR."
      );
    }
    if (numPages > CF.config.maxPdfPagesForImages) {
      avisos.push(`O PDF tem ${numPages} páginas; todas foram lidas, mas confira o resultado com atenção em documentos muito longos.`);
    }

    return {
      rawText: rawTextParts.join("\n"),
      rows: allRows,
      sourceMeta: { tipo: "pdf", paginas: numPages, provavelmenteDigitalizado },
      avisos,
      precisaVisao: provavelmenteDigitalizado
    };
  }

  CF.extractors.pdf = { extractPdf };
})();
