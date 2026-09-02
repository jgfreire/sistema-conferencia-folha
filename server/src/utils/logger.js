// Ponto único de registro de eventos de auditoria (login, logout, criação de usuário, etc.).
// Nunca chamar logModel diretamente com dados vindos de entrada do usuário sem passar por
// aqui, para não arriscar gravar senha/chave/token nos logs.
"use strict";

const logModel = require("../models/logModel");

const SENSITIVE_KEYS = ["password", "senha", "accessKey", "access_key", "apiKey", "api_key", "token", "hash"];

function sanitizeDetail(detail) {
  if (detail == null) return null;
  if (typeof detail === "string") return detail.slice(0, 500);
  if (typeof detail === "object") {
    const clean = {};
    for (const [key, value] of Object.entries(detail)) {
      if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s.toLowerCase()))) continue;
      clean[key] = value;
    }
    return JSON.stringify(clean).slice(0, 500);
  }
  return String(detail).slice(0, 500);
}

function logEvent(eventType, { username, detail } = {}) {
  try {
    logModel.insert({ eventType, username, detail: sanitizeDetail(detail) });
  } catch (err) {
    console.error("[logger] Falha ao gravar log:", err.message);
  }
}

module.exports = { logEvent };
