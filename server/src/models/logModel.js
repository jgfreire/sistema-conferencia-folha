// Acesso à tabela `logs`. Nunca gravar senha, hash ou chave completa aqui — ver
// server/src/utils/logger.js, que é o único ponto de escrita usado pelo resto do backend.
"use strict";

const db = require("../db/database");

function insert({ eventType, username, detail }) {
  db.prepare("INSERT INTO logs (event_type, username, detail) VALUES (?, ?, ?)").run(
    eventType,
    username || null,
    detail || null
  );
}

function listRecent(limit = 200) {
  return db.prepare("SELECT * FROM logs ORDER BY created_at DESC LIMIT ?").all(limit);
}

function countByEventType(eventType) {
  const row = db.prepare("SELECT COUNT(*) AS total FROM logs WHERE event_type = ?").get(eventType);
  return row ? row.total : 0;
}

module.exports = { insert, listRecent, countByEventType };
