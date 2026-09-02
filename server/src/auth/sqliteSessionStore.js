// Session store do express-session persistido em SQLite (mesmo banco dos usuários/logs),
// para que sessões sobrevivam a reinícios do servidor sem depender de nenhum pacote externo.
"use strict";

const session = require("express-session");
const db = require("../db/database");

class SqliteSessionStore extends session.Store {
  constructor() {
    super();
    this._cleanupExpired();
    this._cleanupTimer = setInterval(() => this._cleanupExpired(), 15 * 60 * 1000).unref();
  }

  _cleanupExpired() {
    try {
      db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
    } catch (err) {
      console.error("[session] Falha ao limpar sessões expiradas:", err.message);
    }
  }

  get(sid, callback) {
    try {
      const row = db.prepare("SELECT data, expires_at FROM sessions WHERE sid = ?").get(sid);
      if (!row || row.expires_at < Date.now()) return callback(null, null);
      callback(null, JSON.parse(row.data));
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sessionData, callback) {
    try {
      const maxAge = sessionData.cookie && sessionData.cookie.maxAge ? sessionData.cookie.maxAge : 30 * 60 * 1000;
      const expiresAt = Date.now() + maxAge;
      const data = JSON.stringify(sessionData);
      db.prepare(
        "INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at"
      ).run(sid, data, expiresAt);
      callback && callback();
    } catch (err) {
      callback && callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
      callback && callback();
    } catch (err) {
      callback && callback(err);
    }
  }

  touch(sid, sessionData, callback) {
    this.set(sid, sessionData, callback);
  }
}

module.exports = SqliteSessionStore;
