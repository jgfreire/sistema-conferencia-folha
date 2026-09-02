// Carrega e valida as variáveis de ambiente. Nunca expõe estes valores ao frontend —
// só este processo (backend) os lê.
"use strict";

const path = require("node:path");
const crypto = require("node:crypto");

try {
  process.loadEnvFile(path.join(__dirname, "..", "..", ".env"));
} catch {
  // .env ainda não existe (ex.: primeira execução) — segue com as variáveis já presentes
  // no ambiente, se houver. A validação abaixo garante que nada crítico fique faltando.
}

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(
      `[configuração] Variável de ambiente obrigatória ausente: ${name}. Configure o arquivo server/.env (veja server/.env.example).`
    );
    process.exit(1);
  }
  return value;
}

const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = parseInt(process.env.PORT || "3000", 10);

const ADMIN_USERNAME = required("ADMIN_USERNAME");
const ADMIN_PASSWORD_HASH = required("ADMIN_PASSWORD_HASH");
const ADMIN_ACCESS_KEY = required("ADMIN_ACCESS_KEY");

// Only required to actually use the vision/OCR path — a missing key is reported to the
// caller of that specific route, not a fatal boot error, since the rest of the system
// (PDF/XLSX/CSV/TXT reading, comparison, PDF report) works without it.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

// Se SESSION_SECRET não estiver definido, gera um valor aleatório por processo — funciona,
// mas invalida sessões a cada reinício do servidor. Recomenda-se definir um valor fixo em
// produção (server/.env) para não deslogar todo mundo a cada restart/deploy.
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.SESSION_SECRET) {
  console.warn(
    "[configuração] SESSION_SECRET não definido — gerando um valor temporário. Defina SESSION_SECRET em server/.env para manter sessões entre reinícios do servidor."
  );
}

const SESSION_MAX_AGE_MINUTES = parseInt(process.env.SESSION_MAX_AGE_MINUTES || "30", 10);
const LOGIN_MAX_ATTEMPTS = parseInt(process.env.LOGIN_MAX_ATTEMPTS || "5", 10);
const LOGIN_LOCKOUT_MINUTES = parseInt(process.env.LOGIN_LOCKOUT_MINUTES || "15", 10);

module.exports = {
  NODE_ENV,
  PORT,
  ADMIN_USERNAME,
  ADMIN_PASSWORD_HASH,
  ADMIN_ACCESS_KEY,
  ANTHROPIC_API_KEY,
  SESSION_SECRET,
  SESSION_MAX_AGE_MINUTES,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_LOCKOUT_MINUTES
};
