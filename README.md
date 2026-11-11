# Find Umbrella — static site rebuild

findumbrella.co.uk rebuilt as a static HTML/CSS/JS site, in the same style as the
other umbrella brand sites. **Built; deployment in progress** — see
[LAUNCH-PLAN.md](../find-umbrella-internal/LAUNCH-PLAN.md) and
[DEPLOY-RUNBOOK.md](../find-umbrella-internal/DEPLOY-RUNBOOK.md).

Internal docs live in `../find-umbrella-internal/` on purpose: everything in
*this* folder is published to the web.

## Structure

- `index.html` — homepage
- `css/style.css` — shared design system (brand blue, darker blue surfaces, a touch of green — no yellow)
- `js/tax.js` — shared UK tax engine, **2026/27 rates** (verified GOV.UK, Sep 2026)
- `js/main.js` — nav, accordions, scroll reveal, `file://` link rewriting
- `js/quote.js` — the `/quote/` wizard; posts leads to Cortoa (set `API_BASE` at the top to enable)
- `js/results.js` — `/results/` rendering
- `calculators/` — hub listing all nine calculators

## URL policy

Keep slugs IDENTICAL to the WordPress site to preserve Search Console
impressions (~19.7k impressions, only 8 clicks):

- Calculators live at site root: `/umbrella-calculator/`, `/ir35-calculator/`, etc.
  → one folder per calculator with its own `index.html` (GitHub Pages).
- Guides live under `/umbrella-company/<slug>/` → nested folders.
- Standard pages: `/about/`, `/contact/`, `/quote/`, `/faq/`, `/guides/`,
  `/refer/`, `/privacy-policy/`, `/cookie-policy/`, `/terms-conditions/`.

### Legacy URLs that do NOT exist here

The WordPress sitemap is unusable — `/sitemap_index.xml` and `/wp-sitemap.xml`
both return `text/html` (a catch-all), not XML. The old URL list was recovered
from the Wayback CDX index instead: **53 URLs**, of which **22 have no page in
this build**. Each now has a redirect stub at its old path, so old links and
bookmarks still land somewhere sensible rather than on a 404. Map:
`../find-umbrella-internal/migration-redirects.csv`.

Six were live, keyword-targeted landing pages, each with its own `<h1>`:

| Old URL | `<h1>` |
|---|---|
| `/best-umbrella-companies/` | Compare the best UK Umbrella companies |
| `/calculate-take-home-pay/` | Calculate take home pay with top paying umbrellas |
| `/contractor-services/` | Made for UK Contractors |
| `/healthcare/` | Umbrella comparison for Healthcare Professionals |
| `/home-hmrc-umbrellas/` | HMRC Compliant Umbrella Companies |
| `/home-2/` | Improve Your Take Home Pay Today |

These are plausibly a large share of the 19.7k impressions. Whether to redirect
them or rebuild them as pages in this design is an open decision — see
LAUNCH-PLAN.md.

## Conventions

- Every page repeats the topbar/header/footer — keep them in sync across pages.
- Relative paths: pages at root use `css/`, pages one level deep use `../css/`.
- Calculators pull constants from `js/tax.js` (`window.TaxCalc`) — never hardcode rates.
- Brand rule: Find Umbrella Ltd is its own brand. No other brands from the
  Umbrella project (IFL, Milton, Mavan, Kensington) appear anywhere on this
  site unless the user explicitly asks.

## Deployment

Static GitHub Pages, same pattern as the sibling sites (`sites-lmt/*-site`).
Step-by-step in `../find-umbrella-internal/DEPLOY-RUNBOOK.md`.

**This folder is its own git repo** — `sites-lmt/findumbrella.co.uk-site`, which
is what GitHub Pages serves. Publishing is a commit and a push *here*. The outer
`Umbrella` repo holds it as a gitlink and no copy of the files; when it held real
copies, three weeks of edits went into the outer repo and nothing reached the
site.

**Bump the `?v=` on `js/main.js` and `js/cortoa-quote-embed.js` whenever either
file changes.** Cloudflare serves `.js` with `max-age=14400`, so without a new
version string a publish is invisible to visitors for up to four hours — HTML is
not cached, so the tag in the page is what takes effect immediately. Cortoa's own
`/embed.js` is `max-age=0` and needs no stamp.

`www.findumbrella.co.uk` is the canonical host (see the `CNAME` file). Today the
`www` A record points at a DigitalOcean host running WordPress, and the apex is
GoDaddy-parked with **no working HTTPS at all**. DNS lives at GoDaddy; email is
Microsoft 365, so DNS changes must leave MX and the DKIM records alone.
