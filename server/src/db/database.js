// Banco de dados SQLite (módulo nativo do Node — sem dependência externa). Guarda
// colaboradores e administradores adicionais (o administrador do .env continua existindo
// à parte, fora do banco — ver server/src/auth/adminIdentity.js; ele é o "admin mestre" que
// nunca pode ficar bloqueado do sistema mesmo se o banco for perdido/corrompido), logs e
// sessões.
"use strict";

const path = require("node:path");
const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");

// Em produção (ex.: Render), DATA_DIR aponta para um disco persistente montado fora do
// código da aplicação, para que usuários/logs sobrevivam a cada novo deploy. Sem DATA_DIR
// (uso local), cai no diretório server/data de sempre.
const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, "app.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'COLLABORATOR' CHECK(role IN ('COLLABORATOR','ADMIN')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','BLOCKED')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    username TEXT,
    detail TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

// Migração: bancos criados antes desta versão têm `users.role` travado só em COLLABORATOR
// (CHECK constraint). SQLite não permite alterar um CHECK existente — recria a tabela no
// padrão "rename → create → copy → drop" só quando detecta o schema antigo.
const usersSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
if (usersSchema && usersSchema.sql.includes("CHECK(role IN ('COLLABORATOR'))")) {
  db.exec(`
    ALTER TABLE users RENAME TO users_old_migration;
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'COLLABORATOR' CHECK(role IN ('COLLABORATOR','ADMIN')),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','BLOCKED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT
    );
    INSERT INTO users (id, username, password_hash, role, status, created_at, failed_login_attempts, locked_until)
      SELECT id, username, password_hash, role, status, created_at, failed_login_attempts, locked_until FROM users_old_migration;
    DROP TABLE users_old_migration;
  `);
}

module.exports = db;
