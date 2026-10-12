# GPS verification on every sign-in / sign-out

**Rule:** a device must be inside a site's set boundary (`sites.lat/lng/radius_m`)
for every sign-in and sign-out. No location, no event. Every event shows a
green tick (verified) or red cross (not verified).

## Decisions (agreed 12 Oct 2026)
| Case | Behaviour |
|---|---|
| GPS fix inside site boundary | Event recorded, ✅ |
| GPS fix outside boundary | **Rejected, nothing recorded** |
| No GPS / permission denied | **Rejected, nothing recorded** |
| Auto sign-out (16:00 sweep, transfer to another site) | Still runs, always ❌ |
| Admin manual visit / manual checkout / time edits | Allowed, always ❌ |

## Done in this repo (branch `claude/brave-galileo-wczwq7`, not yet on `main`)
- `docs/app.html`: sign-out sends `deviceToken`, `lat`, `lng`, `accuracy`.
- `docs/app.html`: sign-out no longer opens without a GPS fix; confirm step refuses without one.
- `docs/app.html`: "Check in here anyway" (unverified sign-in) hidden.

The current API ignores the extra sign-out fields, so these are safe to ship first.

## Still to do — live backend `mostlane-api` (source: `Mostlane/Test`, `worker/src/routes/sitelog-api.js`)
1. **Schema** (additive, run once): `visits` add
   `sign_in_verified INTEGER DEFAULT 0, sign_in_distance_m REAL,`
   `out_lat REAL, out_lng REAL, out_accuracy REAL, sign_out_verified INTEGER DEFAULT 0, sign_out_distance_m REAL`.
2. **`/confirm-checkin`**: require numeric lat/lng; haversine against the named site;
   reject (400 `outside_site` / `no_location`) if outside `radius_m`. On success set
   `sign_in_verified=1`, `sign_in_distance_m`.
3. **`/confirm-checkout`**: require `deviceToken` and that the visit's `person_id`
   matches the device's person (403 otherwise); require numeric lat/lng; reject if
   outside the visit's site radius. On success store `out_lat/out_lng/out_accuracy`,
   `sign_out_verified=1`, `sign_out_distance_m`.
4. **`/scan`**: when outside every site and a visit is open, return an
   "outside site, can't sign out" state instead of `confirm_sign_out`.
5. **`/sync-event`** (offline): already geofences both directions; also set the
   verified flags / out location when applied.
6. **`/checkin-unmatched`**: disable (410) — it records unverified sign-ins.
7. **Auto-close, transfer auto-checkout, `/add-visit`, `/manual-checkout`,
   `/update-visit-times`**: leave `sign_*_verified = 0` (❌). Any time edit should reset
   the edited side's verified flag to 0.
8. **Visit list endpoints used by admin**: return the verified flags and distances.
9. **Accuracy**: store it; show it on hover. (Optional: treat accuracy worse than
   ~100 m as not verified.)

## Then — admin UI (`docs/admin.html`, this repo)
Add a ✅/❌ next to every sign-in and sign-out time in Live, Timesheets and visit
history, with distance from site on hover. Existing visits: sign-ins with GPS inside
the radius can be back-filled as ✅; all historic sign-outs are ❌ (no location was ever recorded).

## Rollout order
1. Merge this branch to `main` (app changes go live via GitHub Pages).
2. Deploy backend changes 1–9 to `mostlane-api`.
3. Ship the admin tick/cross UI.
