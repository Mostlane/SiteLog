# SiteLog — State of Play

Read this first. It is the working brief for SiteLog. **Update it as you go**:
when something ships, changes or is decided, edit the relevant section and the
log at the bottom.

The owner is Jamie, who is not a developer. He works mostly from a phone, so
keep explanations plain. He deploys by commit-and-push. There is no wrangler
or local tooling on his side.

## What SiteLog is
SiteLog is QR-code site attendance for Mostlane. Each site has a QR code.
- A worker scans it with their phone camera, which opens the scanner at
  **site-log.co.uk**.
- The phone's GPS must place them inside that site's boundary.
- They then tap **Sign in** or **Sign out**.

Workers include employees, subcontractors and visitors. Most do not have a
portal login.

The office uses the records to see:
- who is on site now;
- daily and weekly timesheets (also emailed as PDFs);
- failed scans;
- a map pin for every sign-in and sign-out.

It is now used heavily, by many people at once, so **reliability beats new
features**. The agreed direction (1 Nov 2026):
1. Make the web app reliable.
2. Give workers a clear history of their own visits.
3. Build one admin screen that shows everything.
4. Only then consider the App Store. Apple rejects plain website wrappers, so
   the app would need a native scanner, GPS, push and a permanent sign-in.

## Where the code lives — TWO repos
| Part | Repo / path | Deploys how |
|---|---|---|
| Scanner + old admin pages | **this repo** `Mostlane/SiteLog`, `docs/` | GitHub Pages on push to `main` → site-log.co.uk |
| **The live API (backend)** | `Mostlane/Test`, `worker/src/routes/sitelog-api.js` | Auto-deploys with the `mostlane-api` worker on push to `main` |
| Office timesheets, PDFs, emails, maps | `Mostlane/Test`, `worker/src/routes/sitelogts.js` + `worker/src/lib/sitelogtspdf.js` | same |
| Portal admin page | `Mostlane/Test`, `sitelog.html` | GitHub Pages (mostlane-portal.com) |
| Tests | `Mostlane/Test`, `worker/tools/test-sitelog-*.mjs` | `node --no-warnings worker/tools/<file>` |

⚠️ **`worker.js` in this repo is the OLD standalone backend and is OUT OF DATE.**
Do not edit it. Every backend change goes in `sitelog-api.js` in Mostlane/Test.
`po/` holds an unrelated old PO worker; leave it alone.

### Hosts
- **api2.site-log.co.uk** is the live API. It is served by `mostlane-api` and
  every page in `docs/` points at it.
- **api.site-log.co.uk** was the OLD standalone `sitelog-api` worker —
  retired 1 Nov 2026 (it had become an old PO-system copy, not SiteLog). The
  address no longer resolves. Only api2 is live.
- `GET /served-by` tells you which worker answered. Every sign-in written by
  the new backend sets `visits.served_by='mostlane-api'`, so a NULL means the
  old worker wrote it.

### Data
- D1 **`sitelog-db`** (id `1e891155-dd61-4e0e-90fe-ad5f4895f2c8`) is bound as
  `SITELOG_DB`. It also holds some unrelated legacy PO tables; leave them alone.
- Main tables:
  - `people` (`portal_username` links a person to a portal user)
  - `devices` (`device_token` → `person_id`)
  - `visits`
  - `sites` (`lat`, `lng`, `radius_m`, default 500)
  - `companies`
  - `scan_log` (every scan attempt, kept 180 days)
  - `pending_events` (offline sign-ins and sign-outs)
  - `site_documents` and `site_document_acks`
- Site documents are stored in R2 `DOCS_BUCKET` (bucket `sitelog-documents`).
- Settings that live in the MAIN portal D1 `app_config`:
  - `sitelog:pushnotify:<tid>` — who gets sign-in and sign-out pushes
  - `sitelog:tsmail:<tid>` — timesheet email recipients and options
- Secrets on mostlane-api: `SITELOG_ADMIN_SECRET` (the admin PIN),
  `GOOGLE_MAPS_KEY`, `PORTAL_BRIDGE_SECRET`, and `FILE_SIGNING_SECRET` (used
  for map links).

## ⚠️ THE QR CODE — must work at all times (confirmed 1 Nov 2026)
Every printed site QR code holds **`https://mostlane.github.io/SiteLog/scan.html`**
(decoded from Jamie's poster). The chain a scan follows:
1. `mostlane.github.io/SiteLog/scan.html` → GitHub redirects to
   **`site-log.co.uk/scan.html`** because of `docs/CNAME`.
2. `scan.html` → `app.html` (keeps the query string).
3. `app.html` talks to **`api2.site-log.co.uk`** (custom domain on mostlane-api).

Breaking ANY link stops every sign-in. Never:
- rename the `Mostlane/SiteLog` repo, make it private, move it to another
  owner, or switch GitHub Pages off / away from `docs/`;
- delete or edit `docs/CNAME`, or change site-log.co.uk's DNS;
- rename or delete `docs/scan.html` or `docs/app.html`;
- remove `api2.site-log.co.uk` from mostlane-api.
`api.site-log.co.uk` is NOT in this chain (its removal on 1 Nov was safe).

## Pages in `docs/`
- `app.html` — the scanner, where workers spend their time.
  - Screens: register, sign in, sign out, the dashboard, **My Hours**, Summary,
    On Site, and documents.
  - Offline: queues sign-ins and sign-outs and replays them once the phone has
    signal.
  - Its API base is the `API` variable.
- `scan.html` is the QR landing page; `index.html` is the front page;
  `sitelogintro.html` is the intro.
- `admin.html` — the OLD admin page, behind a shared 4-digit PIN. It is due to
  be merged into the portal page and retired.
- `documents.html` and `sites.html` are standalone admin tools.
- `sw.js` — the service worker. **Bump `CACHE` (currently `sitelog-v16`)
  whenever cached files change** so phones refresh.

## Rules that are already live (don't regress)
- **GPS on every event.** Sign-in and sign-out must be inside the site
  boundary.
  - If there's no fix, or the phone is outside the boundary, the server refuses
    and writes nothing.
  - Sign-out also checks the visit belongs to that phone.
  - Auto sign-out, office-added visits and edited times are always marked
    ✗ (not checked).
  - Test: `test-sitelog-gps.mjs`.
- **One person per worker.**
  - The phone keeps its id in IndexedDB and localStorage, plus an HttpOnly
    `ml_did` cookie on site-log.co.uk.
  - A phone with no id first calls `/device-recover`.
  - `/register` reuses an existing person with the same name and company
    instead of making a duplicate.
  - "Not you?" calls `/device-forget`.
  - Test: `test-sitelog-identity.mjs`.
- **Which site a scan belongs to** (`chooseSite`):
  1. An open visit whose site contains the fix wins.
  2. If two sites are within 60 m of the nearest, the person's most recent site
     wins.
  3. Otherwise the nearest site.

  Test: `test-sitelog-sitepick.mjs`.
- **Scan log.** Every `/scan`, `/confirm-checkin` and `/confirm-checkout` is
  logged with its outcome. Location failures on the phone arrive through
  `/log-failed-scan` and are stored as `phone_*` rows. Test:
  `test-sitelog-scanlog.mjs`.
- **Push to the owner** on every confirmed sign-in or sign-out, saying who is
  on site now. Auto sign-outs don't push. Test: `test-sitelog-signpush.mjs`.
- **Timesheets** (`sitelogts.loadPeriod`) are the ONE calculation of hours.
  - Missed sign-outs are flagged.
  - "Scanned but not confirmed" stands in for an event that never happened:
    scans between 05:00 and 21:00 only, ignored within 20 min before a visit or
    30 min after a sign-out.
  - Daily emails go out from 16:00 (20:00 at the latest); weekly ones on Monday
    from 07:00.
  - Every event gets a signed 📍 map link.
  - Test: `test-sitelog-timesheets.mjs`.
- **Only a real QR scan is a scan** (2 Nov 2026). `scan.html` adds `qr=<time>`; app.html uses
  it once (strips it from the address, remembers it in `ml_qr_used`) and sends the first scan
  after a fresh stamp as `auto:false`. Every other scan — refresh, Refresh button, reopening
  the app, the 60-second check — sends `auto:true` and is logged as `kind='recheck'`, which
  never shows as a scan, soft scan, failed scan or timesheet event. Never remove the stamp
  from scan.html. Test: `test-sitelog-scanlog.mjs`.
  - **Sign in needs that QR scan**: after a re-check the app shows the site but hides
    Check In ("Scan the site QR code to sign in"). The "sign out?" pop-up opens only after a
    QR scan; the Sign Out button still works any time (`appScan({auto:true, signOut:true})`).
  - One scan request at a time (`appScanBusy`) — no more duplicate rows.
- **My Hours** (the app's history).
  - `GET /my-timesheet?deviceToken=&week=` runs the same `loadPeriod` for one
    person, so a worker sees exactly the office's hours.
  - It shows ✓/✗ location checks, state labels and the week's failed scans.
  - No coordinates or ids are sent to the phone.
  - The old client-side list (`loadHistoryListOld`) is kept only as a fallback.
- **Admin access in the portal.** The `SiteLogAdmin` permission (or Full
  Access) opens sitelog.html. It is separate from `SiteLog`, which only
  launches the scanner.

## Known problems / risks
1. **The old api.site-log.co.uk worker is still live and unpatched.** It
   bypasses the GPS checks.
2. **There are two admin screens.** `admin.html` sits behind one shared 4-digit
   PIN; sitelog.html in the portal is the other. The PIN is weak protection for
   everyone's hours and locations.
3. **The Summary card** in the app still does its own sums from `/my-visits`,
   so it can disagree with My Hours.
4. **Brighton North Road and Starbucks Jubilee Street pins are 45 m apart,**
   both with a 500 m radius.
   - `chooseSite` softens this, but GPS drift can still flip a sign-in between
     them.
   - Fix: archive one, or add a "which site are you at?" picker. `/scan`
     already returns `alternatives` for that picker.
5. **Workers depend on the browser.** Private tabs and QR-reader apps forget
   who they are. `/device-recover` and the same-name relink catch most of this,
   not all.

## Next up (in order)
1. ✅ **DONE 1 Nov 2026 — old api.site-log.co.uk retired.** Jamie removed the
   address from `sitelog-api` and did NOT re-add it to mostlane-api (nothing
   needs it): `api.site-log.co.uk` no longer resolves. api2 confirmed answering
   (`/served-by` → mostlane-api). **Delete the `sitelog-api` worker after
   8 Nov 2026.** History of the checks below.
   1. Check in D1 that no recent visits have `served_by IS NULL`. That would
      mean a phone or bookmark still uses the old host.
   2. Check `scan_log` and `pending_events` the same way.
   3. Find anything still pointing at `api.site-log.co.uk`: old printed QR
      codes, home-screen bookmarks, and other code. **Code: done 1 Nov** —
      the portal's fallback calls (`sitelog.js`, `costing.js`, `sites.js`,
      `projects-api.js`) now default to api2; `docs/` already used api2.
   4. Move the `api.site-log.co.uk` custom domain onto `mostlane-api`. The
      backend already serves both hostnames. Note that moving a live custom
      domain once left a DNS/certificate gap, so do it at a quiet time and
      check straight after.
   5. Disable the old worker's route. Keep its code for a week as a rollback,
      then delete it.

   **Checks 1–3 done 1 Nov 2026 — nothing still uses the old host:**
   - visits: the last one written by the old worker (`served_by` NULL) was
     **16 Aug 2026 08:09**, the cutover day. Every visit since is mostlane-api.
   - Every phone seen since 15 Oct (17 devices) appears in `scan_log`, which only
     the new backend writes. `pending_events` (2 rows) were both written by the
     new backend.
   - Printed QR codes point at `site-log.co.uk/scan.html` (the front end), not
     the API, so they are unaffected by the move.
   - Code: the only live reference is the hostname dispatch in
     `worker/src/index.js` (needed — it lets mostlane-api answer on api.*).
     The rest are comments.
   - Blind spot: a phone that opens an ancient cached page and only *reads*
     (never signs in) leaves no trace in D1. Check the `sitelog-api` worker's
     Metrics tab in the dashboard (requests, last 7 days) before step 4.
   **Second finding (1 Nov): the `sitelog-api` worker is no longer SiteLog at
   all.** Its live code (deployed ~6 Aug 2026) is an old copy of the *PO
   system* ("Mostlane PO System" single-file worker) bound to sitelog-db — that
   is where the stray PO tables in sitelog-db came from. It has zero SiteLog
   routes (every SiteLog call there would 404), its `po_log` is empty (no PO was
   ever raised on it), but its admin API is **unauthenticated** (anyone can list
   the 10 engineer names + link tokens, add/delete them). It still gets ~7k
   requests/30 days (dashboard, 1 Nov) — can't be SiteLog phones, since they'd
   all be failing; likely bots or old PO links. So turning it off cannot break
   SiteLog; it also closes an open admin API.
   Steps 4–5 are dashboard-only (the connector can't edit custom domains).
   Small bug found: offline sign-outs are applied correctly but the
   `pending_events` row is left `resolved=0`.
2. ✅ **DONE 1 Nov 2026** — Summary card reads **GET /my-summary?range=**
   (`sitelogts.personSummary`, same `loadPeriod` as My Hours + the office),
   with missed/unconfirmed counts per site; falls back to the old on-phone sum
   if the endpoint fails. Also: a re-sent offline sign-out that was already
   applied now returns `duplicate_ignored` instead of a false pending event.
3. **One admin screen** — portal sitelog.html REBUILT 1 Nov 2026 as four tabs:
   **🟢 Now** (on site grouped by site + today's tiles) · **📋 Logs** (person
   and/or site + date range; failed scans inline; ✓/✗ location check + 📍 Map on
   every event; problem badges; CSV) · **👷 People** · **⚙ Settings**. Jamie's
   brief: live on-site view, pull a person's or a site's logs for any period,
   all failed scans, partial logs obvious, green tick + map on every event; used
   50/50 phone/desktop. Still to move from admin.html: visit editing (from the
   Logs rows), unmatched offline events, sites (radius/companies/rules/archive),
   companies, documents — then retire admin.html + the PIN.
   Plan APPROVED 1 Nov 2026 (Jamie):
   - Order: **People ✅ (1 Nov)** → visit editing (in the Timesheet card) +
     Problems tab (refused scans, unmatched offline events, unknown-site
     visits) → Sites (radius, companies on site, rules, archive; names + pins
     stay on the portal Sites page) + Companies → Documents → retire admin.html.
   - NOT moved: Job Costing (portal job-costing.html has it) and Timesheets
     (already on sitelog.html).
   - **Pay rates/travel allowances are Full Access only** — enforced in the
     portal proxy (`routes/sitelog.js`), not just hidden.
   - After retiring admin.html: **replace the 4-digit PIN** with a long random
     `SITELOG_ADMIN_SECRET` (approved), and delete `docs/import-sites.json`
     (customer site list in a public repo).
   Original list:
   - people and devices;
   - merge and transfer requests;
   - sites;
   - companies;
   - editing visits;
   - documents.
4. Decide on Brighton North Road (archive it, or build the site picker).
5. Later: an App Store version via Capacitor with a cloud build, plus Android.
   - Needs an Apple Developer organisation account (£79/yr) and a privacy
     policy.
   - Push must go through APNs.
   - Keep the web scanner for visitors who won't install an app.

## How to work on it
- Backend change:
  1. Edit `sitelog-api.js` (and/or `sitelogts.js`) in Mostlane/Test.
  2. Run `node --check` and the matching `test-sitelog-*.mjs`.
  3. Commit, `merge --no-ff` into `main`, and rebuild `worker/dist` (see
     Mostlane/Test CLAUDE.md).
  4. Push.
- Front-end change:
  1. Edit `docs/`.
  2. Syntax-check the inline scripts.
  3. Bump the `sw.js` CACHE.
  4. Push `main`.
- Testing pages: serve them with `python3 -m http.server`, open them in
  Playwright, and mock `api2.site-log.co.uk` with `ctx.route`.
- Never put customer or worker data in this public repo.
- When you check live data, people in screenshots or help text are
  "User 1/2/3", never real names.

## Log
- **12 Oct 2026** — GPS verification on every event; duplicate-person
  prevention; timesheet PDF emails.
- **15–16 Oct 2026** — scan log and failed-scan view; push to the owner on
  sign-in/out; `SiteLogAdmin` permission.
- **17 Oct 2026** — "Scanned but not confirmed" fallback in timesheets.
- **21 Oct 2026** — `chooseSite` for overlapping sites; 📍 map link for every
  event (portal and email).
- **1 Nov 2026** — **My Hours** in the app: the office's calculation, with
  failed scans shown. This file created. Portal fallbacks repointed
  from the old host to api2 (step 1.3).
- **1 Nov 2026** — Old-host checks done (step 1.1–1.3): no use since 16 Aug.
- **1 Nov 2026** — api.site-log.co.uk removed (step 1 done). Summary card on
  /my-summary (step 2 done). Offline sign-out retries no longer logged as
  pending. SW `sitelog-v14`.
- **1 Nov 2026** — Step 3 plan approved. Phase 1 live: 👷 People tab on portal
  sitelog.html (edit/archive/forget phone/merge/new-phone approvals); pay Full
  Access only. QR-code chain documented as a hard rule.
- **1 Nov 2026** — Portal Site Log admin rebuilt (Now/Logs/People/Settings). GitHub
  Pages deploys failed 09:11–09:33 with "in progress deployment" (a stuck earlier
  deploy blocks new ones); the live site stayed on the 09:05 build and worked.
- **2 Nov 2026** — Portal Now tab: "On site right now" was always empty (asked /on-site with no site) — fixed;
  each person shows ✓ location verified + 📍 map; new "Scanned, not confirmed" list (soft scans) with ✕ dismiss
  and "Make it a sign-in / sign-out" (scan kept, marked; visit noted "confirmed by <name>"). Map tiles moved
  to OpenStreetMap (CARTO now needs a key). Live hours "so far" for people still on site.
- **2 Nov 2026** — App re-checks (refresh, reopen, 60 s timer) no longer count as scans: QR stamp in
  scan.html, `auto` flag to /scan, logged as `recheck`. SW `sitelog-v15`.
- **2 Nov 2026** — Check In only after a real QR scan; no automatic sign-out pop-up on re-checks
  (Sign Out button unchanged); duplicate scan requests stopped. SW `sitelog-v16`.
