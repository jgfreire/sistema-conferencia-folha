// CRUD de usuários do banco (colaboradores e administradores adicionais). Toda rota que usa
// este controller já passou por requireAuth + requireAdmin (ver
// server/src/routes/adminRoutes.js) — ou seja, só quem já é administrador pode chegar aqui.
// A role de um usuário só é ADMIN quando explicitamente escolhida por um admin já autenticado
// (nunca a partir de um valor arbitrário — sempre validada contra a lista fixa
// ['COLLABORATOR', 'ADMIN']), e nenhuma ação aqui permite que um usuário altere a própria
// conta (auto-promoção, auto-bloqueio, auto-exclusão) — sempre precisa ser outro admin agindo.
"use strict";

const userModel = require("../models/userModel");
const { hashPassword } = require("../auth/passwords");
const { isAdminUsername } = require("../auth/adminIdentity");
const { logEvent } = require("../utils/logger");

const VALID_ROLES = new Set(["COLLABORATOR", "ADMIN"]);

// Aceita nomes normais (com espaço e acento, ex.: "João Silva") — letras (inclusive
// acentuadas), números, espaço e pontuação básica são todos permitidos, mas nenhum é
// obrigatório além do tamanho mínimo.
function validUsername(username) {
  return typeof username === "string" && /^[\p{L}\p{N} '._-]{3,60}$/u.test(username.trim());
}
function validPassword(password) {
  return typeof password === "string" && password.length >= 6;
}
function isSelf(req, id) {
  return String(req.session.user.id) === String(id);
}

function list(req, res) {
  res.json(userModel.listAll());
}

function create(req, res) {
  const { username, password, role } = req.body || {};
  if (!validUsername(username)) {
    return res.status(400).json({ error: "Nome de usuário inválido (3-60 caracteres)." });
  }
  if (isAdminUsername(username)) {
    return res.status(400).json({ error: "Este nome de usuário é reservado." });
  }
  if (!validPassword(password)) {
    return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
  }
  if (role !== undefined && !VALID_ROLES.has(role)) {
    return res.status(400).json({ error: "Papel inválido." });
  }
  if (userModel.findByUsername(username)) {
    return res.status(409).json({ error: "Já existe um usuário com este nome." });
  }

  const user = userModel.create({ username, passwordHash: hashPassword(password), role });
  logEvent("USUARIO_CRIADO", { username: req.session.user.username, detail: { usuario: username, role: user.role } });
  const { password_hash, ...safe } = user;
  res.status(201).json(safe);
}

function setRole(req, res) {
  const id = Number(req.params.id);
  const existing = userModel.findById(id);
  if (!existing) return res.status(404).json({ error: "Usuário não encontrado." });
  if (isSelf(req, id)) {
    return res.status(400).json({ error: "Você não pode alterar o próprio nível de acesso." });
  }

  const { role } = req.body || {};
  if (!VALID_ROLES.has(role)) {
    return res.status(400).json({ error: "Papel inválido." });
  }

  const updated = userModel.setRole(id, role);
  logEvent(role === "ADMIN" ? "USUARIO_PROMOVIDO_ADMIN" : "USUARIO_REBAIXADO_COLABORADOR", {
    username: req.session.user.username,
    detail: { id, usuario: existing.username }
  });
  const { password_hash, ...safe } = updated;
  res.json(safe);
}

function update(req, res) {
  const id = Number(req.params.id);
  const existing = userModel.findById(id);
  if (!existing) return res.status(404).json({ error: "Usuário não encontrado." });

  const { username } = req.body || {};
  if (username !== undefined) {
    if (!validUsername(username)) {
      return res.status(400).json({ error: "Nome de usuário inválido." });
    }
    if (isAdminUsername(username)) {
      return res.status(400).json({ error: "Este nome de usuário é reservado." });
    }
    const other = userModel.findByUsername(username);
    if (other && other.id !== id) {
      return res.status(409).json({ error: "Já existe um usuário com este nome." });
    }
    userModel.updateUsername(id, username);
  }

  logEvent("USUARIO_EDITADO", { username: req.session.user.username, detail: { id } });
  const { password_hash, ...safe } = userModel.findById(id);
  res.json(safe);
}

function resetPassword(req, res) {
  const id = Number(req.params.id);
  const existing = userModel.findById(id);
  if (!existing) return res.status(404).json({ error: "Usuário não encontrado." });

  const { password } = req.body || {};
  if (!validPassword(password)) {
    return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
  }
  userModel.updatePassword(id, hashPassword(password));
  logEvent("SENHA_ALTERADA", { username: req.session.user.username, detail: { id } });
  res.json({ ok: true });
}

function setStatus(status) {
  return (req, res) => {
    const id = Number(req.params.id);
    const existing = userModel.findById(id);
    if (!existing) return res.status(404).json({ error: "Usuário não encontrado." });
    if (status === "BLOCKED" && isSelf(req, id)) {
      return res.status(400).json({ error: "Você não pode bloquear a própria conta." });
    }
    const updated = userModel.setStatus(id, status);
    logEvent(status === "BLOCKED" ? "USUARIO_BLOQUEADO" : "USUARIO_DESBLOQUEADO", {
      username: req.session.user.username,
      detail: { id }
    });
    const { password_hash, ...safe } = updated;
    res.json(safe);
  };
}

function remove(req, res) {
  const id = Number(req.params.id);
  const existing = userModel.findById(id);
  if (!existing) return res.status(404).json({ error: "Usuário não encontrado." });
  if (isSelf(req, id)) {
    return res.status(400).json({ error: "Você não pode excluir a própria conta." });
  }
  userModel.remove(id);
  logEvent("USUARIO_EXCLUIDO", { username: req.session.user.username, detail: { id, username: existing.username } });
  res.json({ ok: true });
}

module.exports = {
  list,
  create,
  update,
  setRole,
  resetPassword,
  block: setStatus("BLOCKED"),
  unblock: setStatus("ACTIVE"),
  remove
};
