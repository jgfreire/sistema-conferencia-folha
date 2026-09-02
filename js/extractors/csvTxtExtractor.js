// Leitura de arquivos CSV e TXT: texto puro, sem dependência externa.
window.CF = window.CF || {};
CF.extractors = CF.extractors || {};

(function () {
  "use strict";

  async function extractCsvTxt(file, tipo) {
    const text = await file.text();
    const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim().length > 0);

    let delim = null;
    if (tipo === "csv") {
      const candidates = [",", ";", "\t"];
      let best = null;
      let bestAvg = 0;
      candidates.forEach((d) => {
        const sample = lines.slice(0, 15);
        if (!sample.length) return;
        const counts = sample.map((l) => l.split(d).length - 1);
        const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
        if (avg > bestAvg) {
          bestAvg = avg;
          best = d;
        }
      });
      if (bestAvg > 0) delim = best;
    }

    const rows = lines.map((line) => {
      let tokens;
      if (delim) {
        tokens = line.split(delim);
      } else {
        tokens = line.split(/\s{2,}|\t/);
        if (tokens.length < 2) tokens = line.split(/\s+/);
      }
      return tokens.map((t) => t.trim()).filter(Boolean);
    });

    return {
      rawText: text,
      rows: rows.filter((r) => r.length),
      sourceMeta: { tipo, linhas: lines.length },
      avisos: []
    };
  }

  CF.extractors.csvTxt = { extractCsvTxt };
})();
