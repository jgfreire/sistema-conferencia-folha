// Limite de tentativas de login em memória, por username — cobre o caso do administrador
// (que não tem registro no banco para guardar failed_login_attempts, ao contrário dos
// colaboradores, cujo bloqueio por tentativas fica em server/src/models/userModel.js).
"use strict";

const env = require("../config/env");

const attempts = new Map(); // username -> { count, lockedUntil }

function isLocked(username) {
  const entry = attempts.get(username);
  if (!entry || !entry.lockedUntil) return false;
  if (entry.lockedUntil > Date.now()) return true;
  attempts.delete(username);
  return false;
}

function registerFailure(username) {
  const entry = attempts.get(username) || { count: 0, lockedUntil: null };
  entry.count += 1;
  if (entry.count >= env.LOGIN_MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + env.LOGIN_LOCKOUT_MINUTES * 60 * 1000;
  }
  attempts.set(username, entry);
}

function registerSuccess(username) {
  attempts.delete(username);
}

module.exports = { isLocked, registerFailure, registerSuccess };
