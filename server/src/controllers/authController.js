"use strict";

const userModel = require("../models/userModel");
const { verifyPassword } = require("../auth/passwords");
const { verifyAdminLogin, isAdminUsername, verifyAccessKey } = require("../auth/adminIdentity");
const rateLimiter = require("../auth/loginRateLimiter");
const env = require("../config/env");
const { logEvent } = require("../utils/logger");

const GENERIC_ERROR = "Usuário ou senha inválidos.";

function login(req, res) {
  const { username, password, accessKey } = req.body || {};
  // Campo vazio não revela nada sobre nenhuma conta específica, então pode ter mensagem
  // própria — diferente de usuário/senha/chave errados, que sempre usam GENERIC_ERROR.
  if (!username || typeof username !== "string") {
    return res.status(400).json({ error: "Preencha o usuário." });
  }
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Preencha a senha." });
  }

  if (rateLimiter.isLocked(username)) {
    logEvent("LOGIN_RECUSADO", { username, detail: "bloqueado por tentativas" });
    return res.status(429).json({ error: "Muitas tentativas. Tente novamente mais tarde." });
  }

  // Caminho do administrador: identidade inteira vem do .env, nunca do banco de dados.
  if (isAdminUsername(username)) {
    if (verifyAdminLogin({ username, password, accessKey })) {
      rateLimiter.registerSuccess(username);
      req.session.regenerate((err) => {
        if (err) return res.status(500).json({ error: "Falha ao iniciar sessão." });
        req.session.user = { id: "admin", username: env.ADMIN_USERNAME, role: "ADMIN" };
        logEvent("LOGIN_REALIZADO", { username, detail: "role=ADMIN" });
        res.json({ id: "admin", username: env.ADMIN_USERNAME, role: "ADMIN" });
      });
      return;
    }
    rateLimiter.registerFailure(username);
    logEvent("LOGIN_RECUSADO", { username, detail: "credenciais de admin inválidas" });
    return res.status(401).json({ error: GENERIC_ERROR });
  }

  // Caminho do banco de dados: colaborador OU administrador adicional (role = 'ADMIN').
  const user = userModel.findByUsername(username);
  if (!user || user.status !== "ACTIVE") {
    logEvent("LOGIN_RECUSADO", { username, detail: "usuário inexistente ou bloqueado" });
    return res.status(401).json({ error: GENERIC_ERROR });
  }
  if (userModel.isLocked(user)) {
    logEvent("LOGIN_RECUSADO", { username, detail: "bloqueado por tentativas" });
    return res.status(429).json({ error: "Muitas tentativas. Tente novamente mais tarde." });
  }
  if (!verifyPassword(password, user.password_hash)) {
    userModel.registerFailedAttempt(user.id, env.LOGIN_MAX_ATTEMPTS, env.LOGIN_LOCKOUT_MINUTES);
    logEvent("LOGIN_RECUSADO", { username, detail: "senha incorreta" });
    return res.status(401).json({ error: GENERIC_ERROR });
  }
  // Um administrador do banco também precisa da chave de acesso — mesma exigência do
  // admin mestre, para manter o "segundo fator" consistente em todo o nível admin.
  if (user.role === "ADMIN" && !verifyAccessKey(accessKey)) {
    userModel.registerFailedAttempt(user.id, env.LOGIN_MAX_ATTEMPTS, env.LOGIN_LOCKOUT_MINUTES);
    logEvent("LOGIN_RECUSADO", { username, detail: "chave de administrador inválida" });
    return res.status(401).json({ error: GENERIC_ERROR });
  }

  userModel.clearFailedAttempts(user.id);
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Falha ao iniciar sessão." });
    req.session.user = { id: user.id, username: user.username, role: user.role };
    logEvent("LOGIN_REALIZADO", { username, detail: `role=${user.role}` });
    res.json({ id: user.id, username: user.username, role: user.role });
  });
}

function logout(req, res) {
  const username = req.session && req.session.user ? req.session.user.username : null;
  req.session.destroy((err) => {
    res.clearCookie("cf.sid");
    if (err) return res.status(500).json({ error: "Falha ao encerrar sessão." });
    if (username) logEvent("LOGOUT", { username });
    res.json({ ok: true });
  });
}

function me(req, res) {
  res.json(req.session.user);
}

module.exports = { login, logout, me };
