/* ============================================================
   Find Umbrella — results page
   Reads the saved quote (js/quote.js → sessionStorage) and renders
   matched providers with estimated take-home pay.
   ============================================================ */
(function () {
  "use strict";

  /* ======== CONFIG — edit providers here ======== */
  const WEEKS = 52;            // weeks per tax year used to annualise the rate
  const ASSUMED_MARGIN = 25;   // £/week umbrella margin used when a provider's fee isn't set

  const PROVIDERS = [
    {
      name: "TJL Contractors",
      url: "",                     // add the provider's site to switch the CTA to "Visit site"
      ir35: "inside",
      marginPerWeek: null,         // set a £/week fee to show this provider's own take-home figure
      features: [
        "Free insurance cover",
        "No join or exit fees",
        "PAYE — perfect for those inside IR35",
      ],
      offer: "Joining offer — £120 paid after 3 months invoicing",
      meta: "Main demographic — Healthcare, Locums, IT Professionals",
      more: "A PAYE-only umbrella with no joining or exit fees and insurance included. Popular with locums and healthcare contractors who want compliant payroll with a fixed weekly margin.",
    },
    {
      name: "IFL Contracts",
      url: "",
      ir35: "both",
      marginPerWeek: null,
      features: [
        "Low fees",
        "Comprehensive insurance",
        "High return option — via self-employed for those outside IR35",
      ],
      offer: "Joining offer — £120 paid after 3 months invoicing",
      meta: "Suitable for contractors inside or outside IR35",
      more: "Runs both PAYE umbrella payroll and a self-employed option for contractors who are outside IR35 — useful if your IR35 position changes between contracts.",
    },
    {
      name: "Runnymede",
      url: "",
      ir35: "outside",
      marginPerWeek: null,
      features: [
        "Same-day pay",
        "Free to come and go — no exit fees",
        "Dedicated account manager",
        "High return option — ideal for those outside IR35",
      ],
      offer: "Joining offer — up to £1,200, depending on rate",
      meta: "Main demographic — IT Professionals, Healthcare",
      more: "Built for experienced contractors, with a named account manager and same-day payments once your agency funds clear. Best value on higher day rates.",
    },
    {
      name: "Umbrella Company UK",
      url: "",
      ir35: "inside",
      marginPerWeek: null,
      features: [
        "Low fees",
        "Free insurance cover",
        "Quick payments",
        "PAYE — perfect for those inside IR35",
      ],
      offer: null,
      meta: "Straightforward PAYE payroll for inside-IR35 contracts",
      more: "A no-frills, low-cost PAYE umbrella. A good fit if you just want compliant payroll, quick payments and cover included without extras.",
    },
    {
      name: "Orange Genie Umbrella",
      url: "",
      ir35: "inside",
      marginPerWeek: null,
      features: [
        "Low fees",
        "Free insurance cover",
        "Quick payments",
        "PAYE — perfect for those inside IR35",
      ],
      offer: null,
      meta: "Established provider with a long trading history",
      more: "One of the longer-established names in umbrella payroll, with a reputation for compliance and insurer-backed cover included in the fee.",
    },
  ];

  const DEFAULT_QUOTE = {
    rateType: "Daily", dayRate: 500, days: "5", ir35: "Inside",
    hasContract: "Yes", viaAgency: "Yes", agency: "",
  };

  /* ======== PROVIDER DETAILS (shown in the "More details" modal) ========
     Providers without a "profile" simply link out to their website.        */
  const STANDARD_INSURANCES = [
    "Employers' liability insurance",
    "Public liability insurance",
    "Professional indemnity insurance",
  ];
  const STANDARD_ADMIN = [
    "Invoicing, payment allocation and credit control",
    "Payroll operation and salary payments",
    "All company VAT and Corporation Tax",
    "Companies House returns",
  ];

  const PROVIDER_INFO = {
    "TJL Contractors": {
      logo: "tjlcontracts-logo.png",
      url: "https://www.tjlcontractors.co.uk/umbrella",
      profile: [
        "Working through TJL Contractors offers an easy first step into contracting while minimising the hassle of paperwork and responsibilities. TJL Contractors has over 10 years' experience making life easier for contractors.",
        "With TJL Contractors you'll reduce the hassle of paperwork and administration while benefiting from a range of insurance packages built to permanent-employment standards.",
      ],
      highlightsTitle: "Important features",
      highlights: ["Free insurance cover", "No sign-up or exit fees", "24/7 support"],
      insurances: STANDARD_INSURANCES,
      adminTasks: STANDARD_ADMIN,
    },
    "IFL Contracts": {
      logo: "iflcontracts-logo.png",
      url: "https://www.iflmanagement.co.uk/",
      phone: "01784 618224",
      profile: [
        "As part of the successful IFL Group, we have over 18 years' experience working with contractors, giving us insight into your needs and work practices. We currently manage over £16 million in funds and have over 400 contractor 'partners'.",
        "We work with all the major agencies throughout the UK and are familiar with their preferred working practices to ensure swift payment of all accounts.",
      ],
      highlightsTitle: "Important features",
      highlights: ["Low fees", "Comprehensive insurance", "Free to come and go"],
      insurances: STANDARD_INSURANCES,
      adminTasks: STANDARD_ADMIN,
    },
    "Runnymede": {
      logo: "runnymede-umbrella-logo.png",
      profile: [
        "We provide contractor payment solutions focused on tax-efficiency, so you can enjoy greater returns than with an ordinary umbrella company. We are 100% compliant and used by 1,000s of UK contractors like you.",
        "Our tax planning strategies offer outstanding financial returns for contractors who seek to maximise their current earnings in a legal and compliant manner.",
      ],
      highlightsTitle: "Key benefits",
      highlights: ["Same-day pay", "Free to come and go"],
      insurances: STANDARD_INSURANCES,
      adminTasks: STANDARD_ADMIN,
    },
    "Umbrella Company UK": { logo: "umbrella-company-uk-logo.png", url: "https://umbrellacompanyuk.co.uk/" },
    "Orange Genie Umbrella": { logo: "orange-genie-logo.jpg", url: "https://www.orangegenie.com/" },
  };

  /* ======== READ THE SAVED QUOTE ======== */
  let quote = DEFAULT_QUOTE;
  let isDemo = true;
  try {
    const raw = sessionStorage.getItem("fu_quote");
    if (raw) { quote = Object.assign({}, DEFAULT_QUOTE, JSON.parse(raw)); isDemo = false; }
  } catch (e) { /* storage unavailable (some file:// setups) */ }

  // Fallback: answers carried in the URL hash by the quote form
  if (isDemo && location.hash.indexOf("#q=") === 0) {
    try {
      quote = Object.assign({}, DEFAULT_QUOTE, JSON.parse(decodeURIComponent(location.hash.slice(3))));
      isDemo = false;
    } catch (e) { /* bad hash — keep the example */ }
  }

  const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const dayRate = quote.rateType === "Hourly" ? num(quote.hourRate) * 7.5 : num(quote.dayRate);
  const days = parseInt(quote.days, 10) || 5;
  const rate = dayRate * days * WEEKS;

  /* ======== TAKE-HOME PER PROVIDER ======== */
  function pctFor(provider) {
    if (!rate) return 0;
    const r = TaxCalc.umbrellaTakeHome({
      dayRate: dayRate, daysPerWeek: days, weeksPerYear: WEEKS,
      marginPerWeek: provider.marginPerWeek == null ? ASSUMED_MARGIN : provider.marginPerWeek,
      region: "england", studentLoan: "none", pensionPct: 0, includeLevy: true,
    });
    return (r.takeHome / r.assignment) * 100;
  }

  /* ======== HERO ======== */
  const best = Math.round(Math.max.apply(null, PROVIDERS.map(pctFor)));
  const fmtMoney = (n) => "£" + Math.round(n).toLocaleString("en-GB");

  document.getElementById("heroPct").textContent = best + "%";
  document.getElementById("ringPct").textContent = best + "%";
  document.getElementById("factRate").textContent = quote.rateType === "Hourly"
    ? fmtMoney(num(quote.hourRate)) + "/hr" : fmtMoney(num(quote.dayRate)) + "/day";
  document.getElementById("factDays").textContent = days;
  document.getElementById("factIr35").textContent = quote.ir35 === "Not sure" ? "IR35 status to confirm" : (quote.ir35 || "—") + " IR35";
  document.getElementById("factWeeks").textContent = WEEKS;
  document.getElementById("asmWeeks").textContent = WEEKS;
  if (quote.agency && quote.viaAgency !== "No") document.getElementById("factAgency").textContent = quote.agency;
  else document.getElementById("factAgencyChip").hidden = true;
  if (isDemo) document.getElementById("demoNote").hidden = false;

  // animated ring + counter
  requestAnimationFrame(() => {
    document.getElementById("ringBar").style.strokeDashoffset = String(390 * (1 - best / 100));
  });
  (function countUp() {
    const el = document.getElementById("heroPct");
    let n = 0;
    const step = Math.max(1, Math.round(best / 22));
    const t = setInterval(() => {
      n += step;
      if (n >= best) { n = best; clearInterval(t); }
      el.textContent = n + "%";
    }, 34);
  })();

  /* ======== MATCHING ORDER ======== */
  // Providers that suit the contractor's IR35 position are shown first.
  function ordered() {
    const status = (quote.ir35 || "").toLowerCase();
    const score = (p) => {
      if (status === "inside") return (p.ir35 === "inside" || p.ir35 === "both") ? 0 : 2;
      if (status === "outside") return (p.ir35 === "outside" || p.ir35 === "both") ? 0 : 1;
      return 0; // "not sure" or unknown — keep the authored order
    };
    return PROVIDERS
      .map((p, i) => ({ p, s: score(p), i }))
      .sort((a, b) => a.s - b.s || a.i - b.i)
      .map((x) => x.p);
  }

  /* ======== PROVIDER CARDS ======== */
  const grid = document.getElementById("providerGrid");
  let filter = "all";

  function card(p, isBest) {
    const pct = Math.round(pctFor(p));
    const info = PROVIDER_INFO[p.name] || {};
    const url = p.url || info.url || "";
    const external = !!url;
    const hasModal = !!info.profile;
    const ctaHref = external ? url : "../contact/";
    const ctaLabel = external ? (hasModal ? "Visit site" : "Learn more") : "Get introduced";
    return `
      <article class="provider-card reveal${isBest ? " best" : ""}">
        ${isBest ? '<span class="ribbon">Best match</span>' : ""}
        ${info.logo ? `<div class="pc-brand"><img src="../images/${info.logo}" alt="${p.name} logo"></div>` : ""}
        <div class="pc-head">
          <div>
            <div class="pc-name">${p.name}</div>
            <div class="pc-tag">${p.ir35 === "inside" ? "Inside IR35" : p.ir35 === "outside" ? "Outside IR35" : "Inside or outside IR35"}</div>
          </div>
          <div class="pc-pct"><b>${pct}%</b><span>you get</span></div>
        </div>
        <ul class="pc-list">${p.features.map((f) => `<li>${f}</li>`).join("")}</ul>
        ${p.offer ? `<div class="pc-offer">🎁 ${p.offer}</div>` : ""}
        <div class="pc-meta">${p.meta}</div>
        <div class="pc-actions">
          <a href="${ctaHref}" class="btn btn-primary btn-sm"${external ? ' target="_blank" rel="noopener"' : ""}>${ctaLabel}</a>
          ${hasModal ? `<button class="btn btn-soft btn-sm" data-details="${p.name}">More details</button>` : ""}
        </div>
      </article>`;
  }

  function render() {
    const list = ordered().filter((p) =>
      filter === "all" ? true : filter === "inside" ? p.ir35 !== "outside" : p.ir35 !== "inside"
    );
    grid.innerHTML = list.map((p, i) => card(p, i === 0)).join("");
    grid.querySelectorAll("[data-details]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = PROVIDERS.find((x) => x.name === btn.dataset.details);
        if (p) openProvider(p);
      });
    });
  }

  document.querySelectorAll("[data-filter]").forEach((chip) => {
    chip.addEventListener("click", () => {
      filter = chip.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((c) => c.classList.toggle("active", c === chip));
      render();
    });
  });

  render();

  /* ======== PROVIDER DETAIL MODAL ======== */
  const pModal = document.getElementById("providerModal");
  const pBody = document.getElementById("pmBody");

  function openProvider(p) {
    const info = PROVIDER_INFO[p.name] || {};
    const list = (arr) => `<ul class="modal-list">${arr.map((i) => `<li>${i}</li>`).join("")}</ul>`;
    let html = "";

    if (p.more) html += `<div class="note">${p.more}</div>`;
    if (info.profile) {
      html += `<h3 class="modal-sub">Company profile</h3>`;
      html += info.profile.map((t) => `<p>${t}</p>`).join("");
    }
    if (info.highlights) {
      html += `<h3 class="modal-sub">${info.highlightsTitle || "Important features"}</h3>${list(info.highlights)}`;
    }
    if (info.url || info.phone) {
      html += `<h3 class="modal-sub">Website</h3><p>`;
      if (info.url) {
        html += `<a href="${info.url}" target="_blank" rel="noopener">${info.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>`;
      }
      if (info.phone) {
        html += `${info.url ? " · " : ""}<a href="tel:${info.phone.replace(/\s+/g, "")}">${info.phone}</a>`;
      }
      html += `</p>`;
    }
    if (info.insurances) html += `<h3 class="modal-sub">Insurances</h3>${list(info.insurances)}`;
    if (info.adminTasks) html += `<h3 class="modal-sub">Key administrative tasks</h3>${list(info.adminTasks)}`;

    html += `<div class="modal-cta">
      ${info.url ? `<a class="btn btn-primary" href="${info.url}" target="_blank" rel="noopener">Visit site</a>` : ""}
      <a class="btn btn-soft" href="../contact/">Get introduced</a>
    </div>`;

    const logo = document.getElementById("pmLogo");
    if (logo) {
      if (info.logo) { logo.src = "../images/" + info.logo; logo.alt = p.name + " logo"; logo.hidden = false; }
      else { logo.hidden = true; logo.removeAttribute("src"); }
    }
    document.getElementById("pmName").textContent = p.name;
    document.getElementById("pmPct").textContent = Math.round(pctFor(p)) + "%";
    pBody.innerHTML = html;
    if (pModal && pModal.showModal) pModal.showModal();
  }

  const pmClose = document.getElementById("pmClose");
  if (pmClose) pmClose.addEventListener("click", () => pModal.close());
  if (pModal) pModal.addEventListener("click", (e) => { if (e.target === pModal) pModal.close(); });

  /* ======== AD DISCLOSURE MODAL ======== */
  const modal = document.getElementById("adModal");
  const openModal = () => { if (modal && modal.showModal) modal.showModal(); };
  ["adBtn", "adBtn2"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", openModal);
  });
  const closeBtn = document.getElementById("adClose");
  if (closeBtn) closeBtn.addEventListener("click", () => modal.close());
  if (modal) modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });
})();
