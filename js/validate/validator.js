// Validações executadas antes de liberar "REALIZAR CONFERÊNCIA": nunca prosseguir
// silenciosamente com uma leitura incompleta ou insegura.
window.CF = window.CF || {};
CF.validate = CF.validate || {};

(function () {
  "use strict";

  function validarParaConferencia(extracaoAnterior, extracaoAtual) {
    const erros = [];
    const avisos = [];

    erros.push(...extracaoAnterior.erros);
    erros.push(...extracaoAtual.erros);

    if (
      extracaoAnterior.competencia &&
      extracaoAtual.competencia &&
      extracaoAnterior.competencia.label === extracaoAtual.competencia.label
    ) {
      erros.push(
        `Os dois arquivos enviados aparentam ser da mesma competência (${extracaoAnterior.competencia.label}). Envie um arquivo do mês anterior e outro do mês atual.`
      );
    }

    const totalAnterior = extracaoAnterior.totalEmpregados + extracaoAnterior.totalContribuintes;
    const totalAtual = extracaoAtual.totalEmpregados + extracaoAtual.totalContribuintes;
    if (
      extracaoAnterior.empresas.reduce((s, e) => s + e.empregados.length + e.contribuintes.length, 0) !== totalAnterior ||
      extracaoAtual.empresas.reduce((s, e) => s + e.empregados.length + e.contribuintes.length, 0) !== totalAtual
    ) {
      erros.push("Inconsistência interna na contagem de registros. A conferência não pode ser considerada confiável.");
    }

    const cnpjsAnterior = new Set(extracaoAnterior.empresas.map((e) => e.cnpj).filter(Boolean));
    const cnpjsAtual = new Set(extracaoAtual.empresas.map((e) => e.cnpj).filter(Boolean));
    const somenteAnterior = [...cnpjsAnterior].filter((c) => !cnpjsAtual.has(c));
    const somenteAtual = [...cnpjsAtual].filter((c) => !cnpjsAnterior.has(c));
    if (somenteAnterior.length) {
      avisos.push(`Empresa(s) presente(s) apenas no arquivo do mês anterior: ${somenteAnterior.join(", ")}.`);
    }
    if (somenteAtual.length) {
      avisos.push(`Empresa(s) presente(s) apenas no arquivo do mês atual: ${somenteAtual.join(", ")}.`);
    }

    return {
      podeConferir: erros.length === 0,
      erros,
      avisos: [...avisos, ...extracaoAnterior.avisos, ...extracaoAtual.avisos]
    };
  }

  CF.validate.validator = { validarParaConferencia };
})();
