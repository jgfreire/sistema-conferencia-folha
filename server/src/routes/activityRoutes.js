// Endpoint leve para o app operacional avisar o backend quando uma conferência é realizada
// ou um PDF é baixado, só para alimentar o Dashboard/Logs administrativos — não participa da
// lógica de análise/comparação/PDF em si (que continua 100% no frontend, inalterada).
"use strict";

const express = require("express");
const { logEvent } = require("../utils/logger");

const ALLOWED_EVENTS = new Set(["ANALISE_EXECUTADA", "RELATORIO_GERADO"]);

const router = express.Router();

router.post("/log", (req, res) => {
  const { event } = req.body || {};
  if (!ALLOWED_EVENTS.has(event)) {
    return res.status(400).json({ error: "Evento inválido." });
  }
  logEvent(event, { username: req.session.user.username });
  res.json({ ok: true });
});

module.exports = router;
