// Dashboard, Configurações/API-OCR e Logs do painel administrativo. Nunca retorna um valor
// de segredo completo — no máximo os últimos 4 caracteres, para o admin confirmar qual chave
// está configurada sem expor a chave inteira pela rede/tela.
"use strict";

const userModel = require("../models/userModel");
const logModel = require("../models/logModel");
const env = require("../config/env");

function dashboard(req, res) {
  const usuarios = userModel.listAll();
  const colaboradores = usuarios.filter((u) => u.role === "COLLABORATOR");
  const adminsAdicionais = usuarios.filter((u) => u.role === "ADMIN");
  const logs = logModel.listRecent(10);
  res.json({
    colaboradores: {
      total: colaboradores.length,
      ativos: colaboradores.filter((u) => u.status === "ACTIVE").length,
      bloqueados: colaboradores.filter((u) => u.status === "BLOCKED").length
    },
    administradoresAdicionais: adminsAdicionais.length,
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
    }
  });
}

function logs(req, res) {
  res.json(logModel.listRecent(200));
}

module.exports = { dashboard, settings, logs };
