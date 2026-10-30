// Orquestração da aplicação: upload -> extração -> prévia -> conferência -> resultado -> PDF.
(function () {
  "use strict";

  const state = {
    arquivos: { anterior: null, atual: null },
    extracoes: { anterior: null, atual: null },
    comparacao: null
  };

  const els = {
    inputAnterior: document.getElementById("input-anterior"),
    inputAtual: document.getElementById("input-atual"),
    slotAnterior: document.getElementById("slot-anterior"),
    slotAtual: document.getElementById("slot-atual"),
    btnConferir: document.getElementById("btn-conferir"),
    blockingErrors: document.getElementById("blocking-errors"),
    uploadScreen: document.getElementById("upload-screen"),
    resultScreen: document.getElementById("result-screen"),
    resultContent: document.getElementById("result-content"),
    btnBaixarPdf: document.getElementById("btn-baixar-pdf"),
    btnNovaConferencia: document.getElementById("btn-nova-conferencia"),
    pdfDownloadArea: document.getElementById("pdf-download-area")
  };

  // Fire-and-forget: só alimenta o Dashboard/Logs administrativos, nunca bloqueia o fluxo
  // do colaborador mesmo se a chamada falhar.
  function logActivity(event) {
    fetch("/api/activity/log", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event })
    }).catch(() => {});
  }

  const processFile = CF.processFile;

  function setSlotStatus(slotEl, text, kind) {
    const statusEl = slotEl.querySelector(".slot-status");
    statusEl.textContent = text;
    statusEl.className = "slot-status" + (kind ? " " + kind : "");
  }

  async function handleFileInput(which, file) {
    const slotEl = which === "anterior" ? els.slotAnterior : els.slotAtual;
    const resultAreaEl = slotEl.querySelector(".slot-result");

    state.arquivos[which] = file;
    state.extracoes[which] = null;
    resultAreaEl.innerHTML = "";
    setSlotStatus(slotEl, `Lendo "${file.name}"...`, "loading");

    const extracao = await processFile(file);
    state.extracoes[which] = extracao;

    setSlotStatus(slotEl, file.name, extracao.erros.length ? "error" : "ok");
    resultAreaEl.innerHTML = CF.ui.render.renderFileCard(extracao);

    updatePreviaEConferir();
  }

  function updatePreviaEConferir() {
    const { anterior, atual } = state.extracoes;
    if (!anterior || !atual) {
      els.btnConferir.disabled = true;
      els.blockingErrors.innerHTML = "";
      return;
    }

    const validacao = CF.validate.validator.validarParaConferencia(anterior, atual);
    els.blockingErrors.innerHTML = CF.ui.render.renderErros(validacao.erros);
    els.btnConferir.disabled = !validacao.podeConferir;
  }

  function realizarConferencia() {
    const { anterior, atual } = state.extracoes;
    state.comparacao = CF.compare.engine.comparar(anterior, atual);

    els.uploadScreen.classList.add("hidden");
    els.resultScreen.classList.remove("hidden");
    els.resultContent.innerHTML = CF.ui.render.renderResultado(anterior, atual, state.comparacao);
    els.pdfDownloadArea.innerHTML = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
    logActivity("ANALISE_EXECUTADA");
  }

  function baixarPdf() {
    try {
      CF.report.pdfReport.baixarPdf(state.extracoes.anterior, state.extracoes.atual, state.comparacao);
      logActivity("RELATORIO_GERADO");
    } catch (err) {
      els.pdfDownloadArea.innerHTML = `<div class="alert alert-error">${CF.utils.escapeHtml(err.message || String(err))}</div>`;
    }
  }

  function novaConferencia() {
    state.arquivos = { anterior: null, atual: null };
    state.extracoes = { anterior: null, atual: null };
    state.comparacao = null;

    [els.slotAnterior, els.slotAtual].forEach((slotEl) => {
      slotEl.querySelector(".slot-result").innerHTML = "";
      setSlotStatus(slotEl, "Nenhum arquivo selecionado", "");
    });
    els.inputAnterior.value = "";
    els.inputAtual.value = "";
    els.blockingErrors.innerHTML = "";
    els.btnConferir.disabled = true;

    els.resultScreen.classList.add("hidden");
    els.uploadScreen.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  els.inputAnterior.addEventListener("change", (e) => {
    if (e.target.files[0]) handleFileInput("anterior", e.target.files[0]);
  });
  els.inputAtual.addEventListener("change", (e) => {
    if (e.target.files[0]) handleFileInput("atual", e.target.files[0]);
  });
  els.btnConferir.addEventListener("click", realizarConferencia);
  els.btnBaixarPdf.addEventListener("click", baixarPdf);
  els.btnNovaConferencia.addEventListener("click", novaConferencia);

  [els.slotAnterior, els.slotAtual].forEach((slotEl) => {
    const which = slotEl.dataset.slot;
    const input = which === "anterior" ? els.inputAnterior : els.inputAtual;
    slotEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      slotEl.classList.add("dragover");
    });
    slotEl.addEventListener("dragleave", () => slotEl.classList.remove("dragover"));
    slotEl.addEventListener("drop", (e) => {
      e.preventDefault();
      slotEl.classList.remove("dragover");
      if (e.dataTransfer.files[0]) handleFileInput(which, e.dataTransfer.files[0]);
    });
  });
})();
