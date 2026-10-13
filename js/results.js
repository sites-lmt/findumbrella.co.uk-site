/* ============================================================
   Find Umbrella — results page
   Reads the answers the Cortoa quote form handed over on the query
   string, and renders
   matched providers with estimated take-home pay.
   ============================================================ */
(function () {
  "use strict";

  /* ======== CONFIG — edit providers here ======== */
  const WEEKS = 52;            // weeks per tax year used to annualise the rate
  const HOURS_PER_DAY = 7.5;   // used to turn an hourly rate into a daily equivalent

  // Authored best-paying first: Ltd, then self-employed, then PAYE. The column a
  // provider uses barely moves across the rate bands, so this order holds for every
  // quote and is also the order the cards are displayed in.
  const PROVIDERS = [
    {
      name: "TJL Contractors",
      url: "",                     // add the provider's site to switch the CTA to "Visit site"
      ir35: "inside",
      series: "ltd",               // which column of RATE_BANDS applies to this provider
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
      name: "Runnymede",
      url: "",
      ir35: "outside",
      series: "se",
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
      name: "IFL Contracts",
      url: "",
      ir35: "both",
      series: "paye",
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
      name: "Umbrella Company UK",
      url: "",
      ir35: "inside",
      series: "paye",
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
      series: "paye",
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

  /* ======== READ THE ANSWERS ========
     From the Cortoa quote form, which is a different origin: it cannot write
     our sessionStorage, so it navigates here with the answers on the query
     string instead. Keys and values are mapped to this page's shape, and
     anything missing falls back to the defaults, so a partial handoff still
     renders a real quote.

     With no answers on the URL the page keeps its example figures and the demo
     note: a visitor who lands here directly has not been quoted, and zeros
     would read as a quote of nothing. */
  function quoteFromQuery() {
    const p = new URLSearchParams(location.search);
    if (!p.has("day_rate") && !p.has("hourly_rate") && !p.has("rate_type")) return null;

    const n = (v) => { const x = parseFloat(v); return isFinite(x) ? x : 0; };
    const cap = (v) => (v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : "");
    // Any spelling of hourly is hourly; the page compares against "Hourly".
    const rateType = /^h/i.test(p.get("rate_type") || "") ? "Hourly" : "Daily";

    return {
      rateType,
      dayRate: n(p.get("day_rate")) || DEFAULT_QUOTE.dayRate,
      hourRate: n(p.get("hourly_rate")) || undefined,
      days: p.get("days_per_week") || DEFAULT_QUOTE.days,
      ir35: cap(p.get("ir35_position")) || DEFAULT_QUOTE.ir35,
      hasContract: cap(p.get("has_contract")) || DEFAULT_QUOTE.hasContract,
      viaAgency: cap(p.get("via_agency")) || DEFAULT_QUOTE.viaAgency,
      agency: p.get("agency") || "",
    };
  }

  let quote = DEFAULT_QUOTE;
  let isDemo = true;

  // One source, because there is one form now. The wizard that wrote `fu_quote`
  // into sessionStorage, and the older one that handed answers over in the URL
  // hash, are both gone — a reader that still accepted them would render
  // figures from a form nobody can reach.
  const handed = quoteFromQuery();
  if (handed) { quote = Object.assign({}, DEFAULT_QUOTE, handed); isDemo = false; }

  const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const dayRate = quote.rateType === "Hourly" ? num(quote.hourRate) * HOURS_PER_DAY : num(quote.dayRate);
  const days = parseInt(quote.days, 10) || 5;
  const rate = dayRate * days * WEEKS;

  /* ======== TAKE-HOME PERCENTAGES ========
     A banded lookup, keyed on the daily-equivalent rate. These are the figures the
     business supplied, so they are used as given rather than recalculated: the tax
     model only ever produced one answer, because every provider shared a margin.

     `max` is the top of the band, inclusive. Original column names:
       paye    <- "tjl - paye"
       ltd     <- "tek - ltd"
       se      <- "ifl - SE"
       preLoan <- "pre - Loan"  (no provider currently maps to this column)   */
  const RATE_BANDS = [
    { max: 100,      paye: 77,    ltd: 83,    se: 83,    preLoan: 85.6  },
    { max: 200,      paye: 68,    ltd: 83.2,  se: 76.73, preLoan: 84.3  },
    { max: 300,      paye: 63,    ltd: 82.8,  se: 69.1,  preLoan: 83.3  },
    { max: 400,      paye: 59,    ltd: 81,    se: 64.18, preLoan: 82.7  },
    { max: 500,      paye: 56,    ltd: 80.3,  se: 61.22, preLoan: 82.32 },
    { max: 600,      paye: 53,    ltd: 80.4,  se: 59.54, preLoan: 82.1  },
    { max: 700,      paye: 52,    ltd: 80.21, se: 58.74, preLoan: 81.94 },
    { max: Infinity, paye: 52,    ltd: 80.11, se: 58.14, preLoan: 81.83 },
  ];

  function bandFor(dailyRate) {
    for (let i = 0; i < RATE_BANDS.length; i++) {
      if (dailyRate <= RATE_BANDS[i].max) return RATE_BANDS[i];
    }
    return RATE_BANDS[RATE_BANDS.length - 1];
  }

  /* ======== TAKE-HOME PER PROVIDER ======== */
  function pctFor(provider) {
    if (!rate || !dayRate) return 0;
    const pct = bandFor(dayRate)[provider.series];
    return pct == null ? 0 : pct;
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

  /* ======== THE HERO, ON CUE ========
     Held rather than started here: a visitor arriving from the form meets the
     arrival panel first, and a number that has already finished counting up by
     the time they see it is a number nobody watched. */
  function animateHero() {
    requestAnimationFrame(() => {
      document.getElementById("ringBar").style.strokeDashoffset = String(390 * (1 - best / 100));
    });
    const el = document.getElementById("heroPct");
    let n = 0;
    const step = Math.max(1, Math.round(best / 22));
    const t = setInterval(() => {
      n += step;
      if (n >= best) { n = best; clearInterval(t); }
      el.textContent = n + "%";
    }, 34);
  }

  /* ======== MATCHING ORDER ========
     Fixed: highest typical percentage first, i.e. the order PROVIDERS is authored in.
     IR35 still drives the filter chips below, but it does not reorder the list — the
     percentage each provider gets barely changes with rate, so a fixed order is the
     honest one.                                                              */
  function ordered() {
    return PROVIDERS.slice();
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
    // A stagger, so the list reads as arriving rather than as appearing at once.
    // The delay belongs to the position, so it is set here rather than in the card.
    grid.querySelectorAll(".provider-card").forEach((el, i) => {
      el.style.transitionDelay = Math.min(i, 6) * 70 + "ms";
    });
    grid.querySelectorAll("[data-details]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = PROVIDERS.find((x) => x.name === btn.dataset.details);
        if (p) openProvider(p);
      });
    });
    // These cards are new elements, and the page's reveal observer has never seen
    // them — without this they keep opacity 0 and the grid looks empty.
    document.dispatchEvent(new Event("fu:reveal"));
  }

  document.querySelectorAll("[data-filter]").forEach((chip) => {
    chip.addEventListener("click", () => {
      filter = chip.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((c) => c.classList.toggle("active", c === chip));
      render();
    });
  });

  render();

  /* ======== ARRIVAL FROM THE QUOTE FORM ========
     Whether to show the panel at all was decided in the head, before the page
     painted — that is the only place the decision can be made without a flash.
     Here there is nothing to decide: if the curtain is up, walk it through and
     bring it down.

     Everything this page shows is already known, so nothing is being waited for.
     It is a presentation of the handover, kept short for exactly that reason.
     The hero animation starts when it lifts, so the count-up is watched rather
     than already over. */
  (function arrival() {
    const root = document.documentElement;
    if (!root.classList.contains("arriving")) { animateHero(); return; }

    const DURATION = 2600;
    try { sessionStorage.setItem("fu_matched", "1"); } catch (e) { /* fine */ }

    const fill = document.getElementById("matchFill");
    const steps = Array.prototype.slice.call(document.querySelectorAll("#matchSteps li"));
    fill.style.transitionDuration = DURATION + "ms";
    steps.forEach((li, i) => {
      setTimeout(() => li.classList.add("on"), (DURATION / (steps.length + 1)) * (i + 1));
    });
    // Two frames: one for the browser to lay the bar out at zero, one to move it.
    // Otherwise both land in the same frame and there is no transition to see.
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = "100%"; }));

    setTimeout(() => {
      const gate = document.getElementById("matchGate");
      root.classList.remove("arriving");
      root.style.overflow = "";
      animateHero();
      // Fade, then take it out of the page entirely — and if the stylesheet is
      // older than this script, the fade is skipped and it goes at once.
      if (gate) {
        gate.classList.add("is-done");
        setTimeout(() => { gate.hidden = true; }, 500);
      }
    }, DURATION);
  })();

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
