// Orquestração da página de conferência de 3 meses: upload -> extração -> conferência -> resultado -> PDF.
(function () {
  "use strict";

  const SLOTS = [0, 1, 2];

  const state = {
    extracoes: [null, null, null],
    comparacao: null
  };

  const els = {
    inputs: SLOTS.map((i) => document.getElementById(`input-${i}`)),
    slots: SLOTS.map((i) => document.getElementById(`slot-${i}`)),
    btnConferir: document.getElementById("btn-conferir"),
    blockingErrors: document.getElementById("blocking-errors"),
    uploadScreen: document.getElementById("upload-screen"),
    resultScreen: document.getElementById("result-screen"),
    resultContent: document.getElementById("result-content"),
    btnBaixarPdf: document.getElementById("btn-baixar-pdf"),
    btnNovaConferencia: document.getElementById("btn-nova-conferencia"),
    pdfDownloadArea: document.getElementById("pdf-download-area")
  };

  // Fire-and-forget: só alimenta o Dashboard/Logs administrativos.
  function logActivity(event) {
    fetch("/api/activity/log", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event })
    }).catch(() => {});
  }

  function setSlotStatus(slotEl, text, kind) {
    const statusEl = slotEl.querySelector(".slot-status");
    statusEl.textContent = text;
    statusEl.className = "slot-status" + (kind ? " " + kind : "");
  }

  async function handleFileInput(index, file) {
    const slotEl = els.slots[index];
    const resultAreaEl = slotEl.querySelector(".slot-result");

    state.extracoes[index] = null;
    resultAreaEl.innerHTML = "";
    setSlotStatus(slotEl, `Lendo "${file.name}"...`, "loading");
    updateConferir();

    const extracao = await CF.processFile(file);
    state.extracoes[index] = extracao;

    setSlotStatus(slotEl, file.name, extracao.erros.length ? "error" : "ok");
    resultAreaEl.innerHTML = CF.ui.render.renderFileCard(extracao);

    updateConferir();
  }

  function updateConferir() {
    if (state.extracoes.some((e) => !e)) {
      els.btnConferir.disabled = true;
      els.blockingErrors.innerHTML = "";
      return;
    }

    const validacao = CF.validate.validator.validarParaConferenciaTres(state.extracoes);
    els.blockingErrors.innerHTML = CF.ui.render.renderErros(validacao.erros);
    els.btnConferir.disabled = !validacao.podeConferir;
  }

  function realizarConferencia() {
    state.comparacao = CF.compare.engine.compararTresMeses(state.extracoes);

    els.uploadScreen.classList.add("hidden");
    els.resultScreen.classList.remove("hidden");
    els.resultContent.innerHTML = CF.ui.render.renderResultadoTres(state.extracoes, state.comparacao);
    els.pdfDownloadArea.innerHTML = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
    logActivity("ANALISE_EXECUTADA");
  }

  function baixarPdf() {
    try {
      CF.report.pdfReport.baixarPdfTres(state.extracoes, state.comparacao);
      logActivity("RELATORIO_GERADO");
    } catch (err) {
      els.pdfDownloadArea.innerHTML = `<div class="alert alert-error">${CF.utils.escapeHtml(err.message || String(err))}</div>`;
    }
  }

  function novaConferencia() {
    state.extracoes = [null, null, null];
    state.comparacao = null;

    els.slots.forEach((slotEl) => {
      slotEl.querySelector(".slot-result").innerHTML = "";
      setSlotStatus(slotEl, "Nenhum arquivo selecionado", "");
    });
    els.inputs.forEach((input) => (input.value = ""));
    els.blockingErrors.innerHTML = "";
    els.btnConferir.disabled = true;

    els.resultScreen.classList.add("hidden");
    els.uploadScreen.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  SLOTS.forEach((i) => {
    els.inputs[i].addEventListener("change", (e) => {
      if (e.target.files[0]) handleFileInput(i, e.target.files[0]);
    });

    const slotEl = els.slots[i];
    slotEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      slotEl.classList.add("dragover");
    });
    slotEl.addEventListener("dragleave", () => slotEl.classList.remove("dragover"));
    slotEl.addEventListener("drop", (e) => {
      e.preventDefault();
      slotEl.classList.remove("dragover");
      if (e.dataTransfer.files[0]) handleFileInput(i, e.dataTransfer.files[0]);
    });
  });

  els.btnConferir.addEventListener("click", realizarConferencia);
  els.btnBaixarPdf.addEventListener("click", baixarPdf);
  els.btnNovaConferencia.addEventListener("click", novaConferencia);
})();
