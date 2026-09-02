// Funções de renderização (geram HTML a partir do estado). Não mexem em estado nem fazem I/O.
window.CF = window.CF || {};
CF.ui = CF.ui || {};

(function () {
  "use strict";

  const esc = CF.utils && CF.utils.escapeHtml ? CF.utils.escapeHtml : (s) => s;

  function situacaoClass(situacao) {
    switch (situacao) {
      case "SEM ALTERAÇÃO":
        return "sit-neutra";
      case "AUMENTO NA FOLHA":
        return "sit-aumento";
      case "REDUÇÃO NA FOLHA":
        return "sit-reducao";
      case "NOVO NA FOLHA":
        return "sit-novo";
      case "NÃO IDENTIFICADO NO MÊS ATUAL":
        return "sit-nao-identificado";
      default:
        return "";
    }
  }

  function renderErros(erros) {
    if (!erros || !erros.length) return "";
    return `<div class="alert alert-error">
      <strong>Não é possível prosseguir</strong>
      <ul>${erros.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
    </div>`;
  }

  // Mostrado assim que um arquivo é selecionado: só confirmação/erros bloqueantes.
  // O conteúdo tipo relatório (empresas, CNPJ, contagens por seção) só aparece no resultado
  // da conferência e no PDF final.
  function renderFileCard(extracao) {
    if (!extracao) return "";

    return `
      <div class="file-summary">
        ${!extracao.erros.length ? '<p class="file-summary-ok">Arquivo lido com sucesso.</p>' : ""}
        ${renderErros(extracao.erros)}
      </div>
    `;
  }

  function renderTabelaResultados(resultados, nomeColuna) {
    if (!resultados.length) {
      return `<p class="empty-note">Nenhuma divergência encontrada nesta seção.</p>`;
    }
    const rows = resultados
      .map(
        (r) => `
      <tr>
        <td>${esc(r.empresaNome || "—")}</td>
        <td>${esc(r.cnpj || "—")}</td>
        <td>${esc(r.nome || "—")}</td>
        <td>${esc(r.codigo || "—")}</td>
        <td class="num">${r.valorAnterior == null ? "—" : CF.utils.formatMoneyBR(r.valorAnterior)}</td>
        <td class="num">${r.valorAtual == null ? "—" : CF.utils.formatMoneyBR(r.valorAtual)}</td>
        <td class="num">${r.diferenca == null ? "—" : (r.diferenca > 0 ? "+ " : r.diferenca < 0 ? "- " : "") + CF.utils.formatMoneyBR(Math.abs(r.diferenca))}</td>
        <td><span class="badge ${situacaoClass(r.situacao)}">${esc(r.situacao)}</span></td>
      </tr>`
      )
      .join("");

    return `
      <div class="table-wrap">
        <table class="result-table">
          <thead>
            <tr>
              <th>Empresa</th><th>CNPJ</th><th>${esc(nomeColuna)}</th><th>Código</th>
              <th>Mês anterior</th><th>Mês atual</th><th>Diferença</th><th>Situação</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // EMPREGADOS mostra "COLABORADORES" na coluna de nome; CONTRIBUINTES mostra
  // "Sócio/Administrador" — mesmo dado (nome da pessoa), rótulo diferente por seção.
  function renderResumoBloco(titulo, bloco) {
    const r = bloco.resumo;
    const nomeColuna = titulo === "EMPREGADOS" ? "COLABORADORES" : "Sócio/Administrador";
    return `
      <section class="resultado-bloco">
        <h3>${titulo}</h3>
        <div class="resumo-chips">
          <span class="chip-stat">Total analisado: <strong>${r.totalAnalisado}</strong></span>
          <span class="chip-stat sit-neutra">Sem alteração: <strong>${r.semAlteracao}</strong></span>
          <span class="chip-stat sit-aumento">Aumentos: <strong>${r.aumentos}</strong></span>
          <span class="chip-stat sit-reducao">Reduções: <strong>${r.reducoes}</strong></span>
          <span class="chip-stat sit-novo">Novos: <strong>${r.novos}</strong></span>
          <span class="chip-stat sit-nao-identificado">Não identificados: <strong>${r.naoIdentificados}</strong></span>
        </div>
        ${renderTabelaResultados(bloco.divergencias, nomeColuna)}
      </section>
    `;
  }

  function renderResultado(extracaoAnterior, extracaoAtual, comparacao) {
    return `
      <div class="resultado-header">
        <h2>Resultado da Conferência</h2>
        <p>${extracaoAnterior.competencia ? esc(extracaoAnterior.competencia.label) : "?"} → ${extracaoAtual.competencia ? esc(extracaoAtual.competencia.label) : "?"}</p>
      </div>
      ${renderResumoBloco("EMPREGADOS", comparacao.empregados)}
      ${renderResumoBloco("CONTRIBUINTES", comparacao.contribuintes)}
    `;
  }

  CF.ui.render = {
    renderFileCard,
    renderErros,
    renderResultado
  };
})();
