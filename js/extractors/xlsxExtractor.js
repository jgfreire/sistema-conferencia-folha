// Leitura de arquivos XLS/XLSX via SheetJS (biblioteca global `XLSX`, carregada via CDN no index.html).
window.CF = window.CF || {};
CF.extractors = CF.extractors || {};

(function () {
  "use strict";

  async function extractXlsx(file) {
    if (typeof XLSX === "undefined") {
      throw new Error("Biblioteca de leitura de planilhas (SheetJS) não carregou. Verifique sua conexão com a internet e recarregue a página.");
    }
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });

    const rows = [];
    const rawTextParts = [];

    wb.SheetNames.forEach((sheetName) => {
      const sheet = wb.Sheets[sheetName];
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
      aoa.forEach((r) => {
        const tokens = r.map((c) => String(c == null ? "" : c).trim()).filter(Boolean);
        if (tokens.length) {
          rows.push(tokens);
          rawTextParts.push(tokens.join(" "));
        }
      });
    });

    return {
      rawText: rawTextParts.join("\n"),
      rows,
      sourceMeta: { tipo: "xlsx", planilhas: wb.SheetNames.length },
      avisos: []
    };
  }

  CF.extractors.xlsx = { extractXlsx };
})();
