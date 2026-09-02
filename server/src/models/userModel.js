// Acesso à tabela `users` — colaboradores e administradores adicionais (o admin do .env
// nunca é um registro aqui, ver server/src/auth/adminIdentity.js). Nenhuma função aqui
// retorna password_hash para fora do módulo de autenticação.
"use strict";

const db = require("../db/database");

const PUBLIC_FIELDS = "id, username, role, status, created_at, locked_until";

function findByUsername(username) {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username) || null;
}

function findById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) || null;
}

function listAll() {
  return db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users ORDER BY created_at DESC`).all();
}

function create({ username, passwordHash, role }) {
  const stmt = db.prepare("INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, ?, 'ACTIVE')");
  const info = stmt.run(username, passwordHash, role === "ADMIN" ? "ADMIN" : "COLLABORATOR");
  return findById(Number(info.lastInsertRowid));
}

function setRole(id, role) {
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role === "ADMIN" ? "ADMIN" : "COLLABORATOR", id);
  return findById(id);
}

function updateUsername(id, username) {
  db.prepare("UPDATE users SET username = ? WHERE id = ?").run(username, id);
  return findById(id);
}

function updatePassword(id, passwordHash) {
  db.prepare("UPDATE users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?").run(
    passwordHash,
    id
  );
  return findById(id);
}

function setStatus(id, status) {
  db.prepare("UPDATE users SET status = ? WHERE id = ?").run(status, id);
  return findById(id);
}

function remove(id) {
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
}

function registerFailedAttempt(id, maxAttempts, lockoutMinutes) {
  const user = findById(id);
  if (!user) return;
  const attempts = (user.failed_login_attempts || 0) + 1;
  let lockedUntil = null;
  if (attempts >= maxAttempts) {
    lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000).toISOString();
  }
  db.prepare("UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?").run(
    attempts,
    lockedUntil,
    id
  );
}

function clearFailedAttempts(id) {
  db.prepare("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?").run(id);
}

function isLocked(user) {
  if (!user || !user.locked_until) return false;
  return new Date(user.locked_until).getTime() > Date.now();
}

module.exports = {
  findByUsername,
  findById,
  listAll,
  create,
  setRole,
  updateUsername,
  updatePassword,
  setStatus,
  remove,
  registerFailedAttempt,
  clearFailedAttempts,
  isLocked
};
