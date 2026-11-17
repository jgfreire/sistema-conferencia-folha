"use strict";

const app = require("./app");
const env = require("./config/env");

app.listen(env.PORT, () => {
  console.log(`Conferência de Folha — servidor rodando em http://localhost:${env.PORT}`);
});
