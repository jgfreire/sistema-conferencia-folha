// Gera o hash de uma senha para colar em ADMIN_PASSWORD_HASH no .env.
// Uso: npm run hash-password -- "minha-senha-aqui"
"use strict";

const { hashPassword } = require("../src/auth/passwords");

const plain = process.argv[2];
if (!plain) {
  console.error('Uso: npm run hash-password -- "minha-senha-aqui"');
  process.exit(1);
}
if (plain.length < 6) {
  console.error("Escolha uma senha com pelo menos 6 caracteres.");
  process.exit(1);
}

console.log(hashPassword(plain));
