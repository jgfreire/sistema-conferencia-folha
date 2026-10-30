// Lê e normaliza um arquivo de folha (qualquer formato suportado). Compartilhado entre
// a conferência de 2 meses (app.js) e a de 3 meses (tresMeses.js).
window.CF = window.CF || {};

(function () {
  "use strict";

  async function processFile(file) {
    const tipo = CF.fileTypeDetector.detectFileType(file);
    const arquivoMeta = { nome: file.name, tipo };

    if (!tipo) {
      return {
        arquivo: arquivoMeta,
        empresas: [],
        competencia: null,
        totalEmpregados: 0,
        totalContribuintes: 0,
        avisos: [],
        erros: [`Formato de arquivo não suportado: "${file.name}". Envie PDF, XLS, XLSX, CSV, TXT, JPG ou PNG.`]
      };
    }

    let extractorOutput;
    try {
      if (tipo === "pdf") {
        extractorOutput = await CF.extractors.pdf.extractPdf(file);
        if (extractorOutput.precisaVisao) {
          extractorOutput = await CF.extractors.vision.extract(file, tipo);
        }
      } else if (tipo === "xlsx") {
        extractorOutput = await CF.extractors.xlsx.extractXlsx(file);
      } else if (tipo === "csv" || tipo === "txt") {
        extractorOutput = await CF.extractors.csvTxt.extractCsvTxt(file, tipo);
      } else if (tipo === "imagem") {
        extractorOutput = await CF.extractors.vision.extract(file, tipo);
      }
    } catch (err) {
      return {
        arquivo: arquivoMeta,
        empresas: [],
        competencia: null,
        totalEmpregados: 0,
        totalContribuintes: 0,
        avisos: [],
        erros: [`Não foi possível ler o arquivo "${file.name}": ${err.message || err}`]
      };
    }

    return CF.normalize.normalize(extractorOutput, arquivoMeta);
  }

  CF.processFile = processFile;
})();
