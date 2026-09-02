// Funções utilitárias: dinheiro, CNPJ, competência, nomes.
window.CF = window.CF || {};

(function () {
  "use strict";

  var DIACRITICS_RE = new RegExp("[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]", "g");

  function stripAccents(str) {
    return String(str || "").normalize("NFD").replace(DIACRITICS_RE, "");
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  // ---------- Dinheiro ----------
  const MONEY_TOKEN_RE = /^-?\(?R?\$?\s?\d{1,3}(\.\d{3})*,\d{2}\)?$/;

  function looksLikeMoney(tok) {
    return MONEY_TOKEN_RE.test(String(tok || "").replace(/\s/g, ""));
  }

  function parseMoneyBR(raw) {
    if (raw == null) return null;
    let s = String(raw).trim();
    if (!s) return null;

    let negative = false;
    if (/^\(.*\)$/.test(s)) {
      negative = true;
      s = s.slice(1, -1);
    }
    if (/^-/.test(s)) {
      negative = true;
      s = s.slice(1);
    }
    s = s.replace(/R\$\s?/gi, "").trim();
    if (!s) return null;

    const brFormat = /^\d{1,3}(\.\d{3})*(,\d{1,2})?$/;
    const plainComma = /^\d+,\d{1,2}$/;
    const plainDot = /^\d+\.\d{1,2}$/;
    const intOnly = /^\d+$/;

    let num = null;
    if (brFormat.test(s) || plainComma.test(s)) {
      num = parseFloat(s.replace(/\./g, "").replace(",", "."));
    } else if (plainDot.test(s)) {
      num = parseFloat(s);
    } else if (intOnly.test(s)) {
      num = parseFloat(s);
    } else {
      const cleaned = s.replace(/[^0-9.,]/g, "");
      if (!cleaned) return null;
      if (cleaned.includes(",") && cleaned.includes(".")) {
        num = parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
      } else if (cleaned.includes(",")) {
        num = parseFloat(cleaned.replace(",", "."));
      } else {
        num = parseFloat(cleaned);
      }
    }
    if (num == null || isNaN(num)) return null;
    return negative ? -num : num;
  }

  function formatMoneyBR(n) {
    if (n == null || isNaN(n)) return "—";
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  // ---------- CNPJ ----------
  const CNPJ_RE = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;

  function formatCnpjDigits(digits) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
  }

  function findCNPJ(text) {
    if (!text) return null;
    const m = String(text).match(CNPJ_RE);
    if (!m) return null;
    const digits = m[0].replace(/\D/g, "");
    if (digits.length !== 14) return null;
    return formatCnpjDigits(digits);
  }

  function findCNPJLabeled(text) {
    if (!text) return null;
    const m = String(text).match(/CNPJ[:\s]*([\d./\-]{14,20})/i);
    if (m) {
      const found = findCNPJ(m[1]);
      if (found) return found;
    }
    return findCNPJ(text);
  }

  // ---------- CPF (algumas "empresas" no relatório real são pessoa física, identificadas
  // por CPF em vez de CNPJ — ex.: "Empresa: FULANO DE TAL" / "CPF: 999.645.541-68") ----------
  const CPF_RE = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/;

  function formatCpfDigits(digits) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  }

  function findCPF(text) {
    if (!text) return null;
    const m = String(text).match(CPF_RE);
    if (!m) return null;
    const digits = m[0].replace(/\D/g, "");
    if (digits.length !== 11) return null;
    return formatCpfDigits(digits);
  }

  // ---------- Competência ----------
  const MONTHS_PT = {
    janeiro: 1, jan: 1,
    fevereiro: 2, fev: 2,
    marco: 3, mar: 3,
    abril: 4, abr: 4,
    maio: 5, mai: 5,
    junho: 6, jun: 6,
    julho: 7, jul: 7,
    agosto: 8, ago: 8,
    setembro: 9, set: 9,
    outubro: 10, out: 10,
    novembro: 11, nov: 11,
    dezembro: 12, dez: 12
  };
  const MONTH_NAMES_ALT = Object.keys(MONTHS_PT).sort((a, b) => b.length - a.length).join("|");

  function parseCompetenciaToken(str, confianca) {
    if (!str) return null;
    let m = str.match(/\b(0?[1-9]|1[0-2])[\/\-](\d{4})\b/);
    if (m) {
      return { mm: pad2(m[1]), aaaa: m[2], label: `${pad2(m[1])}/${m[2]}`, confianca: confianca || "alta" };
    }
    const stripped = stripAccents(str.toLowerCase());
    const monthRe = new RegExp(`\\b(${MONTH_NAMES_ALT})\\b[\\s./\\-]*(?:de\\s*)?(\\d{4})`, "i");
    m = stripped.match(monthRe);
    if (m) {
      const mm = MONTHS_PT[m[1]];
      if (mm) return { mm: pad2(mm), aaaa: m[2], label: `${pad2(mm)}/${m[2]}`, confianca: confianca || "alta" };
    }
    return null;
  }

  function findCompetencia(text) {
    if (!text) return null;
    const labelRe = /(compet[êe]ncia|refer[êe]ncia|m[êe]s\s*\/?\s*ano|periodo|per[íi]odo)[:\s]+([^\n]{0,40})/i;
    const m = text.match(labelRe);
    if (m) {
      const found = parseCompetenciaToken(m[2], "alta");
      if (found) return found;
    }
    // Fallback: MM/AAAA solto no texto, evitando capturar DD/MM/AAAA (data completa).
    const fallbackRe = /(?<!\d{1,2}\/)\b(0?[1-9]|1[0-2])\/(\d{4})\b/;
    const m2 = text.match(fallbackRe);
    if (m2) {
      return { mm: pad2(m2[1]), aaaa: m2[2], label: `${pad2(m2[1])}/${m2[2]}`, confianca: "baixa" };
    }
    const found2 = parseCompetenciaToken(text, "baixa");
    if (found2) return found2;
    return null;
  }

  // ---------- Nomes ----------
  function normalizeName(name) {
    return stripAccents(String(name || "").toUpperCase())
      .replace(/[^A-Z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  CF.utils = {
    stripAccents,
    escapeHtml,
    pad2,
    round2,
    looksLikeMoney,
    parseMoneyBR,
    formatMoneyBR,
    findCNPJ,
    findCNPJLabeled,
    findCPF,
    findCompetencia,
    parseCompetenciaToken,
    normalizeName
  };
})();
