// requireAuth/requireAdmin: a role vem sempre de req.session.user (definida pelo backend no
// login, nunca lida de um campo enviado pelo cliente numa requisição posterior). Existem duas
// variantes de cada checagem — uma para rotas de página (HTML, redireciona) e uma para rotas
// de API (JSON, responde 401/403) — porque as duas famílias de rota precisam se comportar de
// forma diferente quando a checagem falha.
"use strict";

function requireAuthApi(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "Não autenticado." });
  }
  next();
}

function requireAdminApi(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "Não autenticado." });
  }
  if (req.session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }
  next();
}

function requireAuthPage(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect("/login");
  }
  next();
}

function requireAdminPage(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect("/login");
  }
  if (req.session.user.role !== "ADMIN") {
    return res.status(403).sendFile(require("node:path").join(__dirname, "..", "..", "..", "acesso-negado.html"));
  }
  next();
}

module.exports = { requireAuthApi, requireAdminApi, requireAuthPage, requireAdminPage };
