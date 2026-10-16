/* ============================================================
   The quote page's form: Cortoa's own.

   The quote page shows Cortoa's own form through the same embed a customer's
   site would use, so the whole flow (form → submit → our own results page) runs
   against the real thing. There is no second form behind it.

   The base is chosen from the hostname, so a localhost URL can never be shipped
   to the live site by accident: served from this machine the form comes from the
   local Cortoa, anywhere else from the deployed one.

   embed.js (served by Cortoa) does the work: it mounts the iframe, sizes it to
   its content, forwards our query string *into* the form, and — after a
   submission — asks this page to navigate, so the visitor lands on the results
   page with the answers on the query string rather than inside a form-sized box.

   This file also owns the *wait*, which is the part that matters when Cortoa is
   starting a container from cold. A spinner covers the slot from the first paint;
   if it is taking a while we offer the phone number and carry on waiting; and if
   embed.js itself fails to arrive we ask for it again. See the thresholds below.
   ============================================================ */
(function () {
  "use strict";

  var IS_LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);

  var LOCAL_BASE = "http://localhost:3010";                 // local Cortoa
  // Deployed Cortoa (GCP project cortoa-test), canonical Cloud Run URL.
  var DEPLOYED_BASE = "https://frontend-237211824257.europe-west1.run.app";
  var CORTQA_BASE = IS_LOCAL ? LOCAL_BASE : DEPLOYED_BASE;

  var SLUG = "findumbrella-quote";             // the form's slug in Cortoa

  // The number this page already carries in its header and footer, written once:
  // it appears in two states below, and two copies of a phone number is one copy
  // that goes stale.
  var PHONE = "020 8191 2489";
  var PHONE_HREF = "tel:02081912489";

  /* How long to wait, and what to say while we do.

     Twelve seconds used to be the whole of it: the spinner stopped and the
     visitor was told to ring us. That is *inside* a cold start — Cortoa starting
     a container is slow, not broken — so the page was giving up on a form that
     was still on its way, and the visitor rang because the site had told them to.

     Two thresholds, because "nothing yet" and "nothing ever" are different facts.
     At the first we add the phone number and carry on waiting. Only at the
     second, where the form is genuinely not coming, do we stop the spinner. */
  var STILL_LOADING_MS = 25000;   // offer the phone, keep the spinner
  var GIVE_UP_MS = 90000;         // stop pretending it is still coming

  var mount = document.getElementById("cortoaQuote");
  if (!mount) return;

  var slot = document.createElement("div");
  slot.setAttribute("data-cortoa-form", SLUG);
  slot.setAttribute("data-min-height", "640");
  // The slot holds the space before the frame exists, so the page does not jump
  // when embed.js arrives — and the placeholder overlaps the frame instead of
  // sitting above it, so taking the placeholder away moves nothing either.
  slot.style.position = "relative";
  slot.style.minHeight = "640px";
  mount.appendChild(slot);

  // Centred and covered from inline styles, not from the stylesheet: this element
  // is built here, so it has no markup of its own to fall back on when a cached
  // stylesheet turns out to be older than the page. The stylesheet only does the
  // spinner and the type.
  var placeholder = document.createElement("div");
  placeholder.className = "embed-loading";
  placeholder.id = "embedLoading";
  placeholder.setAttribute("role", "status");
  placeholder.setAttribute("aria-live", "polite");
  placeholder.setAttribute(
    "style",
    "position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;" +
      "align-items:center;justify-content:center;gap:14px;text-align:center;" +
      "padding:32px;background:#fff"
  );
  placeholder.innerHTML =
    '<span class="embed-spinner" aria-hidden="true"></span>' +
    '<p id="embedLoadingText">Loading your quote form…</p>';
  slot.appendChild(placeholder);

  mount.hidden = false;

  function setLoadingText(html) {
    var text = document.getElementById("embedLoadingText");
    if (text) text.innerHTML = html;
  }

  /* Take the placeholder down when the form says it is there.
     embed.js posts the frame's height once it has laid out, and that — not the
     iframe's load event — is the moment there is something to look at: a loaded
     document is not a rendered form, and swapping at the load event would show
     the visitor a half-built one. */
  var settled = false;
  function formArrived() {
    if (settled) return;
    settled = true;
    placeholder.style.transition = "opacity 0.3s ease";
    placeholder.style.opacity = "0";
    setTimeout(function () {
      if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
      // The floor was only for the wait; the frame's own height is the truth now.
      slot.style.minHeight = "0";
    }, 320);
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== CORTQA_BASE) return;
    var data = event.data;
    if (!data || data.type !== "cortoa:form:height" || data.slug !== SLUG) return;
    formArrived();
  });

  // Taking a while. Say so, offer the phone — and carry on waiting, because the
  // frame can still arrive and waiting is the thing the visitor actually needs.
  setTimeout(function () {
    if (settled) return;
    setLoadingText(
      "Still loading — this takes longer the first time. Call us on " +
        '<a href="' + PHONE_HREF + '">' + PHONE + "</a> if you would rather not wait."
    );
  }, STILL_LOADING_MS);

  // Long enough that it is not coming. Now stop the spinner, because a spinner
  // that never stops is a lie, and offer the thing that actually helps.
  setTimeout(function () {
    if (settled) return;
    var spinner = slot.querySelector(".embed-spinner");
    if (spinner) spinner.style.display = "none";
    setLoadingText(
      "We could not load the quote form. Call us on " +
        '<a href="' + PHONE_HREF + '">' + PHONE + "</a> and we will sort your quote over the phone."
    );
  }, GIVE_UP_MS);

  /* Loading embed.js, with a second try.

     A cold start can fail this request outright — a 502 or a 503 from the
     platform while the container is starting — and that is a different failure
     from the form being slow: no frame is ever created, so there is nothing to
     wait for. Retrying is cheap, and the next request usually meets a container
     that is already up. Nothing is said while we retry: a message that resolves
     itself is worse than a spinner. */
  var attempts = 0;

  function loadEmbed() {
    var script = document.createElement("script");
    script.async = true;
    script.src = CORTQA_BASE + "/embed.js";
    script.onerror = function () {
      if (script.parentNode) script.parentNode.removeChild(script);
      if (settled) return;
      attempts += 1;
      if (attempts > 3) return;      // the timers above take it from here
      setLoadingText("Still loading…");
      setTimeout(loadEmbed, attempts * 1500);
    };
    document.body.appendChild(script);
  }

  loadEmbed();
})();
