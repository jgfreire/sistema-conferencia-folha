// Hash e verificação de senha com scrypt (nativo do Node — sem dependência externa).
// Formato armazenado: "scrypt:<saltHex>:<hashHex>". Nunca guardar senha em texto puro.
"use strict";

const crypto = require("node:crypto");

const KEY_LENGTH = 64;

function hashPassword(plainPassword) {
  if (!plainPassword || typeof plainPassword !== "string") {
    throw new Error("Senha inválida para hashing.");
  }
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(plainPassword, salt, KEY_LENGTH);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

function verifyPassword(plainPassword, storedHash) {
  if (!plainPassword || !storedHash) return false;
  const parts = String(storedHash).split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const [, saltHex, hashHex] = parts;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const derived = crypto.scryptSync(plainPassword, salt, expected.length);
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
