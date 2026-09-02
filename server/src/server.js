"use strict";

const app = require("./app");
const env = require("./config/env");

app.listen(env.PORT, () => {
  console.log(`Conferência de Folha — servidor rodando em http://localhost:${env.PORT}`);
  if (!env.ANTHROPIC_API_KEY) {
    console.warn("[aviso] ANTHROPIC_API_KEY não configurada — leitura de fotos/PDFs digitalizados ficará indisponível.");
  }
});
