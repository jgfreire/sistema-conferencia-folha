// Detecta o tipo lógico de um arquivo pela extensão.
window.CF = window.CF || {};

(function () {
  "use strict";

  const EXT_MAP = {
    pdf: "pdf",
    xls: "xlsx",
    xlsx: "xlsx",
    csv: "csv",
    txt: "txt",
    jpg: "imagem",
    jpeg: "imagem",
    png: "imagem"
  };

  function detectFileType(file) {
    const name = (file && file.name || "").toLowerCase();
    const ext = name.includes(".") ? name.split(".").pop() : "";
    return EXT_MAP[ext] || null;
  }

  CF.fileTypeDetector = { detectFileType };
})();
