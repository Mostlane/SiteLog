// Origins allowed to call the API. Credentials (the device cookie) require a
// specific origin to be echoed back - never "*" - so we reflect from this list.
const ALLOWED_ORIGINS = [
  "https://site-log.co.uk",
  "https://www.site-log.co.uk",
  "https://mostlane.github.io"
];
function corsFor(request) {
  const origin = request.headers.get("Origin") || "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-admin-secret",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
    "Access-Control-Max-Age": "86400"
  };
}

const OFFICE_LAT = 50.8573;
const OFFICE_LNG = -1.2343;

// Module-level ephemeral caches. Persist across requests in the same isolate
// Cloudflare Workers reuse isolates, but reset on cold start.
const geocodeCache = new Map();

// Offline-sync schema bootstrap. Runs once per isolate (idempotent), so no
// manual D1 migration is needed when this version is deployed:
//   - visits.offline_synced  : 1 when a visit's time came from a device that
//                              was offline at scan time (device clock, not
//                              server-verified) and synced later.
//   - pending_events         : offline events from devices the server can't
//                              attribute to a known person, so nothing is lost.
let offlineSchemaReady = false;
async function ensureOfflineSchema(env) {
  if (offlineSchemaReady) return;
  try { await env.DB.prepare("ALTER TABLE visits ADD COLUMN offline_synced INTEGER DEFAULT 0").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE visits ADD COLUMN unmatched_site INTEGER DEFAULT 0").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE visits ADD COLUMN provided_site_name TEXT").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE visits ADD COLUMN manual_entry INTEGER DEFAULT 0").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE people ADD COLUMN fuel_rate REAL").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE people ADD COLUMN is_main INTEGER DEFAULT 0").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE sites ADD COLUMN category TEXT DEFAULT 'Projects'").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE devices ADD COLUMN last_seen TEXT").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE documents ADD COLUMN doc_number TEXT").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE documents ADD COLUMN doc_seq INTEGER").run(); } catch (e) {}
  try {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS pending_events (id TEXT PRIMARY KEY, device_token TEXT, lat REAL, lng REAL, accuracy REAL, site_code TEXT, intent TEXT, occurred_at TEXT, synced_at TEXT, resolved INTEGER DEFAULT 0)"
    ).run();
  } catch (e) {}
  offlineSchemaReady = true;
}

// Format a millisecond timestamp as SQLite's UTC string 'YYYY-MM-DD HH:MM:SS',
// matching what CURRENT_TIMESTAMP writes so date-key helpers keep working.
function toSqlUtc(ms) {
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}
// Record that a device was active now (best-effort). Used to surface "last
// active" per person and make duplicate-merge suggestions recency-aware.
async function touchDevice(env, deviceToken) {
  if (!deviceToken) return;
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  try {
    await env.DB.prepare("UPDATE devices SET last_seen = ? WHERE device_token = ?")
      .bind(now, deviceToken).run();
  } catch (e) { /* column may not exist yet pre-migration */ }
}


async function getTravelData(env, fromLat, fromLng, toLat, toLng) {
  try {
    const apiKey = env.GOOGLE_MAPS_KEY || "";
    if (!apiKey) return null;

    const url =
      "https://maps.googleapis.com/maps/api/distancematrix/json" +
      "?origins=" + encodeURIComponent(fromLat + "," + fromLng) +
      "&destinations=" + encodeURIComponent(toLat + "," + toLng) +
      "&mode=driving" +
      "&key=" + encodeURIComponent(apiKey);

    const res = await fetch(url);
    const data = await res.json();
    const el = data?.rows?.[0]?.elements?.[0];

    if (!el || el.status !== "OK") return null;

    return {
      miles: Math.round((el.distance.value / 1609.344) * 10) / 10,
      mins: Math.round(el.duration.value / 60),
      duration_text: el.duration?.text || "",
      distance_text: el.distance?.text || ""
    };
  } catch (e) {
    return null;
  }
}

async function getGeocode(env, address) {
  try {
    const apiKey = env.GOOGLE_MAPS_KEY || "";
    if (!apiKey) return null;

    const cacheKey = String(address).trim().toLowerCase();

    if (geocodeCache.has(cacheKey)) {
      const entry = geocodeCache.get(cacheKey);
      if (Date.now() - entry.t < 86400000) return entry.v;
    }

    const url =
      "https://maps.googleapis.com/maps/api/geocode/json" +
      "?address=" + encodeURIComponent(address) +
      "&region=uk" +
      "&key=" + encodeURIComponent(apiKey);

    const res = await fetch(url);
    const data = await res.json();
    const result = data?.results?.[0];

    if (!result || !result.geometry?.location) return null;

    const out = {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted: result.formatted_address || ""
    };

    geocodeCache.set(cacheKey, { v: out, t: Date.now() });

    if (geocodeCache.size > 200) {
      const firstKey = geocodeCache.keys().next().value;
      geocodeCache.delete(firstKey);
    }

    return out;
  } catch (e) {
    return null;
  }
}

async function handleTravelIn(env, visitId, personId, siteLat, siteLng) {
  try {
    const person = await env.DB.prepare(
      "SELECT travel_status FROM people WHERE id = ?"
    ).bind(personId).first();

    if (!person || person.travel_status !== "paid") return null;

    const today = new Date().toISOString().slice(0, 10);

    const earlier = await env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM visits WHERE person_id = ? AND date(check_in_at) = ? AND id != ?"
    ).bind(personId, today, visitId).first();

    if (earlier && earlier.cnt > 0) return null;

    const travel = await getTravelData(env, OFFICE_LAT, OFFICE_LNG, siteLat, siteLng);
    if (!travel) return null;

    await env.DB.prepare(
      "UPDATE visits SET travel_in_miles = ?, travel_in_mins = ?, is_first_of_day = 1 WHERE id = ?"
    ).bind(travel.miles, travel.mins, visitId).run();

    return travel;
  } catch (e) {
    return null;
  }
}

async function handleTravelOut(env, visitId, personId, siteLat, siteLng) {
  try {
    const person = await env.DB.prepare(
      "SELECT travel_status FROM people WHERE id = ?"
    ).bind(personId).first();

    if (!person || person.travel_status !== "paid") return null;

    const travel = await getTravelData(env, siteLat, siteLng, OFFICE_LAT, OFFICE_LNG);
    if (!travel) return null;

    await env.DB.prepare(
      "UPDATE visits SET travel_out_miles = ?, travel_out_mins = ? WHERE id = ?"
    ).bind(travel.miles, travel.mins, visitId).run();

    return travel;
  } catch (e) {
    return null;
  }
}

function londonNowParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value || "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    hhmm: `${get("hour")}:${get("minute")}`
  };
}

function londonDateKeyFromUtcString(utcString) {
  const d = new Date(utcString);
  const p = londonNowParts(d);
  return p.dateKey;
}

function londonLocalToUtcIso(londonDateKey, hhmm = "16:00:00") {
  const [year, month, day] = londonDateKey.split("-").map(Number);
  const [hour, minute, second = 0] = hhmm.split(":").map(Number);

  let utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  for (let i = 0; i < 3; i++) {
    const parts = londonNowParts(utc);
    const actualMinutes = Number(parts.hour) * 60 + Number(parts.minute);
    const wantedMinutes = hour * 60 + minute;
    const diffMinutes = actualMinutes - wantedMinutes;

    utc = new Date(utc.getTime() - diffMinutes * 60 * 1000);
  }

  return utc.toISOString();
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isValidDateTimeString(str) {
  if (typeof str !== "string") return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

function isValidDateKey(str) {
  if (typeof str !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str + "T00:00:00Z");
  return !isNaN(d.getTime());
}

function isFiniteNumber(v) {
  const n = Number(v);
  return Number.isFinite(n);
}

function parseLatLng(str) {
  if (typeof str !== "string") return null;

  const parts = str.split(",");
  if (parts.length !== 2) return null;

  const lat = Number(parts[0]);
  const lng = Number(parts[1]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}

function constantTimeEqual(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;

  let mismatch = 0;

  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

// Durable device cookie. Fully effective only when the API shares the site's
// domain (a custom domain); cross-site (workers.dev vs github.io) Safari blocks
// it, so the client-side IndexedDB/localStorage stores remain the primary id.
function readDidCookie(request) {
  const c = request.headers.get("Cookie") || "";
  const m = c.match(/(?:^|;\s*)ml_did=([^;]+)/);
  return m ? m[1] : "";
}
function didSetCookie(token) {
  return { "Set-Cookie": "ml_did=" + token + "; Max-Age=63072000; Path=/; Secure; SameSite=Lax; Domain=site-log.co.uk; HttpOnly" };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsFor(request) });
    }

    function json(data, status = 200, extraHeaders) {
      const base = corsFor(request);
      const headers = extraHeaders ? { ...base, ...extraHeaders } : base;
      return Response.json(data, { status, headers });
    }

    async function readBody(req) {
      const ct = (req.headers.get("content-type") || "").toLowerCase();

      if (ct.includes("application/json")) {
        try {
          return await req.json();
        } catch {
          return {};
        }
      }

      if (
        ct.includes("application/x-www-form-urlencoded") ||
        ct.includes("multipart/form-data")
      ) {
        const form = await req.formData();
        const obj = {};
        for (const [k, v] of form.entries()) obj[k] = v;
        return obj;
      }

      try {
        return await req.json();
      } catch {
        return {};
      }
    }

    function isAdminAuthorised() {
      const secret = env.ADMIN_SECRET || "";
      if (!secret) return false;

      const header = request.headers.get("x-admin-secret") ?? "";
      if (!header) return false;

      return constantTimeEqual(header, secret);
    }

    function requireAdmin() {
      if (!isAdminAuthorised()) {
        return json({ ok: false, error: "Unauthorised" }, 401);
      }

      return null;
    }

    // POST /admin-auth
    if (url.pathname === "/admin-auth" && request.method === "POST") {
      const secret = env.ADMIN_SECRET || "";
      if (!secret) return json({ ok: false, error: "Admin secret not configured" }, 500);

      const headerSecret = request.headers.get("x-admin-secret") ?? "";

      let bodySecret = "";
      try {
        const body = await readBody(request);
        bodySecret = (body.password ?? body.adminSecret ?? body.secret ?? "").toString();
      } catch {
        bodySecret = "";
      }

      const valid =
        constantTimeEqual(headerSecret, secret) ||
        constantTimeEqual(bodySecret, secret);

      if (!valid) return json({ ok: false, error: "Invalid password" }, 401);

      return json({ ok: true });
    }

    // POST /register, /signup, /add-person
    if (
      (url.pathname === "/register" ||
        url.pathname === "/signup" ||
        url.pathname === "/add-person") &&
      request.method === "POST"
    ) {
      const body = await readBody(request);

      const deviceToken = (
        body.deviceToken ??
        body.device_token ??
        body.device ??
        body.device_id ??
        readDidCookie(request) ??
        ""
      ).toString().trim();

      const firstName = (
        body.firstName ??
        body.first_name ??
        body.first ??
        ""
      ).toString().trim().slice(0, 80);

      const lastName = (
        body.lastName ??
        body.last_name ??
        body.last ??
        ""
      ).toString().trim().slice(0, 80);

      const company = ((body.company ?? "").toString().trim().slice(0, 120)) || null;
      const purpose = ((body.purpose ?? "").toString().trim().slice(0, 60)) || null;

      if (!deviceToken || deviceToken.length > 128) return json({ ok: false, error: "Missing deviceToken" }, 400);
      if (!firstName && !lastName) return json({ ok: false, error: "Missing name" }, 400);

      try {
        const existing = await env.DB.prepare(`
          SELECT p.id as person_id, p.first_name, p.last_name, p.company, p.purpose, COALESCE(p.archived,0) as archived
          FROM devices d
          JOIN people p ON p.id = d.person_id
          WHERE d.device_token = ?
          LIMIT 1
        `).bind(deviceToken).first();

        if (existing) {
          await env.DB.prepare(`
            UPDATE people
            SET first_name = ?, last_name = ?, company = COALESCE(?, company), purpose = COALESCE(?, purpose)
            WHERE id = ?
          `).bind(firstName, lastName, company, purpose, existing.person_id).run();

          return json({
            ok: true,
            status: "already_registered",
            personId: existing.person_id
          }, 200, didSetCookie(deviceToken));
        }

        const personId = crypto.randomUUID();

        await env.DB.prepare(`
          INSERT INTO people (id, first_name, last_name, company, purpose, archived, hourly_rate)
          VALUES (?, ?, ?, ?, ?, 0, 0)
        `).bind(personId, firstName, lastName, company, purpose).run();

        await env.DB.prepare(`
          INSERT INTO devices (device_token, person_id)
          VALUES (?, ?)
        `).bind(deviceToken, personId).run();

        return json({ ok: true, status: "registered", personId }, 200, didSetCookie(deviceToken));
      } catch (err) {
        console.error("register failed:", err);
        return json({
          ok: false,
          error: "Registration failed"
        }, 500);
      }
    }

    // POST /transfer-request
    if (url.pathname === "/transfer-request" && request.method === "POST") {
      const body = await readBody(request);
      const { deviceToken, firstName, lastName, company } = body;

      if (!deviceToken || !firstName || !lastName || !company) {
        return json({ ok: false, error: "Missing required fields" }, 400);
      }
      if (String(deviceToken).length > 128) {
        return json({ ok: false, error: "Invalid deviceToken" }, 400);
      }

      const existing = await env.DB.prepare(
        "SELECT id FROM device_transfers WHERE new_device_token = ? AND status = 'pending'"
      ).bind(deviceToken).first();

      if (existing) return json({ ok: true, already_pending: true });

      const tempPersonId = crypto.randomUUID();
      const transferId = crypto.randomUUID();
      const now = new Date().toISOString().replace("T", " ").slice(0, 19);

      await env.DB.prepare(
        "INSERT INTO people (id, first_name, last_name, company, is_transfer_pending) VALUES (?, ?, ?, ?, 1)"
      ).bind(
        tempPersonId,
        String(firstName).trim().slice(0, 80),
        String(lastName).trim().slice(0, 80),
        String(company).trim().slice(0, 120)
      ).run();

      await env.DB.prepare(
        "INSERT OR REPLACE INTO devices (device_token, person_id) VALUES (?, ?)"
      ).bind(deviceToken, tempPersonId).run();

      await env.DB.prepare(
        "INSERT INTO device_transfers (id, new_device_token, first_name, last_name, company, status, temp_person_id, requested_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)"
      ).bind(
        transferId,
        deviceToken,
        firstName.trim(),
        lastName.trim(),
        company.trim(),
        tempPersonId,
        now
      ).run();

      return json({ ok: true });
    }

    // GET /pending-transfers
    if (url.pathname === "/pending-transfers" && request.method === "GET") {
      const guard = requireAdmin();
      if (guard) return guard;

      const transfers = await env.DB.prepare(
        "SELECT dt.*, (SELECT COUNT(*) FROM visits v WHERE v.person_id = dt.temp_person_id) as visit_count " +
        "FROM device_transfers dt WHERE dt.status = 'pending' ORDER BY dt.requested_at DESC"
      ).all();

      return json({ ok: true, transfers: transfers.results || [] });
    }

    // GET /all-engineers-for-transfer
    if (url.pathname === "/all-engineers-for-transfer" && request.method === "GET") {
      const guard = requireAdmin();
      if (guard) return guard;

      const engineers = await env.DB.prepare(
        "SELECT id, first_name, last_name, company FROM people " +
        "WHERE (is_transfer_pending = 0 OR is_transfer_pending IS NULL) AND (archived = 0 OR archived IS NULL) " +
        "ORDER BY last_name, first_name"
      ).all();

      return json({ ok: true, engineers: engineers.results || [] });
    }

    // POST /approve-transfer
    if (url.pathname === "/approve-transfer" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;

      const { transferId, targetPersonId } = await readBody(request);

      if (!transferId || !targetPersonId) {
        return json({ ok: false, error: "Missing transferId or targetPersonId" }, 400);
      }

      const transfer = await env.DB.prepare(
        "SELECT * FROM device_transfers WHERE id = ? AND status = 'pending'"
      ).bind(transferId).first();

      if (!transfer) {
        return json({ ok: false, error: "Transfer not found or already resolved" }, 404);
      }

      const now = new Date().toISOString().replace("T", " ").slice(0, 19);

      await env.DB.prepare("UPDATE visits SET person_id = ? WHERE person_id = ?")
        .bind(targetPersonId, transfer.temp_person_id).run();

      await env.DB.prepare("DELETE FROM devices WHERE person_id = ?")
        .bind(targetPersonId).run();

      await env.DB.prepare("INSERT OR REPLACE INTO devices (device_token, person_id) VALUES (?, ?)")
        .bind(transfer.new_device_token, targetPersonId).run();

      await env.DB.prepare("DELETE FROM people WHERE id = ?")
        .bind(transfer.temp_person_id).run();

      await env.DB.prepare(
        "UPDATE device_transfers SET status = 'approved', target_person_id = ?, resolved_at = ? WHERE id = ?"
      ).bind(targetPersonId, now, transferId).run();

      return json({ ok: true });
    }

    // POST /reject-transfer
    if (url.pathname === "/reject-transfer" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;

      const { transferId } = await readBody(request);

      if (!transferId) return json({ ok: false, error: "Missing transferId" }, 400);

      const transfer = await env.DB.prepare(
        "SELECT * FROM device_transfers WHERE id = ? AND status = 'pending'"
      ).bind(transferId).first();

      if (!transfer) return json({ ok: false, error: "Transfer not found" }, 404);

      const now = new Date().toISOString().replace("T", " ").slice(0, 19);

      await env.DB.prepare("DELETE FROM devices WHERE device_token = ?")
        .bind(transfer.new_device_token).run();

      await env.DB.prepare("DELETE FROM people WHERE id = ?")
        .bind(transfer.temp_person_id).run();

      await env.DB.prepare(
        "UPDATE device_transfers SET status = 'rejected', resolved_at = ? WHERE id = ?"
      ).bind(now, transferId).run();

      return json({ ok: true });
    }

    // GET /sites
    if (url.pathname === "/sites" && request.method === "GET") {
      await ensureOfflineSchema(env);
      const rows = await env.DB.prepare(
        "SELECT * FROM sites ORDER BY site_name ASC"
      ).all();

      return json({ sites: rows.results || [] });
    }

    // POST /update-site
    if (url.pathname === "/update-site" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;
      await ensureOfflineSchema(env);

      const { id, siteName, radius, siteRules, category } = await readBody(request);

      if (!id) return json({ error: "Missing id" }, 400);
      if (!siteName) return json({ error: "Missing siteName" }, 400);

      if (category !== undefined) {
        await env.DB.prepare(
          "UPDATE sites SET site_name = ?, radius_m = ?, site_rules = ?, category = ? WHERE id = ?"
        ).bind(siteName, Number(radius ?? 500), siteRules ?? null, (String(category || "").trim() || "Projects"), id).run();
      } else {
        await env.DB.prepare(
          "UPDATE sites SET site_name = ?, radius_m = ?, site_rules = ? WHERE id = ?"
        ).bind(siteName, Number(radius ?? 500), siteRules ?? null, id).run();
      }

      return json({ ok: true });
    }

    // POST /toggle-site
    if (url.pathname === "/toggle-site" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;

      const { id } = await readBody(request);

      if (!id) return json({ error: "Missing id" }, 400);

      const site = await env.DB.prepare(
        "SELECT archived FROM sites WHERE id = ?"
      ).bind(id).first();

      if (!site) return json({ error: "Site not found" }, 404);

      const newState = site.archived ? 0 : 1;

      await env.DB.prepare(
        "UPDATE sites SET archived = ? WHERE id = ?"
      ).bind(newState, id).run();

      return json({ ok: true, archived: newState });
    }

    // GET /engineers
    if (url.pathname === "/engineers" && request.method === "GET") {
      const guard = requireAdmin();
      if (guard) return guard;
      await ensureOfflineSchema(env);
      const rows = await env.DB.prepare(`
        SELECT id, first_name, last_name, company, purpose,
               COALESCE(archived,0) as archived,
               COALESCE(hourly_rate,0) as hourly_rate,
               COALESCE(travel_status,'not_configured') as travel_status,
               travel_cap_type, travel_cap_value, fuel_rate,
               COALESCE(is_main,0) as is_main,
               (SELECT COUNT(*) FROM visits WHERE visits.person_id = people.id) AS visit_count,
               (SELECT COUNT(*) FROM devices WHERE devices.person_id = people.id) AS device_count,
               (SELECT MAX(last_seen) FROM devices WHERE devices.person_id = people.id) AS device_last_seen
        FROM people
        ORDER BY first_name ASC, last_name ASC
      `).all();

      return json({ engineers: rows.results || [] });
    }

    // POST /add-engineer
    // Create an engineer (person) with NO device. A device can be linked later
    // when they register on a phone (via the transfer-approval flow).
    if (url.pathname === "/add-engineer" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;
      await ensureOfflineSchema(env);

      const body = await readBody(request);
      const firstName = (body.firstName ?? body.first_name ?? "").toString().trim().slice(0, 80);
      const lastName = (body.lastName ?? body.last_name ?? "").toString().trim().slice(0, 80);
      const company = ((body.company ?? "").toString().trim().slice(0, 120)) || null;
      const purpose = ((body.purpose ?? "").toString().trim().slice(0, 60)) || null;
      const rateIn = body.hourlyRate ?? body.hourly_rate;
      const hourlyRate =
        rateIn === "" || rateIn == null || Number.isNaN(Number(rateIn)) ? 0 : Number(rateIn);
      const isMain = (body.isMain ?? body.is_main) ? 1 : 0;

      if (!firstName && !lastName) return json({ ok: false, error: "Enter a name" }, 400);

      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO people (id, first_name, last_name, company, purpose, archived, hourly_rate, is_main)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?)
      `).bind(id, firstName, lastName, company, purpose, hourlyRate, isMain).run();

      return json({ ok: true, id });
    }

    // POST /update-engineer
    if (url.pathname === "/update-engineer" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;
      await ensureOfflineSchema(env);

      const body = await readBody(request);
      const id = body?.id;

      if (!id) return json({ error: "Missing id" }, 400);

      const firstName = body.firstName ?? body.first_name ?? null;
      const lastName = body.lastName ?? body.last_name ?? null;
      const company = body.company ?? null;
      const purpose = body.purpose ?? null;

      const rateIn = body.hourlyRate ?? body.hourly_rate;
      const hourlyRate =
        rateIn === "" || rateIn == null || Number.isNaN(Number(rateIn))
          ? null
          : Number(rateIn);

      const travelStatus = body.travelStatus ?? null;
      const travelCapType = body.travelCapType ?? null;
      const travelCapValue =
        body.travelCapValue != null && body.travelCapValue !== ""
          ? Number(body.travelCapValue)
          : null;

      const fuelIn = body.fuelRate ?? body.fuel_rate;
      const fuelRate =
        fuelIn === "" || fuelIn == null || Number.isNaN(Number(fuelIn))
          ? null
          : Number(fuelIn);

      const isMainIn = body.isMain ?? body.is_main;

      const sets = [];
      const binds = [];

      if (firstName !== null) {
        sets.push("first_name = ?");
        binds.push(firstName);
      }

      if (lastName !== null) {
        sets.push("last_name = ?");
        binds.push(lastName);
      }

      if (company !== null) {
        sets.push("company = ?");
        binds.push(company);
      }

      if (purpose !== null) {
        sets.push("purpose = ?");
        binds.push(purpose);
      }

      if (rateIn !== undefined) {
        sets.push("hourly_rate = ?");
        binds.push(hourlyRate ?? 0);
      }

      if (travelStatus !== null) {
        sets.push("travel_status = ?");
        binds.push(travelStatus);

        sets.push("travel_cap_type = ?");
        binds.push(travelCapType);

        sets.push("travel_cap_value = ?");
        binds.push(Number.isFinite(travelCapValue) ? travelCapValue : null);
      }

      if (fuelIn !== undefined) {
        sets.push("fuel_rate = ?");
        binds.push(fuelRate);
      }

      if (isMainIn !== undefined) {
        sets.push("is_main = ?");
        binds.push(isMainIn ? 1 : 0);
      }

      if (!sets.length) return json({ ok: true, note: "No fields to update" });

      binds.push(id);

      await env.DB.prepare(
        `UPDATE people SET ${sets.join(", ")} WHERE id = ?`
      ).bind(...binds).run();

      return json({ ok: true });
    }

    // POST /toggle-engineer
    if (url.pathname === "/toggle-engineer" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;

      const { id } = await readBody(request);

      if (!id) return json({ error: "Missing id" }, 400);

      const person = await env.DB.prepare(
        "SELECT COALESCE(archived,0) as archived FROM people WHERE id = ?"
      ).bind(id).first();

      if (!person) return json({ error: "Engineer not found" }, 404);

      const newState = person.archived ? 0 : 1;

      await env.DB.prepare(
        "UPDATE people SET archived = ? WHERE id = ?"
      ).bind(newState, id).run();

      return json({ ok: true, archived: newState });
    }

    // POST /delete-engineer
    if (url.pathname === "/delete-engineer" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;

      const { id } = await readBody(request);

      if (!id) return json({ ok: false, error: "Missing id" }, 400);

      const visitCount = await env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM visits WHERE person_id = ?"
      ).bind(id).first();

      if (visitCount && visitCount.cnt > 0) {
        await env.DB.prepare(
          "UPDATE people SET archived = 1 WHERE id = ?"
        ).bind(id).run();

        await env.DB.prepare(
          "DELETE FROM devices WHERE person_id = ?"
        ).bind(id).run();

        return json({ ok: true, message: "Archived and device links removed." });
      }

      await env.DB.prepare("DELETE FROM devices WHERE person_id = ?")
        .bind(id).run();

      await env.DB.prepare("DELETE FROM people WHERE id = ?")
        .bind(id).run();

      return json({ ok: true, message: "Engineer deleted." });
    }

    // POST /merge-people
    // Merge one or more duplicate people into a single primary person: all their
    // visits and devices are re-pointed to the primary, then the duplicate rows
    // are deleted. Mirrors the device-transfer approval flow, generalised.
    if (url.pathname === "/merge-people" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;
      await ensureOfflineSchema(env);

      const body = await readBody(request);
      const primaryId = body?.primaryId;
      const mergeIds = Array.isArray(body?.mergeIds)
        ? [...new Set(body.mergeIds.filter(x => x && x !== primaryId))]
        : [];

      if (!primaryId) return json({ ok: false, error: "Missing primaryId" }, 400);
      if (!mergeIds.length) return json({ ok: false, error: "No people to merge" }, 400);

      const primary = await env.DB.prepare("SELECT id FROM people WHERE id = ?").bind(primaryId).first();
      if (!primary) return json({ ok: false, error: "Primary person not found" }, 404);

      const placeholders = mergeIds.map(() => "?").join(",");

      const moved = await env.DB.prepare(
        `UPDATE visits SET person_id = ? WHERE person_id IN (${placeholders})`
      ).bind(primaryId, ...mergeIds).run();

      // Re-point the duplicates' devices to the primary so either phone keeps
      // working under the one person going forward.
      await env.DB.prepare(
        `UPDATE devices SET person_id = ? WHERE person_id IN (${placeholders})`
      ).bind(primaryId, ...mergeIds).run();

      await env.DB.prepare(
        `DELETE FROM people WHERE id IN (${placeholders})`
      ).bind(...mergeIds).run();

      const visitsMoved = (moved && moved.meta && moved.meta.changes) || 0;
      return json({ ok: true, merged: mergeIds.length, visitsMoved });
    }

    // POST /reset-device
    if (url.pathname === "/reset-device" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;

      const { personId } = await readBody(request);

      if (!personId) return json({ ok: false, error: "Missing personId" }, 400);

      const result = await env.DB.prepare(
        "DELETE FROM devices WHERE person_id = ?"
      ).bind(personId).run();

      return json({ ok: true, removedDevices: result.meta.changes });
    }

    // POST /add-site
    if (url.pathname === "/add-site" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;
      await ensureOfflineSchema(env);

      const { siteName, lat, lng, radius, category } = await readBody(request);

      if (!siteName || lat == null || lng == null) {
        return json({ error: "Missing siteName/lat/lng" }, 400);
      }

      if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
        return json({ error: "lat/lng must be numbers" }, 400);
      }

      await env.DB.prepare(
        "INSERT INTO sites (id, site_name, lat, lng, radius_m, archived, category) VALUES (?, ?, ?, ?, ?, 0, ?)"
      ).bind(
        crypto.randomUUID(),
        siteName,
        Number(lat),
        Number(lng),
        Number(radius ?? 500),
        (String(category || "").trim() || "Projects")
      ).run();

      return json({ ok: true, siteName });
    }

    // POST /bulk-add-sites  — import many sites at once; skips names that already exist
    if (url.pathname === "/bulk-add-sites" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;
      await ensureOfflineSchema(env);

      const body = await readBody(request);
      const incoming = Array.isArray(body.sites) ? body.sites : [];
      if (!incoming.length) return json({ ok: false, error: "No sites provided" }, 400);

      const existing = await env.DB.prepare("SELECT site_name FROM sites").all();
      const have = new Set((existing.results || []).map(r => String(r.site_name || "").trim().toLowerCase()));

      const stmts = [];
      let skipped = 0;
      const insert = env.DB.prepare(
        "INSERT INTO sites (id, site_name, lat, lng, radius_m, archived, category) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      for (const s of incoming) {
        const name = String(s.siteName ?? s.n ?? "").trim();
        const lat = s.lat, lng = s.lng ?? s.lon;
        const key = name.toLowerCase();
        if (!name || !isFiniteNumber(lat) || !isFiniteNumber(lng) || have.has(key)) { skipped++; continue; }
        have.add(key);
        stmts.push(insert.bind(
          crypto.randomUUID(),
          name,
          Number(lat),
          Number(lng),
          Number(s.radius ?? 500),
          (s.archived ?? s.arch) ? 1 : 0,
          (String(s.category ?? s.cat ?? "").trim() || "Projects")
        ));
      }

      if (stmts.length) await env.DB.batch(stmts);
      return json({ ok: true, added: stmts.length, skipped });
    }

    // POST /manual-checkout
    if (url.pathname === "/manual-checkout" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;

      const { visitId, manualTime } = await readBody(request);

      if (!visitId) return json({ ok: false, error: "Missing visitId" }, 400);

      if (manualTime !== undefined && manualTime !== "" && !isValidDateTimeString(manualTime)) {
        return json({ ok: false, error: "Invalid manualTime format" }, 400);
      }

      if (manualTime) {
        const vrow = await env.DB.prepare(
          "SELECT check_in_at FROM visits WHERE id = ?"
        ).bind(visitId).first();
        if (vrow && vrow.check_in_at && new Date(manualTime) <= new Date(vrow.check_in_at)) {
          return json({ ok: false, error: "Sign-out time must be after sign-in time" }, 400);
        }
      }

      let checkoutTimeSQL = "CURRENT_TIMESTAMP";
      let bindValues = [visitId];

      if (manualTime) {
        checkoutTimeSQL = "?";
        bindValues = [manualTime, visitId];
      }

      const sql =
        `UPDATE visits SET check_out_at = ${checkoutTimeSQL}, auto_checkout = 0 WHERE id = ? AND check_out_at IS NULL`;

      const result = await env.DB.prepare(sql).bind(...bindValues).run();

      if (result.meta.changes === 0) {
        return json({ ok: false, error: "Visit not found or already checked out" }, 400);
      }

      return json({ ok: true });
    }

    // POST /add-visit
    // Admin manually logs a visit for a person (job costing / corrections).
    // No GPS; flagged manual_entry = 1. Times are taken as entered.
    if (url.pathname === "/add-visit" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;
      await ensureOfflineSchema(env);

      const { personId, site, checkInAt, checkOutAt } = await readBody(request);
      if (!personId || !site || !checkInAt) {
        return json({ ok: false, error: "Missing person, site or start time" }, 400);
      }
      const siteName = String(site).trim().slice(0, 120);
      if (!siteName) return json({ ok: false, error: "Missing site" }, 400);
      if (!isValidDateTimeString(checkInAt)) return json({ ok: false, error: "Invalid start time" }, 400);
      if (checkOutAt && !isValidDateTimeString(checkOutAt)) return json({ ok: false, error: "Invalid end time" }, 400);
      if (checkOutAt && new Date(checkOutAt) <= new Date(checkInAt)) {
        return json({ ok: false, error: "End time must be after start time" }, 400);
      }

      const person = await env.DB.prepare("SELECT id FROM people WHERE id = ?").bind(personId).first();
      if (!person) return json({ ok: false, error: "Person not found" }, 404);

      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO visits
          (id, person_id, site_code, lat, lng, accuracy, hs_ack, auto_checkout, sign_in_confirmed, sign_out_confirmed, manual_entry, check_in_at, check_out_at)
        VALUES (?, ?, ?, NULL, NULL, NULL, 1, 0, 1, 1, 1, ?, ?)
      `).bind(id, personId, siteName, checkInAt, checkOutAt ?? null).run();

      return json({ ok: true, visitId: id });
    }

    // POST /update-visit-times
    if (url.pathname === "/update-visit-times" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;

      const { visitId, checkInAt, checkOutAt } = await readBody(request);

      if (!visitId) return json({ ok: false, error: "Missing visitId" }, 400);
      if (!checkInAt || !isValidDateTimeString(checkInAt)) {
        return json({ ok: false, error: "Invalid checkInAt" }, 400);
      }

      if (checkOutAt && !isValidDateTimeString(checkOutAt)) {
        return json({ ok: false, error: "Invalid checkOutAt" }, 400);
      }

      if (checkOutAt && new Date(checkOutAt) <= new Date(checkInAt)) {
        return json({ ok: false, error: "check_out_at must be after check_in_at" }, 400);
      }

      await env.DB.prepare(
        "UPDATE visits SET check_in_at = ?, check_out_at = ? WHERE id = ?"
      ).bind(checkInAt, checkOutAt ?? null, visitId).run();

      return json({ ok: true });
    }

    // POST /confirm-checkout
    if (url.pathname === "/confirm-checkout" && request.method === "POST") {
      const { visitId } = await readBody(request);

      if (!visitId) return json({ ok: false, error: "Missing visitId" }, 400);

      const result = await env.DB.prepare(`
        UPDATE visits
        SET check_out_at = MAX(check_in_at, COALESCE(check_out_at, CURRENT_TIMESTAMP)),
            auto_checkout = 0,
            sign_out_confirmed = 1
        WHERE id = ?
      `).bind(visitId).run();

      if (result.meta.changes === 0) {
        return json({ ok: false, error: "Visit not found" }, 400);
      }

      let travelOut = null;

      try {
        const visit = await env.DB.prepare(
          "SELECT person_id, site_code FROM visits WHERE id = ?"
        ).bind(visitId).first();

        if (visit) {
          const siteRow = await env.DB.prepare(
            "SELECT lat, lng FROM sites WHERE site_name = ?"
          ).bind(visit.site_code).first();

          if (siteRow) {
            travelOut = await handleTravelOut(
              env,
              visitId,
              visit.person_id,
              siteRow.lat,
              siteRow.lng
            );
          }
        }
      } catch (e) {}

      return json({ ok: true, status: "checked_out", travel: travelOut });
    }

    // POST /confirm-checkin
    if (url.pathname === "/confirm-checkin" && request.method === "POST") {
      const { deviceToken, lat, lng, accuracy, site, visitId } = await readBody(request);

      if (!deviceToken) return json({ ok: false, error: "Missing deviceToken" }, 400);
      if (!site) return json({ ok: false, error: "Missing site" }, 400);

      const siteCheck = await env.DB.prepare(`
        SELECT id, lat, lng
        FROM sites
        WHERE site_name = ? AND COALESCE(archived,0) = 0
        LIMIT 1
      `).bind(site).first();

      if (!siteCheck) {
        return json({ ok: false, error: "Site not found or archived" }, 404);
      }

      if (lat != null && lat !== "" && !isFiniteNumber(lat)) {
        return json({ ok: false, error: "Invalid lat" }, 400);
      }

      if (lng != null && lng !== "" && !isFiniteNumber(lng)) {
        return json({ ok: false, error: "Invalid lng" }, 400);
      }

      const device = await env.DB.prepare(
        "SELECT person_id FROM devices WHERE device_token = ?"
      ).bind(deviceToken).first();

      if (!device) return json({ ok: false, error: "Device not registered" }, 404);

      const person = await env.DB.prepare(
        "SELECT first_name, company FROM people WHERE id = ?"
      ).bind(device.person_id).first();

      let targetId = visitId || null;
      const siteRow = await env.DB.prepare(
        "SELECT lat, lng FROM sites WHERE site_name = ?"
      ).bind(site).first();

      if (!targetId) {
        const openVisit = await env.DB.prepare(`
          SELECT id
          FROM visits
          WHERE person_id = ? AND site_code = ? AND check_out_at IS NULL
          ORDER BY check_in_at DESC
          LIMIT 1
        `).bind(device.person_id, site).first();

        if (openVisit) targetId = openVisit.id;
      }

      let travelIn = null;

      if (targetId) {
        await env.DB.prepare(
          "UPDATE visits SET sign_in_confirmed = 1, hs_ack = 1 WHERE id = ?"
        ).bind(targetId).run();

        try {
          if (siteRow) {
            travelIn = await handleTravelIn(
              env,
              targetId,
              device.person_id,
              siteRow.lat,
              siteRow.lng
            );
          }
        } catch (e) {}

        return json({
          ok: true,
          status: "checked_in",
          site,
          firstName: person?.first_name || null,
          company: person?.company || null,
          travel: travelIn
        });
      }

      const newVisitId = crypto.randomUUID();

      await env.DB.prepare(`
        INSERT INTO visits
          (id, person_id, site_code, lat, lng, accuracy, hs_ack, auto_checkout, sign_in_confirmed, sign_out_confirmed)
        VALUES (?, ?, ?, ?, ?, ?, 1, 0, 1, 0)
      `).bind(
        newVisitId,
        device.person_id,
        site,
        lat ?? null,
        lng ?? null,
        accuracy ?? null
      ).run();

      try {
        if (siteRow) {
          travelIn = await handleTravelIn(
            env,
            newVisitId,
            device.person_id,
            siteRow.lat,
            siteRow.lng
          );
        }
      } catch (e) {}

      return json({
        ok: true,
        status: "checked_in",
        site,
        firstName: person?.first_name || null,
        company: person?.company || null,
        travel: travelIn
      });
    }

    // POST /checkin-unmatched
    // Check in when the GPS matched no configured site. The visit is stored
    // with the captured location and a worker-typed site name, flagged for an
    // admin to later create a site or link it to an existing one. No travel is
    // computed until it's resolved to a real (geofenced) site.
    if (url.pathname === "/checkin-unmatched" && request.method === "POST") {
      await ensureOfflineSchema(env);
      const body = await readBody(request);
      const deviceToken = (body.deviceToken || readDidCookie(request) || "").toString().trim();
      const siteName = (body.siteName || "").toString().trim().slice(0, 120);
      const lat = body.lat, lng = body.lng, accuracy = body.accuracy;

      if (!deviceToken) return json({ ok: false, error: "Missing deviceToken" }, 400);
      if (!siteName) return json({ ok: false, error: "Please enter a site name" }, 400);
      if (lat != null && lat !== "" && !isFiniteNumber(lat)) return json({ ok: false, error: "Invalid lat" }, 400);
      if (lng != null && lng !== "" && !isFiniteNumber(lng)) return json({ ok: false, error: "Invalid lng" }, 400);

      const device = await env.DB.prepare(
        "SELECT person_id FROM devices WHERE device_token = ?"
      ).bind(deviceToken).first();
      if (!device) return json({ ok: false, error: "Device not registered" }, 404);

      const person = await env.DB.prepare(
        "SELECT first_name, company FROM people WHERE id = ?"
      ).bind(device.person_id).first();

      await env.DB.prepare(`
        INSERT INTO visits
          (id, person_id, site_code, lat, lng, accuracy, hs_ack, auto_checkout, sign_in_confirmed, sign_out_confirmed, unmatched_site, provided_site_name)
        VALUES (?, ?, ?, ?, ?, ?, 1, 0, 1, 0, 1, ?)
      `).bind(
        crypto.randomUUID(),
        device.person_id,
        siteName,
        isFiniteNumber(lat) ? Number(lat) : null,
        isFiniteNumber(lng) ? Number(lng) : null,
        isFiniteNumber(accuracy) ? Number(accuracy) : null,
        siteName
      ).run();

      return json({
        ok: true,
        status: "checked_in",
        site: siteName,
        unmatched: true,
        firstName: person?.first_name || null,
        company: person?.company || null
      });
    }

    // POST /resolve-unmatched
    // Admin links an unmatched check-in to a site: either create a new site at
    // the visit's captured GPS, or attach it to an existing site.
    if (url.pathname === "/resolve-unmatched" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;
      await ensureOfflineSchema(env);

      const { visitId, mode, siteName, radius, existingSiteName } = await readBody(request);
      if (!visitId) return json({ ok: false, error: "Missing visitId" }, 400);

      const visit = await env.DB.prepare(
        "SELECT id, lat, lng FROM visits WHERE id = ?"
      ).bind(visitId).first();
      if (!visit) return json({ ok: false, error: "Visit not found" }, 404);

      if (mode === "create") {
        const name = (siteName || "").toString().trim().slice(0, 120);
        if (!name) return json({ ok: false, error: "Missing site name" }, 400);
        if (!isFiniteNumber(visit.lat) || !isFiniteNumber(visit.lng)) {
          return json({ ok: false, error: "This visit has no captured location, so a site can't be created from it. Link to an existing site instead." }, 400);
        }
        const existing = await env.DB.prepare(
          "SELECT id FROM sites WHERE site_name = ?"
        ).bind(name).first();
        if (!existing) {
          await env.DB.prepare(
            "INSERT INTO sites (id, site_name, lat, lng, radius_m, archived) VALUES (?, ?, ?, ?, ?, 0)"
          ).bind(crypto.randomUUID(), name, Number(visit.lat), Number(visit.lng), Number(radius ?? 500)).run();
        }
        await env.DB.prepare(
          "UPDATE visits SET site_code = ?, unmatched_site = 0 WHERE id = ?"
        ).bind(name, visitId).run();
        return json({ ok: true, site: name, created: !existing });
      }

      if (mode === "link") {
        const name = (existingSiteName || "").toString().trim();
        if (!name) return json({ ok: false, error: "Missing site to link to" }, 400);
        const site = await env.DB.prepare(
          "SELECT id FROM sites WHERE site_name = ?"
        ).bind(name).first();
        if (!site) return json({ ok: false, error: "Site not found" }, 404);
        await env.DB.prepare(
          "UPDATE visits SET site_code = ?, unmatched_site = 0 WHERE id = ?"
        ).bind(name, visitId).run();
        return json({ ok: true, site: name });
      }

      return json({ ok: false, error: "Invalid mode" }, 400);
    }

    if (url.pathname === "/delete-visit" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;

      const { visitId } = await readBody(request);

      if (!visitId) return json({ error: "Missing visitId" }, 400);

      await env.DB.prepare(
        "DELETE FROM visits WHERE id = ?"
      ).bind(visitId).run();

      return json({ ok: true });
    }

    // POST /sync-event
    // Replays an offline-captured sign in/out once the device is back online.
    // The client just queues the raw event (device token, GPS, the device-clock
    // timestamp, and whether they meant to sign in or out); all the reconciling
    // happens here against current state, so events are never missed.
    if (url.pathname === "/sync-event" && request.method === "POST") {
      await ensureOfflineSchema(env);
      const body = await readBody(request);
      const deviceToken = (body.deviceToken || readDidCookie(request) || "").toString().trim();
      const intent = body.intent === "out" ? "out" : "in";
      const accuracy = isFiniteNumber(body.accuracy) ? Number(body.accuracy) : null;
      if (!deviceToken) return json({ ok: false, error: "Missing deviceToken" }, 400);

      await touchDevice(env, deviceToken);

      // Trust the device clock, but guard against garbage or future timestamps.
      const nowMs = Date.now();
      const parsed = typeof body.occurredAt === "string" ? Date.parse(body.occurredAt) : NaN;
      const occurredMs =
        Number.isFinite(parsed) && parsed <= nowMs + 5 * 60 * 1000 && parsed >= nowMs - 30 * 24 * 60 * 60 * 1000
          ? parsed
          : nowMs;
      const occurredSql = toSqlUtc(occurredMs);

      // Resolve which site the captured GPS falls inside (mirrors /scan).
      const lat = body.lat, lng = body.lng;
      const latVal = isFiniteNumber(lat) ? Number(lat) : null;
      const lngVal = isFiniteNumber(lng) ? Number(lng) : null;
      let matchedSite = null;
      if (latVal !== null && lngVal !== null && latVal >= -90 && latVal <= 90 && lngVal >= -180 && lngVal <= 180) {
        const siteRows = await env.DB.prepare("SELECT * FROM sites WHERE COALESCE(archived,0) = 0").all();
        let bestDist = null;
        for (const s of siteRows.results || []) {
          const d = haversineMeters(latVal, lngVal, Number(s.lat), Number(s.lng));
          if (d <= Number(s.radius_m) && (bestDist === null || d < bestDist)) { bestDist = d; matchedSite = s; }
        }
      }

      const device = await env.DB.prepare(
        "SELECT * FROM devices WHERE device_token = ?"
      ).bind(deviceToken).first();

      const logPending = async (siteCode, reason) => {
        await env.DB.prepare(
          "INSERT INTO pending_events (id, device_token, lat, lng, accuracy, site_code, intent, occurred_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
        ).bind(crypto.randomUUID(), deviceToken, latVal, lngVal, accuracy, siteCode, intent, occurredSql).run();
        return json({ ok: true, status: "logged_pending", reason });
      };

      // Unknown device, or GPS not inside any site -> log so nothing is lost.
      if (!device) return await logPending(matchedSite ? matchedSite.site_name : null, "unknown_device");
      if (!matchedSite) return await logPending(null, "no_site_match");

      const siteCode = matchedSite.site_name;
      const openVisit = await env.DB.prepare(
        "SELECT id, check_in_at FROM visits WHERE person_id = ? AND site_code = ? AND check_out_at IS NULL ORDER BY check_in_at DESC"
      ).bind(device.person_id, siteCode).first();

      if (intent === "out") {
        if (!openVisit) return await logPending(siteCode, "no_open_visit");
        // Use the offline time only if it's after check-in; else fall back to now.
        // Both strings are 'YYYY-MM-DD HH:MM:SS' UTC, so they compare lexically.
        const outSql = occurredSql > String(openVisit.check_in_at) ? occurredSql : toSqlUtc(nowMs);
        await env.DB.prepare(
          "UPDATE visits SET check_out_at = ?, auto_checkout = 0, sign_out_confirmed = 1, offline_synced = 1 WHERE id = ? AND check_out_at IS NULL"
        ).bind(outSql, openVisit.id).run();
        return json({ ok: true, status: "checked_out", site: siteCode, offline: true });
      }

      // intent === "in" — idempotent if already on site at this site.
      if (openVisit) return json({ ok: true, status: "already_in", site: siteCode, offline: true });
      // Idempotency on retry: if a response was lost and the same event is
      // re-sent, a visit with this exact person+site+timestamp already exists
      // (even if since signed out) — don't create a duplicate check-in.
      const dupIn = await env.DB.prepare(
        "SELECT id FROM visits WHERE person_id = ? AND site_code = ? AND check_in_at = ? LIMIT 1"
      ).bind(device.person_id, siteCode, occurredSql).first();
      if (dupIn) return json({ ok: true, status: "duplicate_ignored", site: siteCode, offline: true });
      await env.DB.prepare(
        "INSERT INTO visits (id, person_id, site_code, lat, lng, accuracy, hs_ack, auto_checkout, sign_in_confirmed, sign_out_confirmed, offline_synced, check_in_at) VALUES (?, ?, ?, ?, ?, ?, 1, 0, 1, 0, 1, ?)"
      ).bind(crypto.randomUUID(), device.person_id, siteCode, latVal, lngVal, accuracy, occurredSql).run();
      return json({ ok: true, status: "checked_in", site: siteCode, offline: true });
    }

    // GET /pending-events  (offline events the server could not attribute)
    if (url.pathname === "/pending-events" && request.method === "GET") {
      const guard = requireAdmin();
      if (guard) return guard;
      await ensureOfflineSchema(env);
      const rows = await env.DB.prepare(
        "SELECT id, device_token, lat, lng, accuracy, site_code, intent, occurred_at, synced_at FROM pending_events WHERE COALESCE(resolved,0) = 0 ORDER BY occurred_at DESC LIMIT 200"
      ).all();
      return json({ ok: true, events: rows.results || [] });
    }

    // POST /scan
    if (url.pathname === "/scan" && request.method === "POST") {
      const body = await readBody(request);
      const lat = body.lat, lng = body.lng, accuracy = body.accuracy;
      const deviceToken = body.deviceToken || readDidCookie(request);

      if (!deviceToken) return json({ ok: false, error: "Missing deviceToken" }, 400);

      if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
        return json({ ok: false, error: "Missing or invalid lat/lng" }, 400);
      }

      await touchDevice(env, deviceToken);

      const latNum = Number(lat);
      const lngNum = Number(lng);

      if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
        return json({ ok: false, error: "lat/lng out of range" }, 400);
      }

      const siteRows = await env.DB.prepare(
        "SELECT * FROM sites WHERE COALESCE(archived,0) = 0"
      ).all();

      let matchedSite = null;
      let bestDist = null;

      for (const s of siteRows.results || []) {
        const d = haversineMeters(latNum, lngNum, Number(s.lat), Number(s.lng));

        if (d <= Number(s.radius_m) && (bestDist === null || d < bestDist)) {
          bestDist = d;
          matchedSite = s;
        }
      }

      if (!matchedSite) {
        // Even with no GPS-matched site, a device that is currently signed in
        // must be able to sign OUT — otherwise an unmatched-location check-in
        // (or someone who left a site and has no signal at a matched one) is
        // stuck open until the 16:00 auto-close. Offer sign-out for their most
        // recent open visit.
        const devNoSite = await env.DB.prepare(
          "SELECT * FROM devices WHERE device_token = ?"
        ).bind(deviceToken).first();
        if (devNoSite) {
          const openAny = await env.DB.prepare(
            "SELECT id, site_code FROM visits WHERE person_id = ? AND check_out_at IS NULL ORDER BY check_in_at DESC LIMIT 1"
          ).bind(devNoSite.person_id).first();
          if (openAny) {
            const perNoSite = await env.DB.prepare(
              "SELECT first_name, company FROM people WHERE id = ?"
            ).bind(devNoSite.person_id).first();
            return json({
              status: "confirm_sign_out",
              visitId: openAny.id,
              site: openAny.site_code,
              firstName: perNoSite?.first_name || null,
              company: perNoSite?.company || null
            });
          }
        }

        let nearestSite = null;
        let nearestDist = null;

        for (const s of siteRows.results || []) {
          const d = haversineMeters(latNum, lngNum, Number(s.lat), Number(s.lng));

          if (nearestDist === null || d < nearestDist) {
            nearestDist = d;
            nearestSite = s;
          }
        }

        if (!nearestSite) {
          return json({ status: "unknown_site", reason: "No active sites configured" });
        }

        return json({
          status: "unknown_site",
          nearestSite: nearestSite.site_name,
          distance_m: Math.round(nearestDist)
        });
      }

      const siteCode = matchedSite.site_name;
      const rulesRaw = matchedSite.site_rules || "";
      const siteRules = rulesRaw
        .split("\n")
        .map((r) => r.trim())
        .filter((r) => r.length > 0);

      const device = await env.DB.prepare(
        "SELECT * FROM devices WHERE device_token = ?"
      ).bind(deviceToken).first();

      if (!device) {
        return json({ status: "first_visit", site: siteCode, siteRules });
      }

      const isArchived = await env.DB.prepare(
        "SELECT COALESCE(archived,0) as archived FROM people WHERE id = ?"
      ).bind(device.person_id).first();

      if (isArchived && isArchived.archived) {
        return json({ status: "blocked", reason: "engineer_archived" });
      }

      const person = await env.DB.prepare(
        "SELECT first_name, company FROM people WHERE id = ?"
      ).bind(device.person_id).first();

      const allOpenVisits = await env.DB.prepare(
        "SELECT id, site_code, check_in_at FROM visits WHERE person_id = ? AND check_out_at IS NULL"
      ).bind(device.person_id).all();

      const nowLondon = londonNowParts();
      const nowDateKey = nowLondon.dateKey;

      for (const v of allOpenVisits.results || []) {
        const visitDateKey = londonDateKeyFromUtcString(v.check_in_at);

        if (visitDateKey < nowDateKey) {
          // MAX(check_in_at, ...) so a night-shift / late check-in can never be
          // closed BEFORE it opened (which would record negative hours).
          const forcedCheckoutUtc = toSqlUtc(Date.parse(londonLocalToUtcIso(visitDateKey, "16:00:00")));

          await env.DB.prepare(`
            UPDATE visits
            SET check_out_at = MAX(check_in_at, ?), auto_checkout = 1
            WHERE id = ? AND check_out_at IS NULL
          `).bind(forcedCheckoutUtc, v.id).run();
        }
      }

      const openVisit = await env.DB.prepare(`
        SELECT *
        FROM visits
        WHERE person_id = ? AND site_code = ? AND check_out_at IS NULL
      `).bind(device.person_id, siteCode).first();

      if (openVisit) {
        return json({
          status: "confirm_sign_out",
          visitId: openVisit.id,
          site: siteCode,
          firstName: person?.first_name || null,
          company: person?.company || null
        });
      }

      return json({
        status: "confirm_check_in",
        site: siteCode,
        firstName: person?.first_name || null,
        company: person?.company || null,
        siteRules
      });
    }

    // GET /companies
    if (url.pathname === "/companies" && request.method === "GET") {
      const rows = await env.DB.prepare(
        "SELECT id, name FROM companies ORDER BY name ASC"
      ).all();

      return json({ companies: rows.results || [] });
    }

    // POST /add-company
    if (url.pathname === "/add-company" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;

      const { name } = await readBody(request);

      if (!name || !name.trim()) {
        return json({ ok: false, error: "Missing company name" }, 400);
      }

      await env.DB.prepare(
        "INSERT INTO companies (id, name) VALUES (?, ?)"
      ).bind(crypto.randomUUID(), name.trim()).run();

      return json({ ok: true });
    }

    // POST /delete-company
    if (url.pathname === "/delete-company" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;

      const { id } = await readBody(request);

      if (!id) return json({ ok: false, error: "Missing id" }, 400);

      await env.DB.prepare(
        "DELETE FROM site_company_map WHERE company_id = ?"
      ).bind(id).run();

      await env.DB.prepare(
        "DELETE FROM companies WHERE id = ?"
      ).bind(id).run();

      return json({ ok: true });
    }

    // GET /companies-for-site
    if (url.pathname === "/companies-for-site" && request.method === "GET") {
      const siteName = url.searchParams.get("site");

      if (!siteName) return json({ error: "Missing site parameter" }, 400);

      const rows = await env.DB.prepare(`
        SELECT c.id, c.name
        FROM sites s
        JOIN site_company_map m ON m.site_id = s.id
        JOIN companies c ON c.id = m.company_id
        WHERE s.site_name = ?
        ORDER BY c.name ASC
      `).bind(siteName).all();

      return json({ companies: rows.results || [] });
    }

    // POST /update-site-companies
    if (url.pathname === "/update-site-companies" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;

      const mappings = await readBody(request);

      if (!mappings || typeof mappings !== "object") {
        return json({ ok: false, error: "Invalid payload" }, 400);
      }

      try {
        const statements = [];

        for (const siteId of Object.keys(mappings)) {
          statements.push(
            env.DB.prepare("DELETE FROM site_company_map WHERE site_id = ?").bind(siteId)
          );

          const companies = mappings[siteId];
          if (!Array.isArray(companies)) continue;

          for (const companyId of companies) {
            statements.push(
              env.DB.prepare("INSERT INTO site_company_map (site_id, company_id) VALUES (?, ?)")
                .bind(siteId, companyId)
            );
          }
        }

        if (statements.length) await env.DB.batch(statements);

        return json({ ok: true });
      } catch (err) {
        console.error("update-site-companies failed:", err);
        return json({
          ok: false,
          error: "Database update failed"
        }, 500);
      }
    }

    // GET /site-occupants
    if (url.pathname === "/site-occupants" && request.method === "GET") {
      const siteName = url.searchParams.get("site");

      if (!siteName) return json({ error: "Missing site parameter" }, 400);

      const rows = await env.DB.prepare(`
        SELECT p.first_name, p.last_name, p.company, p.purpose, v.check_in_at
        FROM visits v
        JOIN people p ON v.person_id = p.id
        WHERE v.site_code = ? AND v.check_out_at IS NULL AND COALESCE(p.archived,0) = 0
        ORDER BY v.check_in_at ASC
      `).bind(siteName).all();

      return json({ occupants: rows.results || [] });
    }

    // GET /my-visits
    if (url.pathname === "/my-visits" && request.method === "GET") {
      const deviceToken = url.searchParams.get("deviceToken");
      const limit = Math.min(Number(url.searchParams.get("limit") || 60), 200);

      if (!deviceToken) return json({ error: "Missing deviceToken" }, 400);

      const device = await env.DB.prepare(
        "SELECT person_id FROM devices WHERE device_token = ?"
      ).bind(deviceToken).first();

      if (!device) return json({ visits: [] });

      const rows = await env.DB.prepare(`
        SELECT id, site_code, check_in_at, check_out_at,
               COALESCE(sign_in_confirmed,0) as sign_in_confirmed,
               COALESCE(sign_out_confirmed,0) as sign_out_confirmed,
               COALESCE(auto_checkout,0) as auto_checkout
        FROM visits
        WHERE person_id = ?
        ORDER BY check_in_at DESC
        LIMIT ?
      `).bind(device.person_id, limit).all();

      return json({ visits: rows.results || [] });
    }

    // GET /me — current profile for this device.
    // Lets the worker app keep its locally cached name/company in sync with
    // admin edits on every page load. Returns registered:false (not an error)
    // when the device has never registered, so the client can stay quiet.
    if (url.pathname === "/me" && request.method === "GET") {
      const deviceToken = url.searchParams.get("deviceToken");

      if (!deviceToken) return json({ ok: false, error: "Missing deviceToken" }, 400);

      const row = await env.DB.prepare(`
        SELECT p.id AS person_id, p.first_name, p.last_name, p.company, p.purpose,
               COALESCE(p.archived,0) AS archived,
               COALESCE(p.is_transfer_pending,0) AS is_transfer_pending
        FROM devices d
        JOIN people p ON p.id = d.person_id
        WHERE d.device_token = ?
        LIMIT 1
      `).bind(deviceToken).first();

      if (!row) return json({ ok: true, registered: false });

      return json({
        ok: true,
        registered: true,
        personId: row.person_id,
        firstName: row.first_name,
        lastName: row.last_name,
        company: row.company,
        purpose: row.purpose,
        archived: !!row.archived,
        isTransferPending: !!row.is_transfer_pending
      });
    }

    // GET /travel-time
    if (url.pathname === "/travel-time" && request.method === "GET") {
      const orig = parseLatLng(url.searchParams.get("orig") || "");
      const dest = parseLatLng(url.searchParams.get("dest") || "");

      if (!orig || !dest) {
        return json({
          ok: false,
          error: "Invalid orig/dest. Expected 'lat,lng' with valid ranges."
        }, 400);
      }

      const result = await getTravelData(env, orig.lat, orig.lng, dest.lat, dest.lng);

      if (!result) {
        return json({ ok: false, error: "Travel data unavailable" }, 502);
      }

      return json({
        ok: true,
        duration_text: result.duration_text,
        distance_text: result.distance_text,
        duration_mins: result.mins,
        distance_miles: result.miles
      });
    }

    // GET /geocode
    if (url.pathname === "/geocode" && request.method === "GET") {
      const address = (url.searchParams.get("address") || "").trim();

      if (!address) return json({ ok: false, error: "Missing address" }, 400);
      if (address.length > 200) return json({ ok: false, error: "Address too long" }, 400);

      const result = await getGeocode(env, address);

      if (!result) return json({ ok: false, error: "Geocode failed" }, 502);

      return json({
        ok: true,
        lat: result.lat,
        lng: result.lng,
        formatted: result.formatted
      });
    }

    // POST /log-failed-scan
    if (url.pathname === "/log-failed-scan" && request.method === "POST") {
      return json({ ok: true });
    }

    // GET /admin
    if (url.pathname === "/admin" && request.method === "GET") {
      const guard = requireAdmin();
      if (guard) return guard;
      await ensureOfflineSchema(env);

      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");

      if (from && !isValidDateKey(from)) {
        return json({ error: "Invalid 'from' date (expected YYYY-MM-DD)" }, 400);
      }

      if (to && !isValidDateKey(to)) {
        return json({ error: "Invalid 'to' date (expected YYYY-MM-DD)" }, 400);
      }

      let sql = `
        SELECT v.id AS visit_id, v.person_id, v.site_code, v.check_in_at, v.check_out_at,
               v.lat, v.lng, v.accuracy, v.hs_ack,
               COALESCE(v.auto_checkout,0) AS auto_checkout,
               COALESCE(v.sign_in_confirmed,0) AS sign_in_confirmed,
               COALESCE(v.sign_out_confirmed,0) AS sign_out_confirmed,
               v.travel_in_miles, v.travel_in_mins,
               v.travel_out_miles, v.travel_out_mins,
               COALESCE(v.is_first_of_day,0) AS is_first_of_day,
               COALESCE(v.offline_synced,0) AS offline_synced,
               COALESCE(v.unmatched_site,0) AS unmatched_site,
               COALESCE(v.manual_entry,0) AS manual_entry,
               COALESCE(p.is_main,0) AS is_main,
               v.provided_site_name,
               CASE
                 WHEN COALESCE(v.auto_checkout,0) = 1 THEN 'No Sign Out'
                 WHEN v.check_out_at IS NOT NULL AND COALESCE(v.sign_out_confirmed,0) = 0 THEN 'Soft Sign Out'
                 WHEN v.check_out_at IS NOT NULL THEN 'Signed Out'
                 WHEN COALESCE(v.sign_in_confirmed,0) = 0 THEN 'Soft Sign In'
                 ELSE 'Still Open'
               END AS sign_out_status,
               p.first_name, p.last_name, p.company, p.purpose, d.device_token
        FROM visits v
        JOIN people p ON v.person_id = p.id
        LEFT JOIN devices d ON d.person_id = p.id
          AND d.rowid = (SELECT MIN(rowid) FROM devices WHERE person_id = p.id)
        WHERE COALESCE(p.archived,0) = 0
      `;

      const params = [];

      // Apply each bound independently so a one-sided range (just from, or just
      // to) is honoured rather than ignored — otherwise the caller silently
      // gets all-time data.
      if (from) {
        sql += " AND v.check_in_at >= ?";
        params.push(londonLocalToUtcIso(from, "00:00:00"));
      }
      if (to) {
        sql += " AND v.check_in_at <= ?";
        params.push(londonLocalToUtcIso(to, "23:59:59"));
      }

      // Cursor for backward pagination: callers needing the complete set (e.g.
      // job costing) page by passing the oldest check_in_at they've seen so far.
      // Kept inclusive (<=) and deduped client-side so no rows fall through a
      // page boundary even when timestamps tie.
      const before = url.searchParams.get("before");
      if (before) {
        sql += " AND v.check_in_at <= ?";
        params.push(before);
      }

      sql += " ORDER BY v.check_in_at DESC LIMIT 500";

      const stmt = env.DB.prepare(sql);
      const rows = params.length ? await stmt.bind(...params).all() : await stmt.all();

      return json({ visits: rows.results || [] });
    }

    // GET /on-site
    if (url.pathname === "/on-site" && request.method === "GET") {
      const site = url.searchParams.get("site") || "";

      const rows = await env.DB.prepare(`
        SELECT v.id as visit_id, v.person_id, p.first_name, p.last_name, p.company
        FROM visits v
        JOIN people p ON v.person_id = p.id
        WHERE v.site_code = ? AND v.check_out_at IS NULL AND COALESCE(p.archived,0) = 0
        ORDER BY p.first_name, p.last_name
      `).bind(site).all();

      const people = (rows.results || []).map((r) => ({
        person_id: r.person_id || "",
        name: `${r.first_name || ""} ${r.last_name || ""}`.trim(),
        company: r.company || ""
      }));

      return json({ people });
    }

    // POST /documents/create
    if (url.pathname === "/documents/create" && request.method === "POST") {
      await ensureOfflineSchema(env);
      const body = await readBody(request);
      const docId = crypto.randomUUID();
      const now = new Date().toISOString().replace("T", " ").slice(0, 19);

      // Per-type running document number (HWP-0001, IND-0001, TBT-0001). MAX(seq)
      // rather than COUNT so deleting a document never reissues an old number.
      const type = body.type || "";
      const prefix = { induction: "IND", hwp: "HWP", tbt: "TBT" }[type] || "DOC";
      const maxRow = await env.DB.prepare("SELECT MAX(doc_seq) AS m FROM documents WHERE type = ?").bind(type).first();
      const docSeq = (maxRow && maxRow.m ? Number(maxRow.m) : 0) + 1;
      const docNumber = prefix + "-" + String(docSeq).padStart(4, "0");

      await env.DB.prepare(`
        INSERT INTO documents
          (id, type, template_version, status, site_name, site_address,
           issued_by, issued_at, permit_no, valid_from,
           manager_signature, manager_signed_at, form_data, created_at, doc_number, doc_seq)
        VALUES (?,?,1,'issued',?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        docId,
        body.type || "",
        body.site_name || "",
        body.site_address || "",
        body.issued_by || "",
        body.issued_at || now,
        body.permit_no || null,
        body.valid_from || null,
        body.manager_signature || null,
        body.manager_signature ? now : null,
        JSON.stringify(body.form_data || {}),
        now,
        docNumber,
        docSeq
      ).run();

      const attendees = Array.isArray(body.attendees) ? body.attendees : [];

      for (let i = 0; i < attendees.length; i++) {
        const a = attendees[i];

        await env.DB.prepare(`
          INSERT INTO document_attendees
            (id, document_id, person_id, person_name, company, sign_order,
             trade, contact_number, cscs_number, signature, signed_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)
        `).bind(
          crypto.randomUUID(),
          docId,
          a.personId || null,
          a.personName || "",
          a.company || "",
          i + 1,
          a.trade || null,
          a.contact || null,
          a.cscs || null,
          a.signature || null,
          a.signature ? now : null
        ).run();
      }

      return json({ ok: true, id: docId });
    }

    // POST /documents/closeout
    if (url.pathname === "/documents/closeout" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;

      const body = await readBody(request);
      const now = new Date().toISOString().replace("T", " ").slice(0, 19);

      if (!body.docId) return json({ ok: false, error: "Missing docId" }, 400);

      await env.DB.prepare(`
        UPDATE documents
        SET status = 'closed',
            completion_time = ?,
            final_area_safe = ?,
            manager_signature = ?,
            manager_signed_at = ?,
            closed_at = ?
        WHERE id = ?
      `).bind(
        body.completionTime || null,
        body.finalAreaSafe ?? null,
        body.managerSignature || null,
        now,
        now,
        body.docId
      ).run();

      return json({ ok: true });
    }

    // GET /documents
    // GET /site-people — everyone signed into the site now OR previously, for the
    // document name dropdowns (currently-on-site listed first).
    if (url.pathname === "/site-people" && request.method === "GET") {
      const site = url.searchParams.get("site") || "";
      const rows = await env.DB.prepare(`
        SELECT p.id AS person_id, p.first_name, p.last_name, p.company,
               MAX(v.check_in_at) AS last_seen,
               MAX(CASE WHEN v.check_out_at IS NULL THEN 1 ELSE 0 END) AS on_now
        FROM visits v JOIN people p ON v.person_id = p.id
        WHERE v.site_code = ? AND COALESCE(p.archived,0) = 0
        GROUP BY p.id
        ORDER BY on_now DESC, last_seen DESC
      `).bind(site).all();
      const people = (rows.results || []).map(r => ({
        person_id: r.person_id || "",
        name: `${r.first_name || ""} ${r.last_name || ""}`.trim(),
        company: r.company || "",
        on_now: Number(r.on_now || 0) === 1
      })).filter(p => p.name);
      return json({ people });
    }

    // GET /my-documents — documents at a site that the calling device's person is
    // linked to (i.e. listed on the document). Powers the user app's Documents tab.
    if (url.pathname === "/my-documents" && request.method === "GET") {
      await ensureOfflineSchema(env);
      const deviceToken = url.searchParams.get("deviceToken") || "";
      const site = url.searchParams.get("site") || "";
      if (!deviceToken) return json({ documents: [] });
      const dev = await env.DB.prepare("SELECT person_id FROM devices WHERE device_token = ?").bind(deviceToken).first();
      if (!dev || !dev.person_id) return json({ documents: [] });
      const wheres = ["da.person_id = ?"];
      const binds = [dev.person_id];
      if (site) { wheres.push("d.site_name = ?"); binds.push(site); }
      const rows = await env.DB.prepare(`
        SELECT DISTINCT d.id, d.type, d.status, d.site_name, d.issued_at, d.doc_number, d.permit_no
        FROM documents d JOIN document_attendees da ON da.document_id = d.id
        WHERE ${wheres.join(" AND ")}
        ORDER BY d.issued_at DESC LIMIT 100
      `).bind(...binds).all();
      return json({ documents: rows.results || [] });
    }

    if (url.pathname === "/documents" && request.method === "GET") {
      const type = url.searchParams.get("type") || "";
      const status = url.searchParams.get("status") || "";
      const site = url.searchParams.get("site") || "";
      const person = url.searchParams.get("person") || "";
      const from = url.searchParams.get("from") || "";
      const to = url.searchParams.get("to") || "";

      let q = `
        SELECT d.id, d.type, d.status, d.site_name, d.issued_at,
               d.permit_no, d.closed_at, d.form_data, d.doc_number,
               GROUP_CONCAT(da.person_name, ', ') AS attendee_names
        FROM documents d
        LEFT JOIN document_attendees da ON da.document_id = d.id
      `;

      const wheres = [];
      const binds = [];

      if (type) {
        wheres.push("d.type = ?");
        binds.push(type);
      }

      if (status) {
        wheres.push("d.status = ?");
        binds.push(status);
      }

      if (site) {
        wheres.push("d.site_name = ?");
        binds.push(site);
      }

      if (from) {
        wheres.push("d.issued_at >= ?");
        binds.push(from);
      }

      if (to) {
        wheres.push("d.issued_at <= ?");
        binds.push(to + " 23:59:59");
      }

      if (person) {
        wheres.push("da.person_name LIKE ?");
        binds.push("%" + person + "%");
      }

      if (wheres.length) q += " WHERE " + wheres.join(" AND ");

      q += " GROUP BY d.id ORDER BY d.issued_at DESC LIMIT 200";

      const rows = await env.DB.prepare(q).bind(...binds).all();

      return json({ documents: rows.results || [] });
    }

    // POST /documents/delete
    if (url.pathname === "/documents/delete" && request.method === "POST") {
      const guard = requireAdmin();
      if (guard) return guard;
      const body = await readBody(request);
      const id = body.id || body.docId;
      if (!id) return json({ ok: false, error: "Missing id" }, 400);
      await env.DB.prepare("DELETE FROM document_attendees WHERE document_id = ?").bind(id).run();
      await env.DB.prepare("DELETE FROM documents WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }

    // GET /documents/single
    if (url.pathname === "/documents/single" && request.method === "GET") {
      const id = url.searchParams.get("id") || "";

      const doc = await env.DB.prepare(
        "SELECT * FROM documents WHERE id = ?"
      ).bind(id).first();

      if (!doc) return json({ error: "Not found" }, 404);

      try {
        doc.form_data = JSON.parse(doc.form_data || "{}");
      } catch {
        doc.form_data = {};
      }

      const atts = await env.DB.prepare(
        "SELECT * FROM document_attendees WHERE document_id = ? ORDER BY sign_order"
      ).bind(id).all();

      doc.attendees = atts.results || [];
      doc.attendee_names = doc.attendees.map((a) => a.person_name).join(", ");

      return json({ document: doc });
    }

    // POST /field-memory/save
    if (url.pathname === "/field-memory/save" && request.method === "POST") {
      const body = await readBody(request);

      const key = (body.key || "").trim();
      const value = (body.value || "").trim();
      const site = (body.site || "").trim();

      if (!key || !value) {
        return json({ ok: false, error: "key and value required" }, 400);
      }

      const now = new Date().toISOString().replace("T", " ").slice(0, 19);

      const existing = await env.DB.prepare(`
        SELECT id, use_count
        FROM field_memory
        WHERE field_key = ? AND COALESCE(site_name,'') = ? AND value = ?
        LIMIT 1
      `).bind(key, site, value).first();

      if (existing) {
        await env.DB.prepare(`
          UPDATE field_memory
          SET use_count = COALESCE(use_count,0) + 1,
              last_used_at = ?
          WHERE id = ?
        `).bind(now, existing.id).run();
      } else {
        await env.DB.prepare(`
          INSERT INTO field_memory
            (id, field_key, site_name, value, use_count, last_used_at)
          VALUES (?, ?, ?, ?, 1, ?)
        `).bind(
          crypto.randomUUID(),
          key,
          site || null,
          value,
          now
        ).run();
      }

      return json({ ok: true });
    }

    // GET /field-memory/suggest
    if (url.pathname === "/field-memory/suggest" && request.method === "GET") {
      const key = url.searchParams.get("key") || "";
      const site = url.searchParams.get("site") || "";

      const rows = await env.DB.prepare(`
        SELECT value
        FROM field_memory
        WHERE field_key = ? AND (site_name = ? OR site_name IS NULL OR site_name = '')
        ORDER BY (site_name IS NOT NULL AND site_name != '') DESC,
                 use_count DESC,
                 last_used_at DESC
        LIMIT 6
      `).bind(key, site).all();

      const seen = new Set();

      const suggestions = (rows.results || [])
        .filter((r) => {
          if (seen.has(r.value)) return false;
          seen.add(r.value);
          return true;
        })
        .map((r) => ({ value: r.value }));

      return json({ suggestions });
    }

    return new Response("Not found", { status: 404, headers: corsFor(request) });
  },

  async scheduled(event, env, ctx) {
    const run = async () => {
      const now = londonNowParts();

      const openVisits = await env.DB.prepare(
        "SELECT id, check_in_at FROM visits WHERE check_out_at IS NULL"
      ).all();

      for (const v of openVisits.results || []) {
        const visitDateKey = londonDateKeyFromUtcString(v.check_in_at);

        if (visitDateKey < now.dateKey) {
          // MAX(check_in_at, ...) guards against negative durations for late /
          // overnight check-ins (see the matching guard in /scan).
          const forcedCheckoutUtc = toSqlUtc(Date.parse(londonLocalToUtcIso(visitDateKey, "16:00:00")));

          await env.DB.prepare(`
            UPDATE visits
            SET check_out_at = MAX(check_in_at, ?), auto_checkout = 1
            WHERE id = ? AND check_out_at IS NULL
          `).bind(forcedCheckoutUtc, v.id).run();
        }
      }
    };

    if (ctx?.waitUntil) {
      ctx.waitUntil(run());
    } else {
      await run();
    }
  }
};
