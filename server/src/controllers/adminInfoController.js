// Dashboard, Configurações/API-OCR e Logs do painel administrativo. Nunca retorna um valor
// de segredo completo — no máximo os últimos 4 caracteres, para o admin confirmar qual chave
// está configurada sem expor a chave inteira pela rede/tela.
"use strict";

const userModel = require("../models/userModel");
const logModel = require("../models/logModel");
const env = require("../config/env");

function mask(value) {
  if (!value) return null;
  const tail = value.slice(-4);
  return `${"•".repeat(Math.max(value.length - 4, 8))}${tail}`;
}

function dashboard(req, res) {
  const usuarios = userModel.listAll();
  const logs = logModel.listRecent(10);
  res.json({
    colaboradores: {
      total: usuarios.length,
      ativos: usuarios.filter((u) => u.status === "ACTIVE").length,
      bloqueados: usuarios.filter((u) => u.status === "BLOCKED").length
    },
    ultimasAtividades: logs.length
      ? logs.map((l) => ({ tipo: l.event_type, usuario: l.username, quando: l.created_at }))
      : null,
    analisesRealizadas: logModel.countByEventType("ANALISE_EXECUTADA"),
    relatoriosProcessados: logModel.countByEventType("RELATORIO_GERADO")
  });
}

function settings(req, res) {
  res.json({
    admin: { username: env.ADMIN_USERNAME },
    sessao: {
      duracaoMinutos: env.SESSION_MAX_AGE_MINUTES,
      limiteTentativasLogin: env.LOGIN_MAX_ATTEMPTS,
      bloqueioMinutos: env.LOGIN_LOCKOUT_MINUTES
    },
    ocr: {
      configurado: Boolean(env.ANTHROPIC_API_KEY),
      chaveMascarada: env.ANTHROPIC_API_KEY ? mask(env.ANTHROPIC_API_KEY) : null,
      modelo: "claude-sonnet-5"
    }
  });
}

function logs(req, res) {
  res.json(logModel.listRecent(200));
}

module.exports = { dashboard, settings, logs };
