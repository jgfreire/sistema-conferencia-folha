// Proxy para a API da Anthropic: recebe do frontend exatamente o corpo que antes ia direto
// pro navegador do usuário (model/max_tokens/system/messages, já montados pelo
// js/extractors/visionExtractor.js — essa lógica de prompt/validação NÃO mudou), adiciona a
// chave (que só este processo conhece) e repassa a resposta. A chave nunca trafega até o
// navegador em nenhuma direção.
"use strict";

const env = require("../config/env");

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

async function extract(req, res) {
  if (!env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: 'Leitura de fotos/PDFs digitalizados não está configurada neste servidor (ANTHROPIC_API_KEY ausente).'
    });
  }

  const { model, max_tokens, temperature, system, messages } = req.body || {};
  if (!model || !messages) {
    return res.status(400).json({ error: "Requisição inválida." });
  }

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION
      },
      body: JSON.stringify({ model, max_tokens, temperature, system, messages })
    });

    const data = await response.json();
    if (!response.ok) {
      const message = (data && data.error && data.error.message) || `HTTP ${response.status}`;
      return res.status(502).json({ error: `Erro na API da Anthropic: ${message}` });
    }
    res.json(data);
  } catch (err) {
    console.error("[vision] Falha ao chamar a API da Anthropic:", err.message);
    res.status(502).json({ error: "Falha ao contatar o serviço de leitura de imagem/PDF." });
  }
}

module.exports = { extract };
