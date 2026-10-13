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
  mount.appendChild(slot);
  mount.hidden = false;


  var script = document.createElement("script");
  script.async = true;
  script.src = CORTQA_BASE + "/embed.js";
  document.body.appendChild(script);
})();
