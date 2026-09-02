(function () {
  "use strict";

  const esc = CF.utils && CF.utils.escapeHtml ? CF.utils.escapeHtml : (s) => s;

  async function api(path, options) {
    const res = await fetch(path, {
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Erro (HTTP ${res.status})`);
    return data;
  }

  // ---------- Navegação entre abas ----------
  function wireTabs() {
    document.querySelectorAll(".admin-nav-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".admin-nav-item").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
        loadTab(btn.dataset.tab);
      });
    });
  }

  function loadTab(tab) {
    if (tab === "dashboard") loadDashboard();
    if (tab === "usuarios") loadUsers();
    if (tab === "configuracoes") loadSettings();
    if (tab === "ocr") loadOcr();
    if (tab === "logs") loadLogs();
    if (tab === "seguranca") loadSeguranca();
  }

  // ---------- Dashboard ----------
  async function loadDashboard() {
    const el = document.getElementById("dashboard-content");
    try {
      const d = await api("/api/admin/dashboard");
      const atividades = d.ultimasAtividades
        ? `<ul>${d.ultimasAtividades.map((a) => `<li>${esc(a.tipo)} — ${esc(a.usuario || "—")} — ${esc(a.quando)}</li>`).join("")}</ul>`
        : `<p class="empty-note">Nenhum dado disponível.</p>`;
      el.innerHTML = `
        <dl class="kv-list">
          <dt>Colaboradores</dt>
          <dd>${d.colaboradores.total} total — ${d.colaboradores.ativos} ativos, ${d.colaboradores.bloqueados} bloqueados</dd>
          <dt>Análises realizadas</dt>
          <dd>${d.analisesRealizadas == null ? "Nenhum dado disponível." : d.analisesRealizadas}</dd>
          <dt>Relatórios processados</dt>
          <dd>${d.relatoriosProcessados == null ? "Nenhum dado disponível." : d.relatoriosProcessados}</dd>
          <dt>Últimas atividades</dt>
          <dd>${atividades}</dd>
        </dl>`;
    } catch (err) {
      el.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    }
  }

  // ---------- Usuários ----------
  function userRow(u) {
    const statusClass = u.status === "ACTIVE" ? "active" : "blocked";
    const statusLabel = u.status === "ACTIVE" ? "Ativo" : "Bloqueado";
    return `
      <tr data-id="${u.id}">
        <td>${esc(u.username)}</td>
        <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
        <td>${esc(u.created_at || "")}</td>
        <td class="row-actions">
          ${u.status === "ACTIVE" ? `<button class="btn" data-action="block">Bloquear</button>` : `<button class="btn" data-action="unblock">Desbloquear</button>`}
          <button class="btn" data-action="reset-password">Alterar senha</button>
          <button class="btn" data-action="delete">Excluir</button>
        </td>
      </tr>`;
  }

  async function loadUsers() {
    const area = document.getElementById("users-table-area");
    try {
      const users = await api("/api/admin/users");
      area.innerHTML = users.length
        ? `<div class="admin-table-wrap"><table class="admin-table">
            <thead><tr><th>Usuário</th><th>Status</th><th>Criado em</th><th>Ações</th></tr></thead>
            <tbody>${users.map(userRow).join("")}</tbody>
          </table></div>`
        : `<p class="empty-note">Nenhum colaborador cadastrado ainda.</p>`;

      area.querySelectorAll("button[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => handleUserAction(btn));
      });
    } catch (err) {
      area.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    }
  }

  async function handleUserAction(btn) {
    const id = btn.closest("tr").dataset.id;
    const action = btn.dataset.action;
    try {
      if (action === "block") await api(`/api/admin/users/${id}/block`, { method: "POST" });
      if (action === "unblock") await api(`/api/admin/users/${id}/unblock`, { method: "POST" });
      if (action === "delete") {
        if (!confirm("Excluir este colaborador? Essa ação não pode ser desfeita.")) return;
        await api(`/api/admin/users/${id}`, { method: "DELETE" });
      }
      if (action === "reset-password") {
        const nova = prompt("Nova senha (mínimo 8 caracteres):");
        if (!nova) return;
        await api(`/api/admin/users/${id}/password`, { method: "POST", body: JSON.stringify({ password: nova }) });
      }
      loadUsers();
    } catch (err) {
      alert(err.message);
    }
  }

  function wireNewUserForm() {
    const form = document.getElementById("new-user-form");
    const errorEl = document.getElementById("user-form-error");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorEl.classList.add("hidden");
      const username = document.getElementById("new-username").value.trim();
      const password = document.getElementById("new-password").value;
      try {
        await api("/api/admin/users", { method: "POST", body: JSON.stringify({ username, password }) });
        form.reset();
        loadUsers();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove("hidden");
      }
    });
  }

  // ---------- Configurações ----------
  async function loadSettings() {
    const el = document.getElementById("settings-content");
    try {
      const s = await api("/api/admin/settings");
      el.innerHTML = `
        <dl class="kv-list">
          <dt>Usuário administrador</dt>
          <dd>${esc(s.admin.username)}</dd>
          <dt>Duração da sessão</dt>
          <dd>${s.sessao.duracaoMinutos} minutos de inatividade</dd>
          <dt>Limite de tentativas de login</dt>
          <dd>${s.sessao.limiteTentativasLogin} tentativas (bloqueio de ${s.sessao.bloqueioMinutos} minutos)</dd>
        </dl>
        <p class="empty-note" style="margin-top:14px">Edição de configurações pelo painel ainda não está disponível — ajuste via variáveis de ambiente no servidor (server/.env).</p>`;
    } catch (err) {
      el.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    }
  }

  // ---------- API / IA ----------
  async function loadOcr() {
    const el = document.getElementById("ocr-content");
    try {
      const s = await api("/api/admin/settings");
      el.innerHTML = `
        <dl class="kv-list">
          <dt>Leitura de fotos/PDFs digitalizados</dt>
          <dd>${s.ocr.configurado ? "Configurada" : "Não configurada"}</dd>
          <dt>Chave da API da Anthropic</dt>
          <dd>${s.ocr.configurado ? esc(s.ocr.chaveMascarada) : "—"}</dd>
          <dt>Modelo</dt>
          <dd>${esc(s.ocr.modelo)}</dd>
        </dl>
        <p class="empty-note" style="margin-top:14px">A chave é configurada via ANTHROPIC_API_KEY no servidor (server/.env) e nunca é enviada ao navegador.</p>`;
    } catch (err) {
      el.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    }
  }

  // ---------- Logs ----------
  async function loadLogs() {
    const el = document.getElementById("logs-content");
    try {
      const logs = await api("/api/admin/logs");
      el.innerHTML = logs.length
        ? `<div class="admin-table-wrap"><table class="admin-table">
            <thead><tr><th>Evento</th><th>Usuário</th><th>Detalhe</th><th>Quando</th></tr></thead>
            <tbody>${logs
              .map(
                (l) =>
                  `<tr><td>${esc(l.event_type)}</td><td>${esc(l.username || "—")}</td><td>${esc(l.detail || "—")}</td><td>${esc(l.created_at)}</td></tr>`
              )
              .join("")}</tbody>
          </table></div>`
        : `<p class="empty-note">Nenhum dado disponível.</p>`;
    } catch (err) {
      el.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    }
  }

  // ---------- Segurança ----------
  async function loadSeguranca() {
    const el = document.getElementById("seguranca-content");
    try {
      const s = await api("/api/admin/settings");
      el.innerHTML = `
        <dl class="kv-list">
          <dt>Sessão</dt>
          <dd>Cookie HttpOnly, SameSite=Lax, expira após ${s.sessao.duracaoMinutos} minutos de inatividade.</dd>
          <dt>Proteção de login</dt>
          <dd>Bloqueio após ${s.sessao.limiteTentativasLogin} tentativas incorretas, por ${s.sessao.bloqueioMinutos} minutos.</dd>
          <dt>Senhas</dt>
          <dd>Armazenadas com hash scrypt — nunca em texto puro.</dd>
          <dt>Administrador</dt>
          <dd>Conta única, definida por variáveis de ambiente no servidor; não pode ser criada, editada ou promovida pelo painel.</dd>
        </dl>`;
    } catch (err) {
      el.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireTabs();
    wireNewUserForm();
    loadDashboard();
  });
})();
