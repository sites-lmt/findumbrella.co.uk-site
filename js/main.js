/* Find Umbrella — shared UI behaviour */
(function () {
  "use strict";

  // file:// preview mode: folder-style links (e.g. "guides/") can't resolve to
  // "guides/index.html" locally, so append the index file when not on a server.
  // On the deployed site links stay clean (e.g. "/guides/").
  if (location.protocol === "file:") {
    document.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      if (!href || /^(https?:|mailto:|tel:|#)/.test(href)) return;
      if (href.endsWith("/")) a.setAttribute("href", href + "index.html");
    });
  }

  /* Carry the ad's click id onto the links the visitor can click.

     A paid click arrives with `?gclid=…` on whatever page the ad pointed at. That
     parameter is how the eventual enquiry is attributed back to the click, and on
     this site it lives in the URL and nowhere else — nothing is stored.

     So the moment it is lost is an ordinary navigation: land on the home page,
     click "get a quote", and it is gone, because a link pointing at `quote/` goes
     to `quote/` and nothing more. The visitor is then unattributed, which is
     invisible in the reports because it reads as organic traffic.

     Two things are deliberately *not* carried:

      - **UTM parameters.** They are collected alongside the click id by convention,
        but no field on the form reads one, so carrying them would achieve nothing
        today — and it would make every internal page look like a fresh campaign
        entry to any analytics that later reads these URLs. They belong in a cookie
        (see the attribution standard in the Orchestrator repo), not smeared across
        the site's links.
      - **The legal pages.** A click id on a privacy or cookie link is a click id in
        a document that gets linked to, crawled and quoted. It has no business there.

     This is deliberately not a cookie yet. A first-party cookie would also survive
     the visitor leaving and coming back next week, which is better — but storing
     anything on a visitor's device needs consent, and this site has no cookie
     banner. Until it does, the query string is the only honest place to keep this,
     and it covers the case that actually happens: land, click, ask. */
  const CARRY = [
    "gclid", "wbraid", "gbraid", // Google — iOS sends wbraid/gbraid, never gclid
    "fbclid", "msclkid", "ttclid", "li_fat_id",
  ];
  const NEVER_CARRY_ONTO = /^\/(privacy-policy|terms-conditions|cookie-policy)(\/|$)/;

  const arriving = new URLSearchParams(location.search);
  const carrying = CARRY.filter((key) => arriving.get(key));

  if (carrying.length) {
    document.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      if (!href || /^(https?:|mailto:|tel:|#)/.test(href)) return;

      // Resolving against this page settles two things at once: whether the link is
      // ours, and what it actually points at. A malformed href is skipped rather
      // than thrown on — this runs before the nav, the accordions and the reveal,
      // and one bad link must not take the rest of the page with it.
      let url;
      try {
        url = new URL(href, location.href);
      } catch (e) {
        return;
      }
      if (url.host !== location.host) return;
      if (NEVER_CARRY_ONTO.test(url.pathname)) return;

      // Whatever the link already carried is kept — the results page puts the
      // visitor's answers on the query string. Only what is missing is added.
      let added = false;
      carrying.forEach((key) => {
        if (!url.searchParams.get(key)) {
          url.searchParams.set(key, arriving.get(key));
          added = true;
        }
      });
      if (!added) return;

      // Written back as it was written: `quote/` stays `quote/` with the parameters
      // appended, rather than turning into an absolute URL.
      const path = href.split(/[?#]/)[0];
      a.setAttribute("href", path + "?" + url.searchParams.toString() + (url.hash || ""));
    });
  }

  // Mobile nav
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  if (header && toggle) {
    toggle.addEventListener("click", () => header.classList.toggle("nav-open"));
    header.querySelectorAll(".main-nav a").forEach((a) =>
      a.addEventListener("click", () => header.classList.remove("nav-open"))
    );
  }

  // FAQ / accordions
  document.querySelectorAll(".faq-item").forEach((item) => {
    const q = item.querySelector(".faq-q");
    const a = item.querySelector(".faq-a");
    if (!q || !a) return;
    q.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      item.parentElement.querySelectorAll(".faq-item.open").forEach((other) => {
        other.classList.remove("open");
        other.querySelector(".faq-a").style.maxHeight = null;
      });
      if (!isOpen) {
        item.classList.add("open");
        a.style.maxHeight = a.scrollHeight + "px";
      }
    });
  });

  // Footer year
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  // Reveal on scroll.
  //
  // A scan can also be asked for, because the results grid rewrites itself on
  // every filter click: the replacement cards are elements the observer has
  // never seen. They kept `.reveal` — opacity 0 — with nothing left to remove
  // it, so the grid went blank the moment a chip was pressed.
  const revealables = () => document.querySelectorAll(".reveal:not(.visible)");
  const showAll = () => revealables().forEach((el) => el.classList.add("visible"));

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    const scan = () => revealables().forEach((el) => io.observe(el));
    document.addEventListener("fu:reveal", scan);
    scan();
  } else {
    document.addEventListener("fu:reveal", showAll);
    showAll();
  }
})();
