(function () {
  "use strict";

  const form = document.getElementById("login-form");
  const errorEl = document.getElementById("login-error");
  const submitBtn = document.getElementById("login-submit");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.add("hidden");
    submitBtn.disabled = true;

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const accessKey = document.getElementById("access-key").value;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password, accessKey })
      });
      const data = await res.json();

      if (!res.ok) {
        errorEl.textContent = data.error || "Não foi possível entrar.";
        errorEl.classList.remove("hidden");
        return;
      }

      window.location.href = data.role === "ADMIN" ? "/admin" : "/";
    } catch {
      errorEl.textContent = "Falha de conexão com o servidor.";
      errorEl.classList.remove("hidden");
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
