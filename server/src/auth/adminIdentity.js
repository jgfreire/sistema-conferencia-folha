// O administrador "mestre" NÃO é um registro no banco de dados — é definido inteiramente
// pelas variáveis de ambiente (ADMIN_USERNAME/ADMIN_PASSWORD_HASH/ADMIN_ACCESS_KEY), então
// nunca fica bloqueado do sistema mesmo se o banco for perdido/corrompido.
//
// Também é possível existirem administradores adicionais como registros na tabela `users`
// (role = 'ADMIN', criados/promovidos por um admin já autenticado — ver
// server/src/controllers/userController.js). Esses login com usuário+senha do banco, mas
// ainda precisam da MESMA ADMIN_ACCESS_KEY do .env — a chave é um segredo do "nível admin"
// como um todo, compartilhado por todos os administradores, não uma senha individual.
"use strict";

const crypto = require("node:crypto");
const env = require("../config/env");
const { verifyPassword } = require("./passwords");

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a || ""));
  const bufB = Buffer.from(String(b || ""));
  if (bufA.length !== bufB.length) {
    // Ainda assim compara contra algo do mesmo tamanho para não vazar a diferença de
    // comprimento por tempo de resposta.
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// Retorna true somente se username, senha e chave de acesso administrativa baterem todos.
function verifyAdminLogin({ username, password, accessKey }) {
  if (!timingSafeStringEqual(username, env.ADMIN_USERNAME)) return false;
  if (!accessKey || !timingSafeStringEqual(accessKey, env.ADMIN_ACCESS_KEY)) return false;
  if (!verifyPassword(password, env.ADMIN_PASSWORD_HASH)) return false;
  return true;
}

function isAdminUsername(username) {
  return timingSafeStringEqual(username, env.ADMIN_USERNAME);
}

// Usado no login de administradores do banco de dados (role = 'ADMIN'): mesma chave
// compartilhada do admin mestre, verificada em tempo constante.
function verifyAccessKey(accessKey) {
  return Boolean(accessKey) && timingSafeStringEqual(accessKey, env.ADMIN_ACCESS_KEY);
}

module.exports = { verifyAdminLogin, isAdminUsername, verifyAccessKey };
