"use strict";

const express = require("express");
const session = require("express-session");
const path = require("node:path");

const env = require("./config/env");
const SqliteSessionStore = require("./auth/sqliteSessionStore");
const { requireAuthApi, requireAdminApi } = require("./auth/middleware");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const activityRoutes = require("./routes/activityRoutes");
const pageRoutes = require("./routes/pageRoutes");

const PROJECT_ROOT = path.join(__dirname, "..", "..");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(express.json({ limit: "15mb" })); // acomoda fotos/PDFs em base64 no corpo da requisição de visão

app.use(
  session({
    name: "cf.sid",
    secret: env.SESSION_SECRET,
    store: new SqliteSessionStore(),
    resave: false,
    saveUninitialized: false,
    rolling: true, // renova a expiração a cada requisição — "expiração por inatividade"
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      maxAge: env.SESSION_MAX_AGE_MINUTES * 60 * 1000
    }
  })
);

// Assets estáticos (CSS/JS) não são sensíveis por si só — o que protege o sistema é nunca
// servir index.html/admin.html fora da rota autenticada abaixo, e nunca colocar segredos
// nesses arquivos. `index: false` evita que o express.static sirva um index.html automático.
app.use("/css", express.static(path.join(PROJECT_ROOT, "css")));
app.use("/js", express.static(path.join(PROJECT_ROOT, "js"), { index: false }));

app.use("/api/auth", authRoutes);
app.use("/api/admin", requireAuthApi, requireAdminApi, adminRoutes);
app.use("/api/activity", requireAuthApi, activityRoutes);

app.use("/", pageRoutes);

// Nunca vazar stack trace/detalhes internos pro cliente — loga o detalhe no servidor e
// devolve uma mensagem genérica (seção 25 do pedido).
app.use((err, req, res, next) => {
  console.error("[erro não tratado]", err);
  res.status(500).json({ error: "Erro interno do servidor." });
});

module.exports = app;
