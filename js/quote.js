/* ============================================================
   Find Umbrella — quote wizard
   One question at a time, Enter to advance, conditional logic
   mirroring the original form. Posts leads to Cortoa's public
   inbound endpoint — see API_BASE below.
   ============================================================ */
(function () {
  "use strict";

  /* ======== CONFIGURATION ======== */

  // Cortoa's deployment URL. Everything below derives from it. While this is
  // empty the wizard still works and still shows results — it just does not
  // send the lead anywhere, which is why it must be set before launch.
  const API_BASE = "";                   // e.g. "https://cortoa-xxxxx-ew.a.run.app"
  const PUBLIC_SLUG = "findumbrella";    // identifies the tenant. Public, not a secret.

  // Business rules the site still owns. Cortoa's /config endpoint serves the
  // tenant's lookup options, not these, so they stay here for now.
  const AGENCY_BLOCKLIST = [];           // e.g. ["Agency Name"] — polite message if matched

  // Deal custom fields to send, keyed by the field key defined in Cortoa.
  // MUST stay empty until matching field definitions exist for this team — the
  // endpoint rejects unknown keys with a 400, which would lose the lead. Once
  // confirmed, map Cortoa's key to a wizard answer, e.g.:
  //   { ir35_status: "ir35", day_rate: "dayRate" }
  const CUSTOM_FIELDS = {};

  // Epoch seconds the form mounted. Cortoa treats a submission faster than 3s
  // as a bot, so this is set once at load — never when a field renders.
  const MOUNTED_AT = Math.floor(Date.now() / 1000);

  /* ======== QUESTION FLOW ======== */
  const STEPS = [
    { id: "rateType", q: "Are you paid by an hourly or daily rate?", type: "choice", options: ["Hourly", "Daily"] },
    { id: "dayRate", q: "What's your daily rate? (£)", type: "number", prefix: "£", min: 1, max: 10000, show: (s) => s.rateType === "Daily" },
    { id: "hourRate", q: "What's your hourly rate? (£)", type: "number", prefix: "£", min: 1, max: 5000, show: (s) => s.rateType === "Hourly" },
    { id: "days", q: "How many days a week do you work?", type: "choice", options: ["1", "2", "3", "4", "5", "6", "7"], compact: true },
    { id: "hasContract", q: "Do you have a contract, or a contract starting soon you want to be paid through an umbrella company?", type: "choice", options: ["Yes", "No"] },
    { id: "viaAgency", q: "Do you work (or will be working) through a recruitment agency?", type: "choice", options: ["Yes", "No"], note: "We look for umbrella companies that are experienced in working with your agency.", show: (s) => s.hasContract === "Yes" },
    { id: "agency", q: "What's your recruitment agency?", type: "text", placeholder: "e.g. Hays", show: (s) => s.hasContract === "Yes" && s.viaAgency === "Yes" },
    { id: "fcsa", q: "Has your agency asked for an FCSA accredited umbrella?", type: "choice", options: ["Yes", "No", "Not sure"], show: (s) => s.hasContract === "Yes" && s.viaAgency === "Yes" },
    { id: "payFreq", q: "How often do you get paid?", type: "choice", options: ["Weekly", "Monthly"] },
    { id: "ir35", q: "Is your current/upcoming contract inside or outside IR35?", type: "choice", options: ["Inside", "Outside", "Not sure"] },
    { id: "contact", q: "Where shall we send your results?", type: "contact" },
  ];

  const state = {};
  let currentId = "start";

  const $ = (id) => document.getElementById(id);
  const els = {
    wizard: $("quoteWizard"),
    steps: $("wzSteps"),
    head: $("wzHead"),
    nav: $("wzNav"),
    backBtn: $("wzBack"),
    nextBtn: $("wzNext"),
    fill: $("wzFill"),
    label: $("wzLabel"),
    hint: $("wzHint"),
  };
  if (!els.wizard) return;

  /* ======== CORTOA BACKEND ======== */
  let turnstileToken = "";
  let resultsPayload = null;
  let storageOk = false;

  function contactStep() { return els.steps.querySelector('[data-step="contact"]'); }

  function loadConfig() {
    if (!API_BASE) return Promise.resolve(null);
    return fetch(`${API_BASE}/api/public/${PUBLIC_SLUG}/config`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }

  // Rendered only when the tenant has a Turnstile site key configured. The site
  // key is public by design; its secret counterpart never leaves the server.
  function mountTurnstile(siteKey) {
    const host = contactStep() && contactStep().querySelector("[data-turnstile]");
    if (!siteKey || !host) return;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.turnstile) return;
      window.turnstile.render(host, {
        sitekey: siteKey,
        callback: (token) => { turnstileToken = token; },
        "error-callback": () => { turnstileToken = ""; },
        "expired-callback": () => { turnstileToken = ""; },
      });
    };
    document.head.appendChild(script);
  }

  // A readable summary for whoever picks the lead up. Deliberately plain text
  // with no links — Cortoa scores link-heavy messages as likely spam.
  function describeAnswers() {
    const annual = Math.round(computeAnnualRate());
    const rows = [
      ["Basis", state.rateType],
      ["Day rate", state.dayRate ? "£" + state.dayRate : ""],
      ["Hourly rate", state.hourRate ? "£" + state.hourRate : ""],
      ["Days per week", state.days],
      ["Annualised", annual ? "£" + annual.toLocaleString("en-GB") : ""],
      ["Has contract", state.hasContract],
      ["Via agency", state.viaAgency],
      ["Agency", state.agency],
      ["FCSA accredited required", state.fcsa],
      ["Pay frequency", state.payFreq],
      ["IR35", state.ir35],
    ];
    return rows.filter((r) => r[1]).map((r) => `${r[0]}: ${r[1]}`).join("\n");
  }

  function buildCustomFields() {
    const out = {};
    Object.keys(CUSTOM_FIELDS).forEach((key) => {
      const src = CUSTOM_FIELDS[key];
      const value = typeof src === "function" ? src(state) : state[src];
      if (value !== undefined && value !== null && value !== "") out[key] = value;
    });
    return out;
  }

  function sendLead() {
    const body = {
      name: state.name,
      email: state.email,
      phone: state.phone,
      company: state.agency || "",
      message: describeAnswers(),
      consent: true,          // the checkbox is enforced before we get here
      source: "inbound_form",
      website: "",            // honeypot — a human never fills this
      _t: MOUNTED_AT,
      customFields: buildCustomFields(),
    };
    if (turnstileToken) body.turnstileToken = turnstileToken;

    return fetch(`${API_BASE}/api/public/${PUBLIC_SLUG}/lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).then((res) => {
      // A 200 covers both a real accept and Cortoa's deliberate fake-success for
      // caught bots — the two are indistinguishable by design.
      if (!res.ok) throw new Error("Lead capture failed: HTTP " + res.status);
      return true;
    });
  }

  function goToResults() {
    const payload = resultsPayload || Object.assign({}, state);
    // Folder-style URLs need the index file when previewing over file://
    const base = location.protocol === "file:" ? "../results/index.html" : "../results/";
    // If storage is unavailable, carry the answers in the URL so results still personalise
    location.href = storageOk ? base : base + "#q=" + encodeURIComponent(JSON.stringify(payload));
  }

  /* ======== TEMPLATES ======== */
  function template(s) {
    if (s.type === "choice") {
      const cols = s.compact ? " days" : s.options.length > 2 ? " cols-3" : " cols-2";
      const opts = s.options
        .map((o) => `<label class="wz-option"><input type="radio" name="${s.id}" value="${o}"><span>${o}</span></label>`)
        .join("");
      return `<h2 class="wizard-q">${s.q}</h2>${s.note ? `<p class="wizard-note">${s.note}</p>` : ""}<div class="wz-options${cols}">${opts}</div><div class="wizard-error" data-error></div>`;
    }
    if (s.type === "number") {
      return `<h2 class="wizard-q">${s.q}</h2><div class="wz-input-wrap"><span class="prefix">${s.prefix}</span><input class="wizard-input" type="number" inputmode="numeric" autocomplete="off" min="${s.min}" max="${s.max}" placeholder="0" data-input></div><div class="wizard-error" data-error></div>`;
    }
    if (s.type === "text") {
      return `<h2 class="wizard-q">${s.q}</h2><input class="wizard-input" type="text" autocomplete="off" placeholder="${s.placeholder}" data-input><div class="wizard-error" data-error></div>`;
    }
    if (s.type === "contact") {
      return `<h2 class="wizard-q">${s.q}</h2>
        <form class="wz-contact" autocomplete="on" novalidate>
          <label class="sr-only" for="wzName">Your name</label>
          <input class="wizard-input" id="wzName" name="name" type="text" placeholder="Your name" autocomplete="name" aria-label="Your name" data-field="name">
          <label class="sr-only" for="wzEmail">Your email</label>
          <input class="wizard-input" id="wzEmail" name="email" type="email" inputmode="email" placeholder="Your email" autocomplete="email" aria-label="Your email" data-field="email">
          <label class="sr-only" for="wzPhone">Your phone</label>
          <input class="wizard-input" id="wzPhone" name="phone" type="tel" inputmode="tel" placeholder="Your phone" autocomplete="tel" aria-label="Your phone" data-field="phone">
          <label class="wz-consent">
            <input type="checkbox" data-consent>
            <span>I'm happy to be contacted about this enquiry. See our <a href="../privacy-policy/" target="_blank" rel="noopener">privacy policy</a>.</span>
          </label>
          <div class="wz-turnstile" data-turnstile></div>
          <!-- Off-screen rather than display:none, and off the tab order. Bots fill it in. -->
          <input class="wz-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        </form>
        <div class="wizard-error" data-error></div>
        <div class="wz-fail" data-fail hidden>
          <strong>We couldn't send your enquiry.</strong>
          <p>Please call <a href="tel:02081912489">020 8191 2489</a> or email
          <a href="mailto:info@findumbrella.co.uk">info@findumbrella.co.uk</a> and we'll pick it up straight away.</p>
          <button type="button" class="btn btn-outline-dark" data-continue>See your results anyway</button>
        </div>`;
    }
    return "";
  }

  function render() {
    STEPS.forEach((s) => {
      const sec = document.createElement("section");
      sec.className = "wizard-step";
      sec.dataset.step = s.id;
      sec.innerHTML = template(s);
      els.steps.appendChild(sec);

      // Native submission must never fire — the wizard advances via next()
      const form = sec.querySelector("form");
      if (form) form.addEventListener("submit", (e) => e.preventDefault());

      const cont = sec.querySelector("[data-continue]");
      if (cont) cont.addEventListener("click", () => goToResults());

      sec.querySelectorAll("input").forEach((input) => {
        input.addEventListener("input", () => {
          if (s.type === "contact") {
            if (input.dataset.field) state[input.dataset.field] = input.value;
          } else state[s.id] = input.value;
          setError(s.id, "");
        });
        if (input.type === "radio") {
          input.addEventListener("change", () => {
            state[s.id] = input.value;
            setError(s.id, "");
            setTimeout(() => next(), 180); // auto-advance, Typeform-style
          });
        }
      });
    });
  }

  /* ======== HELPERS ======== */
  function stepById(id) { return STEPS.find((s) => s.id === id); }
  function activeSteps() { return STEPS.filter((s) => !s.show || s.show(state)); }
  function stepEl(id) { return els.steps.querySelector(`[data-step="${id}"]`); }
  function setError(id, msg) {
    const el = stepEl(id) && stepEl(id).querySelector("[data-error]");
    if (el) { el.textContent = msg; el.classList.toggle("show", !!msg); }
  }

  function validate(s) {
    const v = state[s.id];
    if (s.type === "choice") return v ? "" : "Please choose an option.";
    if (s.type === "number") {
      const n = parseFloat(v);
      if (!isFinite(n) || n < (s.min || 0)) return "Please enter a valid amount.";
      if (s.max && n > s.max) return "That seems a little high — please double-check.";
      return "";
    }
    if (s.type === "text") {
      if (!v || !v.trim()) return "Please enter your recruitment agency.";
      if (AGENCY_BLOCKLIST.some((b) => v.toLowerCase().includes(b.toLowerCase()))) {
        return "I'm sorry, but your agency is one of the few we do not currently work with. If you have another agency, please enter it — or call us and we'll try to help.";
      }
      return "";
    }
    if (s.type === "contact") {
      if (!state.name || !state.name.trim()) return "Please enter your name.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(state.email || "")) return "Please enter a valid email address.";
      if (!(state.phone || "").replace(/\D/g, "").length >= 7) return "Please enter your phone number.";
      const box = stepEl("contact") && stepEl("contact").querySelector("[data-consent]");
      if (box && !box.checked) return "Please tick the box so we know we can contact you.";
      return "";
    }
    return "";
  }

  /* ======== NAVIGATION ======== */
  function show(id) {
    currentId = id;
    els.head.hidden = false;
    els.nav.hidden = false;
    els.hint.hidden = false;
    els.steps.querySelectorAll(".wizard-step").forEach((el) => el.classList.toggle("is-active", el.dataset.step === id));
    const list = activeSteps();
    const i = list.findIndex((s) => s.id === id);
    els.fill.style.width = ((i + 1) / list.length) * 100 + "%";
    els.label.textContent = `Question ${i + 1} of ${list.length}`;
    els.nextBtn.textContent = id === "contact" ? "Get My Results" : "Next";
    // Nothing to go back to on the first question. Hide rather than remove so
    // the progress bar stays in the same place on every step.
    els.backBtn.style.visibility = i <= 0 ? "hidden" : "visible";
    const input = stepEl(id) && stepEl(id).querySelector("input");
    if (input) input.focus();
  }

  function next() {
    const s = stepById(currentId);
    if (!s) return;
    const err = validate(s);
    if (err) { setError(s.id, err); return; }
    const list = activeSteps();
    const i = list.findIndex((x) => x.id === currentId);
    const target = list[i + 1];
    if (target) show(target.id);
    else submit();
  }

  function prev() {
    const list = activeSteps();
    const i = list.findIndex((x) => x.id === currentId);
    if (i > 0) show(list[i - 1].id);
  }

  /* ======== SUBMIT ======== */
  function computeAnnualRate() {
    const days = parseInt(state.days, 10) || 5;
    if (state.rateType === "Hourly") return (parseFloat(state.hourRate) || 0) * 7.5 * days * 52;
    return (parseFloat(state.dayRate) || 0) * days * 52;
  }

  function submit() {
    resultsPayload = Object.assign({}, state);

    storageOk = false;
    try { sessionStorage.setItem("fu_quote", JSON.stringify(resultsPayload)); storageOk = true; } catch (e) { storageOk = false; }

    // Not wired to a backend yet — still show the user their results.
    if (!API_BASE) { goToResults(); return; }

    els.nextBtn.disabled = true;
    els.nextBtn.textContent = "Sending…";

    sendLead()
      .then(() => { goToResults(); })
      .catch((err) => {
        // Never lose the lead silently: tell them to call or email us.
        console.error("Lead capture failed:", err);
        els.nextBtn.disabled = false;
        els.nextBtn.textContent = "Get My Results";
        const fail = stepEl("contact") && stepEl("contact").querySelector("[data-fail]");
        if (fail) fail.hidden = false;
      });
  }

  /* ======== EVENTS ======== */
  els.nextBtn.addEventListener("click", next);
  els.backBtn.addEventListener("click", prev);

  els.wizard.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const t = e.target;
    if (t && t.tagName === "INPUT" && t.type !== "radio") {
      e.preventDefault();
      next();
    }
  });

  render();
  // No intro screen — the first question is the call to action.
  show(activeSteps()[0].id);

  // Tenant config decides whether Turnstile renders. Failure is non-fatal: the
  // wizard works without it, and Cortoa skips the check when no secret is set.
  loadConfig().then((cfg) => {
    if (cfg && cfg.turnstileSiteKey) mountTurnstile(cfg.turnstileSiteKey);
  });
})();
