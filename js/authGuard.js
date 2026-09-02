// Roda em toda página protegida (index.html, admin.html). O bloqueio de verdade já aconteceu
// no servidor antes de a página ser entregue (ver server/src/routes/pageRoutes.js) — isto
// aqui é só reforço (ex.: sessão expira enquanto a aba fica aberta) e cuida da UI comum:
// mostrar o usuário logado e o botão "Sair".
window.CF = window.CF || {};

(function () {
  "use strict";

  async function init() {
    let user = null;
    try {
      const res = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (res.ok) user = await res.json();
    } catch {
      // falha de rede: não força logout, só não preenche o usuário na tela
    }

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const userEl = document.getElementById("session-user");
    if (userEl) userEl.textContent = `${user.username} (${user.role === "ADMIN" ? "Administrador" : "Colaborador"})`;

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
        } finally {
          window.location.href = "/login";
        }
      });
    }

    CF.currentUser = user;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
