// Serve as páginas HTML da aplicação. index.html e admin.html NUNCA são expostas pelo
// middleware estático (ver app.js) — só chegam ao navegador passando por aqui, o que garante
// que digitar a URL direto não contorna a checagem de autenticação/role.
"use strict";

const express = require("express");
const path = require("node:path");
const { requireAuthPage, requireAdminPage } = require("../auth/middleware");

const PROJECT_ROOT = path.join(__dirname, "..", "..", "..");

const router = express.Router();

function noStore(res) {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
}

router.get("/login", (req, res) => {
  noStore(res);
  res.sendFile(path.join(PROJECT_ROOT, "login.html"));
});

router.get(["/", "/index.html"], requireAuthPage, (req, res) => {
  noStore(res);
  res.sendFile(path.join(PROJECT_ROOT, "index.html"));
});

router.get(["/admin", "/admin.html"], requireAuthPage, requireAdminPage, (req, res) => {
  noStore(res);
  res.sendFile(path.join(PROJECT_ROOT, "admin.html"));
});

module.exports = router;
