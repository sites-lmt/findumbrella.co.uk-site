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
   ============================================================ */
(function () {
  "use strict";

  var IS_LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);

  var LOCAL_BASE = "http://localhost:3010";                 // local Cortoa
  // Deployed Cortoa (GCP project cortoa-test), canonical Cloud Run URL.
  var DEPLOYED_BASE = "https://frontend-237211824257.europe-west1.run.app";
  var CORTQA_BASE = IS_LOCAL ? LOCAL_BASE : DEPLOYED_BASE;

  var SLUG = "findumbrella-quote";             // the form's slug in Cortoa

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
    "<p id=\"embedLoadingText\">Loading your quote form\u2026</p>";
  slot.appendChild(placeholder);

  mount.hidden = false;

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

  // Nothing has come back. Say something true rather than spin for ever — and
  // offer the phone, which is the thing that actually helps.
  setTimeout(function () {
    if (settled) return;
    var text = document.getElementById("embedLoadingText");
    var spinner = slot.querySelector(".embed-spinner");
    if (spinner) spinner.style.display = "none";
    if (text) {
      text.innerHTML =
        "This is taking longer than it should. Call us on " +
        '<a href="tel:02081912489">020 8191 2489</a> and we will sort your quote out.';
    }
  }, 12000);


  var script = document.createElement("script");
  script.async = true;
  script.src = CORTQA_BASE + "/embed.js";
  document.body.appendChild(script);
})();
