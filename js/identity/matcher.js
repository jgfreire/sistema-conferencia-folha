// Constrói a chave de identidade de um registro: CNPJ da empresa + código da pessoa
// (preferencial); se o código não existir, usa o nome normalizado como alternativa.
window.CF = window.CF || {};
CF.identity = CF.identity || {};

(function () {
  "use strict";

  function buildRecordKey(rec) {
    const cnpjPart = rec.cnpj ? rec.cnpj.replace(/\D/g, "") : "SEMCNPJ";
    if (rec.codigo) return cnpjPart + "|COD:" + String(rec.codigo).trim().toUpperCase();
    return cnpjPart + "|NOME:" + CF.utils.normalizeName(rec.nome);
  }

  CF.identity.matcher = { buildRecordKey };
})();
