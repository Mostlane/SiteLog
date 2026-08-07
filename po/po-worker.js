// Mostlane PO System
// Single-file Cloudflare Worker
// Requires: D1 binding `DB` configured in Worker Settings -> Bindings

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      await ensureSchema(env.DB);

      if (path === '/' || path === '') return html(landingPage());
      if (path.startsWith('/e/')) return handleEngineerView(path, env);
      if (path === '/office') {
        const remembered = getCookie(request, 'office_user');
        if (remembered) {
          // Verify it's still a valid active user; redirect to their token URL
          const user = await env.DB.prepare(`SELECT slug, token FROM office_users WHERE slug = ? AND active = 1`).bind(remembered).first();
          if (user && user.token) return Response.redirect(new URL('/o/' + user.token, request.url).toString(), 302);
        }
        return html(officeAccessRequiredPage());
      }
      if (path.startsWith('/o/')) return handleOfficeUserView(path, env);
      if (path === '/admin') return html(adminPage());
      if (path === '/stats') return html(statsPage());
      if (path === '/accounts') return html(accountsPage());
      if (path === '/report') return html(await reportPage(env.DB, url.searchParams));
      if (path === '/summary') return html(summaryPage());
      if (path === '/jobs') return html(jobCostPage());

      if (path === '/api/config' && method === 'GET') return json(await getConfig(env.DB));
      if (path === '/api/config' && method === 'POST') return json(await updateConfig(env.DB, await request.json()));
      if (path === '/api/engineers' && method === 'GET') return json(await getEngineers(env.DB));
      if (path === '/api/engineers' && method === 'POST') return json(await addEngineer(env.DB, await request.json()));
      if (path.startsWith('/api/engineers/') && path.endsWith('/rotate') && method === 'POST') return json(await rotateToken(env.DB, 'engineers', path.split('/')[3]));
      if (path.startsWith('/api/engineers/') && method === 'PATCH') return json(await updateEngineer(env.DB, path.split('/').pop(), await request.json()));
      if (path.startsWith('/api/engineers/') && method === 'DELETE') return json(await deleteEngineer(env.DB, path.split('/').pop()));
      if (path === '/api/office-users' && method === 'GET') return json(await getOfficeUsers(env.DB));
      if (path === '/api/office-users' && method === 'POST') return json(await addOfficeUser(env.DB, await request.json()));
      if (path.startsWith('/api/office-users/') && path.endsWith('/rotate') && method === 'POST') return json(await rotateToken(env.DB, 'office_users', path.split('/')[3]));
      if (path.startsWith('/api/office-users/') && method === 'DELETE') return json(await deleteOfficeUser(env.DB, path.split('/').pop()));
      if (path === '/api/suppliers' && method === 'GET') return json(await getSuppliers(env.DB));
      if (path === '/api/suppliers' && method === 'POST') return json(await addSupplier(env.DB, await request.json()));
      if (path.startsWith('/api/suppliers/') && method === 'DELETE') return json(await deleteSupplier(env.DB, path.split('/').pop()));
      if (path.startsWith('/api/suppliers/') && method === 'PATCH') return json(await updateSupplier(env.DB, path.split('/').pop(), await request.json()));
      if (path === '/api/subcontractors' && method === 'GET') return json(await getSubcontractors(env.DB));
      if (path === '/api/subcontractors' && method === 'POST') return json(await addSubcontractor(env.DB, await request.json()));
      if (path.startsWith('/api/subcontractors/') && method === 'DELETE') return json(await deleteSubcontractor(env.DB, path.split('/').pop()));
      if (path === '/api/trades' && method === 'GET') return json(await getTrades(env.DB));
      if (path === '/api/trades' && method === 'POST') return json(await addTrade(env.DB, await request.json()));
      if (path.startsWith('/api/trades/') && method === 'DELETE') return json(await deleteTrade(env.DB, path.split('/').pop()));
      if (path === '/api/accounts' && method === 'GET') return json(await getAccounts(env.DB));
      if (path === '/api/sites' && method === 'GET') return json(await getSites(env.DB));
      if (path === '/api/sites' && method === 'POST') return json(await addSite(env.DB, await request.json()));
      if (path.startsWith('/api/sites/') && method === 'DELETE') return json(await deleteSite(env.DB, path.split('/').pop()));
      if (path === '/api/jobs/search' && method === 'GET') return json(await searchJobs(env.DB, url.searchParams));
      if (path === '/api/closures' && method === 'GET') return json(await getClosures(env.DB));
      if (path === '/api/closures' && method === 'POST') return json(await addClosure(env.DB, await request.json()));
      if (path.startsWith('/api/closures/') && method === 'DELETE') return json(await deleteClosure(env.DB, decodeURIComponent(path.split('/').pop())));
      if (path === '/api/pos' && method === 'GET') return json(await getPOs(env.DB, url.searchParams));
      if (path === '/api/pos' && method === 'POST') return json(await issuePO(env.DB, await request.json()));
      if (path.startsWith('/api/pos/') && method === 'PATCH') return json(await updatePO(env.DB, path.split('/').pop(), await request.json()));
      if (path.startsWith('/api/pos/') && method === 'DELETE') return json(await deletePoRecord(env.DB, path.split('/').pop()));
      if (path === '/api/status' && method === 'GET') return json(await getSystemStatus(env.DB));
      if (path === '/api/dashboard' && method === 'GET') return json(await getDashboard(env.DB));
      if (path === '/api/stats' && method === 'GET') return json(await getStats(env.DB, url.searchParams));
      if (path === '/api/summary' && method === 'GET') return json(await getSummary(env.DB, url.searchParams));
      if (path === '/api/jobcost' && method === 'GET') return json(await getJobCost(env.DB, url.searchParams));
      if (path === '/summary/email' && method === 'GET') return html(await weeklySummaryEmailHtml(env.DB, url.searchParams, url.origin));
      if (path === '/api/export' && method === 'GET') return csvExport(env.DB, url.searchParams);
      if (path === '/logo.jpg' || path === '/logo.svg') return logoResponse();
      if (path === '/icon-192.png') return iconResponse(ICON_192_B64);
      if (path === '/icon-512.png') return iconResponse(ICON_512_B64);
      if (path === '/apple-touch-icon.png' || path === '/apple-touch-icon-precomposed.png') return iconResponse(ICON_180_B64);
      if (path === '/favicon-32.png') return iconResponse(ICON_32_B64);
      if (path === '/favicon.ico') return iconResponse(FAVICON_ICO_B64, 'image/x-icon');
      if (path === '/manifest.webmanifest' || path === '/manifest.json') return manifestResponse(url.searchParams);

      return new Response('Not found', { status: 404 });
    } catch (err) {
      return new Response('Error: ' + err.message, { status: 500 });
    }
  },

  // Cron trigger (add e.g. "0 7 * * MON" in Worker settings) sends the weekly
  // activity email. Dormant until email is configured (see runWeeklyEmail).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runWeeklyEmail(env));
  }
};

// ============================================================
// SCHEMA
// ============================================================
// Schema setup is idempotent but expensive (dozens of D1 round trips), so it
// runs once per isolate rather than on every request. Isolates serve many
// requests; a cold start re-runs it, which is harmless.
let schemaReady = false;

async function ensureSchema(db) {
  if (schemaReady) return;

  await db.exec(`CREATE TABLE IF NOT EXISTS engineers (slug TEXT PRIMARY KEY, name TEXT NOT NULL, active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  await db.exec(`CREATE TABLE IF NOT EXISTS office_users (slug TEXT PRIMARY KEY, name TEXT NOT NULL, active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  await db.exec(`CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, active INTEGER DEFAULT 1)`);
  await db.exec(`CREATE TABLE IF NOT EXISTS sites (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, active INTEGER DEFAULT 1)`);
  // Office-only: subcontractor companies and the trades they cover (for
  // subcontractor POs, which contribute to job cost).
  await db.exec(`CREATE TABLE IF NOT EXISTS subcontractors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, active INTEGER DEFAULT 1)`);
  await db.exec(`CREATE TABLE IF NOT EXISTS trades (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, active INTEGER DEFAULT 1)`);
  await db.exec(`CREATE TABLE IF NOT EXISTS closures (date TEXT PRIMARY KEY, reason TEXT)`);
  await db.exec(`CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)`);
  await db.exec(`CREATE TABLE IF NOT EXISTS po_log (po_number INTEGER PRIMARY KEY AUTOINCREMENT, engineer_slug TEXT, engineer_name TEXT, issued_at TEXT NOT NULL, source TEXT NOT NULL, site TEXT, supplier TEXT, description TEXT, needs_review INTEGER DEFAULT 1, reviewed_at TEXT, reviewed_by TEXT, deleted INTEGER DEFAULT 0)`);

  // Migrations - add new columns if missing (idempotent).
  // One PRAGMA read covers every column instead of one read per column.
  const newColumns = [
    ['cost_ex_vat', 'REAL'],
    ['vat_rate', 'REAL'],
    ['status', "TEXT DEFAULT 'open'"],
    ['flag_reason', 'TEXT'],
    ['credit_note', 'TEXT'],
    ['cost_entered_at', 'TEXT'],
    ['office_user_slug', 'TEXT'],
    ['office_user_name', 'TEXT'],
    ['last_edited_by_slug', 'TEXT'],
    ['last_edited_by_name', 'TEXT'],
    ['last_edited_at', 'TEXT'],
    ['incident_no', 'TEXT'],
    ['cost_category', "TEXT DEFAULT 'materials'"],
    ['trade', 'TEXT']
  ];
  const info = await db.prepare(`PRAGMA table_info(po_log)`).all();
  const existingColumns = new Set(info.results.map(r => r.name));
  for (const [column, type] of newColumns) {
    if (!existingColumns.has(column)) {
      try {
        await db.exec(`ALTER TABLE po_log ADD COLUMN ${column} ${type}`);
      } catch (e) {
        console.error(`Migration failed for po_log.${column}:`, e.message);
      }
    }
  }

  // Supplier account terms: 30 = due end of the month after the spend month,
  // 60 = end of the second month after.
  const supplierInfo = await db.prepare(`PRAGMA table_info(suppliers)`).all();
  if (!supplierInfo.results.some(r => r.name === 'terms_days')) {
    try {
      await db.exec(`ALTER TABLE suppliers ADD COLUMN terms_days INTEGER DEFAULT 30`);
    } catch (e) {
      console.error('Migration failed for suppliers.terms_days:', e.message);
    }
  }

  // Access tokens: personal URLs are /e/<token> and /o/<token> (random,
  // unguessable) instead of name-based slugs, so links can't be derived from
  // someone's name. Slugs remain the internal IDs.
  for (const table of ['engineers', 'office_users']) {
    const tInfo = await db.prepare(`PRAGMA table_info(${table})`).all();
    if (!tInfo.results.some(r => r.name === 'token')) {
      try {
        await db.exec(`ALTER TABLE ${table} ADD COLUMN token TEXT`);
      } catch (e) {
        console.error(`Migration failed for ${table}.token:`, e.message);
      }
    }
  }

  // Per-engineer suspension: link stays valid but access is blocked with a
  // message until reinstated. suspend_reason is optional, shown to the engineer.
  const engInfo = await db.prepare(`PRAGMA table_info(engineers)`).all();
  const engCols = new Set(engInfo.results.map(r => r.name));
  for (const [col, type] of [['suspended', 'INTEGER DEFAULT 0'], ['suspend_reason', 'TEXT']]) {
    if (!engCols.has(col)) {
      try {
        await db.exec(`ALTER TABLE engineers ADD COLUMN ${col} ${type}`);
      } catch (e) {
        console.error(`Migration failed for engineers.${col}:`, e.message);
      }
    }
  }

  const counterCheck = await db.prepare(`SELECT COUNT(*) as c FROM po_log`).first();
  if (counterCheck.c === 0) {
    await db.prepare(`INSERT INTO po_log (po_number, issued_at, source, deleted) VALUES (10010, ?, 'seed', 1)`).bind(new Date().toISOString()).run();
    await db.prepare(`DELETE FROM po_log WHERE po_number = 10010`).run();
  }

  const defaults = [
    ['office_hours_start', '08:30'],
    ['office_hours_end', '16:30'],
    ['office_days', 'MON,TUE,WED,THU,FRI'],
    ['system_status', 'live'],
    ['office_phone', '02380 262000'],
    ['force_open_ooh', '0']
  ];

  const engineers = ['David Molloy', 'Connor Brady', 'Ryan Diggens', 'Daniel Walker', 'Chris Cooke', 'Chris Freeman', 'Tony Pelin', 'Joe Line', 'Jamie Line', 'Greg Line'];

  const officeUsers = [
    ['jamie', 'Jamie'],
    ['joe', 'Joe'],
    ['greg', 'Greg'],
    ['joanna', 'Joanna'],
    ['tanya', 'Tanya'],
    ['megan', 'Megan'],
    ['chloe', 'Chloe']
  ];

  const suppliers = ['Howdens', 'Trade UK', 'Brewers', 'CEF', 'Rexel - WF Senate', 'Electric Center', 'Elliotts', 'Travis Perkins', 'CCF', 'Speedy', 'HSS', 'Dulux', 'Auto Trade Tyres', 'Collard', 'NICEIC', 'Ace Liftaway', 'Huws Gray Ltd', 'Covers', 'Ironmangery', 'L&S Waste', 'Jewsons', 'Midsummer', 'Eurocell', 'TLC', 'FH Brundle', 'Astroflame', 'TJ Waste Zero Waste', 'Metal Supermarket', 'Toolstation', 'Stalwart Products', 'N&C', 'Envirochem', 'City Plumbing', 'AMEX Card DD 17TH', 'Pickerings', 'Keyline', 'Nutland', 'Borderland', 'GERFLOR', 'Glasdon', 'Reform Electrical', 'Pioneer Welding', 'Soham', 'Basingstoke Skip Hire', 'Eyre & Elliston', 'Sydnhams'];

  // Starter trades for subcontractor POs (office can add more in Admin).
  const trades = ['Roofing', 'Plumbing', 'Electrical', 'Groundworks', 'Scaffolding', 'Plastering', 'Painting & Decorating', 'Flooring', 'Glazing', 'Heating & Gas', 'Drainage', 'Bricklaying'];

  // One batched round trip for all seed rows instead of ~70 sequential ones.
  // INSERT OR IGNORE leaves existing rows untouched.
  await db.batch([
    ...defaults.map(([k, v]) => db.prepare(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`).bind(k, v)),
    ...engineers.map(name => db.prepare(`INSERT OR IGNORE INTO engineers (slug, name) VALUES (?, ?)`).bind(slugify(name), name)),
    ...officeUsers.map(([slug, name]) => db.prepare(`INSERT OR IGNORE INTO office_users (slug, name) VALUES (?, ?)`).bind(slug, name)),
    ...suppliers.map(name => db.prepare(`INSERT OR IGNORE INTO suppliers (name) VALUES (?)`).bind(name)),
    ...trades.map(name => db.prepare(`INSERT OR IGNORE INTO trades (name) VALUES (?)`).bind(name))
  ]);

  // Give anyone without an access token one (existing rows on first deploy,
  // plus the seed rows above).
  for (const table of ['engineers', 'office_users']) {
    const missing = await db.prepare(`SELECT slug FROM ${table} WHERE token IS NULL OR token = ''`).all();
    if (missing.results.length) {
      await db.batch(missing.results.map(r =>
        db.prepare(`UPDATE ${table} SET token = ? WHERE slug = ?`).bind(randomToken(), r.slug)
      ));
    }
  }

  schemaReady = true;
}

function slugify(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

// 16 chars from a 62-char alphabet (~95 bits) — unguessable personal URL token.
function randomToken() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let t = '';
  for (const b of bytes) t += alphabet[b % 62];
  return t;
}

// ============================================================
// LOGO (Mostlane-inspired SVG)
// ============================================================
const LOGO_B64 = "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";
function logoResponse() {
  // Decode base64 to binary
  const binary = atob(LOGO_B64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } });
}

// ============================================================
// PWA ICONS + MANIFEST
// ============================================================
const ICON_512_B64 = "iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAIAAAB7GkOtAADDEklEQVR4nOz9aZCdyXWmCb7vcf++u8QeQGDfEkACuW/MTJKZXJL7LlILKVKiqkSVVOpaVFZdVW1W1tPTMzY/5l//6hkbG5uxselpa2u1rGuR1CpZV6lYUkkliizuFJfkkiuZ+wIgEIi493M/7/z4bgSWTIqBRATiRsAfI5FAJiKux73++et+/Jz3MHzq/41CoVAo3HhEkls9hkKhUChsAbbVAygUCoXC1lAEoFAoFG5QigAUCoXCDUoRgEKhULhBKQJQKBQKNyhFAAqFQuEGpQhAoVAo3KAUASgUCoUblCIAhUKhcINSBKBQKBRuUIoAFAqFwg1KEYBCoVC4QSkCUCgUCjcoRQAKhULhBqUIQKFQKNygFAEoFAqFG5QiAIWxQVf8iZf/a0KleVGhsJEUAShsPaMlftScToAIsP3X0ug3EKjX//pCofCGiFs9gMINimAOUR7oARQcQmZwRgBQBkQG0AinfPRFKIeAQmHDKAJQ2BpESUYKkpQEAIFUUKI8BLh7zok00lbDQWX1LxQ2kiIAhS3C3eAMljwA0YwCIaeUnW4xBAQ2SEkMsLi6+pcoUKGwYZQ7gMKWQEKRHoKRQRYUImlohvRknVpCbjIEIUuZZHs3sNXDLhR2FOUEUNgSZBCUUkMpBGNERlpBdDE2y+cZQoi10URLEiVCAkoUqFDYQIoAFLYGApLLHVUVI6vhBQ7PoNOL3YnuZDeEsDRMZ1YkTgU20Iqcoy8rFAobRBGAwnWmDeZAABnJ6NmHzeDA7sm33nnHW25ZOD7X6wZDbpYyv/vi4I//8gdf+sGrKx5joHRpCKhkBBUK10oRgMImQkEEATO6PGenURIpDx1Ht/azt+wOH3/4rnfdd+LEgd0Hp0K45Ms/JHzijoXf+/Ov/78+/6Onz4VOiPKUycAlZZN1y61AoXAtFAEobCIiIIhq0tDkMdDMkjOzo6bZ1Vn5wFtv/o0P3vGmY3OT9MgGOWdWo4owKUCnD+/6nU+9o57b+9/9z1989Xy2TjfnlVAHIqgs/oXCtVEEoLDJEASCBSUBITvkHkO++8j0b3/g9HvefNv+6VCpUWqywULHAFAEQQrM2adC+LV33Hr+fP7v//Ab51aGUcOUO4YA5K3+2QqF7U0RgMJ1gITnqpetVh5M6ZX33rXvNz/60Htv2xMppAGQQ4hNlgNVoCRBJAmEYD5cPtDVp99+6i++9/x/+sZjdW3LChKtBIAKhWujCEBhg1m7nOXq7+VZhljVw0Huh+Gvv//Bf/Ch208s9OGNaGAtwM0aV4CvXhKjvfIlSVJpeHrP9C+/99Sjj/3o1cWGoSd4sYYrFK6RUghW2GB4uYunAGdwdLR85mD37D/+xP3/9FNvPb1v2jwZjYFu9GACginaxVSftd+QldtE9uZdp3a/+fT+TAvI9LQFP1uhsLMoAlDYSCSXj0LzBCAHYLHynI/M2j//5Yf/ycfuOTKB5WH22AXlLiMiFOG1ZaOvfSuOzEHhwQYMkp2Yn3zkvuPBLCCHUMI/hcK1UgSgsNFQpAxuSKAU6pTSbbvSP//Uw3/rXbfPV0muOijCzWIwC6CRAMkIRnIU9mlpv2WHy9E8Em85PHP7wckV1GK1tT9lobADKAJQ2EhoIZgpDd3zwINQhWbp+OTwn37qbb/47jv70Z3WsHJ2nJUIchQxYqsBwOuUd5GESxnAzMTErrkpxTZPqFAoXBNFAAobiiQomkBjZyq7H5oY/tefeesvPXTzFAbGmBlEqPX+XN93zJBoZhFAVYVoAc1AXsoACoVrpQhAYYORlLMTooZTtf/mx9/+2ffcNRVEWWJwoUKOaRDUrFMBiPZsQAET/c78dB8Qy/6/ULhmShpoYSMhAJpCJ9J38exvfeyhz33gno6G2axhBaBCDj6UEtRZ57d0KcAASurWnYleFznhMs+IQqHwRigngMK1s7Ybp+TwbPUkjZ96523/5cfu2NcZuhslUMHA3MBzDt3G6nV+d4ESRchVR3argGYFJQJUKFwzRQAKbwSuOnrCs6kxuQQpmxGhky+8+sl33PmPPvnOmbiSc2pEGmsgCBYirJJVvs4gjmBIoigJ7FU2O0mEQFpxAy0UrpEiAIU3BgFkEEiRDdQo1mAIBpe9/bY9v/O+kydm4KqFuqoCrTLSKFlE6FZkvc4tPBHVEAGE5AR6JshcxuIEUShcG0UACm+Eduk1gKGTWDfWAatQ1Wll8aGbOv/Vr77v1mMLnl0MEpFdq4s1L/F4WOdrXdIUHgB6dafq1LSy+hcK10oRgMIbRCDNQGanhZ5Sk5bO3Lx36nc+fNe7T890NfAsWGAk6SN/51V3n6t8Jbb6YUYAE71Or1+r3AEUCtdMEYDCVcN2IZd7alxSqDynqMGeXv7Njz30kTff3G0WLQ9CZYlwgWoNHq5+6V+l7QZMF4Bup1NBOTUoqaCFwrVRBKCwLghAqz6dq8W7EHJyGi0PJnX+s++569NvO96vkCUXGvdhk929dXd+468tUEaABgCT/W6/W5UsoELh2ikCUFgXgnjRfUEUCcWAOsi88Tx4+P6Tv/HRB/b3mwvJh6GLqpOz19EAR7gm3waRglbVJ/e73X6vUzb/hcK1UwrBCuvCLcrdKKJN4HQBAZL1UjO4+8jUP/q5+04v1CmthBgMFqhugEBYvMZ0TbZnDQiyLPRtpWeSuNo4oFAovEGKABTWhUtm0ag0XDFCFiQQ1jRp/1T9D3/+rY+cnGceKk52RqF5Uq2DwzXn60jWfjszAfMTYbLXhcrhtVC4VspTVFgXMQ/MV5SHJBzBk2BRsbOruvBr7zz2sbecMDNZd/WGGMDFOq1rDtdEmrWnACMm+/1ep167iSgUCm+YIgCFddGtaHnFcxNiRQsWQyDz4Py77zr8d99/50JYboYpwVbvZrWR4RlCMAhwSZroVJ1A5PV6yRUKhZ9GEYDCupALMKu6LoNU18Zm8da91ec+cv+JhR6alVhVrraby0a/NuWSQMghTfQ7E73SDaZQ2ACKABTWRZPlsSOrc3ZBefncXJ1/+2MPPHzbXhidFaXgbcp/2wp+w3RAIGkkGQLoFdHvGshyA1woXCNFAArrwhkcMWdZ7ITI6M0H3vHgLzx822TgUFUOPXqIJtv4/b/aSmCXU6C7IVfWdgcoFArXRBGAwrowhZCGzIusog/tnbcc+kcfuOnQVIBgxhCjRcPIoHNjNYCJoNOQgSEUHWHPdK/bqb1cAxcK10YRgMK6kHuIFnvdfOHcvn783Mfecv/RGeVsZKSsdezfHG8GBwAxu5AJCtarrQqlFrhQuFaKABTWRawsy4RuH8ufeMvBd9x52FnT1uZPu/hvigaMusWHABogQlPdTqcK7cVwoVB4wxQBKPxULl3NG0/ZYlpcvP/E3l//4F0LfVdadecZubJt5MXv5bTNZwgEEQT2zE1P9LqXtoXfpMNHobCzKQJQ+KlcZrlcReXBXBz80jtvv/umeUsDwq+PFcPIg0h0miT3YbdCFQzAmsfc2lBLWKhQWD9FAAo/nUtWU3erfPC2k3MfffNNpmGSm/E6pOKMNv+CS1kAGeDT/bpTV2j9gC7+1bUatEKhsC6KABSuQBf7/Y623iLgxL7Z3t/5xCOH5/qSZJX79VhsCQQSFGkESYo2PzXR7dTwy+uNybUhFwqF9VAEoHAFpETIZQkG0pBNjaXhm287/PCdewOajJhQCen6LLaUSJpVESDpHhbiYCI6RKeE7J4Al5XSgELh6igCULiSRDgYgiI9e/ZQNaymw+C9b7ppphepTAWYkYT79Vxz5XJXCHFmeqLuREDEyBhakHtqzy7lQrhQWCdFAAqXQQAMokU1lZI8Zwb38LZbj7zzloVKScoGDyMz/uux1pKjXpJcbQHQ7fXrypBWpOwwWAwxBlx5IVwoFP5migAULoUQwACA3lCZILJ3K//Yw7fdtGvaPUkknJIswq7H/JG01k4egLtIzPY7jCYBNHfmDOVUboALhauiCEDhUrTWu1fZMyGLUct3HZp44Oa9dTApAEEMbKfOddlrt+t+ztnd28OAkXMT/ToSEmkwGzWNabvElBNAobA+igAUXoM7cgNSCAixo+E7blk4vmfCc5ZVOXYABjmVrvNSy1UATPTqig7PtCgQZDCCPvp713NYhcK2pQhA4SLtek4xeAp0hS4c+6frt51emOmElL0Ns5My43VLuZREMoTQrv7tIBem6rrbhcVAN2WkQZK0WphQjgCFwnooAlC4SOvn4yEYEeAeOhqme47vfeCWExCqOkagggIJGkJctYLY7FHxst8QAHZ3c1KVPcR0oWIKTJmVYGXvXyisnyIAhcsgQIhVdFBNE0O6+cjC7rne6ukAQNudF5vm/POzEABM9XqdKoAm0AXQSgVYoXC1FAEoXIZAeAaZrOO52TNV3XXTnppwglpr+L5la+3apcOumX6/G9t2wUnWnl5K5KdQuCqKABReS05NdusgN4dmwx1H93vrxbkpDX+vjjZIBaAXoZUlpEakzESDMuRbO7xCYXtRBKBwJQHmYmKE4eRC/9hCH8prvptjwvzM5ERdtScAjiJTq90ItlqlCoXtQhGAwuWIJCwEb9DrT9x89EC/8jHMrJ+erKuOgQSokSGF1CYBjd9oC4XxpAhA4VIEKisTAnyhh7uOzGentj72cyV0zESH5wwaBIQKsHILUChcDUUACpdCABi5q6XJKh/dN4NQiSTGJ7wuAHVlu6Z7iBEWKjNYJGRl/S8UroYiAIXXwAAaPPW61cL8bKQgjMdUaRsAGIBonJzoBzPIs9yBrEvbghUpKBR+NuPwVBfGhrWKK4lmuyb7Mz2DctuNfWuHBuDStsOEzU1PBshz9jb8r7DWPrJQKKyHIgCFSxBGaynZidy3a6ZDKQ2Nm9fw/Q1SBe6em40xEDAjzMgA+JZXKhQK24giAIXXQkjRtGfXbAgYt6waEpBMaWqya8zy5DlByITQtikuq3+hsC6KABSuwCAEgdLMRI80hXBRAcZGC2g2PdGrYjCCaA0h1o4pRQAKhXVRBKBwGRQMg6GFip3ZkGBMtHbTDYxDjZUAiMwhHujljhrBQojwpuKAo/vqcVGpQmHMKQJQuBTJIOQsjzFM9TtkQLv6r9ZabfEAR4mqCuTuqaqy9u43mlnV9oTccoUqFLYPRQAKl7LaY0tu5OTkNLmaVzM2LgutBAVgcqIXjHDPqYEsjWPBcqEw1hQBKFyOyFW/505VOXzcFtU1Cep3qn63Y4b29te9bP8LhaujCEDhcqjWU5PkMDUEObKBGxchWK3yUh1sfnqSEKPBDDQBHDPTukJhnCkCULgIIYJZDgs56/z586O+j6uL/ziIwGrXxxTMp6amckqelZPntiUkx2GMhcL2oAhA4SIOCjJUJFMenltccm/kaS30v7W76zWHB5Ig61jNz/RJkKQpWCRJjcNNdaGwPYhbPYDCGNGu745OyM0wNC9L9CYCbtAY+IFeVCEhM7DS3u4FMxdSR8MGFUZFYFs+0kJhe1AEoHAFWo36qMmCjYkL0GWQgEizXqcCHIIAL2VghcJVUkJAhSsgRdCVeeHCwN0gXmLCNh4IAV4Hm5mcDIQI0UjDmA2zUBhzigAUrkTIIpJ88fwgZ5D0MWu4LkLutXFmcsLa/b/UHl3KHXChsH6KABSuhHBSUhwMGhphoe0UttXjukhbDWzA7GzHzMwImswAauuvKgqFbUMRgMKVCADljuGgab2hJdd4HQEgz4A6FTxneHZBbahqrMZZKIw3RQAKr4EkzD29sni+SZK0ZggxBour2mtqmQGajpye6LhFwUyJ4zDAQmH7UASgcDkCHEQQ7NWlpUzRqNXk+jEIr4zuo8UI+K6OHZzvuQUHAxpqfBoXFwrbgCIAhctZW+NjZbFu2m7AGoel/3IIADFW/W4X3jaDCRq3bKVCYbwpAlC4EgsCMrKfX2leevWCAzZ+C2sGAHU71dxUj8oi1dYHlzNAobBuigAULtJ6KOSsnB0MjfPM+WWHqTXaGSdaP7hep56bmaIShAyTSj/IQuEqKAJQuEibQmkSAYSYEc4vDwyX7KvHSAUM8k60uakJ5kSINLCYwRUKV0ERgMJlEAgmwpF9cWnl1bPnBJA2SrAZm+01IQmxCv1u1fpXiyYRxQ66UFg3xQuocBkCnBUZkYdyW8y1e44QGLZ6aJcR6Fmc6FT7Z0MWKlK5GdkYFQqF9VFOAIUrkIsMVTA1yV9aTJBM1HhNFQVJCgHcPRFokaS5t8v/GPiWFgrbg7F6qgtbD0EC7ilU9fLQn3/pRWEM71ZbMwgAiFVVV+Y5iaPJPG731YXC2FIEoHAZAgBHziKHGS++uuggzS7+x/FAsHbyTnW7U/2uKzOEMVOpQmHcKQJQeC2SspxwO7eSBjJw7DIs2favRJrsdqd6Xc9j17y+UBh/igAUroRwg0TC4tIKXj07FDlutcA+sidNE73O5EQXgiMIxQ2oULgKigAULqO1fDOCDKAtDYYvnzkvrBaJjcnyKmEkSepUoVdXbY+AMbErKhS2C0UACpchIDAIZrmBBosDPXs+AcmYhPFIsm/9QD1lIKMzXeeFfgKi5aEplzzQQmH9FAEoXIngbQ8AGhZXVl5eWiLY+sGNxeJKgKTaNvXW79bT3QhXMFLwcTmkFArbgCIAhSsYmT8LMqsWzy+//NIrRNBYbP4vhe1l9WSvMz3RR8pkYCkBKBSuhiIAhStwA2gUAkJYvDB86cxZYdUnaIwQICh1yJmpHrh2LVBOAIXCeikCULgCgrS2Axgt5/zSYrPkMI7LVGk7Vo4qkz0Dmu52UFUpZ3BMrikKhe3BuDzVhTGh3T+3PYAFgHZ2ceXl82m8mq2LRAAMyIAm+r3O5CQYJRQ30EJh/RQBKFwGAQeyHKAkVPHscnr13NKYdARGexFNyGjetoHXZD9O9CqXE2N0UikUxp/ytBSuxEkZnJmU0X58Prx89gLGZf0fkaDoK2AFhAOT9e4Oc86CihFQobB+igAUXgtpRhIQzV45u/TKmSWMmQAQbRooAUz2qn4nYry8KgqFbUARgMKljFZQSlQOgln10rnzz549B2BMJECjgl+CRhqA2cneTD9CaauHVihsM4oAFC7FAcBFQdnhKQRLjb9wboCx2V63uf4kQDoty3dNT8xOVlAakxEWCtuFIgCFSzG0a6tEOeSEgfXzZ5qloUhKGJNzACWBTrp8drKa7tfwPC4aVShsE4oAFC5FAGSRhkAZ5S7E7otnzp9bPA9AcFxUAG25GDSgS31Dp8qrFQJbO6JCYTtRBKBwOQKVBcKCi4DI/OMzw5fOD4F8sUxAcm2lOVBrCBTlAgjNdwJjJRhYWkIWCuulCEDhMohRd3UxZAEk8sqPXmleWs5oa8PkUNLW7/9JoIZHRoAHpnt1d8Jlo0EWCoV1UASgcBlOhRDNTHKALoA8v7h4ZvECEB0Z8Db3hlvqvEyu6hEEoN/rVAapjVAVBSgU1kURgMJljDw2c5ZAQvIYY0rp6RfODbNTgiCG9u9hy6uuVhf7mcnJbhWlDJLjZ1xXKIwnRQAKVyI5STMzM/dMMsTw+AtnzywPjYDcJYFU3sIgkNrrXsoEALPTU91OxMjCaMt1qVDYHhQBKFwJyRACyTbvM6VE4KkXz50bNAzB19wWiK29BEZ7Y0EBPj010asD5GX3X7iesI2FXvK/7UURgMKVuLt7Tk3jnmOMgOR64ZWzry6vtCEiH2WD5i2MtrtEGNAeAHK/U9cxtGbQ2+0ZLIw/rzOtWicSB7IjZTUZKSN7+5+2YIhvjLjVAyiMHaS5QzDA2vMAwB89v7i4NASYESM8y5wWtnCQomhQDiLAvdNhsnJkoWK5BC5sAG2YE0aY4Tw9uXdkHUSHJ0rMKSJ3AvuTvZmZuWkurQyHzy3y1RVrGliQVUJKrWdJcgIM9ICcEMdnl1IEoHAZa0n0IQSMngID8OpSPvPKMoBMq+jemkaMTKK3ZjY7aBIpuU31OFHbapnC+DxfhW1LazaiRjk7IhmtSyklj1I/RByajw8cn3/3nYdvPTQ71a1yHibiuQv6s2+/8qdfefQ7jz+XU59WeWoYDZAIM/OmgTkZxmSTUgSgcBltgF+66LVJSICTT794JnmuzIRgAGGvezS+XuPMopHmbbt6x2y/xxjU/rFQuDYIOBToNDWYsG5vmF4Nzfl+1T2xB++67+R7H77jtv29fROdnglIyBUCHCtvPT3z4Qf2/d9/90t/8pVnLnT6CGakcWhyYz1AGKsoZRGAwuuweg6QVnfTjaofPn++SerUltwrOhB0vaOdbdkvQNDMSNEkh3IAds/06ypkqfQFLlw7Ekl3dd2MXU/Dc7bsJ/fMfeThY7/81uN3H56tu124Z28a2RBWea7SkGFpr+GdN031P/uuoP/wR996bmgdEfQckLIHVV3zND7zswhA4W+iXeBJCvHxF84NUu7UMQkVUwbDKInguqkAgbY8AZA7zNDeVaRoPLh7tlNVS4NmNOYiA4VrgZDAEMTo587Odv1dbzn2a++56513HZyrQblyEp1EhKjQGMFoecKyB8N9R/q/84v3PPbS57/+1CK6U7RoysPUqOqBDvlW/3gjigAU1oPA+JNXlpcGaaYXRYPnbIEI1z2NbE1sMkDAREAeiV2zk1UVtDKU2cVKAF33U0phJyC07UW1zMHKienJT7/nrl95/8mb93ZDzsrm7SmUJjDL3IxgcgYaKgLour/15N5PvOXmx5/94tmcZJW8MdIlQeMzI0saaGE9EAwvnVs+u7gsJQDuvkU7bLXDASHIIW/PBND0RBXN5N4eANr2kOUQUFg/bU5DayhLQlAYNm85see/+Tvv/Me/eM+tu/sxE8iZnglagAySmRtyJa8pRqWY3LJS6sA+/tCpU/unKc8ISVaFuq2lHx+KABTWhzfDzO+9MFRSDU9xIjjMr/9cXu1ZxsoczB4FoJPRPd4fdCtKFgjzhp4MLk9FBQrrQWCGRYm5QQzZcvClTz6w///2uQd/+eHj8z26KKth0YhgRhgYwECEaBaMIVik1YgxBMSIYKf39j94/80dvyApsZuIoCWODq9jQRGAwjrRMKUnnns5t+n3MILYmv1Mm6cEM7NAoi3/sj1zE50qgHC5SwSDWQixRIAKPxMBgYzikE3q1KkJM5n/xYfv/q//znvvOnmgQ0959coJFmihtaEiaYE0tS7khNEMZjAzE9StO2+67eiuXkTOAlMzNDrH6X6qCEBhHUg0rDT+wyd/kkCK1JoVxPVfX4n2DhgizQBJgZifn41oMFzOLjEyVDll5Twuj1phjCEQvGFaVJhy7y90m3/yC3f/Hz719lsWphDqnN1IM7vkr1/WduIyY9zLfsub9k2cPDhvcoPHgCRuwbH5p1MEoLAuzDDI+bGfvDTIosHY7mG27DrLjKSPCtUkSd262jUzETtVNApIYkbb1bIcAQo/E2Zmdium+th05//0q/f/s0/dudDNngQlEiEESVd79eXCvonePSf2mzeBrGKQxmvJHa/RFMYTAQGUwouLw8VGYDShtWLbwkEpw3NDZTMAMtrC7FQ0uQsMosVQV2FVqgqFvwm5Kh/olj3n/8+/cutvvffO7kqTsyvAGM2CpNXqyPVC0pV3T3RO7ZvLOQtKwyFCPVZpaUUACuskAVzKYfGCAMDFtSKxraHtWjaawAQoTXY7agbuQqzbxgAlEajwNzKKZdIMWaf3Tf5Xv3T/p99+tE7DrJ4bsw/X5jhJSSkl9/Vm8QuykA/t7vZ7XXeHN7BIhnIHUNheyF2AVrI9f2YFcCAL3LIIkARvuwJztWKHVbADu6frXpdm8qSUCM/ckluKwpgjyQUZUkUJyM3g1oP9f/6rD37y7XdWQ7gJXQYLFWN71dW6o9sq638ZIC3M9g/snoZY193gSV6ygArbDDorgxYbf+ylRSCTWYzaqsMsiRBoEQigWQgAQ+CeXjO0rkKotRxM2ZXQLd5AhSuQRrW4hhSD1Kzcur/+P/7yPZ9566mJINYdxq4xGI0W2qNk+4Vtq4z1v05kBnozE/HAjLLCUHWtxsZpPpZK4ML6IM3YNHlxedD6LHD8Ng/z031ThiBRkNmqb0ShcAlmIVBpOGzq6ZXh4MFjE//8M299//2nIAmCre1rrjnIKQGoQujXFXABgkMjg63xkIEiAIV1QUnyJmNxaQUwwaj2ADAWE7l1fFiYm4xKAzewvbEjlYsCFF4DXUHBsvtth2b+m8/c/aE3HfXsbW4ZJFHcgBRnQRQw0e3ump1AdZ6AUpKNxzMDoISACutFbsQg+auL59FujZTHqfmuAMxPdvoV4A4aCXOXlzqAwpVIyAiZ1e178H/91O0fuf8YPAesRjQvifmsfsEbex2CFNTt1lO9Ljw53cdn8w+gCEBhnRhppBp/9dx5jdZXgRgnDcBE5GQ3Sp5bzy3JOEbGW4Ut4fLczfbQ6kiLR2b8n//i/T/3wEGkoViBP73F6RucQ6QFl1fBquBYuYAsMYzTE1MEoLBOWh9D1/JgQFCwtnPMWCU1T3Ti/OxMiAEwB+QpcGtzVQtbDqW2YHG07pLBcz46G//bTz/w82+7pUE3I1CJr934XzMSkdGrw/REp+1k4Y4trZ65kiIAhXWh7GYEcHZFLw2cypLGbf5U0RamI40uMyCDPmYjLFxP2hzh6Ctg8lBRrJE1XNozHf7pLzzw6bff0iWdlYU6YuNNmtvzBI2RmO53ESqakWOUA4pxe4AL4wtFIyyfa6pnzniwIQiN+kWOAwQQ67BvunJQoY7msJBl41N0U7jOtG4lJkiNc+hVjcw9Xf3mh+/97Ntv7jIHogM3CaFrtsEZMQTJ0OYgREY4MxCCbJy6lhYBKKwLM/PscIQQaAYH2yLbcQoBdWM1OzVtngHBFYzrLtkp7FRsWE8TVnmTXazjzz9y12+9767JiT5pggRotRX2hnPld9bIynZ89iTl+SisB7m7aDAbDIYrKytgEIwYm0tgAlCvCnt3zRAZyNnT+GSpFrYKATk1UkV2wvDMz73lpt/5hTcd7i8T3s6Nq6rs3XncuD954Wqgu0Ciqs6dX1pcXIQFrfYL3uqxAaP1X3XEwuykKcF9bXNXuJEh1eXQEej2kfuO/NOfu/3UriAEjUz51Xp8rt/eZ4dRBKCwTgQaLAybZmUwBMaqoB0AJBk0NxM7kZQHclQDMG4DLVxfQrTaV+7aN/lPPvW2Nx2daAZLybpGa42kVk2eb1CKABTWhcyyBEcMobWCkI9J9GdEu6eb6FoVIqQQTCoKcMPC0SwFzw/i7QcX/ttPPfTg4YmUB96ZcGs7ugCr9j5mdmP6xhYBKKwPGbNHJLMqWYTcxnFlDfNVNT89JcZAINSQxuWWorD5uEtCzllpOSDJQnbeNHnhH/7C/e9784EaK1AIqlazcHgpWzz0LaIIQGGdmMkhHzbpwjCBNnZFtiTAmTrump2AmdwJiByjlIvCpkG1/YkcyBZMsaMQvRnMdPLf/+g9H3nosMktdKJVAbTXmxE3pgYUASisC9JgQY6VlZWz5xaBLWwH+TfRq6u5qUlAScjyMJ6jLGw0IgQZGSFTlvWG6E5Z87ffdfKzH3xwOlAAQi0EyE1lVzCiCEBhvdBMtJXhcGnp/Ba1g/+baOv4ux3OT3WQG1kkoymPlfdWYZNYM+xv69UhxTx87/0n/8HH7t83gdgsGzzLxGBkQN7KsY4TRQAK64MQgsUABXcANobBdSn3Ku6equFDhAoEPI/dKAvXyOgTvWwCjv5V9kyQiOnMg8enfucXHjq+q6tmJUYLZoSoNi44bruXLaMIQGGd0AUgOMkQARu3ySPCpW5tC1NdCE6TaEwcJ++twgaw6toMErDVIpDWek3ySrLb93b/2cfveej4NHPO1k2qJRlBunIq8Z81xusZLowtorm7y0EhcAy3/wZAMuPMVCTkSZSCsVSD7VRIQhlq20MDJGOVaXP97ud+7u0fftPBanhWDMmimwGkEpQwprdXW0MRgMJ6kOAG0XOQQnZCY+VqC0CAk0Dc3cFMvxKim4ajms/CTiODgap1IfqSvJEZgOSYxtnffOTgpx4+aYhD9kjWRGWgmSzKKoaKWH9f3x1OEYDCehhtsAKNgrsDG2+efu24CHCyU09O9EAzo5ft/w6FFgfDBoCE5EEyyevm7PvvO/a5jz+0q0eJVVW7OyWOkhZIELQx8S8ZB4oAFNZHu7gapVHdvGPsvHYEAT7d789OTEC5fda3elCFTUGeQ1Vn1rmeYqdnMRjywzfP/+NPP3JsthOVY6TnbHaDJvivkyIAhfUhrHlmkTbqEj9e6z+MgNLMZH9uqou0MrKHGDOVKlwj7dGzbfSVYVkMwfLSmUMz4e/9/EO3767YrCAPSRiN7mUC/A0UASisDwKEu4MMIWrUQXuM9lZsL/c8TU/0dk32kAYGd5WMv53GqA+FIefs8mCGwfnD0/7bH33gPfee6BFqBggxZ0htfdhWj3iMKQJQWB82Wu+7nU6n2yEyx6sfMEa+b9L0RGdmsoecOHr0x2mUhTcOL/2nee5EBkDD5T6XP/qWWz/ztlNTFUKModMbKK64YISN4V3VGFEEoLAu6C4AFnq9zvRED2PZa52gM/a73DUBY5uvOnYXFYWrQqO8f3dPgki2n6i7I3usKvPhO+888rkPP7B/mvTsoFgZWVUmI1iWuL+JDW6DWdipEBKREULAfL8DwMes3yKBCmzY7RKHpppgTOhFX5HFogDbFwJQVtvbQcykw+EIZgxhOenOQ/P/6KO333+kt+JWtS6wQI3VLQrjeG5WxoSxeoQLY00wa3tDpjxou8GP0cI66r7KIAKY6nY63eht1/pxGmbhDZBSJqzb7ZOgch1jjIFWLTfYPxH+4Ufvfvjum5dzFYBAx2gugO0/4ONWsDJWFAEorA86CCgDbSKoCB+jfRUB0tzbvd7szPRkv4ecSSuP/7aGQoi1GFJKoiApZfMkhG7FX33n6V96y0lrmkzCM+Robava5uuXeEUUXpciAIV1wdFmWjGgigHycVxYzSgB2DU5OdPvICeQ43VVXbhKRCCYJM9OtWUoCUpoVt53+8Jvf+C2uYnaiJ5StACGNheAbcnXVg9+/CkCUFgv5gLUqevJqQnIMX52QCBAh4bzU93pyRpKVor+tz/KcjMLkVId2IkcDpbuOtz9xx+//8TCZIaRFnwAQGC59r8qigAU1gfpSoDqTmdyog+NY4K9txbBypP9/mS3Bx87w6LCG0ACYA5Xzu6pWVmend/zGx+472237GpApGREtq67QxnF6/lqKAJQWB+eJEChE0MvuFiR5JhttdwpBlAz09VUl3BlVuM1xMLVEzSMbATETi1WZvj199zxCw+fMgBkCCAhBpgV14erpQhAYX1ItIisDtTHILFq7Ze3eliX0yb8uWZ6Nj9JkNnrsh/czggA6UGNybNbyumhWw/85ruOHZiKIcTawBDJEIlgsSxoV0t5vwrrQq2nlnKnspnpCcJXO3KMDUIYJaeagbumJ2NdyUvzv20NAST2GfohMGWdWqj/2S/cf+zA3FC6bPaN00zcRhQBKKwLKhAE1Kttso50atwS7AjSSYpGaPfMxEQdKC/JINscwXPKTKpmu83f/8i977ntYEyDMFabj21LEYDCulCwLCCnbgCBJAfHrtmWlEWIQcDuyV6/Kgkh2xsCAGOAaKb0qQcP/eo7b6liiPRQznYbQRGAwroQTEKow/TUBAAjXd7WBowTAiDQwN3T/YkOJVfZKm5bRpOLMAwfODrxX3zkgV39mGGUAUUANoAiAIV1IQBQp46TvS7ggRhNnjFaXQUgO5M7obnpyX7dkbxM8e3I2r6CwDCHI3Pdf/Dhu28/ujtl0QcKVbZ6K8e3UyhPR2FdBOZMC9R8T0OwAcE8dgEWghAtSnZwfmKqTvIxG2Hhb8aYIRojGmuWuoFZ1S6c//V33PSBN58yZdoo8shxy0DbnhQBKKwLUqLVVZifrgWCJHzcAkAEjSApYX46TvUMI0OYwvbAXQZCmaTV/ZRzSMvvvffIZ957+0RtnhujaNFhGqez5/alCEBhXQgG98o42esFgNAYPn+tdzzdKVWRM1M9Mq81MS5sAwTClYaNOkNOrjTp/qP93/q5B4/unuFgEKMBrdXnmG09ti1FAArrwwWpU9veuemIsTXa0qr7Q6qAhZnJqgpjV61W+OkYRc+durYQPfv8RPiV997+ztv2shlEy4TgchBl/79BFAEorBODe0VN9TrubbdFG7NtGAW6q3WooHzX7HSvttIOZFzRZb8TQJicUrbac1Pb2U+89fjH3nJz8BULtFi5AxZoIRIsLk8bQRGAwvogIXUjd03XRIZ8LO3gRBJGg5thYfeufqdSOQGMKatLuNpuDoAzkEZbGbBievtN/b//0buPzHeTuxDAIKscIWUp57L+bwilJWRhPcjhEDuBU13SjOIYhlZIIyi4lA3VrumJKhgkmI3haAsEIIJi6+FByhMZEeo90/bbH3/rvYcmUl7x0Cfoojjq8GajxsDjtv/YfhQBKKwHGuAW9832KwUgmjyr7boxPkgywaMnWccyTsz3qxDdFUpTgPGDcgCZ0WERooaU51BlYYqvfPaRe993x0FLzZBdl3XacKMEEgFEHLsU5O1JEYDCeomV7d01UweDA+2ZfbwyLNsuxRQcqBg5Nxl7VQlyjimigTQY5dndEGAVaExL77p7/6++547pLtyrEGJsHSFwxXwbq7m3XSmPR+FnQ0LwWNm+hdkqKAMZDDZuT6ARkCRvwz3qd7hrpsuxG2cBAAS6An1oPjC5MyrUedgcX5j4rY+9+ZaFCbicUZ7pbclh2fJvPEUACutCQkU/sGva6CBFQWNYCNZuCw0g0rBrec/chJHlHngcoYkBeRh8GGgAtbK0q+ufec8db7t5D5tFUgghSHQXxjDjYCdQBKCwHqica+YDu6YCskME4eNotGAkWbW/r4Ltmu60J5WyeIwVbC9/jSQsUCEwNRNa/rkHbvqVR26fqJiGkmgELVhog0BjN9l2AEUACutCUF2F/XsmGZnAJAniuE0fgTKQgIG5U/me+elg1p4A2khyUYJxQIAguhMSQgJpuu/U3s+++/TJeVtpNKwmMgPSUFBu04WKiG8C4/YEF8YTQTZZaX4qgIFytvkYY/ZMSpQLJCk5jDy6a9IsiCZS7lAS1sSgsIWQytFXACUParR3ovqlt9/21lO7bLgcTIqRFtkmio7SRQsbT8kCKqwP6+2dtPlAoK49mWVn1dZdjRGGALQ3wQp9gx/vN8bkrGBuPgyekvWdISqt7inH6ge4caChqawZWF/oVM35n7v/1s+8/ZaeUVW/j7bKhLB6NYO3fEybQjkBFNZH4O7ZqdoCgNV108btqSTYKpK7SzCLM3PTkRmeRDMzhmAGwp0q0aCtReIwRVgXPrz/6PSvffCumck6WWg/FbVRn8ImUwSg8LORYMz7dk/HGACJAbQxqwID1s4jJDkqVJ7q9xdmJozJ3JvkKUkjC4t27GP2E9w4UEJQmMhJC938Wx+5703HJowpr57JCBaFvg4UASisi6jBwd0znRgEAATC+CVmE4AkQmbtVTC6dXVg11SEQ5ILEJEFH7ux3xCsLeiCIFC0Kp39xEM3f/yhmzscel62suhfX4oAFF4HXezGCgICazSHdk0FM7lESu1SO3ZIytnlI6OYTlXtmZuEDyTFqhNi5MhMfgzHvuO5tM+jLJg35952au43PnDnfNfdLbCi0lYO8MajCEDhdbi4VdMoc7IyX5ivQYj0tip//Ax5JbGN/7S9wYCqjnt2z0a4e6IZBHkzbvVrNxZs20mzSWl6rvtrH73/vqNTg8HKQLV7jONXWbKzKQJQuBIBgrnk7gwU5J72TnXm+xEQcpKQCGgcV1KSZmZmpADvVjw0XZsZQ/TmQvas0IOV5LfrjtxdLio3RuRQT8X8ubceft+9JwWJMZhJkJUV6bpS3u7Ca6HMHKbWX02QdHRheqrbAWCeSWQCyhizbotXJKVK7BpuWghGgjHSQcuqct6qAd6gSIIxxAACsc5SHpy//+Se337k5EKPjdcxdiM8xnFLK975FAEovA6SG2VmOSe4x8CDe+aneh0AbWzFANLGbv9/CQRbB6D5qW6H0sqFUNUxRHnimOnWzod0wegk3XpyHp0Y/Nq7bj167EhyUaC1uVmhZP5cZ4oAFK5EykrD9p6XUAiA69j+XfOTXbnDggEBBGzsEkGvgAAwUdW7d8+iik3KWW7RzFCygK4nbDsKuVNSM5zs4Fffdfcn7j9SGeEwAwVjAOhFmq8vRQAKF1ldFEkYDFAOJAH3fHBhYrIK2e3iCQBhlCI0rrTqNNnp7JqZAgWGlKTUngDGW7p2HBaMIToU8tKbjs788rvvmZswuXcjI5HU9pgoB4DrTRGAwkXap8+MsYoGg2CQp9TtdvdMd9nWZ7bZP6PmK2NnB3Q5BDA/Uc1P9tCkuu7EqgrGMHYlzDsfk6ckUrfs4m++/7ZTB6ZdiGZGUd6W/2ah3M5cZ4oAFC6DWD2uewKdNMHn5+Zmp/pAAzCL8ty2cN3qwf4sCMB7vc6ePbshDIcDlyxQnsf32LLNYevcf/H9bS9iPCDR6g7wkYdu//CbjkdigIreSBlEIEk5kPM4Hyl3IEUACpeh1lOTEZDJU+hmVidm857JGghGGUUzkuPv1tKGnqf79ZG5Gp4pRa1kZ0IExq+KYSdAkNGHGU1GplRRUY3oDWJIZx85Pfcr77lntmdwh7XXSO1NkgyoyKq0b7u+FAEovAbBnXKGEDxUMjt5YHrPzCRgJKwN+5C0MY//AICACMx1nYRZCISzbTSyDQ4w2xAJLgJmCJbhntxB1N0s3jTf+fUP3X/6wGSbSVCTsACYRoFEkjC77PhQ2GyKABQugwCNogCQhmaIwfKe2f5kLwAiDWub5+3xnBLA3FRvcqIWkBElUq5tMvptCDNqgGYyeBJR9V2hy+bDbz79vrsPd5ATqwxaTpLAiwv+auPOoszXjyIAhYu097sBrILRggB47nd4YLqKgC72ZOLaL9uCXVO9+akJ9+wAILt411hkYONJCpAsDQNpoZNhGiw/eMu+X3nvHbPVBaTl1bTQhqNWL6sLf2nPcN0pAlC4SNvnMXvyttxXUtCBfbuP7p0f/YWtHd/V05pVzE9M7pnp5Tx0BINdUghWlptNoG3g69kZsqClM0dm+Bvvv+eOA5NKjawCYEYEW/3r5VPYMooAFC6HAuQ5ZwGSmmb3VH//3CTgVzotjDEXhYqAfHayszA7gSxHRLDAUm60mYiBcDJZlHyuk37xbac/eOf+0CRnz1lRMhEsjkxbTxGAwhXIghlpYIg13OcnO3t2z6D16dX2OANcYjxPAFMT3fnpriAwrIrD9vhBthfEql0sIxABk+fbju751Dtv3jORLNrA6iRGAyD3svhsPeUzKFwO6ehIw6jlRjU83b4rH57puUJrAr3V47s6CGZh76TdNN3IgdAxH2ZZCf5sBgIEUmmIiuyGZmnfND/30QfuP9glYoh1N7ATWrduFt/PcaB8CIXLoOBwEDTL5GSvc2j3zDa7870clwyY7XdjrNS2BmszQIVyDtgMnKHKQ4ghVp961+0fuvdICD2xQusetZpFvH0CijuZIgCFK6FEwGJEbnZPVccOHcBrnJa3DaOyVM3PTE1OdJAbw2oy07j7WGxPBCNjVL6weNvhhc8+ctv+CTS52HyOKUUACpchSALE7MJwZddkdfzAArbzVlkCkPfOzcxN9pAbEqSVMrBNgkSl4SBhz3zv19918u5DU55h5Bj2DiqgCEDhNVAUyCyB+fCuiX3zXbV9YbYrAvLC/MzsZAd5CAho3eC27080xhD0IYfLv/iOW3/tnScqDZfdqFQOW+NJEYDClVAyozvrqj6yb2ayJuTgtpwqAkTCfXpyYqLfGbWxvChmZVW6FtZiaLrkjxygftPxuV975La5Xj1oPFB+Mflq4yjyvRFsy6e6sFmIINRaPnie6MYje3ZFNVLeviFcAhJnJuNsh8iSVaRj5D9fVpE3gkZF4TLktpuLJEMy5uzYO9n7W++/776j04NBorGyrJF14IaOgYKyoCwB3jYubaW9fKjrpwhA4RIICDQDQfepDk8d2huRGvnIPGG7BYIMqGlDVru7ODThgOfYD0gYCcM2+3HGhFFIX6APacGtJ7LSMKrxnD9yx8TPPXRcRGDuRJLRuPGNg5LTm9xkJcq9aSTl3M7PbbtX2QKKABQupd1H0UUa5nrx6MEZMIBhtFRus4PAaNBGGDA3M1F3Oz5qBkChZCK+cVrbnoQq51QhUaEJkyk1txzofeqDb9k/1bGcQyQEEtqEhCvzTNMg57NLQxfURim3Z6ByCynvV+FySLY2LhZu2jNxcNoAsO0Duf1oCxgYaAQO7pmZnOh5ThotE9uhp824ovbNDR0JSgMXs3WmuuE3P3T3Q7ce4HAlILVNIxyWN8F6IyCT/uLihT//6g/kpORWOr1dNUUACpdCAJS7IwS7/di+yUC4qG38ZEmAJykf2Ts/NdFBzhfPMcV6/hoQKNJiAJ2RGJ57+LZDH3/w+IQlEBYMEGQSwobnXAlCQuj81Q/P/cFffGtxxYMF922dq7Y1FAEoXEEbGGGvrm4/vrdjcgZY2OpRvRFGpv+EkOXN4YW5mV4XnsoqsUG4ockpuQUMXr11gb/+oXtv2tXzlC1GyXI2hUBj2LgAkNY6OZidbfRvvvzUd3/SnFkcBiPk5YO9WoohX+FS2kbvAq3X7x3bPws0QDAjtf0u17ia7S+4QQtzk91ODU/YjKzEG4xRukAeMnYbhZkan3rkznfefoTeyCwrOAFTcBidwkZF50eHN4KM333izF9+77lePT9IgCezNqi33abpllJOAIUrEGGkH9vf2zMdAbqC5Nu3ha7UapfNdm3/FIAobc8bjS2GLuU2gEa6RIgSQ4CnB08d+MWHTs3EFZfIEMhIxvbmSG2foWuaP/KEnCR3V3a5+7nMP/zCt378zAshxBQFwOil3vhqKQJQeA2yiun2w7OzdQ1VzgrMUP7ZXzh+CADdGMW6F3RkOjBW0raMaG0hgjKgECxWcs8puWcQrDrNyuDwtP2tDz14al8/oMlWgWZUoAIQjGbEtQaBHJJ7A7gDw+wkv/74mf/tK483zSD4MIUEM8hLgffVUgSgcBkksueOpdM37e33arisLeLhdn225JCPbjYW5ueq2mjSqFdYOQmsC4L0THdA7h5jqKooqWHd0eAXHrrpw286EhiSqrbp5sa+ugTRGGrkHJCjMYP/9gvff/Tps6gn4Sl6huiIQjH6vjqKABReh/me3bp/qmfUaP03YVs2bCVgyhk5AWQ6tDDbiXBPhEq0+KqwGCHPzXDUZSdn5JQHyw/cvPdz771zPixnuVsnjGorNjLxnzTBHIRcPozBvvHDp//0G48NOIXQoVJwB5hp2zlbbWsoAlC4SGuTT+PRhekjUwGQLASJ2y694uJ4RTpkWYJ8/8JsLyAnbw8E2pZHmq1B7hLruqZROdFgIeyb8F99312nD0zLkwSBygmb0XCTbFwKAeCS44++8tg3n3ol9CeQPVqgCY6y+r8BigDc0Izu6MCLJfQCgFtPHNk33QGGIMRtaJ1/+WBlhBuU9813JzpGSqUG4CqRnMikIK+iUT5cWf74Ayc++sARk5IqCxU9RSXYhiuAck4kU3KL3W89fe4Pvv7iBQ+hWYJnWpAMF/N/rvXC+YaiCMANjYA2vccAQq2/i+QnDi/M9IM8ixxpwDYtmlVbrhScAjHTw0QdgwVS283WYotp37WcsgEpeUrpxPHjv/iuew5OdbLFhjXAyGxMG7z8ClIOVBZgYTn5f/zq97711LlO7FheBpEzGxGBQjGDu2qKANzQCMi0JBez+QBp2eX7ZsJNe6rAHtwy1Rjozk052G82AilUUSkyg93pTji5t+tWySmomMGtG2UxscqpiciZnW5V/b137nvbqXl31aZONAPMKlqXtI1chAkyyKKRdYzf+fFLv/unj+YMEc4KIa+oWVyJQAo5E+1xtUj7eikCcKMjOuQkxYAQPOHEvtmbdvXblrkiclv0sy33Va2HhRlkomRdiycO7A5VdDm3nbXdVkLJSVSdnqsyb95+x8FPvOVkLxJkAAJEEjAxbuwNcOvlYVAHzYWU/+CvfvS9n5ypTNmVaZAPhoOl5QS40Uevuh2n6hZRBOAGR4SMdNnQalVTEE4d3nty77zSCiADKAgB21MG2tQlbx2MPQfDkQN7KzQa3QAXBVg/HpEQ6mHDYzP2d99/y9G9sy7Y6H5o9E5u/BsqCnRfpi9/+7mlf/XFJxpU8Ey0mQlqhsNmsAJwzeNP5Xpn3RQBuKGRqExrL/cQnWTAqf2zM53YtgAwl7VNdIGN3tldDyRBMBppIuoqHN8/27EMgWQJAa0fE71pmuGwO9H9xNtue/+dh5gbbILR/5UQAsxz4/Z7f/b9R18yDxPuOacMEcEEugSYvP04SwjoKigCcGNDa1d3k4ympjkw1zm5bxIAQg2rIY6cE7ZnuIQk25ZVoASD5idtolrrbjBKctriUY4zo8t/CaBZGCw+dOvuT777tn5MUtuAZYPfvdeqsrIz9r7x5OK/+cJ3hxnBzEIAA9l+wGsDKJ/jVVME4EZGoMEqIcmT6Bycu/3g5M2HFgDkUDkjTQaHp21stEsBzIQToM9OxL1zU1prBnDNNjU7nFE4xSQ6uGcq/MrDx+86MJlVGw3a+NSA13bpMaWzOfzuXz3245cXQ76gKjjrEA1yZAeR3UfpzBs+mp1OEYAbmtHFHYI8G9yUbt7TObyn156pE9qNv49clbcn7RrlLrgATXbi3rnJtqUsLv6v8BrU5v5LckhWxWj40EN3fOi+Q13kYahE2iZE26VRdla75ZBgEV9/7Ll/981nlzKCBsrDRkwpwwUXYWwvqEpE7+opAnAjQ/Mh0wXFCYBKqT89c9uB+ZkAABVREwaCFa3apiGgNs9VQIcpKDnqbrRj8xWI7JnKlQlKNNP2/AE3A8HdPAOQohFKHkNKftfh2d/+4O0HppE9mcvdgI201WuX75ybnFcAb+RNllzLKf7RX3z7+0+9lKt5IfZ8JRjJEAEwNgwWIuDbtlZlKykCcIMjmgmou33Pw91TvdMnblorqtwZjxNHjQFEM8l6dbV/bhI5xbaxOSnR3bdxjGuDoEBRAuTI2QzB6mbgoe6TmKmGv/SuO04fnkeGsxYZTNrQEBABl9PMGD2nAOWULPDLP3zp33/96ZUsk8dAz012sa6NBlAM2VcbAeyMKXsdKQJwQ+MOzzkPmwxDMzy2qz59fA+AHRUYISTJRQuQT8Z4YM8uQ4oBJBuHE/JiJY/W4J8EaYGgZyfEACAvnnnP7ft+7oEjkwHOILM8Us+NfP3VfwSGCIF5WFe2uNz88X/+/l//ZIl1nz6kGndvryZSm6gWwrYOUW4tRQBubGgWLNRsXL063H5oendfbdr8znmiRpZvBgYHCOyfn5zsGj1RdKcQwde5e7xxYZs+m+VU1fPh8sl9vc9+4N4Tu/opDR0xC8E9p7ShgcHWdNxkHDTe3tCYha8/+cwff/mxJk5ZrB2e3RkqM8izuwC6+8pg2DayK1wtRQBubAijIuDDvHtm4k2njlQCuB1dH17D6nLA1g/IItTeZ2tuqn9g9ww8OwgLtGBmxLbseLPBCABcdCIYjfJmZZLDT77jtkfuOFRBwSohBKAODLGCNngBIQB3GR1msXppxX//r576zjOLNJMPzeAIiBU9Iae2VfXyhQtnF5cgglYk4GopAnBDI0C5UW7AOD87fffNh4Kydoav7qotvQEkBTa5jWs1k/3u/j0L9IxgrcMw5fIdIXvXSJtNQ3NUgaQSlO46ffgXHjo9U3mTKQZIAZmUEH3jd91Z3kjKDkf1zR89/2/+89NDm7C8YrmBK7NKYtDQkGUBFpqUh8PByNTwhr/IuVqKANzQ0IKFioqM1eE9vaO7KLrvxFlBCATNAM5Odg/NTzWSaMGzlDOojd7MbleIKEX3zOC0hanw6XfectexGXlOcpfTYK3v5mYkCrgb4bSqihcGzR//1Xcef+mCWWWmYJAgofWolYEuGkVzEKDEnbF1uZ7ErR5AYUuRco5IoVsN3nJiZiauNN5FYMDOMcoh2eYqhmCSoLAwaSd21UPVRKz9vJweOoiyG/wQILZlX6ZGSAObNU8ff9OBT963rxKydXoXcz4rCIGbMEdIuBkE4GuPP/+HX3lshcG8AWP2UY95EUk1jJE55YZVHMIEr8r6f/WUXc8NjTwLCuaTId19+kiIEQztQ7TjDLXaO0ZKqIF9u7t1oHJG63QkIKWtHuFWw5GXThZy6GCwfPu++LmPPTA1PSsxXH4ztFlWeozB0MHw1UH6vT//7jMvXwgU6VrL8WyPHaSk1V7VowkLlhDQVVME4EaGkMfK6ppH5quje/qAWVsXgJ2y/38N7S7xwGx3uleDbX4oSRu1w7mxGUVSLMjqkJc//dCJ+4/O0OAQ82UCuUlJUw64cgj68hPn/vDrzy95bWxDkmvNG3ixcd0VrHW1K6ybIgA3NoYEZ1p+513H90z1hcpkN8Kc2DPZm5/pwZNEuRtpZmX5aDu/CQxp6QMP3PTzD5+K6YIgmME2983RxV/56gX+L5//1lOvZiLQHdlLmu4mcSM87IWfhiwET4Muh4/cf3x3rzPMTN767+7cvTAJ+O6p3v7dM0iN0URKiTsu5vUGUBsl87Rv0n/r/Xfesn8aDNa2jt7MtUKrvwTJrfPH33zm33/9MeXGQmiDP2Vzv0kUAbjBcRALe3cf3dMNGIy6ZPmOuQB+HUhAaXa6t3t2EmlI0kL0LM/NVg9tLCAkxve/5Y53nJxUs5StpuRCHtn+bMrmoLXrkACmZ8+u/O4XnnzuXJoIg8CUuHr4+Ckvu22tyseCIgA3NFKFrPtv3rNvZkICadbag+5sZDMT1YE+kJWtz+zEBYXOVg9rC5DcAEIkAnJgHmbce3TmN955cq7fZajNGAyRa4HBjSwRd2HoGLqyZ3kDT474hUef+tq3vp8yPfSSLHgO3rz2Rdt+PiRWnOcHIMxLQ/irpwjAjYyIKjbp3kNTC1NdqUNEUDt7Q0XAxQi7aa7b6080sRdoIQxkN2JKtLUdMyXPjRPKg8k4/NVHbn3o2FxmH6FrI1MGbLjTgiTILzRpucmkAw1NT57Lf/DFx8+eeTWaLXudVQVku/SCYA0SRjMfDvLicgbgbKu+C1dBEYAbGUpp/67Jo4fmRxWgN0ZLDRKCDh3YvXu6g8Ey6PCIfCNaQciCRChLMbHnOX3wzj0fffPNqHpmkFxsm25x4y9hKTL3g01EQ5OkmFh9/utP/rsvP5GqaRDMAyI5QhrFgC4bgLuPklGHg9QMsdq0+kaYwBtIEYAbGJJ5+f5bDt9ydD80lHx0iNYOXwpFAjqyd27fTBeDoeRCoN2QVWBCppFgFeT5xIH5v/vR+0/uCqvhFBopbUoKDiXP2ZAjMiGF+vsvnPsXn//qixdCqnqec4VsZEZwmV5z/pCLQggBZPY8+mHKAeAqKQJwI8OQh/ffPHd0YSKnhtzh6T+XIMgP7Zk5MNeHPFQxhBrwG3L72PruBOXUa87+0tvvePi2/fRha49qZu5yz5vRa0uj/B733CDU57P+7Vd/8lePPsduPzlF0kzZxYAQXjsvR7OVBtqogG2HmFhdV4oA3EBIFx9kAjnnvbNTtx2a7TMTmQQNtB1kBP3TcWm+H3ZPRaRh9uQKQr4B1I8A15phAoCcUkbFtPL20/O/9NaTNeioLo0Fmo0KsTZ4KDQhgoFWI8QfPb/0r/78u+e8w7TCnBhCBl2CtdGnS+ckgdbWCZ4zuGrkZ+HGCGFuJEUAbiSItWx3I9Q0R4/sv/no4ZQby40rEYDWemPt3NWQgNAL2Ds7VU/0krtnX6uA3qG0K+Ooce5aar2ULRgZZ3vxsx+4//b9XReyxbXU/Db6r0v3DhuESIdBxhCT9Kdf/N43H39JqLu+HJngyqJCDckvd+lYDQfR3d0TRB81JisBoKumCMCNglOujNyYMlllWFXb3Uemb95VkxHVVEBVAUTEyDxth26m1Ka5uoCjC92pyRqYCJDljU90GR+oLCBRYnI2piHZuFYQQgYnePYTbz35znuOVZHBsnliW3q7WoC7KZfAgpkxZHDw1R+f+f996amz3umgSdYBI0EDImmSXe5MxVFhGmomo0HJjIDkTpYF7eoo79eNw1o5Pd2VhsOFme79txypDWYBoaYZIbSRoB0M27tCETi0MN2NLgcp+g4VvDb0136mcgsBWYCFusdQMXQ8pSMz/MTbTu2b6eYE06gi69LvsCkCAJhEpVdX9L/+x289+sxZ5ZSUM8wR2lgkkAnQePklsNohBRIwEBplCfHify6sjx39qBcuwQAjnHAGEpaWT+7tvun2gwAuedp3dAnAKgQIA3B4/8JkJyAPSRN3rBdQu3abVLuCSAZn3TTIjWVnJ+qjb7n1rTfvpbTCKrO6Pm5QpNxXGMLXnz7/+1/4QbOyHCtmdlerfi9dxvnaiSmtVqzT2utk2+E2hptCEYAbBcHdExDEKHiX6b5jM0enV+0xbywImjztm+vumQjQUNDGNjgfM1a3zPDcNGZVhrlUxQrD5Tef2vep99w938nDwUCUX69AuiQjzy77v/rCDx57CYGhomThZ3/l6tejLQUmhsNm6Nm18TfVO54iADcMEgTECFgeDHZPhodvOTp58UrthiKARk+T0Q/vno5wycgdXAncBs3d4WBwBLh6nQ59sKfnv/LILTfvm8rN0KAIBIP8ekwJSYyd//CdZ//gP/0oq5bDc6KndYZwBHl7H0AurwwurAxvlBzmDaUIwI0CwWAU4DSSJw7tu+vEAaJ1QLuxnh21N8HmFXny2IFex1xSsJ37Jqg1SchijjHDYcrDRabF9z1w8uMPHOuayTp1tKhEiRY3eyctwcxeuND87n/80ZPPr0QDGRqAwdeZykkQoIOArQwGg8GK2SY7Vu9EigDcQEhAk0GrO/XtJw4szATlZjW6upHPzqUn8dUMQjVZwyTAgby1JZsOuOSk0Y/v29Xv1FKWdnABBCnQgurK4aYcAoYrS6cOzX/yfffum6xgROyamSETBG0TUn4AOdxXJ4ey+GfffOo/fPNpxqrjQ7VX1crrnxhsE5XAlJEzbe3j26k6vgkUAbhBoCNCdYymNNzVaT5878GZTpVRv9Zl5Rpx93yJr07bx7vx/LUnXnn0uXNCg3QuKzdbJwFteklWRIx3HOx3a3M5tZNbQkoQBEaTurZieVj15j71tjs+eLwvMAKVkVZZ6HD9UfirIQvyBB94Hg6bTPLxVwf/z794/uzShTosD5QbAqFOvt5AnKAEEEMg06oBu2wtJbBzdXwTKAKw82k3X5THEE2iN8f2z588smA02+iEj3a/f0npkCAaw9MvnPsXf/qtJ58/QzAxijFu2aWrQBhpIBnmZnrzcxOUdnpPYMllKUViaF3R7j82+ZGHTtedLi6z+tmMWoi20bzLoltUHkYNVjz/6Tee+PI3v5dzavu8Bwb41SYkrLoXEmurfln8r4oiADuftpJHQpZciPncm07t2z3bl7ThhTMkQwhmttbBta3S/NELS3/4pR8+8ZOzkJJ1GoFbZjlHCoEkA+EzfTuya5p8HbuxHYPaNV6QZwLZ65mO/eZ7T9+6t+uuKxP8N8H2DRCZG9jQQVOI+P5Ly//jv/3q+aXlbm9CFuUyAvKr3BWsniJL8s8bpQjAjYKZiUHA3k56++37+nXMsM3a762WDnl2SE3OX//x2e+/5D98YXHxwjIYXBm+ZZ6jpDLgADxNGG/aMxWM3Lk3iAQFMRoQmRKbC+++56aPvfl41wbpotX+pqyha99UDocsRjhXEv/oi49/9enzVnUa0V0wygSJfnUaMCoa2MkpvJtLEYCdyWv3s+1an4bDe47vu+fwbN12ed2Mp166WG/sKcb48uLKn37zqazOd3786tOvDCqEuLXbbc/u2emAOjGcPLiLwXbcs8BLu3dRlGhVV6m5+0D3199zy+5ezFmrnb426wJ87ZuaWcjwxtmZ+OoTZ/7Xz3/tfFM5wnDosNjWJ4/siq5iaozaWOAGzWbeAHbYpC8AaEs/7YolQO45Zwv28H2nju6ecW9LfjajzZMEQi53s4Ccf/zss1977CXU3e888dzjL50PUC3Rqo196asaprcHEBfpx/bNBgtQ3lnbSHHV0x8ACLpyDt1e/9Nvv+VdpxeyPMUedb1WTgb6wDydafCv/+p7jz6zyBAQIiz46nQN4Wq28hdnrwhshlPFxrA2rrbj0phRBGAHInfJJZdnwNveSbRA4PB89/7Te+uK7mnUCnZDGTmIIcNMxgA/e+HCn3z9qZfOrRj1wvnmhy8OBmqgZnRO2JLorQWjBckVAByYsoWJ4DvMAYkQBTm8Idw9OS03g3tOLHzi4Vu61SAruhvdN+/a9GL8BxxkJ1V3qr/45lP/23/6wbKimeS59amTizQK629GFAxQ61pkiZW7X24ZNxaQa+8C27b343ZS2VmTvrAKKRKCkwBlBjdCK2+5eebWA7uhZMjt5eAmvLjDm6ErCWR6+rz+5bdeTelC5eczu1954szLFxKDees5sBV7IocFhY7DQw3EhV6489CUGMfr0bwGJLm7zFwIFAlYyAz75/mZd548ub+nLMG4yf4Xa6ufgCSQ9Qtnl//ln3/30ReTxW5sLhg8GEK7E3A5TFzvudAkVwQCGM4NbWl5ua3v26wf5g2xekqRRnm4GLeOBeP1fhU2hpF3o9qb2LarnzeDmY4evPP4wvyEHALD5lROZpjDzFOEYJ3vPv3qk8+9HGLHjJ7Toz944tz5FTJeUrdzveFIdwgR7lMTE8cPHzTfWWmgnisDScVOhsmiafjBNx358FtPIztYJzAY2rvwzaP9iA3o0hPDn3ztyT/9xhNeT8gzkaFLurhfZUGK5DAzM7guLC5eOL9E6PWM5LaaUYrqOA3pEooA7ETkOWcSZubuOSUBSMv3HJt/+O6bTVkw12ZlvTjMEaMpMC07v/S9p19eciCAzmhPvXjux68OhbCFTwRXU2PbvudT/fr0sd3My9gpWeQkYoxIiaaUIJmGyydmwy+/7eZ9/fZgGBmYr9e1h5RD0JMvLv7LL/zox+cDQpdGtF3dr+G7AsjZIXn2pHxJEcPYfYyjppUYu6EVAdiRjNwd3N3dq6oCbaZXPXL7wun9PXkbqQ/Sxlvga7TbMZICnzrnX/rBszlTCO4NIpe8+uaPXhokrXZy3QK0Wp8MtD5wfmQ+Tm7hnfRGQ5jAJjfGwBgFzcWVTz1y+5tP7vOmkcUkmjJyXr073cSPQgJpg2R//KUf/ofvPJs705Qj53ytqUd0KecMM8ZgtDbXaeyW2IutCjSGyUpFAHYgJC2E1pIhhEBjWjp/aPfcu+89NQUFJUEhmpHrv3Nb70tLAZkGd8/E158884PnVwCjVWAifDnFr3z7ycXlFXLLHob2WoQMIEEH8u7JzsFd075Tuoo7kJywYMqkmC7cfXj6M4/cMtMNdQhtg5UIdqrasZYGik2TAQn8xtNn/+UXHn3lgkE0DIyu0L/Gb2uEGUG4RjdKoyDQWNHu/a0N/nPcBlgEYAfSNksiGUIEmJrG6t4tt5y686YDyg28ISw7sqdNSMJx+kqWHNFZ/fsvfuOlM0uxikQMAURODX/01AtLK8OxiNWOhpDmp6f379/vfunjudVjuwYIiYEwIOdmMNPvfvJ9959a6DQpDRKzYMzBk8S8yX3QJJBskv/+X3z360+8inoyoKnTOUqZ1bWs1wIkBIvw8a0E1tovqxfA8oxxsh0sArDDIEC5pxRYVSFfYB7Kevvnuh+/d2GmQ4MxdmjBBILY+OZPpEL0AUzfe3Hlyz94sRmoY4SGGT0iwPyZ5fDoc8uro73YgH4zOo//1FGOxgpjcA8LPdy6twsHGCIGQUNn5dyuBtEkgw3lqVEvSB++d8/HHryJCpLREGy0PyAZLrsJ2oBVSZC8GaY0BNwTtJKU/+r7L/7Bl588N7SgBDUuywLlbzRvs91UBwajBjQpVmDE2DW0a2tiAoDZHic6cCfk2uSL96uiCMAOo90YMVchp1yZW4yucHqh+75TcwRkoa3AigHR4oZPANGE2nIy8i/++vHHX1gK3Ylm2EhpkGogmPILK/7l7z+b3UhIbcWY3P36tXNqy9UAuMPMFed61c0LXdAyGNQEJWcFBmL8YsrrQHL6CmFCdXxP/9fed9vBmY4Dnco60QJBCwgVCRsVY2zYO08Q7gKT4MjNcPnHZ4f/w7//5vefuxCq2jBQ9hwmYJVhNe3qqs8BBNBaDkJDmtxDTn7ZhnssINl2LMDCRNg9GcSKGq/zShGAHcYo24B5WZ5zmEjZOlx55E2n5mcmseadglG57ia9vkJ9Lofv/OiZs4tLVWXZh1SGu5EWOLiw9K0fPL6YfLTyGAG4O65bPSe5milLd5BgqPYvzM1ORc/uik4DxbG8tVsniZWHzhTPfey+Q3eevCmrqphHXeFW09LXVqKNfdtpdQzWVWPeWD35+W/8+N997Ql32Cgg1JqFXGsYRJSLQHBQcMdqFug46bVRZhAw0e/NTNZAhtWXlodtOUUAdhhsvc5iHlYhDBRT8kOzfOTug1UYGTUDbf3kJnm/SHDG6rtPvfytH72E0E2eqyoAhJlBVQQs/OC580+/mgC4BMls442pfyZqlyOO9r/7dk0e2VXLh5lRClCWJ8k1duWl60Cw0HXkOw90f+Xtp2Zra9yRVzBS/bVOKpsyBzIJOf0CkZ9a9H/1l48+vRgQq/Z91qgW6pKXvup3mABoAYToIMyimV1cWMfmE9Nq76PdM5Nz/QrNiqwaq1V3jIZS2BAEkVZVleckMlh+z11HTi9MXPq0c3PrEXMG//P3n/7mD1+00EXrSGHGUOWU4YlV9cyivvbDF9vkiHZDSrNVL4br9PhKknxVe3RgbvLErj7ljpDllAC1HqHj3mr84ie7uqM3KuX57vCX33vXPSf2VMoxGELYcPe/1/tuarxNyOcyJv6nz3/rz7/9E8Ruu/vHxYX/WuLgbYeL9mMxgCsrK8vLA6CNJmlsLCFEeXvS2T0ztWe6i+EKQoVx8p0tArDTIOBC03i7/5iu/P333bRrokppw11zdel2axRcoBj8lUH+1uNnzq4QoRNjyN60fl1yedMQfH7Jv/aDp0dtvUV3h7QaC74ejwdXi6UlEXBp31z/2K5JyJ0RtMCLzynH9DFZHd9aJGdUCUUJ0Zt33brvgw+ekOfgMne3uOEz4Mrv1lrzUMiZsf+1nyz9/peePLvMqCEvX/E3YIWWAMoJ8cLS0vnz54FVt4WxCQNJ3vYfnZ3sHNw1ycBNtF56Q4znzC68UdorANKtIgOoW44fuv3IfAhZG73rl9b2xsJqQo/cSTz+zMtf/+5T1plSVmpS1YlBrixWIQRaMCU+/cLZ5QsX3HPbn6sd94YO8Kfi7imlVZsMAJBrouLu2dpCVIgGQtlzhjswhiZjLZeMavUul5QROfveuZlf++Cbj8xPOIMyzHMzetg39GcR1hq/CRAhKBBGLQ7xR3/13W8/+WLV7dZ5SW2l7sa8JgCIBE0UQ8iec+vkQWzwD3gtCIAblXPuBO2Z7Xd7nexjpE8oArDTWE1vVIgNOx0O3n/XnsO7+sra+IYnZBay2MaV5a7cUHmQ6794bOnbryRWUD7voKMrj8EHEpJqCkB+/JXhN58fBA6VVxqaQxtelfbTB872yqG9EQHQdkY7eXBhz2wfeQVwb5uGjfvzQUDRXIBbdFiUi7lT428/uOuhUwtQcARWhLHWxl9nyDOV5EMhO5Qys5NqUuz+yV//+F/9x79e8eDKI5+GDVqa2zhWZSmgkXU7GiaFYegBvlqKPiYQqqHkCJTffWTq2HQXymM0wCIAOw+2m7KcmdOhXdP3ntg70ak2+rFod3swjpaUdhtIGkP14uLgC998YrkxEgwALefsRFv66zC4W+BPXjr37adfYohgO16/brH2NQFY+yNJwG86tG/PTB/NAGaSg+ZjlLH90+AwZaOHnA3RY1eD5dP7Jz768C2z3ZgFrhrkGF9z+3rtr20AZEYIyplwejbiJ+dW/sV//PbjL10IISg3qrrcmEv+1WtkgHJ5EgJyEs1DGKO9fwsBBhA0QLrlpv0H5vsYLo9VsUIRgJ2GCEIMwdKFu4/tvuWm/YI22vltbeMMutzRrv5ZFOyJF5e+8e3vU9nobXkO/LKiXwFm4ZUz5x59+sWBKsootWmgW5l0KRzeN31oLion0qgMg2usdpSXwVHOFTxUyMPgS4IadGa74bOP3HLbiYMpu9QGZAwWHbbB0R9AhJPyAA8mRvMQmibbv/3yU3/yzeeH6lseGtyto43xQLh4S+QOOYU2A3TNS3TcPix3BZAC9u2eOXlg2sw3w4PrDVMEYGcxCsnToJlq8MDxqUPznZxlMNuU5GMFAw0gE5SE5Yyv/PDl5xYHNDInuCSE1+z+DGgyf/D8hZcXh2AgEAhw64LtBMC5Do8vdLpVSAg0owhWY7evXEWr8Q6LlUE11a2j0vJbbj/6ibccn6qMQh1ItVn3Ut54eRUEBDjpGLWAJr733Nnf/ZOvvbDSUZyEJ5NvtOvoSHtgoBloLqSMcVzN6FAgQeWOdM8tB+d78uTjU7I8fm9Z4VogAJmFNBgeX+g/dMvBPkAyu9oc8A1cASQop1Hxv+BiCHb2wvDzX//hsroGGTPbgFSb5HPZFzti97Hnzz71/CsMUUAIJLYsRaJ92SDddnjP3FQ3O82C5BbD1gzoalBOzgiLw+Xz+yfwy4/cfmy2ludOtAD3dtmnWbANLfgiAJcJBDJNLiSEAbr/8i8f+6tHn5WrZo4MkG10/kF71WuyIBrNmqYZDIbAeBXZAoKSQYQDMvG+04cPzVSer9Nd13ooArDT4GqCxJtOH73n+AHkgWgutpnXG7oACJ7lGaMVniSefPrH33z8+Rw6dIccoRIg5Su2PIKsqp989uyPfvICwDbSvlqbvGUeoQG67eiB2ckJZBiS5OO1nrw+hOecsYIqpKWPPHDTI/cejswGbz/xYACQXM1rVHgDkFEAs9AkaBjDF7/z43/xl09cUC+kJTZLQpBFtkXIG/eqAAgEMzhodmFlZWn5AlavB8aHNvm1fT5IHF3o3XPyaLeqpHGpWi4CsI3hZb8V5O2EyylPTfXvuPnQdA9Syi5auKSJ9sYNIBiB3Bo6QCsp/9U3H3v1QkaoCbi7jK1n12tnutHOLC4/+ezZpvXgHO1Ot+yRkAPS4b2zM5M1QG97+G0DAVBEttgZym45tv8XH7ltb49ZQfK2zILkqKZhE34Waw+CxoyEkF9e8v/vH37pe0+dsU6vExxqhu6wCE8b/uIEJdAzBQ2GFwZDtJuScXCZXYNGEoIJ8DxVh7ffe+tUr8qCICJx9Y549Neve2ioCMC2J5MKwUF4E9SQWc3ysTnce/poStks2ujobxuYiod2tyUQWbQEVKZXLwx+/6/PnltBzANnyNZnGgRPmd0rtmYCTQOE3pd/kp995VxtyN52r9+yS9cGTNS+SZ7c3WFtmR0yjlsNsEZ9lEetfkaNP5shgA7yh956/B2nZ8NgSahgNS2sLigMZB03cnkZleEyJ8MQtcEq6M++9tgfPDpIIUblhp0cumbVyAFoo693SLoTGkJDQK+mkNBQSWN0FUywa0RlgaHrIfaNH75r/vTBCVkFovKBgBy7ys1Fh67rSxGAbcwoBdOz5yaQjHXDKqGqOp17js2eODAZCZeP/iYvbf2xAZCAVYBFeQ0B9pVvP/vE84uk2WrOBx0QVz3ALsNdiPHRJ5959qWzpBEG28qAOwkKnWAnD+/rMnvOGkVvx2c/2TbBtZGV88gUE6ma8mb45tNzv/TO2zpGVh2zuNlbyfYDzVlRirkxq7/91Ku/+79/8eXzS1aZwwUS1ib/Xrv12+sMAKC74CFGBDu7pAsNN/aWYyNgWyYj0miA5qe6H7z/ljqvCJ3MWmmA3CjUW9XKpgjAtocSPBHujG4dd85NVO++8+h85fBhawC5GU8gAAfdIulRaej+pe899fzikMHWmr2uem62sZRLzIhAeIbh6ZfO/OC5RQFOuAzaskxQI0hYiHefPDxdJaTcGgGNz34SaC/Ufc05laQFc5vYPRE/8/DNd+2bUPamoUYOF5fXxW7c+7q6UZUDGi7Rh68M7fe+8Nh/evSFGAFP0Cg4BKzVUW/wu7hahE6YIVRnl9LSssM2NtV1IyDXatwl1MHee+feU3s7WfBYVczBBwzVVk2yIgDbHAGwygzKyg4GpObYrt677j5WEYK1yR+ujd9hCMiSw+RO+NNnmq8+eWYlhdZbrf0rl6zmV0ZmRUC+4uHbP1lcGjpoDph8c33qfjq2+svN+3r7pwm4mRl9rBaUdvUfuboa3V0u+Mq733T8Yw8et+E5tm1W5Gs74UtVd6NYiyxVMTIEq3tffOy53/2LH53nFL010dMlHT+5ORadghksDBrB6sULK+eXVoAwRue110BS7ncemv70I3dFv5DdiFSh8ZS3athFALY/VpGEsiQod2O67/jCnukeac5aiAToeUNTQAGAQISDEg0xfvX7z377J+dG9udYy9R4/VeVBDMqp9D9+pOvvLp4oSJgErey9LY9rO+bqm49OMdowsbmzW4AZmY0EkbKPefknk/PNZ962y37ZntQhlldBYKbEE2+6P20RmoGjN0fL+Z/8affffy582I0U1itFOfa120C7hmAxJQdFs6cXzl3YXDF643bFQ4ASP0OP/7AkfsP9XxlGVVPMFq7P2v/z1F9xXVJaSoCsI2hIBqszoAph0h6M99J77jneE00jsy6QaA8IsM3MPu4fa7cfIUuMQ5S+MqjTz/7yiDEapQ68zdPXoIgCXn4wVMvvXr2PACXXzc7oNcbEQyAfKKy00cPxVh7zmwTacYpCkTCECRCChaquvupB46+4/RMdkOcaBcSARtUeXuRVZvBtT86IDNfbvzffu3xP/xPf82qRmrkG/7Kr48xjC4YQgDjy2fOnD1/AZfLzdjdCACwkAfp9v0Tv/iOO3oT3Yb9JGJ0PteqBgBsPTw2XcCKAGxjBJECV29cQ03pprnOPUcnQzCQZgiEIAbjRm5nR9NVgCsT6fGXL3zlJxccikzrnbU+Koh/+UL+wQvLKWfzDGzdPbAgIQt1pduP7u5hRa62LfAY5RVacBeVgoa04MnvPND/5CN37ZrokoTVbc2v2QZZ71yKMpRdSm0MSpRgCI+9dP5/+fxfv3jekizWwRF8gwtOfspwaK3hVYBAnl1cOT9YBkadpdu9f855jA4Bo344GMDA9PGHTr7/7sNpZQWhryZRkhr3YRayApWB5jqcAYoAbGNISoIP6e6h03iI1NvuOXVougsgErH15rUgRljY6HpMU5wAFCx94QcvfvHJC7EyNMvrFACi3cf6YhP+7LvPDQYrtbmz2tAhXg0UTA4z4+lDk3t6LjO3zpaN53Vx0CI8GZPDprv67NsO33bTbgjRYCRBC7RNaDlC5KzUCC4qD3IzzM6zTfW7//5bX/jhGfX3GkNQGh1RNj+dV4CEaKyUIF9cap5+tREA+UWDwlUlGAs4ss+KVS3XzXu6v/HIzQfnqtQMQ9WFCMuwTBgVCSc22EDjdSkCsI1Zm9qpLQIbLM328OZ7T0z0eyMDmNUj8GaEAwBIMIsXVuyb3/3h+RefJcM6d8sEHBQR6Hm48q3v/vDV5QzrbG3lFdtmJuBEv3fL8YMWRt7t49MOwF11lJPLnPa08p67DnzwzbcFUqPY8SbGq6Tgbp4VKcqbnDPxF9/58b/+/JfPX1iG5ahGQsq+GgLa5HfNYWYWDaQFZuInLyxfGCpYWE2QVQhh3KJABAIFBk/+1jsP/+333jZTLSNYjj1nTQZjJlKmyarrkBtaBGBbIxMiklVVhgWtnD4wfXL/9KZ/qGtPuDzQvvfMK//5u0+ETuUWaGE9JT+jTBFYQIbxyZeXfvT8khC31iRLbb6sfH6qf+/JfVUe+Jrv2JhgyMNlMEjx4Ez3M++4+eSenud8HZa5LMBCNFIJZNXpPvPy+f/x33398aXKupNMK+5N9syqHplEb7qWO4jGrclJnhCqJ18+f/bCEITkXGWMTgAtkskVajHurpu/96E7Pnzfkbz0sktUVKbSEGok+nUJhxYB2NYQlCm7zGIV8tKDJ3YfnJu6NAtwk2gP4CZvgC89ee7RZ85WxpQ8c71tZ0mTZJ5CrF5N9TcefyFja7qlatVlnnIq52xTdbj98Ew/pCvKF7YcgwejxRg4ePc9R99x5+Hgw+szwBBie6vEoMZ1PuuPvvidP/nGUyvsw72qghHBonlWTtj8C9jQ1ugxSDLIrXrs+TPnlpYB5NXcXUm28Zch14QA5ewILsAHh2bi5z784IMndllzBs3AQlA0xdbP167D2XO83p3CGyDAlbIQ90x13nR813xt2vxbuFG4IdjL55uvPrF4Xh3PQwth3SumAJMQNAjQ2WV8/bFnV1yEb9WWTYDglGdYAE4u9A7vmZH7hnsYXAvmDdBRTrfNpc+957bdvdpldl0qqLMkhyF7htXdrzz+yv/0Zz94ZUCSZvDhABachKfVlX9TD04knBCCxVgFQsLjz5x5+cwiQDOO3QXAKiSdoUnZAgDLw+W3ntr9X37yoVv3dTq+bJlicFJy5OuREl0EYJsjEYmhyk06feLY7SeOQmkzX+6ylwbs+edf+c9//dhAFalgtWu9i5GgaCHCIZeqx589c24p4fVMIzabNU8FgVrt2Ld3dur4oQMQX+Mudh3WlCte4pJaLs8rMICfeOvJh0/Pi9aEjl+fhHeBbJ3f7Mzi4Pc//9WvP3U+dqeIJtIlT4iCBfPVY9zmKqdRcFdytJf3sHOD/MJLLyk1owTpNgQ0VpV8koDMEAwuOWvGXt/8/Xfv/Vsfvv/w7pmcXYgiDVc8SJfMwQ39gYoAbHPILMEDfXj/6YVTB2a92RxXfbUdX5SBoZAAJ7Pra4+/8OPnzwBmwejLiHF9SzhNWfJB6DFEBDyziO8+9QpWkzewuqjlnH1TGzNeLFdNlGeLRikPd89O3nJs2pqz8BSYTMlTI1IMm7+kEKB5Y0oKVabJh5ENiRyn4OnBo/1PPXJHbZIneh45cW8yofXKcM/Z//dvPft7X/pJYx1DhiMlt1CN6v5GHQI2G2VEA0wpC9ll5g3Cl348OHthmWiySFCk6NdFs9cHASEY62AG0IJZRXCmEz/9rlO/+qF7904GpQsWaVYBIYPZQ2bIjJKZnNrgZjJFALY1BKDQBbl3tnf/zQudAPmmhA4Fd2VA7r7aAhivDoZ/8pXvnxsKVTVMjjxYLQD+2QMwZMlX0HM5lJ47s/LV7z0Bcu3g3irBpi9tq9/eKDM6KwPluRvs1N7+7l7IapvDS4SLvvGd1X/aqJxE22jBaJC7kBh3T9ivvOeOEwdmJRgZsfE13j8NkyvlHz539v/zx195bikS7mlAq8Tg7qYMSaiuz6qSGUUaXRZBC8ru+sIPX14cwtr9tWcfpxIOAO3NSCRIBotGA0CLUH2o1/07H77jt3/+jmMznbBs7lDFjlmwRHk0xmAYFXhv5E9UBGBbI29934dLNy30Tx07LMGCbcakFwIQAQWliimqMeQfvjT46o+eH8rUVqSZ0XPr/vmzvtuoBYBAz8kMi2fPfvvxnwxEW+0f1QpA63+54T/O68DojIIcBqOgk3vmjx7e5wgNqqFVjBW8oTfX41ZAcsYMQxoGDM2sUcyhW+VzD53a9e4Hbq4DJYmmUa7I5g/JU1CzrOp/+LMffvFHrwQkpCRWaDt+jSpY266e18fPg6vl2+1rm+RP/viZZ86uQDGg9UQaowv8VYS1ZOfVD82Q2Qz21vnvffjuf/KLDx2fptLQIU/Llle6HFQa5LySQMZ6tSh7Yz7xIgDbGAKgZYSur9yxv3dgrisXjZuxa3YEmAEwOnKGNzn757/5/E9W6lD3LOXQ6QIA8npmJtv1HWqv7KpAWPXYS8NnzrQGL22FgQnX7ypPYB4tKiIBpdMHdt18cBeaZDTIBKPRmIM2fYEj6DAHQlCgUkqwCtDx2fzJh286PNMJnmghy0Aj7XqkKgnu+uKPXvqfv/DjJU13K5lpZDZ+5c3/Zqegjbw1KYEazRfCaIsD/9oTZ5YbD8gWTOs6i15nRuagunSbZGBQSGE34m+89+T/5e+9/f6jfV64MAwdr3pZzGkIUd6459VQ28a8yUUAtikji10ScD+yq/+uu47MBRdbg4VNWaEk0BMEB2GdcwN8/qs/OLfkcBGeU06tH91612u1pcyR9GaATveps/7Xjz+3aiEnAGaBmyJnPw0G0Nr8QtfCVPfUwTnj0LyhZ7nMQoBfhzJXQLTW8McDSYaAZBde/tADN7//vhO1GpfIzXt4dflvJIEWnjmP/8e//ssnX2kYQtMMRIJbYd2xusW4ZH1vDTCwNNQXHn12oESm5G6EXafjyFVz6bTOCgN1YQE2mODg5+49/t/9gw/9wjtOdmKQp+TI1mEVGLjWPexy09y1tNcrXuQ1GQyvoQjA9mK0HEprqyR92Ny0f+7BWw4HrFCj7OhNee32F5FWJwvffvLFHz1zFs6AZJFKGYzrN/MhaKREgfBkFn5yNj361HOjKjG0WuKbewN8OQEyZFJgEIzAHcf3H5zrcLjYhn2k6xRUENqdvblrqKBQxTy4fX//ww/dvnuyS2Qqu8OMxrb148ay9kOyPY0RWnb+3l/+8E+++woAwyCLtP9/e/8dZVeWXneCe3/n3PteRMCbhAfSIl1lZRVZhlWsIksU2c0hm9UiKU1La2a0NKtXz5pZmj+mZ41ZazTTwzFL0zLdrZFEUmKLohGHoi2yqsjy3qfPBDITSAAJ730A4d6753x7/rgvAkhTlQDiBSKAPL+ViUIWEO/e5853zmf2rpbOmK0AkDO9tOvoxZOXpuCtDpDgi2UwcROQcGdGw5ihWDs+9sDaX/v7H/mHP7/zkdUKeRJmREVd76w2F/oGIhOabdO6lmRqlcJ+5GR2CQB3FBq0yV+b9xfZHX1g2/rt67vwnrNV0xz+ohkgA2AmhcbRB55+ed/FK5P1WI1mGs10iJViuMEVUlArGQMj5HWMZpZm8slz483MpLvaHRIxayiz8BAwT/S+lCmAAfKHt9/zwMZlmJmoImjMOcuNXJAqyxvvBfJMSoTDhGDe/6WPPvjhhzZ4dsrE2o0g6AsjJT/Y+s95+fDFfSf+4MvPjfc7gbnqX64sppx1G8PzO0KBVffEuYkXXj4IOmPIqd8ODC9xDN61Bh5THsmhkvVz7j2ypvNrv/rkP//f/NIvfOjR0Ez3k2dWchrFNjIDg3qLBDjpACmbUxRtc5lzRw2+3dG8BIA7iewCAyiqZ2wCm5ynV9bVhx67twohYxlRBTkUh39tZniTPTSBFaYnZ3rffn36ymRDyS06K8HoCoYbaVMjkBGyM6jJYoNAZZqeOzHz6ule1Ix7pjyJfZ8rKi70Rk5kgHVo9cDtHnxotT2ycWUaWZuyRXOEygHAFzgmtRcxy157Y3DP/v5HdvwXH394RS1aNKssxAA3CRaHNj99LfHTZDXTQoKQJoT+wSv517+yf/eJmWBOT5mdDAMQls4RABBQh3xpYupre89PeLdmVqjd6sW+rxuBtBCiGYMZzYJZBdlYhZ97YsN/91/+1D//Bx/7+H3djqfUJBlCAJAC2ylFBcKU5K6cXT6om9HcgtPa+RbAIX9rkqgEgDsJWjCSomQpy2ky27SienjbGgjucZAX1fDfVoc5A0UDLVbfe27vC69fYNX17LCKVqk9bd5EcwJFsq0seJC7Re47fuHg6SusOrOtprrWFrrgGzmCBhrQVlYJsmN4dMeWFStWJlFyDIyLF7a2ONsi5QQZuhRWdvWf/dQTj+5YL3cSbTWes+qfQ3tlZh9G7SsgUMlz00/8/LP7Pv/MPrcuB45fldCa3C4hBOWUU/bdhy8dPD1jMluAvsmFoU2IwqxVcIykOZFIeG/HSvuvfuGJf/m//6X/+pfe+9jGKnqa6fWbOJZkTL0xTEhsqjVer8yM7v2KzVhozBt4hqSUcr/J7hbtrfF6AbaKhQWjptQ0IsTKJaKuQ/7QA6vvWxfgM5QZq3ZWa+h5kwQzIFJBSqi+v+foyUtXQnc5Un8YD+8Ag/HCxcuvnbgo3Ed6Fqgcw2xb6O0ovb4BCSR+7D33bfvm3ssTjasiRZcv8F1Ym8r1lFgh1FW+8omHN/zi+7fRQd6eLywdVisjTVk18tzr47/3xV2XpnOMPmuQ86Y+xqWAACKOUTxy5vJTew8+se39wXOgL6bJxDyQABkYYKiFJ+8Ze/jv/djf+uh9X335xLd3H//B/nOXJ6dzDOZV0GTUdNs2hhCyhcmcBVAZMEQjSDElJ98cA0oAuKNIGdkRKsYqEJ59pOYnHt+2bgRyh9WQSBmHv1Ky/YIp0Xjw/JWXTkymbFV+55b/G3t0tpWrxuO+kxNXppqVI6EBrJUWnnWgHcKFboK2GRQPb1720D2dV480CFUwSw3anfcCXlhtBxSz5EhbVsS//7Pv27k6KCXU3QW88KCOiAwTRPQhXGri73/puef2n7eRlcj9H+7yuei0Q5HRXBen8/f3nvnkT2F9TJITi2cyMQ+iEZl5MJVCeBph+vD9Kz/4wNpf+ciD39x16Fuvnn5q76ljF2YQglI/pxTrCoaU+8GFWLln9wQagwl0vk3PVgkAdxR0miFWbmaS96/es3bVBx7eGJAdzAxQE+VYgL7wIBil1LA7suvI2eePXbGqlhLBIbRZiG2/CWK95+Tl0+NTK0dXZLAKOXlj1lkMlVBCgqfVNZ7csfZLL56aQagGtbbbIXXAUFvKde/S3/zoI594YmtlOdNceptj/NBox7kE0FxyTbH7R9967TPPvo7OKDyrfZ8W7PLzRICnJpKNx+8fGH/uwNlfeGyV8m0Zkhg2Gkz9ykXRBDliYKBn9/zw2vqRn330v/jIzuePXn720IWv7720++DpCxcu9LPk1rYrhzxTmayuk9AkgAhGmy3qz1ECwJ2Em3mIMkoiejVnHntg0/rVo2DOFntEV4A3YBx6g7ahgZMIU309f3Ti/CQ70aSchnIEGEiuEbE+eHr89PkrD29a0XbjA+6LVaoiRUXLH3xsx8qvH5645LV6gSaGBR92VatpnB/ZuOxXPvbE8rqds75N+R8TBLeq++qh8d/6wstne2MRCd4XqqW8lhIw5TparkcOnp/+5jN7fvqBj451qtudOpw37Q27Ux6CQe6ZimYSGgYaXcmamVWVfubRDR99eMMvf2jqxMXJg6euvHTwzO7D5w6cuTo+mZpkOefpfg8grIIZsoEO6LrOuoVoFyksEJJLGRLclEFf1gkffHjLSCeCJouDdnBbEBckwl2wuj58/ML3Xj4i1GxmsnFoWem2Hmzx4sTkwVOXf/LRDdbWOWzgbbAoX2MRzGnn5pVb1y47dfFyk3xWaWPItyPAMBiioxnADOsg/WcfefInHt0Q6S4ayAU4CqnN689u/iURgny8pz/+2guvHB+HLTNNE55YL/GmeiIrNSGM9fvNd148cOQTjzx27wZ3DwM1kdlhDrwlF75kaKcuQFgwJ0wSs7U9PLTg2SAxeBgRqJQq+UPr8NC65Z94cPXVD20b7zenLs0cPHbhhbN+4PTlYydOXr4y1Uvsuff7qZctOSTn4KUoJ4A7BQFEx2wmSeYBOaG7fEX4xH0jKypzR01EyixCb1fsnzeOjjAD8xdPXHxx3zlwtLFmiNehQNA0DdZf23P+5z+8fdPyus9IMDpgWoC6xo0QAb9nzH7+sY2vHLx8VSvNLpsI1ENMhQ+Mq2ie+4GSM6Gj3Lz//tW//JM7V3Wa3PMmjJirtiHXwx1wMSiDSGAWIUSmvtvvfefwnzx1MrM29bKDXGL2yG+knVJsQgfNTGUzip0XT058de/Jh7atCmT2KOUYpIwswsKSDQCzqkoAYNbKWgcgtG95MGunaFrbZ5lBco8AjFg+EpeP1FtXjn3w3rW/3KTk6KV84er0mYvj58evXJnsH5uMEz3l1G8HbNzLCeBOgQCY3WlR7opBvelHd2zfsn4dZvdvg8/0An2w5Rbi+HR+9tVj09PTrDpoJTJtOD6+7WMEY+5r975DZ8cf27RyJRxwQ8Bs5+Xt/tIaKXCsW//Y4zvGvvzK1al+DBGkD1US2pXJIIox5pzbBtk1o/qVn3ps57Y1SDMKXZHBXO7t+WBYl6YUAMFE5NwOuYkMu45f+vMvP3Pq/HgYXZH7U8FMwGDqaHF9O384DlE51rHp9VKsheoz33zppx/d8t4dq1Nu4FSIDtFgnO3xWvrwun9n/6+5G2erpzJ7RnZhIANAVoY62kgnrhjtbNuwygkDIpI0Fz8oLEDDeGG4XJ/PSS7QBcEV0fvgIxs3rRu7HZrJAOVkPDI+8+yeI9lBuSANowA8hwglF/34xasHTl12wWBGcpDbWoSva8qeBVIPbl3+4PqRitPZNdzVHwBEKptngJ4R6hE0kx++f/V//qEdy6LUyvBJ0PCl7QlJTRacFkMwiIYTE/6HX335hddPeXcsJQ8WTSC8lRZYmqumIALMjZQtVsZoceTFwxc/v+t4PyFCMTI73IJa27frmlmXMO/4Yl+nBU5YOxtCEFCIGXSXZ7ec6pwqZWQhARLc4RleAsCS53ptNYFSihZz8i2rOj++Y/mIYQGkYN4GqpnKevbQ+Otnp2UhmJMEwhCv3arYWQgT3t31+rmZnGlmkG7LE/wht9R6ATQbV45+5In76jxJxjfN2Q2jBs5W3N8FVl2mme2rwt/9G0/cv6qb+tMKdHprCDD8GkCrcWR0OVOSfBr8y+/s/dR39s7kDjyEYFRWKwd7W6xebhUCNGPOmQhw5azLqfvp7x84dDElVp6Stf4KhlmB8SX8bG6ct3kSc9JADIYqqApuzFAiLYRWX70ViVhis3yFd8ACHTRA+bEd6x/duAbIs6otC8PAmwWIvDjT+9auYxdTx0I0T+2Wa4jfIQl1jFVgrwmvHLpwtckA5FrEzkMjDcwpr6rDhx5dv7Jyd1moCL1F1P3WEeg0wA0eOpG9q7/0ge2/+BP3B8vBAkRzBMLMFkDmjyREwEEmheqZwxf/8OsvnbraaGSF3M1TMCa/Xn94yW6cFUIQ2E+JyJR76O4+fvUPvv7KpRQIY9MjANjStAseLgbA4S7JB9K6rVsD2+l6b4/cJQDcWbAKcHfFauf2TdvuWYY8Q74pRThf3jA7P3dQlp+7PPPUq0d76tAC0Dgg+LAiQHsdZYEC62Nnxs+Pj7dbzll5iUX6xjpJh2Ye2b7h/Y/vRNNmgAi0y/FQDgCExVb+qJma2LJ27JMfeWRt7U2GrIIQkOmJNHGuCDwsKFbKoGcGnbk08Tt//cKu4xOxHgXMqujNDADFWtdseZbmxlmAsrdGEiHSgyUzTiT7D1/f89zrl0gh96K5JL/jOkNvAcroJIQgVmJ0Vo6QEDLMrcqMCaEEgDsJZbnF5L5upH7P1uUjVZ5djIYJ2xShJCgLPtCmDHsOnTl18aocFJQ493eHQWsxycabJjeou6en9MqRC9kT6cKiHdhJeZBbzMnvu2fFx9//YBUD5AEpMlE9KoGc375ckCHLBDlHIn71E0/+5OOb3Z1WQ7Rg10RRr9MAHgoONqLBI3vJ7a+ePfyF5w5Nq0qSNz3mnoXYzz7r07aUd81t86okWrDsSZ6YMx3HL01/6uu7z85UqCukrISB1OzdTTu2R9JMpIMZjFCEByrCK3gFLwHgDmBun2kMfQbk/iPrRj/44CYgyerhpmEwOAHIPbervwsErqrzjZden8qiGYXAwLY7ZzhrwmB58yj3Jng6O21P7TuflUAu4rii6E5ldiQbM39yx8p1q8Y89Q3J0JgSPEF+MzY4b4WSB8gsZk9P3rv2Vz/+cCdQYozBggFGixZrW4jmdYFEoDPEp/ef+7dffPX8TMeANuFEwBlpNXPmQGJqCdM651iQBAuySrRAz+BfP3XgT79zYMZGAVZGIi/2vS44ZCu4TgIGRKIiQCND+w8YwHICuLOIZkoBzf1bl927eXX77R3ql7JtJCUZxEB5lAdvgPzaqcnn959pekKsRDJQnjQ0ZzoMpt8tCATzzNT0nv1HJvpspW8XCxcFI2XBoPzYjo0fuG850nQP9YyHHLqy4PMWX6VSDnEaI6ti83d+8oGHtqwUQgi3I+wZFL0JZscnu7/+mWdfP3wkhvzGN/WOUNN8OwaJQ8bQPXV14rc/993nD16wSmou04favnYnUwLAHcDcV9A9QVg3Vj35wLqxCq6oBXgHCYjwgUBbAyQxfO2Fw/svZHaXoem7lHMWMoe3Oqgtq8oCaOrB7NiFmUOnrg761BcJIgBGySB53rwi/Ozjq9YuqzMjrM6ZYmUkkeezNw8GswDhww+u+8X3bVlpkpBvyyZVEpUns/7Dt177/CuXcxzx3pSWaKvnTTIYbqZS5uiyV882v/+Fvacu90LHpIUop9+RlABwJ0GDZnqbxsIHHr9XTqom5nrDh9iQn1sfJZrBMxiu9PXt3UevTNMIKpkFhFDVcWh2XWrtv0TRjMYGVTw7yVcPn8ZbPPBuH63+qSuIbYI5yH/mvfc+unU1mn6nrkBmMLty04Pf+jQGzZSnVo3mv/effvDBjSsoD2x79Rb8Kbuo2PnWrmO/98UXL/W7DWsIdpfsjltbRHQsMKVetfxPv/HqH3/j1WkbLZmPOcoLcUdRBXh6cMPyRzYv56CYpdnD7PByMcrw2f0ng1t84dDZw+emgIB+P0aQuRFyzpIPZydFAa17aaRg6JN2cQKvHTnfzN7TIiSgCQ7UshwMCFVyf3DbPR94eGudJtBMgwSNZiFU7UjVLV0EWUQz8fOPr/6ZJ7eGGNwBb8vrCz/fF/jqmcnf+twL+0+OhxCctWId7O5ZFgRPbILFmHoTFn7zC7s+/ezx6XYU+O4Ic/Pj7nmn72o46NfOzYrRsfc98vBY5ZEZ7WI9zL0/gNaLygW4BEcDe+q1o8fPjYcqBvXRTFPuQlZroTW0q7d2YpLIbDGkbIdPjl+4mm6XK/DbQMEIukt0VKLVwT724zvvvWdUvStmghloMruRGS1dG9wcdHNSAJEc921c/Xc/9sCWlSM9DxJNeWGn31qvd2imyX/xzd1f33NWFi1PZFhG7Z7vpiaZ5P3Y9Dtp0jvYfyH+mz9/8cUDJ3j9ee1dHAlKALgjGMhPer9e3/WffmJL16LUzgBXw/yuDh5JTkFiFo2nJ/Mzx6auzPQNGcFczAjBWpGGYbYgEQafhrGPMalBJ7x2YerAiXODFVhydwA553x7EuQY9FCwtYokAg3ATz648skHN6Q4ZmKdZhzMANzf8bUg5Aw0jvhVQ5OtBpWlyns/99imDz75YJNniH6IkNnQJixmkdAow6ekpgH7OTfOzz138t9/5bUrfUYzeBOUQzsbfNcsimQIdYIlBjUezJ46eO7/++ldJy5ONUKvySlLQPa7fzTsbSkB4A6hzbRYZ+v6sfvWdwOCI4BCWwce6kdXsLYzkBRC3P3ayef3nWLVgSRFhY4EgwUnh/atUdtkHpidTOwgZygfuTC57/hZAHPyO63w0W3QPpqDBgSjWZi1FrxnxD750z++bHQ0u1mg5R5iYLQbeSkEZoekSCglwTw1D20c+9sf37lqpOPOShlKTht+hzYR4NnRZJpyFcNLR8Z/66+fOXwpxVhBLlYGcXGEtxeA9v1wIdMtNqzpRkspdj73/Il/9iffPD2ZjI48454l3L5dxVKiBIA7BEpSFfvvffS+5cu6LjlsICOMN0hCDeNSFRTNHCHPiC8dOH7ixMUQYtsyMjuKKg1z/98mkmQW6E7RIEMeH79y4NiFRgjWShxe+/X2cp36okjqpx9b/8FtYy5vWMcgo0lv9lp6u0ehIbs0yWUOi96XhdEKv/DhBz/0nu2WvLKKqJENg4V4uM8hQ7lvowwhqDc+2f+dL7/47T2nqhDm6kia++UuYCCOS1FofTxJgAaf7uN3v3n033/xxYleivTcTDE3ZnekdfA8KQFgKXNtL0bSXWOa+vGHNy0bqbNc1rbNOAchYDjXE+Q0CVQD4siFqy+8fjp5lNpVmm/6+0OF8qxW9hygKVtnz4mJM+N9Gt4kerpYB/bWt2ZDrb/90w8vG5HLAzOTkNui8Y+4MbXOrmaUjSqzquRp5skda//uJx4fRb+SGwweaNaWYYZ8606XOUGf6Wf7g+8c+vPvHUxx9C0fnbti+38dklpVP5IQcs4MYdJG/9Vfv/zf/tXLZ5qqDoHq60eFv7slKL6FEgCWKm+RGhOweWV4bMtyQ3IOpIGNPsQyLNtFjAClnBxx3+mLT+87Lotwvx1akJ5p1n5NmTPr7p6T44dPXQLMZ1dWSW0BYsFv5ocgZ23+M09u++jOtZYmXCYjA9vEOWd1hud+g1ZVFAQlmUCaOek5LcP0J3/ioSe3LiPcAtyz2Kq1ywa5+Hnc57VQ1NrMU1aH1EQL3z9w6d98/uUzE2aaa+W6a9e46xEk0HKv6l+6MF3/5leP//efefHCjBBqd7V6u4O/+IYX5E2TcXcPJQAsVQjMmru3m28CTz68fcvqLtQH4IDk4PCbRTLgdINPN3rh4PiZq0InMCzs516YXT/Rmu6KnsXqyMXewRNnAJEG1xwLejPvAKNY7Vi77O/91ANrRnKjKuSGSprLxKnV49WsxAUH2qGSSLhHTGYyK/zko5s/+aH7Ys7uHXeKGSZSlCjD/Hbj18fINhti8sr8yFX7jc/vfvX4pRCDyzCITPO40p3A3MeGIMwoGJurE71/89kX/8Vf7T7dg4XwhkrwnA7u9Q9y1xRIZikBYMlx3edLgM+K9YLQ+x+5f82yUeUkQmy9Yd74gR0Sypkxnrs48c2n9ntnObwvT0N8/LfSBrpggTkLsBCqGGihl+Oxs5dnJq+2KXYOJqSwiBsxh5LFCulvPrn9p37sUXdWkCHPOcXTOLfc6LpJPQIwM3hME3B1R5f/6s99+KGNo/LssgRDDM4sJfnsg936s9S1fwfBx4P6Myn8279+4a+fPVIHRM14qAf3fHdM//4Qru0bBFJudS+u7Oary9O5ycZ+/Quv/Ms//e6Fq32b87ebffE4iN3tmLq4iNLkC0MJAEuO9gPosoyKuV/7tKybw9iWMX14W6c2ykZr2AiAUMHqweI5vNH2IEUA7L52dmrXsYsZneCwhZxLGpQxiMQoIqiXZRlVUB/MPzjWO3ElG5u+O+FOOvJwjChv7W7pAfLs21Yu+1985P6dqzWNEQuwPAV3CwD7UJJbBkUFuqkPnyESUuNCE6tKM598csPPPXFPhCvUMaAKjAiBEazAOFvDvLV7lDwl10zyXmqUZ5STC32GP3vh1O98Zf9krl0O5PY0eXfD68CsaiihzE4PFcyu9PAbXzn0X//uD3afmZwxSzl57klNa/4mCHIo5+xJaO6uHFAJAEsTCpJZu911Cd48tmPj1rUrAICVwaw1q5q19BmqP7ubxYle+taLB6c8Inmkgi2gftZc8BKodv8MZoBSIHa9fur0lWkwsP0LkmP45og3Tjt4QTPP+WPvve+XP/5E7dMzyRFHPVtqcm56rZAnvQkM7p6znHWDgBBQxdSPj24Z+1/+4uObltfuRoqcewdJkkbMx/xLoOCSixGS5+w50545cO7ffeqbp6/MhLoKwTJIM9zt2/83QMyWsjwxJtYEAm3a46e+88p/89tf/ube85P93JaLJWTQZaLBAoMFKmoxNx9DpwSApUk7gCSYyQzexDT9449s3bBmRaubs8C4jEcv97+963Cv39oFNp7T7Z8ObXM+J89fOHB63B3BTGAAIuIifnQJNhliEPLyqL/9iUd/7j1rTEhhlJ0xyKp6pFUPqsw8Ncmh7hhiVx4UK3la1wn/85//4Id2blTfmyZn5dmnO6SVhXRWIGsDTYxRoTp2qfdbn33uhdfPWaf2/hQ9h6r2NpIO3eV4adPKdxMytsGPVGqs+9nnz/yj3/z8p77z2oWZyNBhStafaT+GGXSHcjL17yY16RIAlhwECDFIyu5yC6Av6+qJHWNjddtLuMA34Dnl9NT+CwcvNFmIkSGEIaaYbpYUus8dODM+1Tcb1EIALaJipcth7arh9P7jW5b9rz/5E/euG9PUVTPFump6fQpBUm4gt84IYJ7djME14jOf/Nj2X/nozuVKdeyDIioAsxXjoSCnox07yMkRLyf80Vdf+KvnjvTiMvMc4cmdINsX9F1zAJhltjuLFODu7nKH1yt3n8n/zR8+84//+Jm9Z2dkgPeYZ5Sb1kbMETKqhZDgXSzunmdy19DW/0wOT1lsF5v7N6154J4VAG5HE0KwaeBbu/ZfnM4M5mkmM7KqFyXrQgJh5JnXTl2e7BmYJKFJyou4ZyXMgrkZadHcejMfeWTLP/zbP7ljZcOp88iuWKcmyxMDEaJc6jeVIVri5IX/yZNb/rd/5wNbV1RQcDRVJRv+e0prY5RkFpPFLz5/9N994bnLqRJMOZmBFvspyxZUcugOgIN/EemdPJERj/eW/dZX9/4ff+NzX3rxxHRYoVA5zYRoMLM+Q76Lls2755ncNcx2DorMHtqzZ/PwfZt2bFoJNQu6/s82ysWjZ3uvHj7faxSR1e/1suVWcGKwV7yNO0YJCkfOT5w8f3kgkp+bxVOqafvpc2qaBnSLSk1Aszzk/9lPbPv7f+Ph1bU3IDvdUEUgt0cVJbcY6E3sT3z8iS3/8Jd+7L3rVlnTNGK2MQr0qTddYv4QHuACGaoXXj/z25996vBEBxYJj9Ga5JmV3Km7J5txs7TqUrONnyRF9OhTVH9a/OLuY/+73/7af/sXL+w+10wjGOnNFLyJ5A0vmsPL6S0YJQAsRQQBmWAgPXtl9tCGztpRauiJGA18VAdiAGyvbS/sOXz8zDjIgFzVMcaufDAgNrjB2wYBcqpv+46eb1IKEAaFy9t3C2+8G4iqYwiSy6zTjVUVAtZ3Zv5Xn/yJ/+p/+rNbV3f8ypUmI3RGXGaxggXlfidPfvyJ7f/n//IXfvqxLey5BTIIiFJESG+6xM2iQd/i4G2UIHeoH4JOXe79mz/+6vdfO2WdlQGiN576CrVoJg9LfoVaaCQBIulCEmNIbC5Fy1y2bt+l+n/4zHP/6Dc+/dfPHL/YY6hroBfSFJRmX+W297f1BHUoS97+A2CoOb2FYtHcVgs/HBEmUQy10kyTH7hv48fuXWEKzjjsD5QrN2J0hgYMYIRf7fPpvcfPT/ZRr8q5Z0juPjD/0jD1n28ECcbp6cRv75v8lb+Bld1+zztBDBqqEunNQFWBMAlGoIvgBD2P3DOm/8MvPfaeTfy9zz//1JHpi+MTtEbT06GuHt+x7j//4KN/92OP7NxQWQg0gtYm/lVVUHXrdyM4Blqx8ASYQnAAkOX+lX749S+/8qe7U79eH6fPwSpZh0Ag6VkWBmGd74JJsOtou55acZHZeT2BJnSyEEJHDZD7FdFP4Suvjr96+utfenLr3/mphz62c/PyqteoYVYEsnISqlCL7Wx+nn38iDaRu5jP8oYoAWAJQskBUkoSpHvvGXv4oa3CAqhg0oTYthyGnEMwI185Nv7C0cmEaMqGJLlohKC8KHMwVR37V6f2HT55adJXdqO7wuK2LbaiD20BkQBMECxG03JPv/LRR598+L4v/GDvq4dPT033Ad+xdf1H3/foj92/ZkOV1Z+muu2+UBLIgfbGfG7G3UjSxAiKyvSk7JPq/vF39v7+Xz/Tt1VBHox54BAutnMj7dUXfbJ6kXiTtiDbDlHNvr/tHB+jOp2T49N/+KVnn9/12ic//sR/8tH3vG/rsmXWS6qydfpZcER6ZoDFWf0OtraTuPF00SJRAsBShKDDgsFAj3hofWfD8g5ypg35TCkwWzDC4MakTMT66X2nXzx6WVXHPEd60qKmMgVvGlk4cal34MTVbWvXWfBFH8fkIBeE2ZIIna4sg7M38dAK2/mL75vsY6LXdEeq5REByjmp6YfYufYgQ3orA12wRohmVJYng6PufOfVS//yc68cvxq6Y8oz02CAvdG3bL5qQ3cVs7WAttNsENxpyDlDsVq5Zc+lK6//5dOffv7EL334gV/+6MMPb66WmTpMTfKEOgQBcDCBYbD396WfBSoBYElCyKrA5EmrRuoP7NxWtwPpC9CKT8LRRpYGjOcmZp49cGayb6FbIc0wGgzwLPmijAsR8KbHevmlhi/tP/rxJ9bbYN+6+N+s669PGdFQTgukIefRoOXLTWqQM9xDqFLowhhm5Z2G9ATaDbybDIamEaBY1XtOTvyPn/n+q2czR9el3nhF9X0gSlf40VzX50DmXoQQu01qZCOZ1a5D5w+cnfj00wd/9tG1v/wTO5+8d/XKsS4ApT4AowVW7VHd1TYLv901dN2VbgtvEtOdowSApYqZp35/prdp69YPPrQZnh1mw058EzC23SpAzqi7Lx45uev1UwwxDHpEogB6WqyVQ0SsmBmvTueXj5ycTO9fWRnkS+twLSj1LRpUCxTZSIbWcx1kZJQU2wyaYZ5Jn+uu2g5EMMKzqXEPMsuhc/pq+tefffZLLx4BV8OnwTbBrVlxibLrvyEEBSiql/pZjKCJoe50e329fPjSvuMXP/PskU88tunv/dQjT25ftWrViooGNcg9CNlqmf3Qkt21TcDstYb8zX7T/ujtV3+UALAEGWjKO4OSVfHeHVs2ryG8B3SHvwbLIdDongPjDOIzh8ePnL5Qq0OXzJKiywMbMvgibblN7pDb6JFT42fOXVq5eS3U3suScfAgLIYskpZdkCpTapJi5azCQCTUO8wQyWHddpvClkAaIBCZsMt9/sevvPBH3z88xZGQJtp58l6GLBiXxMnpToGki4l1ClHZCJlB7h3rI4QZrw9e6Rz7/snPPfv6++/f+Dc//PCT96997+bV9yzrAH16Tm0v9w99tfnGaw353n/kf16jBIAlh0CClRqxs2ys8+EH1o+aS0aG4W/D5RIEo0sxnLs888y+81f76lRJMoAZAmS0Vq7t9m8eCWRVMiHq+NX82vGLj2xaKc+wpfXRHRgCQFUARUqxMhGuQe/sYPFVgsJQl2AmgJmBiUIOnc89ffC3v/Ty5V40wCwRSA6AdCHcfXKWCwgBMSREF80IyF2RzE4px6jsTco8ncc+v2fyay9/fefmVR95dNsHHlz/5P0bH9i8ZlV3cEpt+4zmai/Xm72ZAM4qX7Un8kERuv3CGQDo2o/MBXBeV7R42y/ltQxjW8Pj7G9aUdP2hlrZx8LSQhJReW8q1fesW/7xB9d0SEcUf2gi79YhPWdBNJJ27OyFXa+fVr0ys2k/XgYHMTv6uAhrh4DMUcsNvX/iKl89culvffB+wZZgMvtab1JbPWx7q+YmTQEwgsP/xiWHKZuc1ei3Xj35rz71g30XPIYMILFqr7+U8mV3DG2HKIFw3UiXi2AHRPvNiNa2D6UURl453d99dM/vfuO1x7et/MB9q57YsvKDD219YMem1WOxrQkbpZxd2VMDqxmjZE4DXWpA0F1tpWZgCGeAzQaAViNGVMZgjwG4+EOOGZnBZYSCBMgJk5zw9kFm9wElACw9CADJaeY71ne3bFwGIzLkDhvu5hFgEFzKFqpeoxf2Hjt3/gKxYolliV3wGOLUlfH9x85Op9gNvnhjAEsLAcEUvG/uL52c+B/+8qWXj10eq0Ijc5jhXdngeRvRIE6gw5TcU91pYv3CwcsvvXp89YqRHffsu3fDisd2rHv/A1vee989G1bEDr2ORF2BgJrByuyKnmWRFgA4zAlK1q7UlImD5lQY0JpxG0ytuw31VmksGZytW5QJkkkIgTIDIEduW5ljCQBLEFKA1V1Nv2/7qnXLIpTlTgbORyL4bZFiiE2vrxiPj1/52nN7ZhpntbRWjbbFnSbEzuFzkwdOXXx82xppsacBlgYUKp8CeXii+hefeupbr5xWtTznCVAoy/9tRNkHUiqNsbtG3dUXPV04reePXfjrXRfuWX7gnhHdt3HlY/dve3DHpm2bV2xebisrW1HHkTqDAJa3uZwMuJSVCQvirE7UbArWk3I2s/ZMx9lpkreezgmDt98QeasgIMJzMLa+o21eqASAJUirVBvD9PQH7183FszdjQuifykQ8EBvgL3nJp8/cgnVaGs32Z5slwJyGLKB7Iwevzj12pGTj29fU5a2FsGZ+yf7y37z6wc//cyhXr9nVvcxSmTKS8H3tkBAfQ8WQ7TQNDPm/VhVWcmqgKrby+nYuB+7jOfOTXb27BvhSyMxb1+3Yue2ex7csOrezau3ra/Xjl4dq6rlI91lo3GkCvUgcziXulOrOeE0hegQxDn5Fvpb+sragkUGjFU0yJIQDCFkoG3sGzxyCQBLjrZak8Sta8fes3VFDWTRgjnMNS+bkLe9mPpNDLzc6Hu7z56drmXVYOFYSAuwm0IS4FSG6tOXrx46c8nxQ1+HpXLTC4rm9n4AOBlW/9kP9v3O556+1LMKoJKHEQxetNY+okTLBUUAVHWa1DA3VZB5w16POdVoYKhZeeg2CFno9ZrG++PSuauXXzo6ycqyOBr0wJq4ZuXYpjXLN61evn716Kqxas1IXDda1XU1OtId7XRHR+q6rkZMoxVgN9JIZghK0ERvJmXvNz4505tOncmZ5srkVD/lq9P9K5P9EgCWCsTsFDpIwpzvf3znptWjnl3tAdMyF6D1pTXampnuPb1r33SuaTBlMiy878AN0yp1eUbVnZoaP3L84uXptG4kDta/t2x97n6otgzYtoB+fveZ3/7sdy9fuho6K3PoRCDkSTcDqEG/eWHBYQhtqj0E5NSA9FBnr8yCmQlQSgGNBWarQgjZMZMySDA0ic+dAk5Nwq8i96kmwlaM1etWdOtOtXy0u3y0u2rZaLfTGQvN8i5HRkej0ZXbkVF7q6GDK1sWOTHZv3R1Wowz2a9cHp9M1UQ/XRqfmJjuj0/M9JKXALD4uLuFSpDSDMkQ6C7LMx948sOrV4zRp2ndhBiQ2XYFDPHSkOiW+7uPTe45O4NgFkzZltK2UWRuQieIFXM/Lnv25PSRUxfW3X+PPNPMBcIckBAWQFl/SZGTi3AyaFqeWS37zt5z//SPnnrl+GSsRyAXgsPt9pu3vbuhoKYJhAVmR0YgDTAFy4bkArKFSELuIHMGgCoEdyey0ZwBIIPJOkCHZlcyLpxPUIImoQwXkOFo3WDbJs7BbPdb86GD1k8NJNyrCgzIycyDQTTQhBp1KAFgCSC6QLpZ26HFDK5bxvs3jXViUMoG5fadGnqCQySRUH3j+dfPzwAG80YhQEvHJ4SmlBDcWfWmgXjw3NTx81d+/P4NgEi4a3ZHjLs+A0RDv59D5YB7qF88Ov7rn/r+S6+fRL0sy2eLiHBGzM4fFG4Ds5k2ygUhMKhVBpIzt39KSHKCNJ/bsbM1F3CJyK5r0nTZ3YiKGlTiGAHMOsdd/yEXYCAEf0PQl0gb1IfVXkEMURzIGEIgJaUSABafEAT14B7qOiVvgCw9vHnDvatGgQSYAyBccehNQBTM6qMTve/ser3Xz7TI1AsVm0WTfngzFBgsJGVXQmYIVy5dPXRuMgNm0WfzIEYNT2JhCWPWrTLytNejRybqf/0X3/riU3vYXcVre8D2FfCl8v69S+CgqQZoy2dqi2hEu9bPhuJB4Xbw1sz6m+K6keH2b4podapt4H3USpNe+9nrQ/vsX3nTkb3dw71B+m/2AaTZA/6SElR5txKggCwhOSUaDE3/se1r712zTMpgpWCA5sr+QyUD/O7e4/tOTwORRpqQ+ktn9RBBZQQihCpaFdiE6tnXz54enxHZuERKki++ROhtwIEmN4yd0xPhX3/qmU8/fWiis9qtun7vd9cfg5YqfNNv+XZyf9erf7/hBwaf3rmJs+t/fbtLXENv+Ws/Er3hcUsAWERmNwKeAbmFlFySwTtRj2xfs7IT3UEzwuRtR/DwFUMa8Nt7jp+byEbAAVjOvnS20gQ9JxlpVsmZG9Ujzxw4ffjUpXZongI9y4XrZNzvVijMJBvP3T/48ku//1fPXkm1hxE5tIRSdoU7iRIAFpHBUpVpCRWsAgMJpukdm9c+vH0TAGfljOaq5MEzh7260cL+8/1dx6ZzQvQepMatzUkN90K3jCDK28l3977nHhAOnZs+fPqiAzJzCGYhWBu+7uLNrwBTH536d77y6m9++oVxHzGAuadhu0QU3j2UALAEkGVGZ4QFmnkz8+jWdfdvXgvPgGVvbZwy1Jtd4+ZxKV07aroE4AfP7z9wYtxGRoNSUKZVsHk4FC4ARspbg3VZCGLVoHP49MWrU42E5K3NCTwl+hJqXp0/mrXi0WwuN0mf/dYLv/kXzxybGkXoRKVONZt4LhRunhIAFhkBATmAcK/QywyNdT+8vX5wNbNYGWKrKhYiwsi8ajZyeEo59bP3HEmgdNXx1OvHz585VnWrRBp6wZDz8J7eMEg2YjBDamI3M0T16PnbB6d6/abD3LRrvzJh4N1TCBDgufFm2nMzk9B3V578w2cv/T8+c+T181fNpkyTTncv3+HCrVM+PIvMrKyrAJdLOa1dtfyhrRtmzYR0XcXolmsAA91YAWZGM8jpTvLw6andR8ZZdbO3vYOCZ1s6JeABc4qaJrX9dNp/7PyFqUSqtkGPdCsQvdRu/ZahMoleJjxX6vWTvrTr1L/606/vP3S60+2aEinQcva7u+xRWFBKAFh8REJO0i0i9e5bP/LwfdsxUDsY3oJGSiaYSRWTqQ9i14HjLx+9YN3lniUER6AyucSOANfBgagVL41PvHzs8nSjCgLmZJbvnqVQgIN1VXvqx4BnDp77tT964ZXjV+tOAM3djKEdkb7W1Fco3CQlACw+tEC5QbRI9e9fW23ZMDrUZr5WE1AwJlBwekPqzMWr33zx4NUZZLRJdmZGEEtdREwwsofwvb0nJ/uJaBQCWwX1JXd2uXUSQ0ag96zqPH+890//9PtPHbiYQ8fd+8nd0HhOKVkMfDstgELhRigBYClgkAe4w1aMxPdsXbU8YNbFc3g7uzbRRJAGTwz1K2cvf2/fKdQjSD2qabMozrhkd5ScVUwyaqbhswfPTaZEpCzBBU9L87ZvGgGQoAy6dXedmvm//s4Xv7LrJEdGU27AEKuaNLkzBLnkfhcFvsJtpQSAxcclgxtcWetWr/zxRx+qMLcFH9o3W3B5HvgSWj3l4flj/f3nZ4Khi1SpR8hhGVyyI1XCrLYl6eKh873jFyZBd7RqLH6XJMMJgDGnKvjTxyb/b7//ja+8fNqtE/NMZYCFfr/nOYdQhdiRBQ1mTguFm6YEgCWARJJGpLRp9bLH79vUancM+SokKUqNOwwXrvR/8OrJfmOWmxgY2v21WqmQJWO2/lbUTskDIV6Z9lcPngVoDoE3ppG7FBEkSa628TNDUKOQ9p26/I9//0ufe/aIOitNmbmngeCPxaoikXszJqct0RNbYelTtIAWGUk0ZoSMyNA8vmFk83JlJbEa5nsjiQbB8oxbx5DPjE88v/+4hShyygPMCZmaVmF4KS8nrYlNhd70ZPPC4SsNR2s1DTseKrtTU+F0gTmJni0kWNf08oXp/8+nnvn6roOqlznkZkGRMCGYSS6gHRwcaD4WCrdAOQEsMmRrBS33vGwkPPbgjgDKNWQxBra6VEaakT2vntt7/OLlK+6ZAzERa1VKxIGG7DCvPmQEsIoxTU0dOXn+0hQt0KC8tEvXPwrPlhuHSQp52pBfPNv8sz946q++sStXIwi1J4+xBlvLQc2dDgmyaH4W5kEJAEsASRDcN4yG9+3cDJKDnO4Qv9qtJiHb6YIzM/7lZ/c0SSFeP/Q7t5McvujQMJEApJwRwslL03uOj7ssKPn856QXCYIkLTjzjFXV4UtT/88/+PYff+f1KRtNNgangQGAD94gXlfzLbv/wnwoAWDxoRw0CPeuqbetiSDJwKE7MgpyyB3w3ccnnjt0OcmMd1L+gAO1XALK7tbtnhrvv/D6CTcYM+yOeSJvws1SCJZ71qlfOT39a7//3c89dVTd1bSxnAARkqcERFr5whaGSakBLD6kDCFW9t4HNq/rBsjZJneHiSBYCG33+HdePnVyqm5cwZb2Zv+NDBZ/AGCs6pT83OWpl49f7smj98Dqznkqb8CFBCiOPfv6uX/650/91XOnoRiU+p6rugOXN43aKYdBmqsIPheGQwkAi8P1tg4ByMohxA+894GxTiV30SFyqEGAhuQwC1fGL72w91DfR6rY3LkZBHdB9BwOnJo4f2FibJUaVwh35JE2Igfqi3sv/trvfPP5w5etHlVu1PQqgc20XJHmCEkMJeFfGCp34vflbkCYszNnluBh44ruzi0dA7JaDeQhrv6zYkOeSDx36MK+U1ehTCPCHbmRFJDdq5qo4/ELV4+eGUfoUHdAD1A7sgZll/pAT3Lv99V8Zc+Zf/YHX3t6//lUL0upIdxoZlTOgEBT6xk1+5lZ5KdRuFsoAWDRmOvlcJContixcVOngssDM/JQv+QE4KJZdtrX9oyfuNiHUmp6Oaf2XpZ228/b4sx9Mp0+f3n/qQlwLGiuIWZJPxd35SxIOWeRk0367NOH/9HvfPvbu4+HToV+z8HsSVBGUOjI6gzCaCy6b4UhU1JAi0m7rSONPvWe+zesXL4ccBMcHHR3DysLJFLZGA+fn9l98HR/prGRbsw5paQYbTavvPQhKYmAg1kI0SYnruw7eXEqsxoMgi3l/LgIBigzIPdGvD/RdH/veyf/1Z8/dfTkeY6udFRyt8Aw+5bMWcQCmBXCKBSGRgkAiwnZqkFzZbf3xL2d0WjKmTAiaMgVgLYPlM8ePL37+GV0uiBjNDMlzRUCluy6eY1rLfA0BVKo6vrlY1f2nbn6vs3LNfTWqSFDQLBsGSQv9fDvv/j0v/jCgeNXYPUKoQZonYo5KWWYieGNz6as/oUhU1JAiwwJCQ9uWX3/mhEKghtAD8PVtRFA8Gpj39l74dR4nxD6/ZSUfW7pX8rr5jXmitYSmpRyasyqFw6ef+XEhUGj69JGpAsWw8HL/V/7s5f+yV/tP3cldaog1moSQ4C758ZipN2Z9ZnCHUUJALeP2fGu2RagQWmWnvHYzs071i2X+0DpxjD/FVmDrf3s7CjtyLmJ5w+PZ9UxT0VTQp0Ur7+xpc+12rgBCDEa4CcvNy8euzqTem00XRTeQbupzeQILkyxevb4lf/773/rf/zya+e1EozWnwBk0Ux9NTPBzGFetvuFhacEgNuHZj3dBVCwNjEjSX7/1nvuWRY9JydEo1o3mHnR6ma2o6Pt/+zef/SlAycY6y6aSkkMrLtoJ43me7XbBa87BcQIOWmwke8+c+DM2XOgtS+xbvuI7CBjN3vNa+eUtgWLcIGEiG+9fOT/9Ouf+bOnjs2gw95V0bJ1g3oVG/Sn6qhgbJqc5mP/WSjcGOVDdntxUAFkMs8huSGzvndl/djaGqwBD+7wvvEWUxlzASZLkLfyni4Y/NKMP3VoYvrqRajpheVNvQzIyj3ccT1AhEkBoucmhxy61PTBQ0e+cSQ37kLuAe4JaSY1vf7t2kj7QMS/gffkM1Q/q5mkep6VnD0XcbLf/Luv7/q//O73v7NvPLMT6eaNKymEwAgEMgpBQggxlu9mYeEpReDbSLtJJCUXJSK65+QPb1n9yMYVDjAYlQDJrht6vakrzP3aDhOAEh0ys+Pnrz6972SMgcH6OcBBzURJjHdK/meWtg2ob4zZ6sYVI670/T9+87Wf3nnP9jUjyiIcSmA9/4PUDd+UuzeggcFFtgKficEyONVU1b7z/odffe0Pv7zr8OVc1SugLM8IQRC8GRg1WOUC27OCBrMipfOzsHCUXcbtY6C0LG/F3+AGgGny4R3rt29YLxdJWJBVGWHe33pP7qCIDKgBXzt+8dXDJ/vswCKZ0J+21LM7Uj+NAOAywIzIYjXm3ZXf3/X6F1440ierPO1pOqMyq8JtWT4FUQ1oGaGH2GPowSCO9PrROBHqbx4b/7X/8OV/+WfPHr9U15VJc67Laruz3vDcOPuoKKt/YWEpJ4DbhwYlTEGiAAR5b3knPbJ15VgdUtMgAKyczK3q2Xx2ryQYJEGZFs5Oznz1xQOTufIQvekTqCqELMnvmPrvLBScjBazZ5gzhpySh7qf9P/7+q4fe2TjB7aMqslgAKnUo3UWuseJAGhozcnMK8BTMnMuy+dnOn/+/eO/8emX9p68kGIgJlzhTum5Ktz1lBPA7YVwKCibAFZy37F29P7Na5GzgTRzEaDNW9XAAJHZBU8kj16a+u7Lh93qVmeUygYwVnfc8k9BICSXg0Y5lJVz7jVi5/lD47/92efOzVSIXdEcsLjgqz8AgVlBYieiVmPNTMeUhKdO9v/f//Hb/6/f/dbuYzM5rgxK0afvJP3Vwt1OOQHcTiSR8oAMVM4azvs2rnpo2zq5RMsyEOZuSGQAbt3jkHAwtmmlxvNLBy4cG+8rIcRoFb3vTSJDjSH7ztwWKAKJMZhZTnKv6m7KCUwzmZ996sDjD27+Bz/32FhuJMy4deKCP0cCTgbJU9+AXHdOXPXvvnz0X39h7zOv7Mv1aD3CZmaSoYaGPeJXKMyDEgBuMxJ9kPQlaNi0trtpdYUMGVyKAJEBn+fhLEugjA74xHT/e8+/NtkPZqSc2V2ABYWK2Yn8zg+3ZJgTRSDNhQAFZOQZNSlWdbJ4djL/u8/8YNuakV/68XstJ0nXf8h182rK1w1JD5r5B7Y60myeji6QDs9G9tl56fDF//j1l77w9P49Z2nVqhAtN42o7DSrwMxi41hYGpQAcBshmRu30A9jlffVv7xi+dh77900gqQQI+a0fyIwrzSxCw1jrT41jTh64NLMs4cvNz5SxQy5ixYCAXi6s/o/r8dad0RGWMgCY3QAJna7r5yc+Sd/+XIYXf6f7Fw5ki7LVvlAJoiA5DK2KfsboLVqh4ztMEVm7mdWshi8AQUFWZxJGuEUEQ9P8i+e3v/7X3hu77GLCTF24qDHBxZC+9pTunPm7gp3OyUA3EZkBtKYxSxBad2K7sP375j78+tyA8MZA6PFLPvei/vOX5lh6ErpjW0md+rq38LBLxwksiSmvlixM/Lca0f+u9+9iL/z8f/0A9s6zZRUNaoZg4HwPkPgDR6wSCMEugDCRQsVvJHnHmrATN6Rj1V+bnL0m7sO/dk3Xvr2vnNnJy3bGElTwnXvJQ1AyQAVlhAlANxOJFhryiiLUX7/+pEHt65YEP1Kd4A5h3G35145dPnKJDrdwcTX3bj+cKCqkUhmmFVjz71+8Z//2Xcn7WO/+v5NFSyoHR0gIngTza9q56QFlyizBFiovMlEP5pZrC/37dVDZ//kqaOf+cazxy9Na2RVBhk73sxweHKuhcJCUALA7UQOIbuF5Ky6wZ68b/2aLrAAvZgUJGWrXjo8vvf0dF8hmIbsMrBEGKTnRVonVjP9hNBNConLnjo0eeLffuvE3/rgr/z0YztGG6YpAilFxO4NDog5mAFDDsokkCFBZlUUGfqNf2fPsT956sjXXzp16NT5ZFEja2ABMauZ6JrlkukvLG1KALh9ECCDGaSsZKOj4ckHN3fm3fH/VoyIhCH0Q/z683sPnOvF7jLmdFcvRgSQGUGo6VvVRewm+dEJ+8d/+tyLh879g5/Z+ZEH140GCEgIla5LxWhWLamt715nw9Ba8BoFJTVuVc1QuTfjU82LR6785ff2fvmF469f6PcaWBwxA+Rs+vJcR4Ku0vJfWNqUAHD7EKBBEcAhW7Vi9OGtqytL0pCFfwVATvLs5f5LB85cnkY10lHvCkK8i9cjSb0Gse4G5dSbQogMFbKPT/mffOPVZ3a//vd+7kN/66P3PrS+O2ZE6yqMgUDbwGuRBOAUB0IaIiB3whFqhnix35ydnn5x37nPfv2Fb792+sRk7arNwmiVGkPKyeDRiBCSM2UPt0+JolC4FUoAuJ0IojzHYAxxx4aVG5cHYgHUGARJCHHPweMHT18BDZ5p85eXWNoQiFXOqoPVdcg5icE9V97zuOzA1eqf/OkPPvft53/low9/4skdD27srFuxevBzAlyaa4cVYWZGgAFAsKm+nzw//eqJs9999fDTrx7cc9bPTcrVNQajW+pJyQNCiPDUZNHMYQgVdCe12BbehZQAcDth6+udwY6lD963fk0NBxKrW5/4evvLAETjeO7gmX1nJ0dqc6QmjJrSnd758yOhyUlvMsGAYJBAS9ZBToFqHM8cm9n16X07vnXob9y/7H2PP/DA5tWb1yy7Z/XI8m7osN2uiwgCLs/MXBm/curCxOGzvZdPTv5g/7mXD585d3UaNFowhkBIDSSE2CC2ZwqANAMQIC+rf2HJUwLA7UNtez+t3+RVI+mJnZs6nQ48hWHrcQgIFg+fm3zh4Jl+wmjdUTNt0ZHvblPZ1hFy1v0SFFphjQjJ0DZtIvX7B8+lAycnqu+e2Lh+xX1b161d0VmzrLtqxEx9wVzqOy9dnbp08eLRs1NHzk1fnXJHByMjNtK11FDNNQMY8o2v6TUhN96tHVeFu4gSAG4fBN1zCGbGTSs7Ozd1jcgLMBUkdzN7+eipF/efRjXS6zuzG6Yd9bAvtbS4rufy2kkn50RSTpK01oS5p44ai0cuXjly9gqyDd4GC2hdhWmIEQywCBuz0RAIeVM3vdr7PcbM+prpyw+/nYV7poXCUCgB4LYiz05KfHT7ho3LO1CmOMzmfEGEkVONvr/33JELM2FszPszlYVIa959XYlzTo3uTtLMBESE6Nbr9WIA60w0oDtjZqTopOBQH7DgyQR3AqyooOTKZCx7+8LdQQkAt5VACPKcnnhw4/pujZxo1ZBHQyWQRy5e+d5r5xJHQ38mWPCmGXar0ZKGreJCqxlkRtLdpdYbmUlNox6rWNUj/SbnmYZVN8SAnCRZq9dN0EBGl5yQQrZAjCrAvH8zo2SFwtKlBIDbhwAzCR5Hxu7dsqpbZyWBJr9RZZp3ZjYhffD4hVePnWfd6eSryTuNdZUT7N2yb73eol2zLf/ubmYGOILbKKTpRkiwboeU9/sUCRlFkhJy40aYRQDoe6IQEWrwDvJQLhR+FCUA3D4IOWNi/eiGZQ+tyAATqwAZNB/tT28dCAl3ADL65Wl9fe/4+GTDYEaDksXK0zzUpe9kvH1dpPYoAMBgJubcCIkQlSmhCo4g6JrkKGiCIdMF5IoGKit5K0BUKNz5lABwW3FWnvQT9695ZN2IZD3GEQh26/tJQbnVmEdrI0aQpy+Of2H3ySxF9HsMWYpq+G4dSjIztB24pAZHAwGycC0gCoBg8OvKMWz9GByiUahKU2fh7qM4gt0+BqI1aWbnjtWr1q3OrSjcvLIJAhBpoNxFwIWMsPfwmePHT7jLaO5yV3Lpru4AfUfaMsDs7zEr7j/7p9f/Tc0GhFkvgHfz61a4uykB4LbirrUr4v3rRw2GnKIR7bJ9i3Dw8y6aQe60i036xiuH+xl1t045C4ixkuB5vjaTdyjtpn+uEtCm9zE3LAC8YYnn7D9vl+eZe4Tbc+eFwkJTAsCw+eHLLGne7z1wz4oHN66GjBZqg0Pza84UlEAIBnigjl3RU/vPNSlLTKKFykIIIVh8d5YA3rxev6E+/KaDAN7yH29kLpYM8/4KhcWjBIBh86bd5HVLBiFkv3/L2gfuWSWahQCX5/lvJ0laazOV5U/vPXPgfE4uEVVd0dg0KblLpXOxUCi8gRIAFhABatUmbVYwoK6337N6+UjoubscyKDPs6m8nW0VAFov6Zvfe/bStEJduwsyzy4oxFi2rYVC4U2UALBwiEBGbfAR9QA2KT5wT/fD93aTYC7KCUUL4rx6sZzIRqgBevtOTe4+MZObZAgQ3TMgMzOH0d7dZeBCofBmSgBYKAgnXRZIMTWyIMe9a7pP7liX2KpHcla8bD7vAkFKoATrPv/a8WMXplBVkAbSo6AB8kxI4F2tBlooFG6OEgAWjtn8P2zGARDW37J22aZ71tIhCzQbzjyRzOQM8Wo/Prfn8NWr4xbszYXlWQP14lFbKBTmKAFggSAkuQiXu2Kdch4N6bHta0ejwSVRpGiQbnlXPvdj5tkYnj10ZtfhC7EzwvTuU30rFAo3TwkAC4UgIFHJ3S3UyHn9Mnvywa3tjh1EP8E1aDi/NdoflBA8N8C3Xz352ukJizXsXSP6UygU5kEJAAsFYdbq0BsyI2Bb14zt3LoKSAZJGij4yOdjCqn2hyPOXO49ve/8pUk0jc/lewqFQuFHUALAAiEaQEoKIcLJGDetXb52zCA3gGQwGmdNrOZBhsPC4eNnXj18Dp1RSjml0vBTKBTekRIAFoiBAL1bBYvIeSTyxx7ZMlYJrECLREUYyRCgebwLQgVrFJ87fuXo+fG6ZkCDeSWWCoXCu4USABYIDZowQXenYUWXjz+4NZhJ1m752xV6nmu1oGB27Oyl7764D6xzUoihqkrLf6FQeGdKAFgoBLiM8AwYfeua+PDWZQQBtX4iGoobsCTg4JmrT+85qth1WE6OZqYEgEKh8I6UALBQCAEIhuym7DOPbltzT7dCm/HXGzry57NU0zjtevb186euyM0QgzOwHTsoFAqFH0kJAAsHQ4gGh7tZfu8DG0fM4PbWnM/NLdW6JlQvieC5K9Nff/FQPywLatSfZhxB7JQTQKFQeEdKAFgoSMLN3AGOjXYf2b6mGwZr982vzdf9EEEJg+4hSnj50IXdhy8idjtpIuZe8th4LCeAQqHwjpQAsFBIcGUAFmz7Pau3rOzABs4vA2uwm2DWnMRdUiZJekqQ93L+0nMHL82ASHLvVBGeVDysCoXCDVACwMLhQCMyuj70wPaty2p409hc5v9WduiS+yC0SN6X/OzV/tf2T/RQBXkTxnpWE/3ANMznUSgU7lJKABgyc/5TbMu8FplnHr5v9aqVy+W0+bT8A2yd3aXUNLGqs4UXXjt68eIlpcbdW4NDM3Je8qKFQuHdwryU6Atv5ZpfoFyQpPVj1SObRiujJ4UAQLeeoCcBePYYzBWmwO+9fPDi+ARDRQ4u3Vqfm5UYUCgU3oGyTCwEA9NxQqmf7924+t7VY0AG47zFmAlHgBvh5MEL+emD472Uq6pqV/x29S8UCoUboQSAhYJEMMLzw9vv2bJyFJ5oUfPr0BeV5WZS6ov49kuvv3pqmqGWJ8klmdlcMCgUCoUfTVkpFoK2aUegUHXu3bxm5SjR9ARgfs7scgZSnghM9fTsywfOXukxRKi1FVBbgVCx/SoUCjdACQALBYGUfPPq7mMbOkY2rGnifHNAEiFPiNh74sru49NQIA0cPLCknHMJAIVC4UYoAWD4CABEsyQ8uHnlY5tWwJli7Z7BW5oDm4WUAIvRac8ePPP6uRnWFSFJgM1lfkoKqFAo3AhlpRg+rR+LC1C+f/OaTRvWunsAXSDn0QIEgJJnhs75q9h94OjUxHjbFjSkGy8UCu8uSgBYEAgloBP52MbO6k5Aq+DAME+FhuzZKCDsO3Pp+b1HGSqK7q226LVfC4VC4UYoAWBYDFbeQTaedMe6lWMP3zNK5MGfklCeVwoIgUQfePHklf2nLgdTm/8HRArXjaEVCoXCO1ICwJDQYOUd5OMhZGxat2bnxpXISQQptov0PA4BRprh+Hj/e6+cH+8zpSQAg7nfsvQXCoWbowSAITG3/A6SMA5pzZqV2zcuBxItkMizVjC41VOAewbCsZPnv/f8HhtdZUZPqfUdm/8zKBQK7zZKABgCAlwSmWlOUim7rxjRhzeTnZHMikrMvUoZHGhv3JpeJ+GTic8cunzu8pSJmV2FGmX6t1Ao3BIlAAwBAqaknAW6KFhyrBmrP3jvKsCAAMgIA6/5v9/wln1Q3QVcsmAXJ2e++eK+ZFGyDFpJ+hcKhVulBIAhQCggM88E9Y2QRbjWrhh57IFtlQCJNDA6Y76FB591kCcgVEfOXX113/G+19liRdXqtW2gxQKgUCjcLCUADAUaEdVEuJk5I5i3rVu2Ze0KkxvgTsmcuIUAcO0a5GTjT7187FJjCF1kGRQ8tW+hykmgUCjcJCUADAMyWyVaMIpB8mXBH9+6tgIB0EISEwAh3Ooy3SaCzvWbr76wd0oRIQST55SVSwW4UCjcGiUADAEXGtSyjgCI8Lymo/fv3MpABxxkCAYEb0y3eAZoE0EvHr66++jlXt+NbnQpZ1TO4gBfKBRuhRIAhgAJyZwxOx0CtHIUO3eMGSDSiUCanLnPWwkAQqv1CXz72f3nJkkGIiH3CMoi5i8xVygU3pUUR7AhQPeInodOTr2K/SbwgR2bN41UAALA1gLMAm1k7r/eEUkOAjLNAJ5Rn7ii5w9e7KVYd6Ln7DKYtZv/cgAoFAq3QDkBDAPSCMlhTKmp4e/Z+dBYpwOAINX6AxM03PBevS3qUiLhDqc9s3v/kVMXGSugtZXkGx+tnAIKhcLNUQLAcCAodxldGuP0j++8p1NHSIDevOjf4ELtrbiP5HTECYWn9xw5d+GSRXPpugeZkwAqx4BCoXBzlAAwBAQl92gCghk3LA/bVgfDNYuuW4BAaN1fAIvx6LmpF49MzDjf8oYVC7BCoXCLlAAwBCRCjHQAxvDo9g3rRjoAdOvFWZGCIAk0R3h+/8k9JydRd1HW+kKhMCRKABgGFABTBpnc3//o9vXLu/BmHjoNhCQ0hEhemE7Pv3r09ERm6Gp+rsKFQqEwRwkAQ4Awkq7s4FgVdm5aOVpbM8+8DCFYdid0+OTF5w6cTrKy+S8UCkOkBIChIBgTajTp/g3LdqwcAeCcT4utQM7IspPk7mMXd52YYgzI/dLtUygUhkUJAENCDhpS/96NazesX9vKf87H/BcQlUNVX5xML75yZGp6pih/FgqF4VICwDAQQGWSaB7dtnLD6hFlGebVmSkpGkAevjT5zJ7DIUS43/gYQaFQKLwjJQAMAwpyics7eGhDPRLgMuCWjwCtvTuioQe8dGL69QszoarA0upfKBSGSQkAQ4BtH5Br+4bVD21Y3ZYE7NYzQAQgwqiLV3tfe/7weKqQ3aTS718oFIZICQDDIZIQtm7asO2e1UA2kvNdrAn4ydMXvvvCvsxRQfLM8n4VCoXhURaUISAwMcL7D20Y2bS66zk7TLiJhn3NMvf/mFKWff+1Myeu9FnVYgScN/OYhUKh8KMpAWAYkA3CaDc8uGFspILADIi6hSrwXCAgOd6z7+891aRAoyxYCKUFtFAoDJESAIYAQShtXDN679YNgtEMEsVb69knQcBZ7Tsxvu/gcaW+PMsFcV6dpYVCofBGSgAYAgKQettX1Q9tXkuIYKTIcDM/P4CtejTRA77x4t4TFyetO0JleJPyG1RAC4VCYZ6UADBfCBIy+v3ru5tW10KERLUpoBtEbQwYSIdKgC709a3dRyeSxVjRG4MUShtooVAYJiUAzB9l9xXLxp64d8OKIG8rucw3sVgPrF3a1R9tCWDX65dfOTrZoMpNpnsINIYi+l8oFIZICQC3zLW12MWVK5Y/sG2jyd1bJ0e/qbWarbHwrL8jged27T99tafYcXgwkISraEEXCoUhUgLATeMAKHjy3JfJQUhbxvoP37cOkCEnhqQKuFH/dwHyPnKvL/Ykox++NPPUoYt9D2ZmpMPcaaUHtFAoDJUSAG6cWTd3uSALMYRA0CVQO9aPrV5WDwoCYgZvvASgVjoOgNwgMjy15/Du109Z1YGLgGAOgrxlf7FCoVB4KyUA3DicNeCVJAc1SMr7SGWP3rs1kvLW+h2VvcUK+IeTIUcAUKmJ9Enxmf2nT5y5GK2o/xQKhQWkBICbxiCIKXlqXCKVl9V68r7No0aXgzQJ4E3JNjQwp1EZ8NfPTr14eMpjd+7IUSgUCgtBCQA3gwjIIDMiRIQIUk1vRTfct3F5TbaNnEYRvPGe/QgFujNACYx7Tlx45ch5q7qSl8b/QqGwcJQAcBOIItsSAEizGI2oo+7fsnH9aEUIDrkT3rbs3ODDUg2VEkiGKzP+7N7zZy9PA+0cWckBFQqFhaIEgJuAgER3eU6QwzOyj3RH3vvwfcu6ceALQwBwv5mOHe+7pwZA7J48f/W7zx+w2A0WUCZ/C4XCQlICwM3CHGogI1hIMznnLPvEvd2xOkiwYGQlhBDCTXTssA6oui64v3T0wu6TV7JVWUksReBCobCAlABwUwhQCDFYoEskyLXL6s1rx0horlOTwE2ZN4pGVMGu9NJ3ntszlV0xtAWHQqFQWDhKALgJ2vyOoEAzNZkhEI9tX7t2ZRftNG/7124ycSOju/eFI5fSC6+dgIOeMHCGLFGgUCgsFCUA3ATt+u/uUo5KYMj96Sd3rF27bFS31LOpgQZcJbGf89P7zh2fIAHzZpD8uQlFuUKhULg5SgC4WQh4zjkw0apo9ujmFcs6JtctLNbtuLC7x1jNJP/K8/tOT4nmkT5IIpUTQKFQWDBKALhpDBZMzI0QNm/avGPtaKvnfEtuLQTgMEBHT5zfc/RC3zvGikqEC+UEUCgUFpASAG6cdjGW0RG6Qq2UHtx+z6a1Y1CG3dDqL8ndBVyz/xUCc1Z+eu+JU1cyqhpU1iDdtFBPpVAoFIC42Ddwx0C2CRkX+n0sN6uReg9tHrln3SjmvFzeidbw1677b5cM+fxk+urey2cnQSbJPXQkUDeqJ1ooFAq3QDkB3CgaSPxTIj3l7KMV790wtqzTvfGpLzMLIUhyDaT/AcDqlw+c3X/oBJoe21jiziL+XCgUFpgSAG6cQZLfaVUAGNaM1Q+sGwlwDZRCbyhj0x4Crv9NAl44dPzY2fOsgoUg0D1JJQAUCoWFpQSAm0IAYQbPTdPfuHr04Q2rodTWcm+0CEySNBu88mY4MYFnD09OZYQYs9xBEiwBoFAoLDAlANwcAuFEmlFK929eu31dDWWa3bj0G2a3/y614qG7Dp5/7tDFhErKyllAGAST0gNaKBQWkBIAbg4CZlYHs3pk68Z1y+vkaHv2b7gI3D6MZKRLamb2vH748IVphU6Wt49EeBsnigNYoVBYOEoX0M0iuHrsbF7NH9u2DKodogt2QyGAJJQJNAymbGj2n5/81t4zOXsVqoH8pyhYqykksTSDFgqFBaIEgJtEItTP3LYmvmfbcqLG7EJ9o5t1ZcmzBUghhJfPTD174HyAQTJCEAUxgoLK0l8oFBaQkgK6CSSBpAV42rR+5cb1q8U5zZ4bawECnBGwWimaplK1+/VzF8fHzQgQIiRRN1FRKBQKhVulBICbgKQBcgX6A5tWrB2Dp0SAzLixVI1DggGG3Cdx6MLl77582K1uawNzD1Ay/4VC4TZQAsDNITLnvLzLnZvXRjWtkRd0o2KgbMe/SBCusO/s1K6Dp2mxFHsLhcLtpwSAm0ae160c27ljM5RorWSP36Bqmykzp8RgIV7p4wevXbg4mTw3KqqfhULhtlMCwI0y28BJ0lYvq7atr+EZwQBhoBJxncTbDyWTDSQwXpya+sYzr2QLdRVKq0+hULj9lABwo5BsxdtivezJ7avWdnqwyhDNc2YUDTcgCedWZ4WQrzby7+29fOD0tGw0lV6sQqGwGJQAcKOQJMzdO3V89N7No1UlBMAMJANwg5t40qJZnOyl77y07+pMgxBzLqoPhUJhESgB4EaRBErSyk567P7NMVQuOgGjtTv/d07jiwJJWefYpf5Lrx1pkhtBL/mfQqGwCJQAcBNQlLRxeX5w48jAIt4Go1s3gkDCkdkwPLf/1PELPTAqJ5Zp30KhsBiUAHATOGSBOzetWtttHRuD0B4Lbvgh5GC6nPGtlw+fnXZaMCnGW3KTLBQKhflRAsCPYtD4M+jRJIRgfO9DW1fEiOwupna29wbT/wAAMx04fmXXoQv9HGkBSGX/XygUFoUSAH4EZDu4RVEOuAN1sIe3rQ+RGphEykXyTaeAwVSv5O4utao+kiRPIJ/fd+T4hclQd9TqfpYaQKFQWAxKAPgRyJBdJBR9Bk5H3Lpq5P5VXbBSqKNhhBYYBy1C12C73XfBBblLLk9SJv38TP8be8+dvdTvhGypT1RWpsAKhcJiUALAj0BwoHXmIrIZ4A9sWbty+RgAsn3p+COswIwMwRjaLiEKQui8duTiy/uOy0xyxuDuuah+FgqFxaAEgB8B3TBQaWMAabn3/vvWr1s5AryzA6QkwJWzZwdJi0QQwosHzx89dSHEmFKCBRhKDaBQKCwKJQD8UCQRxkAoy4JgI5Ye2zK2rGr/6B1os0JCklxgchl5ZiI/vf9CT1Ug3T3JEc1CSQEVCoVFoASAH4qRopEkXGZwbVyz/IH1HeDGnFokyI0hhiBHkkDuPnT6m6+cUjUGoPWFp3sxfikUCotCCQA/FAFZ7nCQFOHatm3jPas7gL+j5g8AwCUHBMkpM+ul9OqBE8cvNLAOB6UFk7LciwVAoVC4/fz/AfHTJJCLd3YZAAAAAElFTkSuQmCC";
const ICON_192_B64 = "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";
const ICON_180_B64 = "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";
const ICON_32_B64 = "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAFD0lEQVR4nK2WW2xUZRDH//Od62730trLAm3pBdtwK2KhXIq2QtUEJWpikHjBxBANRowaH/RBMfFBTHzDhAcTwIREDEqikYSYoiYFQmMs4SK0Edpyaam9UNrttrt7zvm+8WFrLXS7SxPn6Zyc+eaXmfl/M4f0bfuRzYQgZ9yBqem6AGd1v/tsVg8icuJu06qSkvwc5Smi/xWgCXJjyZ2bl5zY/fSWVaUq7mpiboRMACHIibtrl8/7cscGZuQFLADA3AB6JgARe3LX5mW6JgBEwr45hZ4MkuEbM0MTRWFfqq+FIRuCwHPrciYAAZB8eyxB0wAqYzgiiLtlkLHJRGDuHhhLvRWEbDI1VrNmQERKsZN0GTyl5owAZhC1945MAgK239Ilc1qlEgGK4alD7248tKvRS7qpVDL2AICgvjvx1GtewMr1m0pyWiEJkJtwD77T+EpD1cMVBWTqijlbBgAIKT/FyLH0gpANpWaG1zWRHEt89GLt9oZqqTjpySmfbADFQZ8BQCpFRPNz/ZD3lkjTKBFLNq4q/XTbalcqTdD0PmdUEREUl+bnAJCKAZQW5EApmnaeCNJVoaC1/81HZyldNltakjf1XFkUvGfYCSG8CefzV9csmhcmwsxBkgkglSJLr63MB5A6WBkJQhD/e9c0QclYsnF16c4nl4xOOL9f7RczFDYrgAiuq4qLAjULH2BACAGgMhKakgcBSrFt63tfW0+g71u7jrXdnBlnVoAmBJJe45J5OZYBZl0QgPKiYF7I8iQTQdOEG0u+91zNirJ8qdRnR89NHyLZVaSYIeiF9RXMaL7Qc+nmMID8gFVRGGBXakI4CbeiLO/DZ1cC+Obk1a5Lf/vM/0YnpzQyG0AQOUlv0cLcxx8qIcLe45dPtvcDIKIVZfnwpBCkXLnn5bqQ3xyOJT7+to1sI+54zFCKFxYECsO2G3d0TcwCEISkt6V2od/U74wnfjnXc7Z7KPXpkcVFECI+7mxaXbp1fSWAT46cvd47yj7jcu8IEVypwn7zqzc2RHJ9ifFk+n2gmGFoT9WWMOPncz2JO/G2riGlWAhqqinWfYaX9Pa8VCeIfrt0a9+xP62A5UluPnuzeyBaURRyPPlMXfnavZELXUNpMiCC48jiSHBddYQIR850w9Q7eke7BqIAygqD2+rLtzdVrXmwaDiWeH1fC4gY0DQam3C3fnHiSt+IqWsAIiHfEytL02SgEbmOV19dGPKZt4bHf73Yp+eYE9HEmb8GFkXCUqmDbz2W8tyxr6XzxogVsqVUAEyf0XZ1qO6DH59fV16/OBIJ+z2p0pWICMybli9gxk9tN0aHxwO5/pjilst92xuqPMW2oQF4e/+pH1o67bDPk5NLSCk2fUY04R043n7geDs0Aqfbya5URo7ZuHQ+EY62dkMIqVjYRvP53mjcCfnMwWj8/a9bDzV3WCF7KvoUQ9dIC1rA5Ey5F5ASaHVZ3uLi3BtDY6c7+jXbcKXSDO16f6xh97HaioLmCz09vVEraMt0240Z3rQrNwMgCK63tqoQREdbr02MJlJFYGbD0s933j7f0Q/LsIJW2ugzLb1MNy6bT8B3Z7qhi6nRxsympQufLhXuM3oagCuV7jc3LV9wfXDsjyuDmm1Mj6WYlbzPyJN21z0QRNKR5ZFgSX7g8OlOd9wxtOwLYy4AAbhefXURgMOnumBqao6/WVkAqR3fVLPg2mD0YveQbunqvms9m/0DD0AyojCDsXsAAAAASUVORK5CYII=";
const FAVICON_ICO_B64 = "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";

function iconResponse(b64, type) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Response(bytes, { headers: { 'Content-Type': type || 'image/png', 'Cache-Control': 'public, max-age=604800' } });
}

function manifestResponse(params) {
  // start_url is whitelisted to our own token/office paths so the query param
  // can never point the installed app at another origin.
  const raw = params.get('start') || '';
  const start = /^\/(e|o)\/[A-Za-z0-9]{8,40}$/.test(raw) ? raw : '/office';
  const manifest = {
    name: 'Mostlane PO System',
    short_name: 'Mostlane PO',
    description: 'Raise and track Mostlane purchase orders',
    start_url: start,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#003366',
    theme_color: '#003366',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
    ]
  };
  return new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' } });
}

// ============================================================
// API LOGIC
// ============================================================
async function handleEngineerView(path, env) {
  const token = path.split('/')[2];
  const eng = await env.DB.prepare(`SELECT * FROM engineers WHERE token = ? AND active = 1`).bind(token).first();
  if (!eng) return html(unknownEngineerPage());
  if (eng.suspended) {
    const cfg = await getConfigMap(env.DB);
    return html(suspendedEngineerPage(eng, cfg.office_phone));
  }
  return html(engineerPage(eng));
}

async function handleOfficeUserView(path, env) {
  const token = path.split('/')[2];
  const user = await env.DB.prepare(`SELECT * FROM office_users WHERE token = ? AND active = 1`).bind(token).first();
  if (!user) return html(unknownOfficeUserPage());
  // Set cookie remembering this office user for 90 days
  const cookie = `office_user=${encodeURIComponent(user.slug)}; Max-Age=${90 * 24 * 60 * 60}; Path=/; SameSite=Lax`;
  return new Response(officePage(user), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Set-Cookie': cookie
    }
  });
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.split(';').map(s => s.trim()).find(c => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

async function getOfficeUsers(db) { return (await db.prepare(`SELECT * FROM office_users ORDER BY name`).all()).results; }
async function addOfficeUser(db, body) {
  const slug = slugify(body.name);
  // On conflict the existing token is kept, so re-adding someone doesn't break their link
  await db.prepare(`INSERT INTO office_users (slug, name, active, token) VALUES (?, ?, 1, ?) ON CONFLICT(slug) DO UPDATE SET active = 1, name = ?`).bind(slug, body.name, randomToken(), body.name).run();
  return { success: true, slug };
}
async function deleteOfficeUser(db, slug) {
  await db.prepare(`UPDATE office_users SET active = 0 WHERE slug = ?`).bind(slug).run();
  return { success: true };
}

async function getSystemStatus(db) {
  const config = await getConfigMap(db);
  const now = new Date();
  const ukTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
  const dayMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const today = dayMap[ukTime.getDay()];
  const todayDate = ukTime.toISOString().split('T')[0];
  const currentTime = ukTime.toTimeString().slice(0, 5);
  const closure = await db.prepare(`SELECT * FROM closures WHERE date = ?`).bind(todayDate).first();
  if (config.system_status === 'disabled') return { mode: 'disabled', message: 'System is currently offline. Call office on ' + config.office_phone };
  if (config.force_open_ooh === '1') return { mode: 'ooh', message: null, forced: true };
  const officeDays = config.office_days.split(',');
  if (!officeDays.includes(today) || closure) return { mode: 'ooh', message: null, reason: closure ? closure.reason : 'weekend' };
  if (currentTime >= config.office_hours_start && currentTime <= config.office_hours_end) return { mode: 'office_hours', message: 'Please call the office on ' + config.office_phone };
  return { mode: 'ooh', message: null };
}

async function getConfigMap(db) {
  const rows = await db.prepare(`SELECT key, value FROM config`).all();
  const map = {};
  for (const r of rows.results) map[r.key] = r.value;
  return map;
}
async function getConfig(db) { return await getConfigMap(db); }
async function updateConfig(db, body) {
  for (const [k, v] of Object.entries(body)) {
    await db.prepare(`INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?`).bind(k, String(v), String(v)).run();
  }
  return { success: true };
}
async function getEngineers(db) { return (await db.prepare(`SELECT * FROM engineers ORDER BY name`).all()).results; }
async function addEngineer(db, body) {
  const slug = slugify(body.name);
  // On conflict the existing token is kept, so re-adding someone doesn't break their link
  await db.prepare(`INSERT INTO engineers (slug, name, active, token) VALUES (?, ?, 1, ?) ON CONFLICT(slug) DO UPDATE SET active = 1, name = ?`).bind(slug, body.name, randomToken(), body.name).run();
  return { success: true, slug };
}
async function deleteEngineer(db, slug) { await db.prepare(`UPDATE engineers SET active = 0 WHERE slug = ?`).bind(slug).run(); return { success: true }; }
// Suspend (block access, keep the link) or reinstate an engineer.
async function updateEngineer(db, slug, body) {
  if (body.suspended !== undefined) {
    const susp = body.suspended ? 1 : 0;
    const reason = susp ? ((body.suspend_reason || '').trim() || null) : null;
    await db.prepare(`UPDATE engineers SET suspended = ?, suspend_reason = ? WHERE slug = ?`).bind(susp, reason, slug).run();
  }
  return { success: true };
}

// Issue a fresh token, instantly invalidating the old link. `table` is fixed
// by the route, never user input.
async function rotateToken(db, table, slug) {
  const token = randomToken();
  await db.prepare(`UPDATE ${table} SET token = ? WHERE slug = ?`).bind(token, slug).run();
  return { success: true, token };
}
async function getSuppliers(db) { return (await db.prepare(`SELECT * FROM suppliers WHERE active = 1 ORDER BY name`).all()).results; }
async function addSupplier(db, body) {
  await db.prepare(`INSERT INTO suppliers (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET active = 1`).bind(body.name).run();
  return { success: true };
}
async function deleteSupplier(db, id) { await db.prepare(`UPDATE suppliers SET active = 0 WHERE id = ?`).bind(id).run(); return { success: true }; }
async function getSubcontractors(db) { return (await db.prepare(`SELECT * FROM subcontractors WHERE active = 1 ORDER BY name`).all()).results; }
async function addSubcontractor(db, body) {
  await db.prepare(`INSERT INTO subcontractors (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET active = 1`).bind(body.name).run();
  return { success: true };
}
async function deleteSubcontractor(db, id) { await db.prepare(`UPDATE subcontractors SET active = 0 WHERE id = ?`).bind(id).run(); return { success: true }; }
async function getTrades(db) { return (await db.prepare(`SELECT * FROM trades WHERE active = 1 ORDER BY name`).all()).results; }
async function addTrade(db, body) {
  await db.prepare(`INSERT INTO trades (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET active = 1`).bind(body.name).run();
  return { success: true };
}
async function deleteTrade(db, id) { await db.prepare(`UPDATE trades SET active = 0 WHERE id = ?`).bind(id).run(); return { success: true }; }
async function updateSupplier(db, id, body) {
  if (body.terms_days !== undefined) {
    const days = Number(body.terms_days) === 60 ? 60 : 30;
    await db.prepare(`UPDATE suppliers SET terms_days = ? WHERE id = ?`).bind(days, id).run();
  }
  return { success: true };
}

// Per-supplier, per-spend-month outstanding amounts for the accounts view.
// "Outstanding" = costed POs not marked complete, inc VAT (what is actually
// owed). The client buckets months and applies each supplier's terms.
async function getAccounts(db) {
  const [suppliers, months] = await db.batch([
    db.prepare(`SELECT * FROM suppliers WHERE active = 1 ORDER BY name`),
    db.prepare(`SELECT supplier, substr(issued_at, 1, 7) as ym,
      SUM(CASE WHEN cost_ex_vat IS NOT NULL AND COALESCE(status, 'open') != 'complete' THEN cost_ex_vat * (1 + COALESCE(vat_rate, 20) / 100) ELSE 0 END) as unpaid_inc_vat,
      SUM(CASE WHEN cost_ex_vat IS NULL AND COALESCE(status, 'open') != 'complete' THEN 1 ELSE 0 END) as uncosted_open
      FROM po_log WHERE deleted = 0 AND supplier IS NOT NULL GROUP BY supplier, ym`)
  ]);
  return { suppliers: suppliers.results, months: months.results };
}
async function getSites(db) { return (await db.prepare(`SELECT * FROM sites WHERE active = 1 ORDER BY name`).all()).results; }
async function addSite(db, body) {
  await db.prepare(`INSERT INTO sites (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET active = 1`).bind(body.name).run();
  return { success: true };
}
async function deleteSite(db, id) { await db.prepare(`UPDATE sites SET active = 0 WHERE id = ?`).bind(id).run(); return { success: true }; }

// Read-only site lookup for the payroll worker (called over a service
// binding). Returns the shape the payroll app expects: job_ref/site/client.
async function searchJobs(db, params) {
  const q = (params.get('q') || '').trim();
  if (q.length < 2) return [];
  const rows = await db.prepare(
    `SELECT name FROM sites WHERE active = 1 AND name LIKE ? ORDER BY name LIMIT 10`
  ).bind('%' + q + '%').all();
  return rows.results.map(r => ({ job_ref: r.name, site: r.name, client: null }));
}
async function getClosures(db) { return (await db.prepare(`SELECT * FROM closures ORDER BY date DESC`).all()).results; }
async function addClosure(db, body) {
  await db.prepare(`INSERT INTO closures (date, reason) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET reason = ?`).bind(body.date, body.reason || '', body.reason || '').run();
  return { success: true };
}
async function deleteClosure(db, date) { await db.prepare(`DELETE FROM closures WHERE date = ?`).bind(date).run(); return { success: true }; }

async function getPOs(db, params) {
  let query = `SELECT * FROM po_log WHERE deleted = 0`;
  const binds = [];
  if (params.get('needs_review') === '1') query += ` AND needs_review = 1`;
  // Engineer-facing views pass hide_subcontractor=1 — subcontractor POs are
  // office-only to see, so they never reach an engineer even if mis-attributed.
  if (params.get('hide_subcontractor') === '1') query += ` AND COALESCE(cost_category, 'materials') != 'subcontractor'`;
  if (params.get('category')) { query += ` AND COALESCE(cost_category, 'materials') = ?`; binds.push(params.get('category')); }
  if (params.get('trade')) { query += ` AND trade = ?`; binds.push(params.get('trade')); }
  if (params.get('site')) { query += ` AND site = ?`; binds.push(params.get('site')); }
  if (params.get('engineer')) { query += ` AND engineer_slug = ?`; binds.push(params.get('engineer')); }
  if (params.get('office_user')) { query += ` AND office_user_slug = ?`; binds.push(params.get('office_user')); }
  if (params.get('supplier')) { query += ` AND supplier = ?`; binds.push(params.get('supplier')); }
  if (params.get('from')) { query += ` AND issued_at >= ?`; binds.push(params.get('from')); }
  if (params.get('to')) { query += ` AND issued_at <= ?`; binds.push(params.get('to') + 'T23:59:59'); }
  if (params.get('status')) { query += ` AND COALESCE(status, 'open') = ?`; binds.push(params.get('status')); }
  if (params.get('uncosted') === '1') query += ` AND (cost_ex_vat IS NULL)`;
  if (params.get('unmatched_site') === '1') {
    query += ` AND (site IS NOT NULL AND site NOT IN (SELECT name FROM sites WHERE active = 1))`;
  }
  if (params.get('search')) {
    const term = '%' + params.get('search').toLowerCase() + '%';
    query += ` AND (CAST(po_number AS TEXT) LIKE ? OR LOWER(engineer_name) LIKE ? OR LOWER(site) LIKE ? OR LOWER(incident_no) LIKE ? OR LOWER(supplier) LIKE ? OR LOWER(description) LIKE ? OR LOWER(flag_reason) LIKE ? OR LOWER(credit_note) LIKE ?)`;
    binds.push(term, term, term, term, term, term, term, term);
  }
  query += ` ORDER BY po_number DESC LIMIT 1000`;
  return (await db.prepare(query).bind(...binds).all()).results;
}

// ============================================================
// JOB COST (job = site). Rolls PO spend up per job, split by cost category
// and, for subcontractor work, by trade. Costs are ex VAT — VAT is
// reclaimable so it isn't a cost to the job. Labour is added in a later phase.
// ============================================================
async function getJobCost(db, params) {
  let where = `WHERE deleted = 0 AND site IS NOT NULL AND TRIM(site) != ''`;
  const binds = [];
  if (params.get('from')) { where += ` AND issued_at >= ?`; binds.push(params.get('from')); }
  if (params.get('to')) { where += ` AND issued_at <= ?`; binds.push(params.get('to') + 'T23:59:59'); }

  const [byJob, byTrade] = await db.batch([
    db.prepare(`SELECT site,
        COUNT(*) AS po_count,
        SUM(CASE WHEN cost_ex_vat IS NULL THEN 1 ELSE 0 END) AS uncosted,
        COALESCE(SUM(CASE WHEN COALESCE(cost_category, 'materials') = 'materials' THEN cost_ex_vat ELSE 0 END), 0) AS materials_ex,
        COALESCE(SUM(CASE WHEN cost_category = 'subcontractor' THEN cost_ex_vat ELSE 0 END), 0) AS subcontractor_ex,
        COALESCE(SUM(cost_ex_vat), 0) AS total_ex
      FROM po_log ${where} GROUP BY site`).bind(...binds),
    db.prepare(`SELECT site, COALESCE(trade, '(no trade)') AS trade,
        COUNT(*) AS count, COALESCE(SUM(cost_ex_vat), 0) AS ex
      FROM po_log ${where} AND cost_category = 'subcontractor'
      GROUP BY site, trade`).bind(...binds)
  ]);

  const tradesBySite = {};
  for (const t of byTrade.results) {
    (tradesBySite[t.site] = tradesBySite[t.site] || []).push({ trade: t.trade, count: t.count, ex: t.ex });
  }
  const jobs = byJob.results.map(j => ({
    site: j.site,
    po_count: j.po_count,
    uncosted: j.uncosted,
    materials_ex: j.materials_ex,
    subcontractor_ex: j.subcontractor_ex,
    total_ex: j.total_ex,
    by_trade: (tradesBySite[j.site] || []).sort((a, b) => b.ex - a.ex || b.count - a.count)
  })).sort((a, b) => b.total_ex - a.total_ex || b.po_count - a.po_count);

  return {
    jobs,
    totals: {
      jobs: jobs.length,
      po_count: jobs.reduce((s, j) => s + j.po_count, 0),
      uncosted: jobs.reduce((s, j) => s + j.uncosted, 0),
      materials_ex: jobs.reduce((s, j) => s + j.materials_ex, 0),
      subcontractor_ex: jobs.reduce((s, j) => s + j.subcontractor_ex, 0),
      total_ex: jobs.reduce((s, j) => s + j.total_ex, 0)
    }
  };
}

// Lowest PO number the system will ever issue (the seed deletes 10010, so the
// first real PO is 10011).
const PO_START = 10011;

// Smallest number >= PO_START not currently present in po_log. Because deletes
// are permanent (the row is removed), a freed number becomes the next one
// issued, keeping the sequence gap-free.
async function nextPoNumber(db) {
  const row = await db.prepare(`
    SELECT COALESCE(MIN(n), ?) AS next FROM (
      SELECT ? AS n
      UNION ALL
      SELECT po_number + 1 FROM po_log
    ) WHERE n >= ? AND n NOT IN (SELECT po_number FROM po_log)
  `).bind(PO_START, PO_START, PO_START).first();
  return row.next;
}

async function issuePO(db, body) {
  const status = await getSystemStatus(db);
  if (status.mode === 'disabled') return { error: status.message };
  if (status.mode === 'office_hours' && body.source !== 'office') return { error: status.message };

  // Subcontractor POs are office-only, and always need a site (job) and trade
  // so they cost against a job.
  const isSubcontractor = body.cost_category === 'subcontractor';
  if (isSubcontractor) {
    if (body.source !== 'office') return { error: 'Subcontractor POs can only be raised by the office' };
    if (!body.site || !body.site.trim()) return { error: 'Site (job) is required for a subcontractor PO' };
    if (!body.supplier || !body.supplier.trim()) return { error: 'Subcontractor is required' };
    if (!body.trade || !body.trade.trim()) return { error: 'Trade is required for a subcontractor PO' };
    if (!body.description || !body.description.trim()) return { error: 'Description is required' };
  }

  // Validate required fields (engineer source only — office can issue with missing fields if needed for emergency reconciliation)
  if (body.source === 'engineer') {
    // Block a suspended engineer even if they still have the form loaded
    if (body.engineer_slug) {
      const eng = await db.prepare(`SELECT suspended FROM engineers WHERE slug = ?`).bind(body.engineer_slug).first();
      if (eng && eng.suspended) return { error: 'Access to Mostlane PO system has been suspended. Please contact the office for more info.' };
    }
    const hasSite = body.site && body.site.trim();
    const hasIncident = body.incident_no && body.incident_no.trim();
    if (!hasSite && !hasIncident) return { error: 'Enter a site or an incident number' };
    if (!body.supplier || !body.supplier.trim()) return { error: 'Supplier is required' };
    if (!body.description || !body.description.trim()) return { error: 'Description is required' };
    // Supplier must be in the active list
    const supplierCheck = await db.prepare(`SELECT 1 FROM suppliers WHERE name = ? AND active = 1`).bind(body.supplier).first();
    if (!supplierCheck) return { error: 'Supplier must be picked from the list' };
  }

  const issuedAt = new Date().toISOString();
  // Assign the number explicitly (lowest free) instead of relying on
  // AUTOINCREMENT, so deleted numbers get reused. Retry on the off-chance two
  // POs are issued at the same instant and pick the same number.
  let poNumber;
  for (let attempt = 0; attempt < 6; attempt++) {
    poNumber = await nextPoNumber(db);
    try {
      await db.prepare(`INSERT INTO po_log (po_number, engineer_slug, engineer_name, issued_at, source, site, incident_no, supplier, description, needs_review, office_user_slug, office_user_name, cost_category, trade) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        poNumber, body.engineer_slug || null, body.engineer_name || null, issuedAt, body.source || 'office',
        body.site || null, body.incident_no || null, body.supplier || null, body.description || null, body.source === 'office' ? 0 : 1,
        body.office_user_slug || null, body.office_user_name || null,
        isSubcontractor ? 'subcontractor' : 'materials', isSubcontractor ? (body.trade || null) : null
      ).run();
      return { success: true, po_number: poNumber, issued_at: issuedAt };
    } catch (e) {
      if (!/UNIQUE|constraint|PRIMARY/i.test(e.message)) throw e;
      // number was taken between read and write — recompute and retry
    }
  }
  return { error: 'Could not allocate a PO number, please try again' };
}

// Permanent delete — removes the row so the number is freed for reissue.
async function deletePoRecord(db, poNumber) {
  await db.prepare(`DELETE FROM po_log WHERE po_number = ?`).bind(poNumber).run();
  return { success: true };
}


async function updatePO(db, poNumber, body) {
  const allowed = ['site', 'incident_no', 'supplier', 'description', 'needs_review', 'reviewed_by', 'engineer_slug', 'engineer_name', 'deleted', 'cost_ex_vat', 'vat_rate', 'status', 'flag_reason', 'credit_note', 'cost_category', 'trade'];
  const fields = []; const binds = [];
  for (const [k, v] of Object.entries(body)) {
    if (allowed.includes(k)) {
      fields.push(`${k} = ?`);
      binds.push(v === '' ? null : v);
    }
  }
  if (body.needs_review === 0) { fields.push(`reviewed_at = ?`); binds.push(new Date().toISOString()); }
  if (body.cost_ex_vat !== undefined && body.cost_ex_vat !== null && body.cost_ex_vat !== '') {
    fields.push(`cost_entered_at = ?`); binds.push(new Date().toISOString());
  }
  // Stamp who edited it
  if (body.edited_by_slug && body.edited_by_name) {
    fields.push(`last_edited_by_slug = ?`); binds.push(body.edited_by_slug);
    fields.push(`last_edited_by_name = ?`); binds.push(body.edited_by_name);
    fields.push(`last_edited_at = ?`); binds.push(new Date().toISOString());
  }
  if (!fields.length) return { success: true };
  binds.push(poNumber);
  await db.prepare(`UPDATE po_log SET ${fields.join(', ')} WHERE po_number = ?`).bind(...binds).run();
  return { success: true };
}

// Global "needs attention" counts for the office dashboard. These are not
// affected by the log's current filters — they always show the full backlog.
async function getDashboard(db) {
  // UK 'today' for the raised-today count (issued_at is stored UTC; this keeps
  // the same UK-local convention used elsewhere in the worker).
  const ukTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
  const todayDate = ukTime.toISOString().split('T')[0];
  const [uncosted, review, flagged, creditDue, unmatched, today] = await db.batch([
    db.prepare(`SELECT COUNT(*) c FROM po_log WHERE deleted = 0 AND cost_ex_vat IS NULL AND COALESCE(status, 'open') != 'complete'`),
    db.prepare(`SELECT COUNT(*) c FROM po_log WHERE deleted = 0 AND needs_review = 1`),
    db.prepare(`SELECT COUNT(*) c FROM po_log WHERE deleted = 0 AND COALESCE(status, 'open') = 'flagged'`),
    db.prepare(`SELECT COUNT(*) c FROM po_log WHERE deleted = 0 AND COALESCE(status, 'open') = 'credit_due'`),
    db.prepare(`SELECT COUNT(*) c FROM po_log WHERE deleted = 0 AND site IS NOT NULL AND site NOT IN (SELECT name FROM sites WHERE active = 1)`),
    db.prepare(`SELECT COUNT(*) c FROM po_log WHERE deleted = 0 AND substr(issued_at, 1, 10) = ?`).bind(todayDate)
  ]);
  return {
    uncosted: uncosted.results[0].c,
    needs_review: review.results[0].c,
    flagged: flagged.results[0].c,
    credit_due: creditDue.results[0].c,
    unmatched_site: unmatched.results[0].c,
    today: today.results[0].c
  };
}

async function getStats(db, params) {
  let where = `WHERE deleted = 0`;
  const binds = [];
  if (params.get('engineer')) { where += ` AND engineer_slug = ?`; binds.push(params.get('engineer')); }
  if (params.get('supplier')) { where += ` AND supplier = ?`; binds.push(params.get('supplier')); }
  if (params.get('from')) { where += ` AND issued_at >= ?`; binds.push(params.get('from')); }
  if (params.get('to')) { where += ` AND issued_at <= ?`; binds.push(params.get('to') + 'T23:59:59'); }
  if (params.get('source')) { where += ` AND source = ?`; binds.push(params.get('source')); }

  // All eleven aggregates are independent, so run them in one batched round
  // trip instead of sequentially.
  const [total, bySupplier, byEngineer, byOfficeUser, bySite, bySource, byDay, byMonth, needsReview, byStatus, totalSpend, uncosted] = await db.batch([
    db.prepare(`SELECT COUNT(*) as c FROM po_log ${where}`).bind(...binds),
    db.prepare(`SELECT COALESCE(supplier, '(none)') as supplier, COUNT(*) as count, COALESCE(SUM(cost_ex_vat), 0) as total_ex_vat FROM po_log ${where} GROUP BY supplier ORDER BY count DESC`).bind(...binds),
    db.prepare(`SELECT COALESCE(engineer_name, '(none)') as engineer, COUNT(*) as count, COALESCE(SUM(cost_ex_vat), 0) as total_ex_vat FROM po_log ${where} GROUP BY engineer_name ORDER BY count DESC`).bind(...binds),
    db.prepare(`SELECT COALESCE(office_user_name, '(no office user)') as office_user, COUNT(*) as count, COALESCE(SUM(cost_ex_vat), 0) as total_ex_vat FROM po_log ${where} AND office_user_name IS NOT NULL GROUP BY office_user_name ORDER BY count DESC`).bind(...binds),
    db.prepare(`SELECT COALESCE(site, '(none)') as site, COUNT(*) as count, COALESCE(SUM(cost_ex_vat), 0) as total_ex_vat FROM po_log ${where} GROUP BY site ORDER BY total_ex_vat DESC`).bind(...binds),
    db.prepare(`SELECT source, COUNT(*) as count FROM po_log ${where} GROUP BY source ORDER BY count DESC`).bind(...binds),
    db.prepare(`SELECT substr(issued_at, 1, 10) as day, COUNT(*) as count, COALESCE(SUM(cost_ex_vat), 0) as total_ex_vat FROM po_log ${where} GROUP BY day ORDER BY day DESC LIMIT 60`).bind(...binds),
    db.prepare(`SELECT substr(issued_at, 1, 7) as month, COUNT(*) as count, COALESCE(SUM(cost_ex_vat), 0) as total_ex_vat FROM po_log ${where} GROUP BY month ORDER BY month DESC LIMIT 24`).bind(...binds),
    db.prepare(`SELECT COUNT(*) as c FROM po_log ${where} AND needs_review = 1`).bind(...binds),
    db.prepare(`SELECT COALESCE(status, 'open') as status, COUNT(*) as count, COALESCE(SUM(cost_ex_vat), 0) as total_ex_vat FROM po_log ${where} GROUP BY status`).bind(...binds),
    db.prepare(`SELECT COALESCE(SUM(cost_ex_vat), 0) as total FROM po_log ${where}`).bind(...binds),
    db.prepare(`SELECT COUNT(*) as c FROM po_log ${where} AND cost_ex_vat IS NULL`).bind(...binds)
  ]);

  return {
    total: total.results[0].c,
    needs_review: needsReview.results[0].c,
    total_spend_ex_vat: totalSpend.results[0].total,
    uncosted: uncosted.results[0].c,
    by_supplier: bySupplier.results,
    by_engineer: byEngineer.results,
    by_office_user: byOfficeUser.results,
    by_site: bySite.results,
    by_source: bySource.results,
    by_day: byDay.results,
    by_month: byMonth.results,
    by_status: byStatus.results
  };
}

// DD-MM-YY HH:MM in UK time, for CSV export
function fmtDateTimeUK(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\//g, '-').replace(',', '');
}

// DD-MM-YY in UK time
function fmtDateUK(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-');
}

async function csvExport(db, params) {
  let query = `SELECT * FROM po_log WHERE deleted = 0`;
  const binds = [];
  if (params.get('engineer')) { query += ` AND engineer_slug = ?`; binds.push(params.get('engineer')); }
  if (params.get('supplier')) { query += ` AND supplier = ?`; binds.push(params.get('supplier')); }
  if (params.get('from')) { query += ` AND issued_at >= ?`; binds.push(params.get('from')); }
  if (params.get('to')) { query += ` AND issued_at <= ?`; binds.push(params.get('to') + 'T23:59:59'); }
  if (params.get('status')) { query += ` AND COALESCE(status, 'open') = ?`; binds.push(params.get('status')); }
  query += ` ORDER BY po_number DESC`;
  const rows = await db.prepare(query).bind(...binds).all();
  const headers = ['PO Number', 'Issued At', 'Source', 'Category', 'Trade', 'Issued By (Office)', 'Engineer', 'Site', 'Incident No', 'Supplier', 'Description', 'Status', 'Cost Ex VAT', 'VAT Rate', 'Cost Inc VAT', 'Flag Reason', 'Credit Note', 'Needs Review', 'Cost Entered At', 'Last Edited By', 'Last Edited At'];
  const csv = [headers.join(',')];
  for (const r of rows.results) {
    const vatRate = r.vat_rate != null ? r.vat_rate : 20;
    const costInc = r.cost_ex_vat != null ? (r.cost_ex_vat * (1 + vatRate / 100)).toFixed(2) : '';
    csv.push([
      r.po_number, fmtDateTimeUK(r.issued_at), r.source, r.cost_category || 'materials', r.trade || '', r.office_user_name || '', r.engineer_name || '', r.site || '', r.incident_no || '', r.supplier || '', r.description || '',
      r.status || 'open', r.cost_ex_vat != null ? r.cost_ex_vat : '', r.cost_ex_vat != null ? vatRate : '', costInc,
      r.flag_reason || '', r.credit_note || '', r.needs_review ? 'Yes' : 'No', fmtDateTimeUK(r.cost_entered_at),
      r.last_edited_by_name || '', fmtDateTimeUK(r.last_edited_at)
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  }
  return new Response(csv.join('\n'), { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="mostlane-po-log-${new Date().toISOString().split('T')[0]}.csv"` } });
}

// ============================================================
// HELPERS
// ============================================================
function html(body) { return new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }); }
function json(data) { return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }); }

// ============================================================
// STYLES (Mostlane portal look)
// ============================================================
const sharedStyles = `
*, *::before, *::after { box-sizing: border-box; }
html, body { width: 100%; max-width: 100%; margin: 0; padding: 0; }
body {
  font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
  background: #e6e8eb;
  color: #1a1a1a;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}
.topbar {
  background: linear-gradient(180deg, #1A4F8F 0%, #003468 100%);
  color: #fff;
  padding: 12px 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  position: sticky; top: 0; z-index: 10;
}
.topbar .brand { display: flex; align-items: center; gap: 12px; font-weight: 600; font-size: 15px; }
.topbar .brand img { height: 32px; width: auto; background: #fff; padding: 4px 8px; border-radius: 6px; }
.topbar .backbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; flex: none;
  border-radius: 10px; background: rgba(255,255,255,0.15);
  color: #fff; text-decoration: none;
  transition: background 0.15s, transform 0.15s;
}
.topbar .backbtn:hover { background: rgba(255,255,255,0.28); transform: translateX(-1px); }
.topbar .backbtn:active { transform: translateX(0); }
.topbar .backbtn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.topbar nav { display: flex; gap: 6px; flex-wrap: wrap; }
.topbar nav a {
  color: #fff; text-decoration: none; font-size: 13px; font-weight: 500;
  padding: 6px 10px; border-radius: 6px; background: rgba(255,255,255,0.1);
  transition: background 0.15s;
}
.topbar nav a:hover, .topbar nav a.active { background: rgba(255,255,255,0.25); }
.wrap { max-width: 1100px; margin: 0 auto; padding: 16px 14px 60px; }
.wrap-narrow { max-width: 560px; margin: 0 auto; padding: 16px 14px 60px; }
h1 { font-size: 22px; font-weight: 600; color: #003366; margin: 0 0 16px; }
h2 { font-size: 17px; font-weight: 600; color: #003366; margin: 0 0 12px; }
h3 { font-size: 14px; font-weight: 600; color: #003366; margin: 0 0 10px; }
p { margin: 0 0 12px; }
.muted { color: #5a6677; font-size: 13px; }
.card {
  background: #ffffff; border-radius: 14px; padding: 18px; margin-bottom: 14px;
  box-shadow: 0 2px 10px rgba(0, 30, 80, 0.06); border: 1px solid #e3e7ee;
}
label { display: block; font-size: 13px; font-weight: 600; color: #003366; margin-bottom: 6px; }
input, select, textarea {
  width: 100%; padding: 12px 14px; border: 1px solid #c9d2dd; border-radius: 10px;
  font-size: 16px; font-family: inherit; background: #fff; color: #1a1a1a;
  transition: border-color 0.15s, box-shadow 0.15s;
}
input:focus, select:focus, textarea:focus {
  outline: none; border-color: #1A4F8F; box-shadow: 0 0 0 3px rgba(26, 79, 143, 0.12);
}
textarea { min-height: 90px; resize: vertical; }
.field { margin-bottom: 14px; }
button, .btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px 18px;
  background: linear-gradient(180deg, #1A4F8F 0%, #003468 100%);
  color: #fff; border: none; border-radius: 12px;
  font-weight: 600; font-size: 15px; font-family: inherit;
  cursor: pointer; text-decoration: none;
  box-shadow: 0 3px 8px rgba(0,30,80,0.20), inset 0 1px 2px rgba(255,255,255,0.15);
  transition: transform 0.15s, box-shadow 0.15s;
}
button:hover, .btn:hover { transform: translateY(-1px); box-shadow: 0 5px 12px rgba(0,30,80,0.28), inset 0 1px 2px rgba(255,255,255,0.20); }
button:active, .btn:active { transform: translateY(0); }
button.ghost, .btn.ghost {
  background: #fff; color: #003366; border: 1px solid #c9d2dd;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
button.ghost:hover { background: #f5f7fb; transform: translateY(-1px); }
button.danger { background: linear-gradient(180deg, #c0392b 0%, #962d22 100%); }
button.big { padding: 18px 24px; font-size: 16px; width: 100%; }
button.small { padding: 7px 12px; font-size: 13px; border-radius: 8px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { text-align: left; font-size: 12px; font-weight: 600; color: #5a6677; text-transform: uppercase; letter-spacing: 0.04em; padding: 10px 8px; border-bottom: 2px solid #003366; }
td { padding: 12px 8px; border-bottom: 1px solid #eef1f5; vertical-align: top; }
tr:hover td { background: #f8fafd; }
.badge { display: inline-block; padding: 3px 9px; font-size: 12px; font-weight: 600; border-radius: 20px; }
.badge.review { background: #fff4d6; color: #8a6100; }
.badge.ok { background: #d6f5dd; color: #1e6c33; }
.badge.engineer { background: #d6e4f5; color: #1A4F8F; }
.badge.office { background: #ececf0; color: #555; }
.badge.danger-badge { background: #fdeeec; color: #962d22; }
.stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px; }
@media (min-width: 700px) { .stat-grid { grid-template-columns: repeat(4, 1fr); } }
.stat { background: #fff; border: 1px solid #e3e7ee; padding: 14px; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,30,80,0.04); }
.stat .v { font-size: 26px; font-weight: 700; color: #003366; line-height: 1.1; }
.stat .l { font-size: 12px; color: #5a6677; margin-top: 4px; font-weight: 500; }
.attention-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
@media (min-width: 700px) { .attention-grid { grid-template-columns: repeat(6, 1fr); } }
.att { background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 12px 14px; cursor: pointer; text-align: left; transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s; }
.att:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,30,80,0.12); border-color: #c9d2dd; }
.att .v { font-size: 24px; font-weight: 700; line-height: 1; }
.att .l { font-size: 11px; color: #5a6677; margin-top: 5px; font-weight: 600; }
.att.zero { opacity: 0.5; }
.att.zero:hover { opacity: 0.8; }
.alert { padding: 14px; border-radius: 10px; margin-bottom: 14px; border-left: 4px solid #003366; background: #f0f5fc; font-size: 14px; color: #1a1a1a; }
.alert.warn { border-color: #c0392b; background: #fdeeec; }
.row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.row-between { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.po-display { font-size: 64px; font-weight: 700; color: #003366; letter-spacing: -0.02em; line-height: 1; text-align: center; }
.filter-bar { display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 14px; }
@media (min-width: 700px) { .filter-bar { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); } }
.filter-bar input, .filter-bar select { font-size: 14px; padding: 9px 12px; }
.tab-bar { display: flex; gap: 4px; margin-bottom: 16px; background: #fff; padding: 6px; border-radius: 12px; border: 1px solid #e3e7ee; overflow-x: auto; }
.tab { padding: 9px 14px; cursor: pointer; font-size: 13px; font-weight: 600; color: #5a6677; border-radius: 8px; white-space: nowrap; transition: background 0.15s, color 0.15s; }
.tab.active { background: linear-gradient(180deg, #1A4F8F 0%, #003468 100%); color: #fff; }
.tab:hover:not(.active) { background: #f0f5fc; color: #003366; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 500px) { .grid-2 { grid-template-columns: 1fr; } }
.table-scroll { overflow-x: auto; }
.chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; background: #f0f5fc; border: 1px solid #d6e4f5; border-radius: 20px; font-size: 13px; color: #003366; }
.chip button { padding: 0; width: 18px; height: 18px; line-height: 1; background: transparent; box-shadow: none; color: #5a6677; font-size: 14px; border-radius: 50%; }
.chip button:hover { background: #d6e4f5; transform: none; box-shadow: none; }
.modal-backdrop { display: none; position: fixed; inset: 0; background: rgba(0, 20, 40, 0.5); z-index: 100; justify-content: center; align-items: center; padding: 16px; }
.modal-backdrop.show { display: flex; }
.modal { background: #fff; border-radius: 14px; padding: 20px; max-width: 500px; width: 100%; max-height: 92vh; overflow-y: auto; box-shadow: 0 10px 30px rgba(0,30,80,0.25); }
.bar-chart { display: flex; flex-direction: column; gap: 8px; }
.bar-row { display: grid; grid-template-columns: 140px 1fr 50px; gap: 10px; align-items: center; font-size: 13px; }
@media (max-width: 500px) { .bar-row { grid-template-columns: 100px 1fr 40px; font-size: 12px; } }
.bar-row .name { color: #003366; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar-row .bar { background: #e3e7ee; height: 22px; border-radius: 6px; position: relative; overflow: hidden; }
.bar-row .bar .fill { height: 100%; background: linear-gradient(90deg, #1A4F8F, #003468); border-radius: 6px; transition: width 0.4s ease; }
.bar-row .count { font-weight: 600; color: #003366; text-align: right; }
.fade-in { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
.empty { text-align: center; padding: 40px 20px; color: #5a6677; font-size: 14px; }
code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 13px; background: #f0f5fc; padding: 2px 6px; border-radius: 4px; color: #003366; }
.ac-dropdown {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 50;
  background: #fff; border: 1px solid #c9d2dd; border-top: none;
  border-radius: 0 0 10px 10px; max-height: 280px; overflow-y: auto;
  box-shadow: 0 4px 14px rgba(0,30,80,0.12);
}
.ac-item { padding: 10px 14px; cursor: pointer; font-size: 15px; color: #1a1a1a; border-bottom: 1px solid #f0f5fc; }
.ac-item:last-child { border-bottom: none; }
.ac-item:hover, .ac-item.active { background: #f0f5fc; color: #003366; }
.ac-item strong { color: #1A4F8F; font-weight: 700; background: #fff4d6; }
.ac-empty { padding: 14px; color: #5a6677; font-size: 13px; font-style: italic; }
.my-po { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #eef1f5; align-items: center; }
.my-po:last-child { border-bottom: none; }
.my-po-num { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-weight: 700; color: #003366; font-size: 15px; min-width: 60px; }
.my-po-detail { flex: 1; font-size: 14px; }
`;

function topbar(active) {
  const link = (href, label, key) => `<a href="${href}"${active === key ? ' class="active"' : ''}>${label}</a>`;
  return `<div class="topbar">
    <div class="brand"><a class="backbtn" href="https://mostlane-portal.com/main.html" title="Back to portal" aria-label="Back to portal"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></a><img src="/logo.jpg?v=2" alt="Mostlane"> PO System</div>
    <nav>${link('/office', 'Office', 'office')}${link('/jobs', 'Job Costs', 'jobs')}${link('/summary', 'Summary', 'summary')}${link('/accounts', 'Accounts', 'accounts')}${link('/stats', 'Stats', 'stats')}${link('/admin', 'Admin', 'admin')}</nav>
  </div>`;
}

function pageHead(title, startPath) {
  // startPath lets an installed PWA open the exact page it was added from
  // (an engineer's own PO form, an office user's log) instead of a generic one.
  const manifestHref = '/manifest.webmanifest' + (startPath ? '?start=' + encodeURIComponent(startPath) : '');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Mostlane PO">
    <meta name="application-name" content="Mostlane PO">
    <meta name="theme-color" content="#003366">
    <link rel="manifest" href="${manifestHref}">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <style>${sharedStyles}</style></head><body>`;
}

// ============================================================
// PAGES
// ============================================================
function landingPage() {
  return `${pageHead('Mostlane PO')}${topbar('')}
  <div class="wrap-narrow">
    <div class="card">
      <h1>Mostlane PO System</h1>
      <p class="muted">Internal tool. Engineers use their assigned link. Office and admin views below.</p>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
        <a class="btn" href="/office">📋 Office View</a>
        <a class="btn ghost" href="/stats">📊 Stats</a>
        <a class="btn ghost" href="/admin">⚙️ Admin</a>
      </div>
    </div>
  </div></body></html>`;
}

function unknownEngineerPage() {
  return `${pageHead('Unknown')}${topbar('')}
  <div class="wrap-narrow">
    <div class="card">
      <h2>Link not recognised</h2>
      <p class="muted">Please call the office on <a href="tel:02380262000"><code>02380 262000</code></a>.</p>
    </div>
  </div></body></html>`;
}

function suspendedEngineerPage(eng, officePhone) {
  const phone = officePhone || '02380 262000';
  const telHref = 'tel:' + phone.replace(/[^0-9+]/g, '');
  const reason = eng.suspend_reason
    ? `<p style="margin-top:14px"><strong style="color:#962d22">Reason:</strong> ${escapeHtmlServer(eng.suspend_reason)}</p>`
    : '';
  return `${pageHead('Access suspended')}
  <div class="topbar">
    <div class="brand"><a class="backbtn" href="https://mostlane-portal.com/main.html" title="Back to portal" aria-label="Back to portal"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></a><img src="/logo.jpg?v=2" alt="Mostlane"> PO</div>
    <div style="font-size:13px;font-weight:500">👷 ${escapeHtmlServer(eng.name)}</div>
  </div>
  <div class="wrap-narrow">
    <div class="card fade-in" style="text-align:center;padding:36px 22px">
      <div style="font-size:44px;line-height:1;margin-bottom:12px">🚫</div>
      <h1 style="margin-bottom:8px">Access suspended</h1>
      <p style="font-size:15px;color:#1a1a1a;margin-bottom:4px">Access to the Mostlane PO system has been suspended. Please contact the office for more info.</p>
      ${reason}
      <a class="btn" style="margin-top:20px" href="${telHref}">📞 Call ${escapeHtmlServer(phone)}</a>
    </div>
  </div></body></html>`;
}

function unknownOfficeUserPage() {
  return `${pageHead('Office Link Not Recognised')}${topbar('')}
  <div class="wrap-narrow">
    <div class="card">
      <h2>Office link not recognised</h2>
      <p class="muted">Use your assigned office URL. If you don't have one yet, ask Jamie.</p>
    </div>
  </div></body></html>`;
}

function officeAccessRequiredPage() {
  return `${pageHead('Office Access')}${topbar('')}
  <div class="wrap-narrow">
    <div class="card">
      <h2>Use your office link</h2>
      <p class="muted" style="margin-bottom:12px">Each office user has their own private URL so we can track who issues which PO. If you don't have your link (or it has stopped working), ask Jamie for a new one.</p>
    </div>
  </div></body></html>`;
}

function engineerPage(eng) {
  return `${pageHead('New PO — ' + eng.name, '/e/' + eng.token)}
  <div class="topbar">
    <div class="brand"><a class="backbtn" href="https://mostlane-portal.com/main.html" title="Back to portal" aria-label="Back to portal"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></a><img src="/logo.jpg?v=2" alt="Mostlane"> PO</div>
    <div style="display:flex;align-items:center;gap:12px"><div style="font-size:13px;font-weight:500">👷 ${escapeHtmlServer(eng.name)}</div></div>
  </div>
  <div class="wrap-narrow">
    <div id="status-area"></div>
    <div id="form-area" style="display:none">
      <div class="card fade-in">
        <h1 style="margin-bottom:4px">Raise a PO</h1>
        <p class="muted">Outside office hours only. Enter a site or an incident number, plus supplier and description.</p>
        <div id="prefill-note" style="display:none;margin-top:12px;padding:10px 12px;border-radius:10px;background:#d6f5dd;color:#1e6c33;font-size:13px;font-weight:600"></div>
        <div class="field" style="position:relative;margin-top:16px">
          <label>Site</label>
          <input id="site" type="text" placeholder="Start typing..." autocomplete="off" oninput="filterSites()" onfocus="filterSites()" onblur="setTimeout(hideSites,200)">
          <div id="site-dropdown" class="ac-dropdown" style="display:none"></div>
        </div>
        <div class="field">
          <label>Incident number <span style="font-weight:400;color:#5a6677">(for incident jobs — use instead of, or as well as, a site)</span></label>
          <input id="incident_no" type="text" placeholder="e.g. INC123456" autocomplete="off">
        </div>
        <div class="field" style="position:relative">
          <label>Supplier</label>
          <input id="supplier" type="text" placeholder="Start typing..." autocomplete="off" oninput="filterSuppliers()" onfocus="filterSuppliers()" onblur="setTimeout(hideSuppliers,200)">
          <div id="supplier-dropdown" class="ac-dropdown" style="display:none"></div>
        </div>
        <div class="field">
          <label>Description</label>
          <textarea id="description" placeholder="What's being purchased"></textarea>
        </div>
        <button class="big" onclick="submitPO(this)">Issue PO Number</button>
      </div>
      <div class="card fade-in" id="my-pos-card" style="display:none">
        <h2>My Recent POs</h2>
        <div id="my-pos-list"></div>
      </div>
    </div>
    <div id="result-area" style="display:none"></div>
  </div>
<script>
const ENGINEER = ${JSON.stringify({ slug: eng.slug, name: eng.name })};
let SUPPLIERS = [];
let SITES = [];
async function init() {
  const [status, suppliers, sites] = await Promise.all([
    fetch('/api/status').then(r => r.json()),
    fetch('/api/suppliers').then(r => r.json()),
    fetch('/api/sites').then(r => r.json())
  ]);
  SUPPLIERS = suppliers;
  SITES = sites;
  const statusArea = document.getElementById('status-area');
  if (status.mode === 'disabled') { statusArea.innerHTML = '<div class="card fade-in"><div class="alert warn">' + escapeHtml(status.message) + '</div></div>'; loadMyPOs(true); return; }
  if (status.mode === 'office_hours') {
    statusArea.innerHTML = '<div class="card fade-in" style="text-align:center;padding:36px 20px"><h2>Office is open</h2><p class="muted" style="margin-bottom:18px">' + escapeHtml(status.message) + '</p><a href="tel:02380262000" class="btn">📞 Call 02380 262000</a></div>';
    loadMyPOs(true);
    return;
  }
  document.getElementById('form-area').style.display = 'block';
  prefillFromJobLink();
  loadMyPOs(false);
}
// The portal's "Raise PO for this job" link opens this page with the job
// encoded on the fragment as #mlpo=<base64 JSON>. Fill only empty fields —
// never overwrite what the engineer has already typed — and leave supplier
// and description to them. Any bad or missing payload just leaves it blank.
function prefillFromJobLink() {
  const m = location.hash.match(/mlpo=([^&]+)/);
  if (!m) return;
  try {
    let raw = m[1].replace(/-/g, '+').replace(/_/g, '/');
    while (raw.length % 4) raw += '=';
    const bin = atob(raw);
    let json;
    try {
      json = new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
    } catch (e) {
      json = decodeURIComponent(escape(bin));
    }
    const d = JSON.parse(json);
    const siteField = document.getElementById('site');
    const incidentField = document.getElementById('incident_no');
    let filled = false;
    if (d.site && siteField && !siteField.value) { siteField.value = d.site; filled = true; }
    if (d.jobRef && incidentField && !incidentField.value) { incidentField.value = d.jobRef; filled = true; }
    if (filled) {
      const note = document.getElementById('prefill-note');
      if (note) {
        const label = d.jobRef || d.site || '';
        note.textContent = label ? ('✓ Pre-filled from job ' + label) : '✓ Pre-filled from job';
        note.style.display = 'block';
      }
    }
  } catch (e) { /* malformed payload — leave the form blank */ }
}
function filterSites() {
  const input = document.getElementById('site');
  const dd = document.getElementById('site-dropdown');
  const q = input.value.trim().toLowerCase();
  if (!q) { dd.style.display = 'none'; return; }
  const matches = SITES.filter(s => s.name.toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) { dd.innerHTML = '<div class="ac-empty">No match — your entry will be saved as a new site for review</div>'; dd.style.display = 'block'; return; }
  dd.innerHTML = matches.map(s => '<div class="ac-item" onmousedown="pickSite(\\''+escapeJsAttr(s.name)+'\\')">'+highlight(s.name, q)+'</div>').join('');
  dd.style.display = 'block';
}
function pickSite(name) { document.getElementById('site').value = name; hideSites(); }
function hideSites() { document.getElementById('site-dropdown').style.display = 'none'; }
function filterSuppliers() {
  const input = document.getElementById('supplier');
  const dd = document.getElementById('supplier-dropdown');
  const q = input.value.trim().toLowerCase();
  if (!q) { dd.style.display = 'none'; return; }
  const matches = SUPPLIERS.filter(s => s.name.toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) { dd.innerHTML = '<div class="ac-empty">No suppliers match — pick one from the list</div>'; dd.style.display = 'block'; return; }
  dd.innerHTML = matches.map(s => '<div class="ac-item" onmousedown="pickSupplier(\\''+escapeJsAttr(s.name)+'\\')">'+highlight(s.name, q)+'</div>').join('');
  dd.style.display = 'block';
}
function highlight(text, q) {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return escapeHtml(text);
  return escapeHtml(text.slice(0,i)) + '<strong>' + escapeHtml(text.slice(i,i+q.length)) + '</strong>' + escapeHtml(text.slice(i+q.length));
}
function pickSupplier(name) {
  document.getElementById('supplier').value = name;
  hideSuppliers();
}
function hideSuppliers() { document.getElementById('supplier-dropdown').style.display = 'none'; }
async function loadMyPOs(officeHours) {
  try {
    const params = new URLSearchParams();
    params.set('engineer', ENGINEER.slug);
    params.set('hide_subcontractor', '1');
    const pos = await fetch('/api/pos?' + params).then(r => r.json());
    if (!pos.length) return;
    const card = document.getElementById('my-pos-card');
    const list = document.getElementById('my-pos-list');
    if (!card || !list) return;
    card.style.display = 'block';
    list.innerHTML = pos.slice(0, 20).map(p => {
      const dStr = fmtDateTime(p.issued_at);
      const where = p.incident_no ? ('🎫 ' + escapeHtml(p.incident_no) + (p.site ? ' · ' + escapeHtml(p.site) : '')) : escapeHtml(p.site || '—');
      return '<div class="my-po"><div class="my-po-num">'+p.po_number+'</div><div class="my-po-detail"><div><strong>'+escapeHtml(p.supplier || '—')+'</strong> · <span class="muted">'+where+'</span></div><div class="muted" style="font-size:12px;margin-top:2px">'+dStr+'</div></div></div>';
    }).join('');
    if (officeHours) {
      document.getElementById('status-area').appendChild(card);
    }
  } catch (e) { console.error('loadMyPOs failed', e); }
}
let submittingEngineerPO = false;
async function submitPO(btn) {
  if (submittingEngineerPO) return;
  const site = document.getElementById('site').value.trim();
  const incident = document.getElementById('incident_no').value.trim();
  const supplier = document.getElementById('supplier').value.trim();
  const description = document.getElementById('description').value.trim();
  if (!site && !incident) { alert('Enter a site or an incident number'); return; }
  if (!supplier) { alert('Supplier is required'); return; }
  if (!description) { alert('Description is required'); return; }
  const valid = SUPPLIERS.some(s => s.name === supplier);
  if (!valid) { alert('Please pick a supplier from the dropdown list'); return; }
  submittingEngineerPO = true;
  if (btn) { btn.disabled = true; btn.textContent = 'Issuing...'; }
  try {
    const res = await fetch('/api/pos', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engineer_slug: ENGINEER.slug, engineer_name: ENGINEER.name, source: 'engineer', site, incident_no: incident, supplier, description }) }).then(r => r.json());
    if (res.error) { alert(res.error); if (btn) { btn.disabled = false; btn.textContent = 'Issue PO Number'; } submittingEngineerPO = false; return; }
    document.getElementById('form-area').style.display = 'none';
    document.getElementById('result-area').style.display = 'block';
    document.getElementById('result-area').innerHTML = \`
      <div class="card fade-in" style="text-align:center;padding:40px 20px">
        <p class="muted" style="text-transform:uppercase;font-size:12px;letter-spacing:0.08em;margin-bottom:8px">PO Number Issued</p>
        <div class="po-display">\${res.po_number}</div>
        <div style="margin:24px 0;color:#5a6677;font-size:14px;line-height:1.7">
          <strong style="color:#003366">\${incident ? '🎫 ' + escapeHtml(incident) + (site ? ' · ' + escapeHtml(site) : '') : escapeHtml(site)}</strong><br>
          \${escapeHtml(supplier)}<br><span style="font-size:13px">\${escapeHtml(description)}</span>
        </div>
        <button class="ghost" onclick="location.reload()">Raise Another</button>
      </div>\`;
  } catch (err) { alert('Error: ' + err.message); if (btn) { btn.disabled = false; btn.textContent = 'Issue PO Number'; } submittingEngineerPO = false; }
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }
function escapeJsAttr(s) { return String(s).replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'"); }
function fmtDate(v) {
  if (!v) return '';
  const s = String(v);
  if (s.length === 10 && s.charAt(4) === '-') return s.slice(8,10) + '-' + s.slice(5,7) + '-' + s.slice(2,4);
  const d = new Date(v);
  if (isNaN(d)) return s;
  const p = n => (n < 10 ? '0' : '') + n;
  return p(d.getDate()) + '-' + p(d.getMonth() + 1) + '-' + String(d.getFullYear()).slice(2);
}
function fmtDateTime(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  const p = n => (n < 10 ? '0' : '') + n;
  return fmtDate(d) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
init();
</script></body></html>`;
}

function officePage(user) {
  return `${pageHead('Office — ' + user.name, '/o/' + user.token)}
  <div class="topbar">
    <div class="brand"><a class="backbtn" href="https://mostlane-portal.com/main.html" title="Back to portal" aria-label="Back to portal"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></a><img src="/logo.jpg?v=2" alt="Mostlane"> PO / Office</div>
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:13px;font-weight:500">👤 ${escapeHtmlServer(user.name)}</div>
      <nav><a href="/jobs">Job Costs</a><a href="/summary">Summary</a><a href="/accounts">Accounts</a><a href="/stats">Stats</a><a href="/admin">Admin</a></nav>
    </div>
  </div>
  <div class="wrap">
    <div class="row-between">
      <h1 style="margin:0">PO Log</h1>
      <div class="row">
        <button class="ghost small" onclick="exportCSV()">⬇ Export CSV</button>
        <button class="ghost small" onclick="openReport()">🖨 PDF Report</button>
        <button class="small" onclick="openNewPO()">+ New PO</button>
      </div>
    </div>
    <div class="card" id="attention-card" style="display:none;padding:16px">
      <h2 style="margin-bottom:10px">Needs attention</h2>
      <div class="attention-grid" id="attention"></div>
    </div>
    <div class="stat-grid" id="stats"></div>

    <div class="tab-bar" id="status-tabs">
      <div class="tab active" data-status="">All</div>
      <div class="tab" data-status="open">Open</div>
      <div class="tab" data-status="priced">Priced</div>
      <div class="tab" data-status="flagged">🚩 Flagged</div>
      <div class="tab" data-status="credit_due">💷 Credit Due</div>
      <div class="tab" data-status="complete">✓ Complete</div>
    </div>

    <div class="card">
      <div class="field" style="margin-bottom:10px">
        <input id="search-input" type="text" placeholder="🔍 Search PO #, engineer, site, incident no, supplier, description..." oninput="loadPOs()">
      </div>
      <div class="filter-bar">
        <select id="filter-engineer"><option value="">All engineers</option></select>
        <select id="filter-office-user"><option value="">All office users</option></select>
        <select id="filter-supplier"><option value="">All suppliers</option></select>
        <select id="filter-category"><option value="">Materials + Subcontractor</option><option value="materials">📦 Materials only</option><option value="subcontractor">👷 Subcontractor only</option></select>
        <input id="filter-from" type="date">
        <input id="filter-to" type="date">
      </div>
      <div class="row" style="margin-bottom:0">
        <label style="display:flex;align-items:center;gap:8px;margin:0;color:#1a1a1a;font-weight:500;font-size:14px;cursor:pointer">
          <input type="checkbox" id="filter-review" style="width:auto;margin:0" onchange="loadPOs()"> Needs office review
        </label>
        <label style="display:flex;align-items:center;gap:8px;margin:0;color:#1a1a1a;font-weight:500;font-size:14px;cursor:pointer">
          <input type="checkbox" id="filter-uncosted" style="width:auto;margin:0" onchange="loadPOs()"> Uncosted only
        </label>
        <label style="display:flex;align-items:center;gap:8px;margin:0;color:#1a1a1a;font-weight:500;font-size:14px;cursor:pointer">
          <input type="checkbox" id="filter-unmatched-site" style="width:auto;margin:0" onchange="loadPOs()"> Site not in list
        </label>
        <button class="ghost small" onclick="clearFilters()">Clear filters</button>
      </div>
    </div>
    <div class="card" style="padding:0">
      <div class="table-scroll">
        <table>
          <thead><tr><th>PO #</th><th>Issued</th><th>Issued By</th><th>Engineer</th><th>Site / Incident</th><th>Supplier</th><th>Cost</th><th>Status</th><th></th></tr></thead>
          <tbody id="po-tbody"></tbody>
        </table>
      </div>
    </div>
  </div>
  <div class="modal-backdrop" id="modal"><div class="modal">
    <div class="row-between"><h2 id="modal-title" style="margin:0"></h2><button class="ghost small" onclick="closeModal()">✕</button></div>
    <div id="modal-body" style="margin-top:12px"></div>
  </div></div>
<script>
const OFFICE_USER = ${JSON.stringify({ slug: user.slug, name: user.name })};
let allPOs = [], allEngineers = [], allSuppliers = [], allSites = [], allSubcontractors = [], allTrades = [];
let currentStatus = '';
async function init() {
  const [engineers, suppliers, sites, officeUsers, subs, trades] = await Promise.all([
    fetch('/api/engineers').then(r => r.json()),
    fetch('/api/suppliers').then(r => r.json()),
    fetch('/api/sites').then(r => r.json()),
    fetch('/api/office-users').then(r => r.json()),
    fetch('/api/subcontractors').then(r => r.json()).catch(() => []),
    fetch('/api/trades').then(r => r.json()).catch(() => [])
  ]);
  allEngineers = engineers; allSuppliers = suppliers; allSites = sites; allSubcontractors = subs; allTrades = trades;
  document.getElementById('filter-engineer').innerHTML = '<option value="">All engineers</option>' + engineers.filter(e => e.active).map(e => '<option value="' + e.slug + '">' + escapeHtml(e.name) + '</option>').join('');
  document.getElementById('filter-supplier').innerHTML = '<option value="">All suppliers</option>' + suppliers.map(s => '<option value="' + escapeAttr(s.name) + '">' + escapeHtml(s.name) + '</option>').join('');
  document.getElementById('filter-office-user').innerHTML = '<option value="">All office users</option>' + officeUsers.filter(u => u.active).map(u => '<option value="' + u.slug + '">' + escapeHtml(u.name) + '</option>').join('');
  ['filter-engineer','filter-supplier','filter-category','filter-from','filter-to','filter-office-user'].forEach(id => { document.getElementById(id).onchange = loadPOs; });
  document.querySelectorAll('#status-tabs .tab').forEach(t => {
    t.addEventListener('click', () => { setStatusTab(t.dataset.status || ''); loadPOs(); });
  });
  loadPOs();
  loadDashboard();
}
function setStatusTab(status) {
  document.querySelectorAll('#status-tabs .tab').forEach(x => x.classList.toggle('active', (x.dataset.status || '') === status));
  currentStatus = status;
}
async function loadDashboard() {
  let d;
  try { d = await fetch('/api/dashboard').then(r => r.json()); } catch (e) { return; }
  const cards = [
    ['uncosted', 'Uncosted', d.uncosted, '#003366'],
    ['review', 'Awaiting review', d.needs_review, '#b58a00'],
    ['flagged', 'Flagged', d.flagged, '#c0392b'],
    ['credit_due', 'Credit due', d.credit_due, '#b58a00'],
    ['unmatched_site', 'Site not in list', d.unmatched_site, '#b58a00'],
    ['today', 'Raised today', d.today, '#003366']
  ];
  document.getElementById('attention-card').style.display = 'block';
  document.getElementById('attention').innerHTML = cards.map(([kind, label, v, color]) =>
    '<div class="att ' + (v ? '' : 'zero') + '" onclick="applyAttention(\\'' + kind + '\\')"><div class="v" style="color:' + (v ? color : '#003366') + '">' + v + '</div><div class="l">' + label + '</div></div>'
  ).join('');
}
// Clicking an attention card resets filters and isolates that backlog.
function applyAttention(kind) {
  resetFilterInputs();
  if (kind === 'uncosted') document.getElementById('filter-uncosted').checked = true;
  else if (kind === 'review') document.getElementById('filter-review').checked = true;
  else if (kind === 'unmatched_site') document.getElementById('filter-unmatched-site').checked = true;
  else if (kind === 'flagged') setStatusTab('flagged');
  else if (kind === 'credit_due') setStatusTab('credit_due');
  else if (kind === 'today') {
    const t = new Date().toISOString().split('T')[0];
    document.getElementById('filter-from').value = t;
    document.getElementById('filter-to').value = t;
  }
  loadPOs();
  const tbl = document.querySelector('.table-scroll');
  if (tbl) tbl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function formatMoney(n) { return '£' + Number(n).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ','); }
function renderStats() {
  const today = new Date().toISOString().split('T')[0];
  const todayPOs = allPOs.filter(p => p.issued_at && p.issued_at.startsWith(today)).length;
  const flagged = allPOs.filter(p => p.status === 'flagged').length;
  const creditDue = allPOs.filter(p => p.status === 'credit_due').length;
  const uncosted = allPOs.filter(p => p.cost_ex_vat == null).length;
  const siteNames = new Set(allSites.map(s => s.name));
  const unmatchedSites = allPOs.filter(p => p.site && !siteNames.has(p.site)).length;
  const totalSpend = allPOs.reduce((s, p) => s + (p.cost_ex_vat != null ? Number(p.cost_ex_vat) : 0), 0);
  document.getElementById('stats').innerHTML = \`
    <div class="stat"><div class="v">\${allPOs.length}</div><div class="l">Showing</div></div>
    <div class="stat"><div class="v">\${uncosted}</div><div class="l">Uncosted</div></div>
    <div class="stat"><div class="v" style="color:\${unmatchedSites?'#b58a00':'#003366'}">\${unmatchedSites}</div><div class="l">Site needs review</div></div>
    <div class="stat"><div class="v" style="color:\${flagged?'#c0392b':'#003366'}">\${flagged}</div><div class="l">Flagged</div></div>
    <div class="stat"><div class="v" style="color:\${creditDue?'#b58a00':'#003366'}">\${creditDue}</div><div class="l">Credit Due</div></div>
    <div class="stat"><div class="v">\${formatMoney(totalSpend)}</div><div class="l">Total ex VAT</div></div>\`;
}
async function loadPOs() {
  const params = new URLSearchParams();
  const eng = document.getElementById('filter-engineer').value;
  const officeUser = document.getElementById('filter-office-user').value;
  const sup = document.getElementById('filter-supplier').value;
  const category = document.getElementById('filter-category').value;
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const review = document.getElementById('filter-review').checked;
  const uncosted = document.getElementById('filter-uncosted').checked;
  const unmatchedSite = document.getElementById('filter-unmatched-site').checked;
  const search = document.getElementById('search-input').value.trim();
  if (eng) params.set('engineer', eng);
  if (officeUser) params.set('office_user', officeUser);
  if (sup) params.set('supplier', sup);
  if (category) params.set('category', category);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (review) params.set('needs_review', '1');
  if (uncosted) params.set('uncosted', '1');
  if (unmatchedSite) params.set('unmatched_site', '1');
  if (search) params.set('search', search);
  if (currentStatus) params.set('status', currentStatus);
  allPOs = await fetch('/api/pos?' + params).then(r => r.json());
  renderStats(); renderPOs(allPOs);
}
function resetFilterInputs() {
  ['filter-engineer','filter-office-user','filter-supplier','filter-category','filter-from','filter-to','search-input'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('filter-review').checked = false;
  document.getElementById('filter-uncosted').checked = false;
  document.getElementById('filter-unmatched-site').checked = false;
  setStatusTab('');
}
function clearFilters() { resetFilterInputs(); loadPOs(); }
function statusBadge(p) {
  const s = p.status || 'open';
  const map = {
    open: '<span class="badge office">Open</span>',
    priced: '<span class="badge ok">Priced</span>',
    flagged: '<span class="badge danger-badge">🚩 Flagged</span>',
    credit_due: '<span class="badge review">💷 Credit Due</span>',
    complete: '<span class="badge ok">✓ Complete</span>'
  };
  let html = map[s] || map.open;
  if (p.needs_review) html += ' <span class="badge review" title="Engineer-raised, needs office review">Review</span>';
  return html;
}
function renderPOs(pos) {
  const tbody = document.getElementById('po-tbody');
  if (!pos.length) { tbody.innerHTML = '<tr><td colspan="9"><div class="empty">No POs match your filters.</div></td></tr>'; return; }
  const siteNames = new Set(allSites.map(s => s.name));
  tbody.innerHTML = pos.map(p => {
    const dStr = fmtDateTime(p.issued_at);
    const cost = p.cost_ex_vat != null ? formatMoney(p.cost_ex_vat) : '<span class="muted">—</span>';
    const siteUnmatched = p.site && !siteNames.has(p.site);
    let siteCell = (p.site ? escapeHtml(p.site) : (p.incident_no ? '<span class="muted">—</span>' : '—')) + (siteUnmatched ? ' <span title="Site not in master list" style="color:#b58a00">⚠️</span>' : '');
    if (p.incident_no) siteCell += '<div style="font-size:12px;margin-top:2px"><span class="badge engineer" title="Incident number">🎫 ' + escapeHtml(p.incident_no) + '</span></div>';
    const isSub = (p.cost_category || 'materials') === 'subcontractor';
    let supplierCell = escapeHtml(p.supplier || '—');
    if (isSub) supplierCell += '<div style="font-size:12px;margin-top:2px"><span class="badge review" title="Subcontractor PO">👷 ' + escapeHtml(p.trade || 'Subcontractor') + '</span></div>';
    return \`<tr>
      <td><strong style="color:#003366">\${p.po_number}</strong></td>
      <td class="muted">\${dStr}</td>
      <td>\${escapeHtml(p.office_user_name || (p.source === 'engineer' ? '(engineer)' : '—'))}</td>
      <td>\${escapeHtml(p.engineer_name || '—')}</td>
      <td>\${siteCell}</td>
      <td>\${supplierCell}</td>
      <td>\${cost}</td>
      <td>\${statusBadge(p)}</td>
      <td><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="ghost small" onclick='openEdit(\${p.po_number})'>Edit</button><button class="danger small" title="Delete PO \${p.po_number}" onclick='hardDeletePO(\${p.po_number}, false)'>🗑</button></div></td>
    </tr>\`;
  }).join('');
}
async function openNewPO() {
  if (!allEngineers || allEngineers.length === 0) {
    try { allEngineers = await fetch('/api/engineers').then(r => r.json()); } catch (e) { console.error('fetch engineers failed', e); }
  }
  if (!allSuppliers || allSuppliers.length === 0) {
    try { allSuppliers = await fetch('/api/suppliers').then(r => r.json()); } catch (e) { console.error('fetch suppliers failed', e); }
  }
  if (!allSites || allSites.length === 0) {
    try { allSites = await fetch('/api/sites').then(r => r.json()); } catch (e) { console.error('fetch sites failed', e); }
  }
  if (!allSubcontractors || allSubcontractors.length === 0) {
    try { allSubcontractors = await fetch('/api/subcontractors').then(r => r.json()); } catch (e) { console.error('fetch subcontractors failed', e); }
  }
  if (!allTrades || allTrades.length === 0) {
    try { allTrades = await fetch('/api/trades').then(r => r.json()); } catch (e) { console.error('fetch trades failed', e); }
  }
  const activeEngs = (allEngineers || []).filter(e => Number(e.active) === 1);
  const engOptions = activeEngs.map(e => '<option value="' + e.slug + '">' + escapeHtml(e.name) + '</option>').join('');
  const subOptions = (allSubcontractors || []).map(s => '<option value="' + escapeAttr(s.name) + '">' + escapeHtml(s.name) + '</option>').join('');
  const tradeOptions = (allTrades || []).map(t => '<option value="' + escapeAttr(t.name) + '">' + escapeHtml(t.name) + '</option>').join('');
  document.getElementById('modal-title').textContent = 'New PO';
  document.getElementById('modal-body').innerHTML = \`
    <div class="field"><label>PO type</label>
      <div class="tab-bar" style="margin-bottom:0">
        <div class="tab active" id="mtype-materials" onclick="setMType('materials')">📦 Materials</div>
        <div class="tab" id="mtype-subcontractor" onclick="setMType('subcontractor')">👷 Subcontractor</div>
      </div>
    </div>
    <div class="field" id="m-engineer-field"><label>Engineer (optional)</label><select id="m-engineer"><option value="">— None / Office —</option>\${engOptions}</select></div>
    <div class="field" style="position:relative"><label id="m-site-label">Site</label><input id="m-site" type="text" autocomplete="off" oninput="filterMSites()" onfocus="filterMSites()" onblur="setTimeout(hideMSites,200)"><div id="m-site-dropdown" class="ac-dropdown" style="display:none"></div></div>
    <div id="m-materials-fields">
      <div class="field"><label>Incident number <span style="font-weight:400;color:#5a6677">(optional)</span></label><input id="m-incident" type="text" placeholder="e.g. INC123456" autocomplete="off"></div>
      <div class="field" style="position:relative"><label>Supplier</label><input id="m-supplier" type="text" autocomplete="off" oninput="filterMSuppliers()" onfocus="filterMSuppliers()" onblur="setTimeout(hideMSuppliers,200)"><div id="m-supplier-dropdown" class="ac-dropdown" style="display:none"></div></div>
    </div>
    <div id="m-sub-fields" style="display:none">
      <div class="field"><label>Subcontractor</label><select id="m-subcontractor">\${subOptions ? '<option value="">— Select —</option>' + subOptions : '<option value="">No subcontractors — add them in Admin</option>'}</select></div>
      <div class="field"><label>Trade</label><select id="m-trade">\${tradeOptions ? '<option value="">— Select —</option>' + tradeOptions : '<option value="">No trades — add them in Admin</option>'}</select></div>
    </div>
    <div class="field"><label>Description</label><textarea id="m-description"></textarea></div>
    <button onclick="submitNewPO(this)">Issue PO</button>\`;
  window.mType = 'materials';
  document.getElementById('modal').classList.add('show');
}
function setMType(t) {
  window.mType = t;
  const sub = t === 'subcontractor';
  document.getElementById('mtype-materials').classList.toggle('active', !sub);
  document.getElementById('mtype-subcontractor').classList.toggle('active', sub);
  document.getElementById('m-materials-fields').style.display = sub ? 'none' : 'block';
  document.getElementById('m-sub-fields').style.display = sub ? 'block' : 'none';
  document.getElementById('m-engineer-field').style.display = sub ? 'none' : 'block';
  document.getElementById('m-site-label').textContent = sub ? 'Site (job)' : 'Site';
}
function filterMSites() {
  const input = document.getElementById('m-site');
  const dd = document.getElementById('m-site-dropdown');
  if (!input || !dd) return;
  const q = input.value.trim().toLowerCase();
  if (!q) { dd.style.display = 'none'; return; }
  const matches = (allSites || []).filter(s => s.name.toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) { dd.innerHTML = '<div class="ac-empty">No match — will be saved as free-text site</div>'; dd.style.display = 'block'; return; }
  dd.innerHTML = matches.map(s => '<div class="ac-item" onmousedown="pickMSite(\\''+escapeJsAttr(s.name)+'\\')">'+highlightText(s.name, q)+'</div>').join('');
  dd.style.display = 'block';
}
function pickMSite(name) { document.getElementById('m-site').value = name; hideMSites(); }
function hideMSites() { const dd = document.getElementById('m-site-dropdown'); if (dd) dd.style.display = 'none'; }
function filterMSuppliers() {
  const input = document.getElementById('m-supplier');
  const dd = document.getElementById('m-supplier-dropdown');
  if (!input || !dd) return;
  const q = input.value.trim().toLowerCase();
  if (!q) { dd.style.display = 'none'; return; }
  const matches = (allSuppliers || []).filter(s => s.name.toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) { dd.innerHTML = '<div class="ac-empty">No suppliers match — pick one from the list</div>'; dd.style.display = 'block'; return; }
  dd.innerHTML = matches.map(s => '<div class="ac-item" onmousedown="pickMSupplier(\\''+escapeJsAttr(s.name)+'\\')">'+highlightText(s.name, q)+'</div>').join('');
  dd.style.display = 'block';
}
function pickMSupplier(name) { document.getElementById('m-supplier').value = name; hideMSuppliers(); }
function hideMSuppliers() { const dd = document.getElementById('m-supplier-dropdown'); if (dd) dd.style.display = 'none'; }
function filterESuppliers() {
  const input = document.getElementById('e-supplier');
  const dd = document.getElementById('e-supplier-dropdown');
  if (!input || !dd) return;
  const q = input.value.trim().toLowerCase();
  if (!q) { dd.style.display = 'none'; return; }
  const matches = (allSuppliers || []).filter(s => s.name.toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) { dd.innerHTML = '<div class="ac-empty">No suppliers match — pick one from the list</div>'; dd.style.display = 'block'; return; }
  dd.innerHTML = matches.map(s => '<div class="ac-item" onmousedown="pickESupplier(\\''+escapeJsAttr(s.name)+'\\')">'+highlightText(s.name, q)+'</div>').join('');
  dd.style.display = 'block';
}
function pickESupplier(name) { document.getElementById('e-supplier').value = name; hideESuppliers(); }
function hideESuppliers() { const dd = document.getElementById('e-supplier-dropdown'); if (dd) dd.style.display = 'none'; }
function highlightText(text, q) {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return escapeHtml(text);
  return escapeHtml(text.slice(0,i)) + '<strong>' + escapeHtml(text.slice(i,i+q.length)) + '</strong>' + escapeHtml(text.slice(i+q.length));
}
function escapeJsAttr(s) { return String(s).replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'"); }
let submittingNewPO = false;
async function submitNewPO(btn) {
  if (submittingNewPO) return;
  const isSub = window.mType === 'subcontractor';
  const site = document.getElementById('m-site').value.trim();
  const description = document.getElementById('m-description').value.trim();
  let body;
  if (isSub) {
    const subcontractor = document.getElementById('m-subcontractor').value.trim();
    const trade = document.getElementById('m-trade').value.trim();
    if (!site) { alert('Site (job) is required for a subcontractor PO'); return; }
    if (!subcontractor) { alert('Please pick a subcontractor'); return; }
    if (!trade) { alert('Please pick a trade'); return; }
    if (!description) { alert('Description is required'); return; }
    body = { source: 'office', cost_category: 'subcontractor', site, supplier: subcontractor, trade, description,
      office_user_slug: OFFICE_USER.slug, office_user_name: OFFICE_USER.name };
  } else {
    const incident = document.getElementById('m-incident').value.trim();
    const supplier = document.getElementById('m-supplier').value.trim();
    if (!site && !incident) { alert('Enter a site or an incident number'); return; }
    if (!supplier) { alert('Supplier is required'); return; }
    if (!description) { alert('Description is required'); return; }
    if (!(allSuppliers || []).some(s => s.name === supplier)) { alert('Please pick a supplier from the dropdown list'); return; }
    const engSlug = document.getElementById('m-engineer').value;
    const eng = allEngineers.find(e => e.slug === engSlug);
    body = { engineer_slug: engSlug || null, engineer_name: eng ? eng.name : null, source: 'office', cost_category: 'materials',
      site, incident_no: incident, supplier, description,
      office_user_slug: OFFICE_USER.slug, office_user_name: OFFICE_USER.name };
  }
  submittingNewPO = true;
  if (btn) { btn.disabled = true; btn.textContent = 'Issuing...'; }
  try {
    const res = await fetch('/api/pos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
    if (res.error) { alert(res.error); return; }
    alert('PO ' + res.po_number + ' issued');
    closeModal(); loadPOs(); loadDashboard();
  } catch (e) {
    alert('Error: ' + e.message);
  } finally {
    submittingNewPO = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Issue PO'; }
  }
}
function openEdit(poNumber) {
  const p = allPOs.find(x => x.po_number === poNumber);
  const status = p.status || 'open';
  const vatRate = p.vat_rate != null ? p.vat_rate : 20;
  const costEx = p.cost_ex_vat != null ? p.cost_ex_vat : '';
  const costInc = p.cost_ex_vat != null ? (p.cost_ex_vat * (1 + vatRate / 100)).toFixed(2) : '';
  document.getElementById('modal-title').textContent = 'PO ' + poNumber;
  const auditBits = [];
  if (p.office_user_name) auditBits.push('Issued by <strong>' + escapeHtml(p.office_user_name) + '</strong>');
  else if (p.source === 'engineer') auditBits.push('Issued by engineer (' + escapeHtml(p.engineer_name || '—') + ')');
  if (p.last_edited_by_name && p.last_edited_at) {
    auditBits.push('Last edited by <strong>' + escapeHtml(p.last_edited_by_name) + '</strong> on ' + fmtDateTime(p.last_edited_at));
  }
  const auditHtml = auditBits.length ? '<div class="muted" style="font-size:12px;margin-bottom:12px;line-height:1.5">' + auditBits.join('<br>') + '</div>' : '';
  document.getElementById('modal-body').innerHTML = auditHtml + \`
    <h3 style="margin-bottom:6px;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#5a6677">Details</h3>
    <div class="field"><label>Engineer</label><select id="e-engineer"><option value="">— None —</option>\${allEngineers.map(e => '<option value="' + e.slug + '"' + (e.slug === p.engineer_slug ? ' selected' : '') + '>' + escapeHtml(e.name) + '</option>').join('')}</select></div>
    <div class="field" style="position:relative"><label>Site</label>
      <input id="e-site" type="text" autocomplete="off" value="\${escapeAttr(p.site || '')}" oninput="filterEditSites()" onfocus="filterEditSites()" onblur="setTimeout(hideEditSites,200)">
      <div id="e-site-dropdown" class="ac-dropdown" style="display:none"></div>
      <div id="e-site-status" style="margin-top:6px;font-size:12px"></div>
    </div>
    <div class="field"><label>Incident number</label><input id="e-incident" type="text" placeholder="e.g. INC123456" autocomplete="off" value="\${escapeAttr(p.incident_no || '')}"></div>
    <div class="field" style="position:relative"><label>\${(p.cost_category === 'subcontractor') ? 'Subcontractor' : 'Supplier'}</label><input id="e-supplier" type="text" autocomplete="off" value="\${escapeAttr(p.supplier || '')}" oninput="filterESuppliers()" onfocus="filterESuppliers()" onblur="setTimeout(hideESuppliers,200)"><div id="e-supplier-dropdown" class="ac-dropdown" style="display:none"></div></div>
    \${(p.cost_category === 'subcontractor') ? '<div class="field"><label>Trade <span class="badge review" style="font-weight:600">👷 Subcontractor</span></label><select id="e-trade"><option value="">— Select —</option>' + (allTrades || []).map(t => '<option value="' + escapeAttr(t.name) + '"' + (t.name === p.trade ? ' selected' : '') + '>' + escapeHtml(t.name) + '</option>').join('') + (p.trade && !(allTrades || []).some(t => t.name === p.trade) ? '<option value="' + escapeAttr(p.trade) + '" selected>' + escapeHtml(p.trade) + '</option>' : '') + '</select></div>' : ''}
    <div class="field"><label>Description</label><textarea id="e-description">\${escapeHtml(p.description || '')}</textarea></div>

    <h3 style="margin-top:18px;margin-bottom:6px;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#5a6677">Invoice / Cost</h3>
    <div class="grid-2">
      <div class="field"><label>Cost ex VAT (£)</label><input id="e-cost-ex" type="number" step="0.01" value="\${costEx}" oninput="syncCost('ex')"></div>
      <div class="field"><label>VAT rate (%)</label><input id="e-vat-rate" type="number" step="0.01" value="\${vatRate}" oninput="syncCost('rate')"></div>
    </div>
    <div class="field"><label>Cost inc VAT (£)</label><input id="e-cost-inc" type="number" step="0.01" value="\${costInc}" oninput="syncCost('inc')"></div>

    <h3 style="margin-top:18px;margin-bottom:6px;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#5a6677">Status</h3>
    <div class="field"><label>Status</label>
      <select id="e-status">
        <option value="open"\${status==='open'?' selected':''}>Open (awaiting invoice)</option>
        <option value="priced"\${status==='priced'?' selected':''}>Priced (invoice entered)</option>
        <option value="flagged"\${status==='flagged'?' selected':''}>🚩 Flagged (suspicious / tools / query)</option>
        <option value="credit_due"\${status==='credit_due'?' selected':''}>💷 Credit Due</option>
        <option value="complete"\${status==='complete'?' selected':''}>✓ Complete</option>
      </select>
    </div>
    <div class="field" id="flag-reason-field" style="display:\${status==='flagged'?'block':'none'}">
      <label>Flag reason</label>
      <textarea id="e-flag-reason" placeholder="Why is this flagged?">\${escapeHtml(p.flag_reason || '')}</textarea>
    </div>
    <div class="field" id="credit-note-field" style="display:\${status==='credit_due'?'block':'none'}">
      <label>Credit expected</label>
      <textarea id="e-credit-note" placeholder="What credit is expected and from whom?">\${escapeHtml(p.credit_note || '')}</textarea>
    </div>

    \${p.needs_review ? '<div class="alert" style="margin-top:14px">⚠️ Engineer-raised, needs office review of details above.</div>' : ''}

    <div class="row-between" style="margin-top:18px;margin-bottom:0">
      <button class="danger small" onclick='hardDeletePO(\${poNumber}, true)'>Delete</button>
      <div class="row">
        \${p.needs_review ? '<button class="ghost small" onclick="markReviewed(' + poNumber + ')">Mark Reviewed</button>' : ''}
        <button class="small" onclick='saveEdit(\${poNumber})'>Save</button>
      </div>
    </div>\`;

  // Wire status change to show/hide reason fields
  document.getElementById('e-status').addEventListener('change', (e) => {
    document.getElementById('flag-reason-field').style.display = e.target.value === 'flagged' ? 'block' : 'none';
    document.getElementById('credit-note-field').style.display = e.target.value === 'credit_due' ? 'block' : 'none';
  });

  document.getElementById('modal').classList.add('show');
}
function filterEditSites() {
  const input = document.getElementById('e-site');
  const dd = document.getElementById('e-site-dropdown');
  const status = document.getElementById('e-site-status');
  if (!input || !dd) return;
  const q = input.value.trim().toLowerCase();
  // Update status indicator
  if (q && status) {
    const matchExact = allSites.some(s => s.name.toLowerCase() === q);
    if (matchExact) {
      status.innerHTML = '<span style="color:#1e6c33">✓ In sites list</span>';
    } else {
      const v = input.value.trim();
      status.innerHTML = '<span style="color:#b58a00">⚠️ Not in sites list</span> <button class="ghost small" style="padding:3px 8px;font-size:11px;margin-left:6px" onclick="addCurrentSiteToList()">+ Add to list</button>';
    }
  } else if (status) {
    status.innerHTML = '';
  }
  if (!q) { dd.style.display = 'none'; return; }
  const matches = allSites.filter(s => s.name.toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) { dd.style.display = 'none'; return; }
  dd.innerHTML = matches.map(s => '<div class="ac-item" onmousedown="pickEditSite(\\''+escapeJsAttr(s.name)+'\\')">'+highlightText(s.name, q)+'</div>').join('');
  dd.style.display = 'block';
}
function pickEditSite(name) { document.getElementById('e-site').value = name; hideEditSites(); filterEditSites(); }
function hideEditSites() { const dd = document.getElementById('e-site-dropdown'); if (dd) dd.style.display = 'none'; }
async function addCurrentSiteToList() {
  const name = document.getElementById('e-site').value.trim();
  if (!name) return;
  if (!confirm('Add "' + name + '" to the master sites list?')) return;
  await fetch('/api/sites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  allSites = await fetch('/api/sites').then(r => r.json());
  filterEditSites();
  alert('Added to sites list');
}
function syncCost(changed) {
  const ex = parseFloat(document.getElementById('e-cost-ex').value);
  const rate = parseFloat(document.getElementById('e-vat-rate').value);
  const inc = parseFloat(document.getElementById('e-cost-inc').value);
  if (changed === 'ex' && !isNaN(ex) && !isNaN(rate)) {
    document.getElementById('e-cost-inc').value = (ex * (1 + rate / 100)).toFixed(2);
  } else if (changed === 'inc' && !isNaN(inc) && !isNaN(rate)) {
    document.getElementById('e-cost-ex').value = (inc / (1 + rate / 100)).toFixed(2);
  } else if (changed === 'rate' && !isNaN(ex) && !isNaN(rate)) {
    document.getElementById('e-cost-inc').value = (ex * (1 + rate / 100)).toFixed(2);
  }
}
async function saveEdit(poNumber) {
  const engSlug = document.getElementById('e-engineer').value;
  const eng = allEngineers.find(e => e.slug === engSlug);
  const costExStr = document.getElementById('e-cost-ex').value.trim();
  const costEx = costExStr === '' ? null : parseFloat(costExStr);
  const vatRateStr = document.getElementById('e-vat-rate').value.trim();
  const vatRate = vatRateStr === '' ? 20 : parseFloat(vatRateStr);
  let newStatus = document.getElementById('e-status').value;
  const p = allPOs.find(x => x.po_number === poNumber);
  const oldStatus = p.status || 'open';
  // Auto-promote open -> priced when cost is first entered (unless explicitly flagged/credit_due/complete)
  if (oldStatus === 'open' && costEx != null && newStatus === 'open') {
    newStatus = 'priced';
  }
  const flagReason = document.getElementById('e-flag-reason') ? document.getElementById('e-flag-reason').value.trim() : '';
  const creditNote = document.getElementById('e-credit-note') ? document.getElementById('e-credit-note').value.trim() : '';
  if (newStatus === 'flagged' && !flagReason) { alert('Flag reason is required when status is Flagged'); return; }
  if (newStatus === 'credit_due' && !creditNote) { alert('Credit note is required when status is Credit Due'); return; }
  await fetch('/api/pos/' + poNumber, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      engineer_slug: engSlug || null,
      engineer_name: eng ? eng.name : null,
      site: document.getElementById('e-site').value.trim(),
      incident_no: document.getElementById('e-incident').value.trim(),
      supplier: document.getElementById('e-supplier').value.trim(),
      trade: document.getElementById('e-trade') ? document.getElementById('e-trade').value.trim() : (p.trade || null),
      description: document.getElementById('e-description').value.trim(),
      cost_ex_vat: costEx,
      vat_rate: vatRate,
      status: newStatus,
      flag_reason: newStatus === 'flagged' ? flagReason : null,
      credit_note: newStatus === 'credit_due' ? creditNote : null,
      edited_by_slug: OFFICE_USER.slug,
      edited_by_name: OFFICE_USER.name
    }) });
  closeModal(); loadPOs(); loadDashboard();
}
async function markReviewed(n) { await fetch('/api/pos/' + n, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ needs_review: 0, edited_by_slug: OFFICE_USER.slug, edited_by_name: OFFICE_USER.name }) }); closeModal(); loadPOs(); loadDashboard(); }
async function hardDeletePO(n, fromModal) {
  if (!confirm('Delete PO ' + n + ' permanently?\\n\\nThe number ' + n + ' will be freed and reused on the next PO, so the sequence has no gaps. This cannot be undone.')) return;
  await fetch('/api/pos/' + n, { method: 'DELETE' });
  if (fromModal) closeModal();
  loadPOs(); loadDashboard();
}
function exportCSV() {
  const params = new URLSearchParams();
  const eng = document.getElementById('filter-engineer').value;
  const sup = document.getElementById('filter-supplier').value;
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  if (eng) params.set('engineer', eng); if (sup) params.set('supplier', sup);
  if (from) params.set('from', from); if (to) params.set('to', to);
  if (currentStatus) params.set('status', currentStatus);
  if (from) params.set('from', from); if (to) params.set('to', to);
  window.location.href = '/api/export?' + params;
}
// Opens the print-ready report with every filter currently applied to the log
function openReport() {
  const params = new URLSearchParams();
  const eng = document.getElementById('filter-engineer').value;
  const officeUser = document.getElementById('filter-office-user').value;
  const sup = document.getElementById('filter-supplier').value;
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const search = document.getElementById('search-input').value.trim();
  if (eng) params.set('engineer', eng);
  if (officeUser) params.set('office_user', officeUser);
  if (sup) params.set('supplier', sup);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (search) params.set('search', search);
  if (currentStatus) params.set('status', currentStatus);
  if (document.getElementById('filter-review').checked) params.set('needs_review', '1');
  if (document.getElementById('filter-uncosted').checked) params.set('uncosted', '1');
  if (document.getElementById('filter-unmatched-site').checked) params.set('unmatched_site', '1');
  window.open('/report?' + params, '_blank');
}
function closeModal() { document.getElementById('modal').classList.remove('show'); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }
function fmtDate(v) {
  if (!v) return '';
  const s = String(v);
  if (s.length === 10 && s.charAt(4) === '-') return s.slice(8,10) + '-' + s.slice(5,7) + '-' + s.slice(2,4);
  const d = new Date(v);
  if (isNaN(d)) return s;
  const p = n => (n < 10 ? '0' : '') + n;
  return p(d.getDate()) + '-' + p(d.getMonth() + 1) + '-' + String(d.getFullYear()).slice(2);
}
function fmtDateTime(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  const p = n => (n < 10 ? '0' : '') + n;
  return fmtDate(d) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
let modalMouseDownTarget = null;
document.getElementById('modal').addEventListener('mousedown', (e) => { modalMouseDownTarget = e.target; });
document.getElementById('modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && modalMouseDownTarget === e.target) closeModal(); });
init();
</script></body></html>`;
}

// ============================================================
// PDF REPORT (print-optimised page; browser Save as PDF produces the PDF)
// ============================================================
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

async function reportPage(db, params) {
  const pos = await getPOs(db, params);
  // Chronological reads best on paper
  const rows = [...pos].sort((a, b) => (a.issued_at || '').localeCompare(b.issued_at || ''));
  const esc = escapeHtmlServer;
  const money = n => '£' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const grossOf = r => r.cost_ex_vat * (1 + (r.vat_rate != null ? r.vat_rate : 20) / 100);

  let totalEx = 0, totalInc = 0, uncosted = 0;
  const bySupplier = {};
  for (const r of rows) {
    const sup = r.supplier || '(none)';
    const s = bySupplier[sup] = bySupplier[sup] || { count: 0, ex: 0, inc: 0 };
    s.count++;
    if (r.cost_ex_vat != null) {
      totalEx += r.cost_ex_vat;
      totalInc += grossOf(r);
      s.ex += r.cost_ex_vat;
      s.inc += grossOf(r);
    } else {
      uncosted++;
    }
  }
  const topSuppliers = Object.entries(bySupplier).sort((a, b) => b[1].ex - a[1].ex).slice(0, 12);
  const maxSupEx = topSuppliers.length ? Math.max(...topSuppliers.map(([, v]) => v.ex)) : 0;

  // Human-readable description of the active filters
  const filterBits = [];
  if (params.get('from') || params.get('to')) {
    filterBits.push((params.get('from') ? fmtDateUK(params.get('from')) : 'start') + ' — ' + (params.get('to') ? fmtDateUK(params.get('to')) : 'today'));
  } else {
    filterBits.push('All time');
  }
  if (params.get('supplier')) filterBits.push('Supplier: ' + params.get('supplier'));
  if (params.get('engineer')) {
    const e = await db.prepare(`SELECT name FROM engineers WHERE slug = ?`).bind(params.get('engineer')).first();
    filterBits.push('Engineer: ' + (e ? e.name : params.get('engineer')));
  }
  if (params.get('office_user')) {
    const u = await db.prepare(`SELECT name FROM office_users WHERE slug = ?`).bind(params.get('office_user')).first();
    filterBits.push('Issued by: ' + (u ? u.name : params.get('office_user')));
  }
  if (params.get('status')) filterBits.push('Status: ' + params.get('status').replace('_', ' '));
  if (params.get('search')) filterBits.push('Search: "' + params.get('search') + '"');

  // Group transactions by month with subtotals
  const groups = [];
  let cur = null;
  for (const r of rows) {
    const ym = (r.issued_at || '').slice(0, 7);
    if (!cur || cur.ym !== ym) { cur = { ym, rows: [], ex: 0, inc: 0 }; groups.push(cur); }
    cur.rows.push(r);
    if (r.cost_ex_vat != null) { cur.ex += r.cost_ex_vat; cur.inc += grossOf(r); }
  }
  const monthTitle = ym => {
    const m = Number(ym.slice(5, 7));
    return (MONTHS_FULL[m - 1] || ym) + ' ' + ym.slice(0, 4);
  };

  const STATUS_LABELS = { open: 'Open', priced: 'Priced', flagged: 'Flagged', credit_due: 'Credit Due', complete: 'Complete' };
  const statusCell = r => {
    const s = r.status || 'open';
    return '<span class="st st-' + esc(s) + '">' + (STATUS_LABELS[s] || s) + '</span>';
  };

  const transactionRows = groups.map(g => {
    const body = g.rows.map(r => `
      <tr>
        <td class="num">${r.po_number}</td>
        <td class="nowrap">${fmtDateUK(r.issued_at)}</td>
        <td>${esc(r.engineer_name || r.office_user_name || '—')}</td>
        <td>${esc(r.site || (r.incident_no ? '' : '—'))}${r.incident_no ? `<div style="font-size:9px;color:#5a6677">Incident: ${esc(r.incident_no)}</div>` : ''}</td>
        <td>${esc(r.supplier || '—')}</td>
        <td class="desc">${esc(r.description || '')}</td>
        <td class="num">${r.cost_ex_vat != null ? money(r.cost_ex_vat) : '—'}</td>
        <td class="num">${r.cost_ex_vat != null ? money(grossOf(r)) : '—'}</td>
        <td>${statusCell(r)}</td>
      </tr>`).join('');
    return `
      <tr class="month-row"><td colspan="9">${monthTitle(g.ym)}</td></tr>
      ${body}
      <tr class="subtotal-row"><td colspan="6">${monthTitle(g.ym)} total — ${g.rows.length} PO${g.rows.length === 1 ? '' : 's'}</td><td class="num">${money(g.ex)}</td><td class="num">${money(g.inc)}</td><td></td></tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>PO Report — Mostlane</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif; color: #1a1a1a; margin: 0; background: #f0f2f5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { max-width: 880px; margin: 0 auto; background: #fff; padding: 40px 44px; }
    @media screen { .sheet { margin: 24px auto; box-shadow: 0 4px 20px rgba(0,30,80,0.12); border-radius: 8px; } }
    .rpt-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #003366; padding-bottom: 18px; margin-bottom: 22px; }
    .rpt-head img { height: 44px; }
    .rpt-title { text-align: right; }
    .rpt-title h1 { margin: 0; font-size: 22px; color: #003366; letter-spacing: 0.01em; }
    .rpt-title .sub { color: #5a6677; font-size: 12px; margin-top: 4px; line-height: 1.5; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .sumbox { border: 1px solid #dde3ec; border-left: 4px solid #1A4F8F; border-radius: 6px; padding: 10px 14px; }
    .sumbox .v { font-size: 20px; font-weight: 700; color: #003366; }
    .sumbox .l { font-size: 10.5px; color: #5a6677; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
    h2 { font-size: 14px; color: #003366; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #dde3ec; padding-bottom: 6px; margin: 26px 0 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #5a6677; padding: 6px 6px; border-bottom: 2px solid #003366; }
    td { padding: 5px 6px; border-bottom: 1px solid #eef1f5; vertical-align: top; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    td.nowrap { white-space: nowrap; }
    td.desc { color: #444; }
    tbody tr:nth-child(even):not(.month-row):not(.subtotal-row) td { background: #f8fafd; }
    tr.month-row td { background: #003366 !important; color: #fff; font-weight: 600; font-size: 11px; padding: 6px 8px; letter-spacing: 0.04em; }
    tr.subtotal-row td { background: #eef3fa !important; font-weight: 700; color: #003366; border-bottom: 2px solid #c9d2dd; }
    tr.grand-row td { background: #003366 !important; color: #fff; font-weight: 700; font-size: 11.5px; padding: 8px; }
    .st { font-weight: 600; font-size: 9.5px; padding: 1px 7px; border-radius: 10px; white-space: nowrap; }
    .st-open { background: #ececf0; color: #555; }
    .st-priced, .st-complete { background: #d6f5dd; color: #1e6c33; }
    .st-flagged { background: #fdeeec; color: #962d22; }
    .st-credit_due { background: #fff4d6; color: #8a6100; }
    .supbar { display: inline-block; height: 9px; background: linear-gradient(90deg, #1A4F8F, #003468); border-radius: 4px; vertical-align: middle; }
    .note { font-size: 10px; color: #8a94a3; margin-top: 18px; border-top: 1px solid #dde3ec; padding-top: 8px; display: flex; justify-content: space-between; }
    .print-btn { position: fixed; bottom: 22px; right: 22px; background: linear-gradient(180deg, #1A4F8F 0%, #003468 100%); color: #fff; border: none; border-radius: 30px; padding: 14px 22px; font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer; box-shadow: 0 4px 14px rgba(0,30,80,0.35); }
    .screen-hint { max-width: 880px; margin: 16px auto -8px; padding: 0 8px; color: #5a6677; font-size: 13px; }
    @media print {
      body { background: #fff; }
      .sheet { max-width: none; padding: 0; }
      .print-btn, .screen-hint { display: none; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
      h2 { page-break-after: avoid; }
      @page { size: A4; margin: 13mm 11mm; }
    }
  </style></head><body>
  <div class="screen-hint">Press the button (or Ctrl/Cmd+P) and choose <strong>Save as PDF</strong>. Adjust filters on the Office page, then re-open the report.</div>
  <div class="sheet">
    <div class="rpt-head">
      <img src="/logo.jpg?v=2" alt="Mostlane">
      <div class="rpt-title">
        <h1>Purchase Order Report</h1>
        <div class="sub">${filterBits.map(esc).join(' &middot; ')}<br>Generated ${fmtDateTimeUK(new Date().toISOString())}</div>
      </div>
    </div>

    <div class="summary">
      <div class="sumbox"><div class="v">${rows.length}</div><div class="l">Purchase Orders</div></div>
      <div class="sumbox"><div class="v">${money(totalEx)}</div><div class="l">Net (ex VAT)</div></div>
      <div class="sumbox"><div class="v">${money(totalInc)}</div><div class="l">Gross (inc VAT)</div></div>
      <div class="sumbox"><div class="v">${uncosted}</div><div class="l">Awaiting cost</div></div>
    </div>

    ${topSuppliers.length ? `<h2>Spend by Supplier${topSuppliers.length === 12 ? ' (top 12)' : ''}</h2>
    <table>
      <thead><tr><th style="width:26%">Supplier</th><th style="width:8%" class="num">POs</th><th style="width:14%" class="num">Net</th><th style="width:14%" class="num">Gross</th><th>Share of net spend</th></tr></thead>
      <tbody>${topSuppliers.map(([name, v]) => `
        <tr>
          <td><strong>${esc(name)}</strong></td>
          <td class="num">${v.count}</td>
          <td class="num">${money(v.ex)}</td>
          <td class="num">${money(v.inc)}</td>
          <td><span class="supbar" style="width:${maxSupEx ? Math.max(2, Math.round(v.ex / maxSupEx * 100)) : 2}%"></span></td>
        </tr>`).join('')}
      </tbody>
    </table>` : ''}

    <h2>Transactions</h2>
    ${rows.length ? `<table>
      <thead><tr>
        <th class="num">PO #</th><th>Date</th><th>Raised By</th><th>Site / Incident</th><th>Supplier</th><th style="width:24%">Description</th><th class="num">Net</th><th class="num">Gross</th><th>Status</th>
      </tr></thead>
      <tbody>
        ${transactionRows}
        <tr class="grand-row"><td colspan="6">Grand total — ${rows.length} PO${rows.length === 1 ? '' : 's'}${uncosted ? ' (' + uncosted + ' not yet costed)' : ''}</td><td class="num">${money(totalEx)}</td><td class="num">${money(totalInc)}</td><td></td></tr>
      </tbody>
    </table>` : '<p style="color:#5a6677">No purchase orders match the selected filters.</p>'}

    <div class="note">
      <span>Mostlane PO System &middot; Net/Gross totals cover costed POs only${rows.length === 1000 ? ' &middot; Limited to the most recent 1,000 POs — narrow the date range for a complete report' : ''}</span>
      <span>Generated ${fmtDateTimeUK(new Date().toISOString())}</span>
    </div>
  </div>
  <button class="print-btn" onclick="window.print()">🖨 Save as PDF</button>
</body></html>`;
}

// ============================================================
// WEEKLY ACTIVITY SUMMARY (who bought what, from where, for which jobs)
// ============================================================
// Aggregate POs in a date range by the engineer they're attributed to, with a
// per-engineer supplier breakdown and the list of jobs. Cost is ignored — this
// is about buying activity, not spend (which lags by weeks).
async function getSummaryRange(db, from, to) {
  let where = 'WHERE deleted = 0';
  const binds = [];
  if (from) { where += ' AND issued_at >= ?'; binds.push(from); }
  if (to) { where += ' AND issued_at <= ?'; binds.push(to + 'T23:59:59'); }
  const rows = (await db.prepare(
    `SELECT po_number, issued_at, engineer_name, office_user_name, source, supplier, site, incident_no, description
     FROM po_log ${where} ORDER BY issued_at DESC`
  ).bind(...binds).all()).results;

  const groups = {};
  const supTotals = {};
  for (const r of rows) {
    const key = r.engineer_name || (r.office_user_name ? 'Office — ' + r.office_user_name : '(no engineer)');
    const g = groups[key] || (groups[key] = { name: key, count: 0, sup: {}, pos: [] });
    g.count++;
    const sup = r.supplier || '(none)';
    g.sup[sup] = (g.sup[sup] || 0) + 1;
    supTotals[sup] = (supTotals[sup] || 0) + 1;
    g.pos.push({ po_number: r.po_number, issued_at: r.issued_at, supplier: r.supplier, site: r.site, incident_no: r.incident_no, description: r.description });
  }
  const engineers = Object.values(groups).map(g => ({
    name: g.name,
    count: g.count,
    suppliers: g.sup,
    by_supplier: Object.entries(g.sup).map(([supplier, count]) => ({ supplier, count })).sort((a, b) => b.count - a.count),
    pos: g.pos
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const by_supplier = Object.entries(supTotals).map(([supplier, count]) => ({ supplier, count })).sort((a, b) => b.count - a.count);
  return { from: from || null, to: to || null, total: rows.length, engineers, by_supplier };
}
async function getSummary(db, params) {
  return getSummaryRange(db, params.get('from'), params.get('to'));
}

// Monday-Sunday of the previous full week, in UK time, as YYYY-MM-DD strings.
function lastWeekRangeUK() {
  const nowUK = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
  const dow = nowUK.getDay(); // 0 Sun .. 6 Sat
  const mondayThis = new Date(nowUK); mondayThis.setDate(nowUK.getDate() - ((dow + 6) % 7));
  const start = new Date(mondayThis); start.setDate(mondayThis.getDate() - 7);
  const end = new Date(mondayThis); end.setDate(mondayThis.getDate() - 1);
  const fmt = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  return { from: fmt(start), to: fmt(end) };
}

// Server-rendered, inline-styled email body (also viewable at /summary/email).
async function weeklySummaryEmailHtml(db, params, origin) {
  const from = params.get('from');
  const to = params.get('to');
  const s = await getSummaryRange(db, from, to);
  const esc = escapeHtmlServer;
  const range = (from ? fmtDateUK(from) : '') + (from && to ? ' – ' : '') + (to ? fmtDateUK(to) : '');
  const base = origin || '';
  const supLine = bs => bs.map(x => esc(x.supplier) + ' ×' + x.count).join(' · ');

  const engineerBlocks = s.engineers.map(e => {
    const jobs = e.pos.map(p => {
      const where = p.incident_no ? ('INC ' + esc(p.incident_no) + (p.site ? ' · ' + esc(p.site) : '')) : esc(p.site || '—');
      return `<tr>
        <td style="padding:4px 8px;border-bottom:1px solid #eef1f5;font-family:monospace;color:#003366">${p.po_number}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eef1f5;white-space:nowrap;color:#5a6677">${fmtDateUK(p.issued_at)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eef1f5"><strong>${esc(p.supplier || '—')}</strong></td>
        <td style="padding:4px 8px;border-bottom:1px solid #eef1f5">${where}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eef1f5;color:#444">${esc(p.description || '')}</td>
      </tr>`;
    }).join('');
    return `<details style="margin:0 0 8px;border:1px solid #e3e7ee;border-radius:10px;overflow:hidden">
      <summary style="cursor:pointer;padding:12px 14px;background:#f0f5fc;list-style:none">
        <span style="font-weight:700;color:#003366;font-size:15px">${esc(e.name)}</span>
        <span style="color:#1A4F8F;font-weight:600"> — ${e.count} PO${e.count === 1 ? '' : 's'}</span>
        <div style="color:#5a6677;font-size:12px;margin-top:3px">${supLine(e.by_supplier)}</div>
      </summary>
      <div style="padding:6px 10px 12px">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead><tr>
            <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #003366;font-size:10px;color:#5a6677;text-transform:uppercase">PO #</th>
            <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #003366;font-size:10px;color:#5a6677;text-transform:uppercase">Date</th>
            <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #003366;font-size:10px;color:#5a6677;text-transform:uppercase">Supplier</th>
            <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #003366;font-size:10px;color:#5a6677;text-transform:uppercase">Site / Job</th>
            <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #003366;font-size:10px;color:#5a6677;text-transform:uppercase">Description</th>
          </tr></thead>
          <tbody>${jobs}</tbody>
        </table>
      </div>
    </details>`;
  }).join('');

  const supplierTally = s.by_supplier.slice(0, 15).map(x =>
    `<span style="display:inline-block;background:#f0f5fc;border:1px solid #d6e4f5;border-radius:16px;padding:4px 10px;margin:0 6px 6px 0;font-size:12.5px;color:#003366">${esc(x.supplier)} <strong>×${x.count}</strong></span>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Weekly PO Summary</title></head>
  <body style="margin:0;background:#e6e8eb;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif;color:#1a1a1a">
  <div style="max-width:680px;margin:0 auto;padding:20px 14px 40px">
    <div style="background:#fff;border-radius:14px;padding:20px;border:1px solid #e3e7ee">
      <div style="border-bottom:3px solid #003366;padding-bottom:12px;margin-bottom:16px">
        <h1 style="margin:0;font-size:19px;color:#003366">Weekly PO Activity</h1>
        <div style="color:#5a6677;font-size:13px;margin-top:4px">${esc(range || 'All time')}</div>
      </div>
      <p style="margin:0 0 16px;font-size:14px;color:#1a1a1a">
        <strong>${s.total}</strong> PO${s.total === 1 ? '' : 's'} raised by <strong>${s.engineers.length}</strong> ${s.engineers.length === 1 ? 'person' : 'people'} across <strong>${s.by_supplier.length}</strong> supplier${s.by_supplier.length === 1 ? '' : 's'}. Tap a name to expand.
      </p>
      ${s.total ? engineerBlocks : '<p style="color:#5a6677">No POs were raised in this period.</p>'}
      ${s.total ? `<h2 style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#5a6677;margin:20px 0 8px">All suppliers this week</h2><div>${supplierTally}</div>` : ''}
      <div style="margin-top:22px;text-align:center">
        <a href="${base}/summary${from ? '?from=' + esc(from) + (to ? '&to=' + esc(to) : '') : ''}" style="display:inline-block;background:#003468;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px">Open the interactive summary</a>
      </div>
      <p style="margin:18px 0 0;font-size:11px;color:#8a94a3;text-align:center">Mostlane PO System · buying activity (costs not shown — they're added later from invoices)</p>
    </div>
  </div></body></html>`;
}

// Sends the previous week's summary email. Dormant unless email is configured
// via Worker secrets (see sendEmail). PUBLIC_URL (optional) sets the base for
// the "open interactive summary" link.
async function runWeeklyEmail(env) {
  await ensureSchema(env.DB);
  const { from, to } = lastWeekRangeUK();
  const origin = env.PUBLIC_URL || 'https://site-log.co.uk';
  const params = new URLSearchParams({ from, to });
  const htmlBody = await weeklySummaryEmailHtml(env.DB, params, origin);
  const subject = `Mostlane PO — week of ${fmtDateUK(from)}`;
  await sendEmail(env, subject, htmlBody);
}

// Extract a bare address from "Name <a@b.com>" or "a@b.com".
function parseEmailAddress(s) {
  const m = String(s || '').match(/<([^>]+)>/);
  return (m ? m[1] : (s || '')).trim();
}

// Sends via Microsoft 365 (Microsoft Graph, app-only auth). Dormant unless
// configured with Worker secrets:
//   MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET  (Azure app registration
//     with the Mail.Send *application* permission, admin-consented)
//   SUMMARY_FROM  the 365 mailbox to send from (e.g. office@mostlane.co.uk)
//   SUMMARY_TO    comma-separated recipient addresses
async function sendEmail(env, subject, htmlBody) {
  const to = (env.SUMMARY_TO || '').split(',').map(s => s.trim()).filter(Boolean);
  const sender = parseEmailAddress(env.SUMMARY_FROM);
  if (!env.MS_TENANT_ID || !env.MS_CLIENT_ID || !env.MS_CLIENT_SECRET || !sender || !to.length) {
    console.log('Weekly email not sent: Microsoft 365 not configured (need MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, SUMMARY_FROM, SUMMARY_TO).');
    return;
  }
  // 1. App-only access token (client credentials flow)
  const tokRes = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(env.MS_TENANT_ID)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.MS_CLIENT_ID,
      client_secret: env.MS_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    })
  });
  if (!tokRes.ok) { console.error('MS token request failed:', tokRes.status, await tokRes.text()); return; }
  const token = (await tokRes.json()).access_token;
  // 2. Send from the configured mailbox
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: htmlBody },
        toRecipients: to.map(a => ({ emailAddress: { address: a } }))
      },
      saveToSentItems: true
    })
  });
  if (!res.ok) console.error('MS sendMail failed:', res.status, await res.text());
}

function summaryPage() {
  return `${pageHead('Summary — PO System')}${topbar('summary')}
  <div class="wrap">
    <h1>Buying Activity</h1>
    <div class="card">
      <p class="muted" style="margin-bottom:10px">Who raised POs, how many, from which suppliers and for which jobs. Tap an engineer to expand. Costs aren't shown here — this is about buying activity.</p>
      <div class="filter-bar" style="margin-bottom:10px">
        <input id="f-from" type="date">
        <input id="f-to" type="date">
      </div>
      <div class="row">
        <button class="ghost small" onclick="setThisWeek()">This week</button>
        <button class="ghost small" onclick="setLastWeek()">Last week</button>
        <button class="ghost small" onclick="setThisMonth()">This month</button>
        <button class="ghost small" onclick="setDays(30)">Last 30 days</button>
      </div>
    </div>
    <div class="stat-grid" id="overview"></div>
    <div id="engineers"></div>
    <div class="card" id="supplier-card" style="display:none">
      <h2>All suppliers</h2>
      <div id="supplier-tally" style="display:flex;flex-wrap:wrap;gap:6px"></div>
    </div>
  </div>
<script>
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function fmtDate(v){const s=String(v||'');if(s.length>=10&&s.charAt(4)==='-')return s.slice(8,10)+'-'+s.slice(5,7)+'-'+s.slice(2,4);return s}
function mondayOf(d){const x=new Date(d);x.setDate(d.getDate()-((d.getDay()+6)%7));return x}
function setThisWeek(){const n=new Date();document.getElementById('f-from').value=ymd(mondayOf(n));document.getElementById('f-to').value=ymd(n);load()}
function setLastWeek(){const n=new Date();const m=mondayOf(n);const s=new Date(m);s.setDate(m.getDate()-7);const e=new Date(m);e.setDate(m.getDate()-1);document.getElementById('f-from').value=ymd(s);document.getElementById('f-to').value=ymd(e);load()}
function setThisMonth(){const n=new Date();document.getElementById('f-from').value=ymd(new Date(n.getFullYear(),n.getMonth(),1));document.getElementById('f-to').value=ymd(n);load()}
function setDays(days){const to=new Date();const from=new Date(Date.now()-days*86400000);document.getElementById('f-from').value=ymd(from);document.getElementById('f-to').value=ymd(to);load()}
['f-from','f-to'].forEach(id=>document.getElementById(id).addEventListener('change',load));
async function load(){
  const from=document.getElementById('f-from').value, to=document.getElementById('f-to').value;
  const p=new URLSearchParams(); if(from)p.set('from',from); if(to)p.set('to',to);
  const s=await fetch('/api/summary?'+p).then(r=>r.json());
  document.getElementById('overview').innerHTML=
    '<div class="stat"><div class="v">'+s.total+'</div><div class="l">POs raised</div></div>'+
    '<div class="stat"><div class="v">'+s.engineers.length+'</div><div class="l">People buying</div></div>'+
    '<div class="stat"><div class="v">'+s.by_supplier.length+'</div><div class="l">Suppliers used</div></div>'+
    '<div class="stat"><div class="v">'+(s.engineers[0]?escapeHtml(s.engineers[0].name.split(" ")[0]):'—')+'</div><div class="l">Most active</div></div>';
  const cont=document.getElementById('engineers');
  if(!s.total){cont.innerHTML='<div class="card"><div class="empty">No POs were raised in this period.</div></div>';document.getElementById('supplier-card').style.display='none';return}
  cont.innerHTML=s.engineers.map((e,i)=>{
    const supLine=e.by_supplier.map(x=>escapeHtml(x.supplier)+' ×'+x.count).join(' · ');
    const chips=e.by_supplier.map(x=>'<span class="chip">'+escapeHtml(x.supplier)+' <strong style="margin-left:2px">×'+x.count+'</strong></span>').join('');
    const rows=e.pos.map(p=>{
      const where=p.incident_no?('🎫 '+escapeHtml(p.incident_no)+(p.site?' · '+escapeHtml(p.site):'')):escapeHtml(p.site||'—');
      return '<tr><td style="font-family:ui-monospace,monospace;color:#003366;font-weight:600">'+p.po_number+'</td><td class="muted" style="white-space:nowrap">'+fmtDate(p.issued_at)+'</td><td><strong>'+escapeHtml(p.supplier||'—')+'</strong></td><td>'+where+'</td><td>'+escapeHtml(p.description||'')+'</td></tr>';
    }).join('');
    return '<details class="card acc"'+(i===0?' open':'')+' style="padding:0;overflow:hidden">'+
      '<summary style="cursor:pointer;padding:14px 16px;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:12px">'+
        '<span><span style="font-weight:700;color:#003366;font-size:16px">'+escapeHtml(e.name)+'</span><span style="color:#1A4F8F;font-weight:600"> — '+e.count+' PO'+(e.count===1?'':'s')+'</span>'+
        '<div class="muted" style="font-size:12px;margin-top:3px">'+supLine+'</div></span>'+
        '<span class="acc-chevron" style="color:#5a6677;font-size:20px">▾</span>'+
      '</summary>'+
      '<div style="padding:0 16px 16px">'+
        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">'+chips+'</div>'+
        '<div class="table-scroll"><table><thead><tr><th>PO #</th><th>Date</th><th>Supplier</th><th>Site / Job</th><th>Description</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
      '</div></details>';
  }).join('');
  document.getElementById('supplier-card').style.display='block';
  document.getElementById('supplier-tally').innerHTML=s.by_supplier.map(x=>'<span class="chip">'+escapeHtml(x.supplier)+' <strong style="margin-left:2px">×'+x.count+'</strong></span>').join('');
}
setThisWeek();
</script>
<style>
details.acc summary::-webkit-details-marker{display:none}
details.acc[open] .acc-chevron{transform:rotate(180deg)}
details.acc summary:hover{background:#f8fafd}
</style>
</body></html>`;
}

function jobCostPage() {
  return `${pageHead('Job Costs — PO System')}${topbar('jobs')}
  <div class="wrap">
    <h1>Job Costs</h1>
    <div class="card">
      <p class="muted" style="margin-bottom:10px">Spend per job (site), split into materials and subcontractor work, with subcontractor spend broken down by trade. Figures are <strong>ex VAT</strong>. Tap a job to see its POs. Labour is not included yet.</p>
      <div class="filter-bar" style="margin-bottom:10px">
        <input id="j-search" type="text" placeholder="🔍 Find a job / site..." oninput="render()">
        <input id="j-from" type="date">
        <input id="j-to" type="date">
      </div>
      <div class="row">
        <button class="ghost small" onclick="setRange(null)">All time</button>
        <button class="ghost small" onclick="setRange(30)">Last 30 days</button>
        <button class="ghost small" onclick="setRange(90)">Last 90 days</button>
        <button class="ghost small" onclick="setThisYear()">This year</button>
        <label style="display:flex;align-items:center;gap:8px;margin:0;color:#1a1a1a;font-weight:500;font-size:14px;cursor:pointer">
          <input type="checkbox" id="j-onlysub" style="width:auto;margin:0" onchange="render()"> Only jobs with subcontractor spend
        </label>
      </div>
    </div>
    <div class="stat-grid" id="j-overview"></div>
    <div id="j-list"></div>
  </div>
<script>
let DATA = null;
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function money(n){return '£' + Number(n||0).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',')}
function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function fmtDate(v){const s=String(v||'');if(s.length>=10&&s.charAt(4)==='-')return s.slice(8,10)+'-'+s.slice(5,7)+'-'+s.slice(2,4);return s}
function setRange(days){
  if(days){document.getElementById('j-from').value=ymd(new Date(Date.now()-days*86400000));document.getElementById('j-to').value=ymd(new Date());}
  else {document.getElementById('j-from').value='';document.getElementById('j-to').value='';}
  load();
}
function setThisYear(){const n=new Date();document.getElementById('j-from').value=ymd(new Date(n.getFullYear(),0,1));document.getElementById('j-to').value=ymd(n);load();}
['j-from','j-to'].forEach(id=>document.getElementById(id).addEventListener('change',load));
async function load(){
  const p=new URLSearchParams();
  const from=document.getElementById('j-from').value, to=document.getElementById('j-to').value;
  if(from)p.set('from',from); if(to)p.set('to',to);
  DATA=await fetch('/api/jobcost?'+p).then(r=>r.json());
  render();
}
function render(){
  if(!DATA)return;
  const q=document.getElementById('j-search').value.trim().toLowerCase();
  const onlySub=document.getElementById('j-onlysub').checked;
  let jobs=DATA.jobs;
  if(q)jobs=jobs.filter(j=>j.site.toLowerCase().includes(q));
  if(onlySub)jobs=jobs.filter(j=>j.subcontractor_ex>0);
  const t={jobs:jobs.length,
    po_count:jobs.reduce((s,j)=>s+j.po_count,0),
    uncosted:jobs.reduce((s,j)=>s+j.uncosted,0),
    materials_ex:jobs.reduce((s,j)=>s+j.materials_ex,0),
    subcontractor_ex:jobs.reduce((s,j)=>s+j.subcontractor_ex,0),
    total_ex:jobs.reduce((s,j)=>s+j.total_ex,0)};
  document.getElementById('j-overview').innerHTML=
    '<div class="stat"><div class="v">'+t.jobs+'</div><div class="l">Jobs</div></div>'+
    '<div class="stat"><div class="v">'+money(t.total_ex)+'</div><div class="l">Total cost ex VAT</div></div>'+
    '<div class="stat"><div class="v">'+money(t.materials_ex)+'</div><div class="l">📦 Materials</div></div>'+
    '<div class="stat"><div class="v">'+money(t.subcontractor_ex)+'</div><div class="l">👷 Subcontractor</div></div>'+
    '<div class="stat"><div class="v" style="color:'+(t.uncosted?'#b58a00':'#003366')+'">'+t.uncosted+'</div><div class="l">POs awaiting cost</div></div>'+
    '<div class="stat"><div class="v">'+t.po_count+'</div><div class="l">POs</div></div>';
  const cont=document.getElementById('j-list');
  if(!jobs.length){cont.innerHTML='<div class="card"><div class="empty">No jobs match.</div></div>';return;}
  const max=Math.max(...jobs.map(j=>j.total_ex),1);
  cont.innerHTML=jobs.map((j,i)=>{
    const matPct=j.total_ex?Math.round(j.materials_ex/j.total_ex*100):0;
    const bar='<div style="display:flex;height:8px;border-radius:5px;overflow:hidden;background:#e3e7ee;width:'+Math.max(6,Math.round(j.total_ex/max*100))+'%;min-width:60px">'+
      '<div style="width:'+matPct+'%;background:linear-gradient(90deg,#1A4F8F,#003468)"></div>'+
      '<div style="width:'+(100-matPct)+'%;background:#b58a00"></div></div>';
    const tradeChips=j.by_trade.map(tr=>'<span class="chip">👷 '+escapeHtml(tr.trade)+' <strong style="margin-left:2px">'+money(tr.ex)+'</strong><span class="muted" style="margin-left:4px">×'+tr.count+'</span></span>').join('');
    const warn=j.uncosted?' <span class="badge review" title="'+j.uncosted+' PO(s) not costed yet — total is incomplete">⚠️ '+j.uncosted+' uncosted</span>':'';
    return '<details class="card acc" style="padding:0;overflow:hidden" data-site="'+encodeURIComponent(j.site)+'" ontoggle="onToggle(this)">'+
      '<summary style="cursor:pointer;padding:14px 16px;list-style:none">'+
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">'+
          '<div style="flex:1;min-width:200px"><span style="font-weight:700;color:#003366;font-size:16px">'+escapeHtml(j.site)+'</span>'+warn+
            '<div class="muted" style="font-size:12px;margin-top:3px">'+j.po_count+' PO'+(j.po_count===1?'':'s')+' · 📦 '+money(j.materials_ex)+' · 👷 '+money(j.subcontractor_ex)+'</div>'+
            '<div style="margin-top:6px">'+bar+'</div></div>'+
          '<div style="text-align:right"><div style="font-size:20px;font-weight:700;color:#003366">'+money(j.total_ex)+'</div><div class="muted" style="font-size:11px">ex VAT</div></div>'+
        '</div>'+
      '</summary>'+
      '<div style="padding:0 16px 16px">'+
        (tradeChips?'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">'+tradeChips+'</div>':'')+
        '<div class="job-pos"><div class="muted" style="font-size:13px">Loading POs…</div></div>'+
      '</div></details>';
  }).join('');
}
async function onToggle(el){
  if(!el.open)return;
  const box=el.querySelector('.job-pos');
  if(box.dataset.loaded)return;
  box.dataset.loaded='1';
  const p=new URLSearchParams();
  p.set('site',decodeURIComponent(el.dataset.site));
  const from=document.getElementById('j-from').value, to=document.getElementById('j-to').value;
  if(from)p.set('from',from); if(to)p.set('to',to);
  try{
    const pos=await fetch('/api/pos?'+p).then(r=>r.json());
    if(!pos.length){box.innerHTML='<div class="muted">No POs.</div>';return;}
    box.innerHTML='<div class="table-scroll"><table><thead><tr><th>PO #</th><th>Date</th><th>Type</th><th>Supplier</th><th>Description</th><th>Cost ex VAT</th></tr></thead><tbody>'+
      pos.map(p2=>{
        const sub=(p2.cost_category||'materials')==='subcontractor';
        const type=sub?'<span class="badge review">👷 '+escapeHtml(p2.trade||'Subcontractor')+'</span>':'<span class="badge office">📦 Materials</span>';
        const cost=p2.cost_ex_vat!=null?money(p2.cost_ex_vat):'<span class="badge review">awaiting cost</span>';
        return '<tr><td style="font-family:ui-monospace,monospace;font-weight:600;color:#003366">'+p2.po_number+'</td>'+
          '<td class="muted" style="white-space:nowrap">'+fmtDate(p2.issued_at)+'</td><td>'+type+'</td>'+
          '<td>'+escapeHtml(p2.supplier||'—')+'</td><td>'+escapeHtml(p2.description||'')+'</td>'+
          '<td style="text-align:right;white-space:nowrap">'+cost+'</td></tr>';
      }).join('')+'</tbody></table></div>';
  }catch(e){box.innerHTML='<div class="muted">Could not load POs.</div>';}
}
document.getElementById('j-search').addEventListener('input',render);
load();
</script>
<style>
details.acc summary::-webkit-details-marker{display:none}
details.acc summary:hover{background:#f8fafd}
</style>
</body></html>`;
}

function accountsPage() {
  return `${pageHead('Accounts — PO System')}${topbar('accounts')}
  <div class="wrap">
    <h1>Supplier Accounts</h1>
    <div class="card">
      <p class="muted" style="margin-bottom:10px">Outstanding amounts per supplier by spend month, <strong>inc VAT</strong>. POs marked <strong>✓ Complete</strong> count as paid. Terms: <strong>30 days</strong> = due end of the month after the spend month; <strong>60 days</strong> = end of the second month after. Overdue amounts show in red.</p>
      <div class="row">
        <label style="display:flex;align-items:center;gap:8px;margin:0;color:#1a1a1a;font-weight:500;font-size:14px;cursor:pointer">
          <input type="checkbox" id="filter-due" style="width:auto;margin:0" onchange="render()"> Only suppliers with a balance due now
        </label>
        <label style="display:flex;align-items:center;gap:8px;margin:0;color:#1a1a1a;font-weight:500;font-size:14px;cursor:pointer">
          <input type="checkbox" id="filter-balance" style="width:auto;margin:0" onchange="render()"> Hide suppliers with no balance
        </label>
      </div>
    </div>
    <div class="stat-grid" id="totals"></div>
    <div class="card" style="padding:0">
      <div class="table-scroll">
        <table>
          <thead id="acc-thead"></thead>
          <tbody id="acc-tbody"></tbody>
        </table>
      </div>
    </div>
  </div>
<script>
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
let DATA = null;
function formatMoney(n) { return '£' + Number(n).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ','); }
function ymKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function monthLabel(ym) { return MONTH_NAMES[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(2, 4); }
// Due date = last day of the month 1 (30 days) or 2 (60 days) months after
// the spend month, so the exact day count flexes with month lengths.
function dueDate(ym, termsDays) {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  const monthsAfter = Number(termsDays) === 60 ? 2 : 1;
  return new Date(y, m + monthsAfter, 0, 23, 59, 59);
}
// Past 3 months plus the current month, oldest first
function windowMonths() {
  const out = [];
  const now = new Date();
  for (let i = 3; i >= 0; i--) out.push(ymKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  return out;
}
async function init() {
  DATA = await fetch('/api/accounts').then(r => r.json());
  render();
}
function render() {
  const months = windowMonths();
  const onlyDue = document.getElementById('filter-due').checked;
  const onlyBalance = document.getElementById('filter-balance').checked;
  const now = new Date();
  const bySupplier = {};
  for (const row of DATA.months) {
    (bySupplier[row.supplier] = bySupplier[row.supplier] || []).push(row);
  }
  const supplierMeta = {};
  for (const s of DATA.suppliers) supplierMeta[s.name] = s;
  // Every active supplier, plus any free-text supplier with outstanding POs
  const names = new Set(DATA.suppliers.map(s => s.name));
  for (const n of Object.keys(bySupplier)) names.add(n);
  const rows = [];
  for (const name of [...names].sort((a, b) => a.localeCompare(b))) {
    const meta = supplierMeta[name];
    const terms = meta && meta.terms_days ? Number(meta.terms_days) : 30;
    const cells = {};
    let older = 0, balance = 0, dueNow = 0, uncosted = 0;
    for (const r of (bySupplier[name] || [])) {
      uncosted += Number(r.uncosted_open || 0);
      const amt = Number(r.unpaid_inc_vat || 0);
      if (!amt) continue;
      balance += amt;
      if (months.includes(r.ym)) cells[r.ym] = (cells[r.ym] || 0) + amt;
      else if (r.ym < months[0]) older += amt;
      if (dueDate(r.ym, terms) < now) dueNow += amt;
    }
    rows.push({ name, meta, terms, cells, older, balance, dueNow, uncosted });
  }
  let visible = rows;
  if (onlyDue) visible = visible.filter(r => r.dueNow > 0);
  if (onlyBalance) visible = visible.filter(r => r.balance > 0 || r.uncosted > 0);
  document.getElementById('acc-thead').innerHTML = '<tr><th>Supplier</th><th>Terms</th><th>Older</th>' +
    months.map((m, i) => '<th>' + monthLabel(m) + (i === months.length - 1 ? ' (current)' : '') + '</th>').join('') +
    '<th>Balance</th><th>Due now</th></tr>';
  const tBal = visible.reduce((s, r) => s + r.balance, 0);
  const tDue = visible.reduce((s, r) => s + r.dueNow, 0);
  const tUncosted = visible.reduce((s, r) => s + r.uncosted, 0);
  document.getElementById('totals').innerHTML =
    '<div class="stat"><div class="v">' + formatMoney(tBal) + '</div><div class="l">Total outstanding inc VAT</div></div>' +
    '<div class="stat"><div class="v" style="color:' + (tDue ? '#c0392b' : '#003366') + '">' + formatMoney(tDue) + '</div><div class="l">Due now</div></div>' +
    '<div class="stat"><div class="v">' + visible.filter(r => r.balance > 0).length + '</div><div class="l">Suppliers with balance</div></div>' +
    '<div class="stat"><div class="v" style="color:' + (tUncosted ? '#b58a00' : '#003366') + '">' + tUncosted + '</div><div class="l">Uncosted open POs</div></div>';
  const tbody = document.getElementById('acc-tbody');
  if (!visible.length) { tbody.innerHTML = '<tr><td colspan="' + (5 + months.length) + '"><div class="empty">Nothing outstanding.</div></td></tr>'; return; }
  tbody.innerHTML = visible.map(r => {
    const warn = r.uncosted ? ' <span title="' + r.uncosted + ' open PO(s) with no cost entered yet — balance is incomplete" style="color:#b58a00">⚠️' + r.uncosted + '</span>' : '';
    const termsCell = r.meta
      ? '<select style="width:auto;padding:6px 8px;font-size:13px" onchange="setTerms(' + r.meta.id + ', this.value)"><option value="30"' + (r.terms === 30 ? ' selected' : '') + '>30 days</option><option value="60"' + (r.terms === 60 ? ' selected' : '') + '>60 days</option></select>'
      : '<span class="muted" title="Not in supplier list — assumed 30 days">30 days*</span>';
    const monthCells = months.map(m => {
      const amt = r.cells[m] || 0;
      if (!amt) return '<td class="muted">—</td>';
      const overdue = dueDate(m, r.terms) < now;
      return '<td' + (overdue ? ' style="color:#c0392b;font-weight:600" title="Past due date (' + fmtDate(dueDate(m, r.terms)) + ')"' : ' title="Due ' + fmtDate(dueDate(m, r.terms)) + '"') + '>' + formatMoney(amt) + '</td>';
    }).join('');
    return '<tr><td><strong>' + escapeHtml(r.name) + '</strong>' + warn + '</td><td>' + termsCell + '</td>' +
      '<td' + (r.older ? ' style="color:#c0392b;font-weight:600" title="Unpaid spend older than shown months — past due"' : ' class="muted"') + '>' + (r.older ? formatMoney(r.older) : '—') + '</td>' +
      monthCells +
      '<td><strong>' + (r.balance ? formatMoney(r.balance) : '—') + '</strong></td>' +
      '<td' + (r.dueNow ? ' style="color:#c0392b;font-weight:700"' : ' class="muted"') + '>' + (r.dueNow ? formatMoney(r.dueNow) : '—') + '</td></tr>';
  }).join('');
}
async function setTerms(id, value) {
  await fetch('/api/suppliers/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ terms_days: Number(value) }) });
  const s = DATA.suppliers.find(x => x.id === id);
  if (s) s.terms_days = Number(value);
  render();
}
function fmtDate(d) {
  const p = n => (n < 10 ? '0' : '') + n;
  return p(d.getDate()) + '-' + p(d.getMonth() + 1) + '-' + String(d.getFullYear()).slice(2);
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
init();
</script></body></html>`;
}

function statsPage() {
  return `${pageHead('Stats — PO System')}${topbar('stats')}
  <div class="wrap">
    <h1>Stats</h1>
    <div class="card">
      <div class="filter-bar">
        <select id="f-engineer"><option value="">All engineers</option></select>
        <select id="f-supplier"><option value="">All suppliers</option></select>
        <select id="f-source"><option value="">All sources</option><option value="engineer">Engineer (OOH)</option><option value="office">Office</option></select>
        <input id="f-from" type="date">
        <input id="f-to" type="date">
      </div>
      <div class="row" style="margin-bottom:8px">
        <button class="ghost small" onclick="setRange(7)">Last 7 days</button>
        <button class="ghost small" onclick="setRange(30)">Last 30 days</button>
        <button class="ghost small" onclick="setRange(90)">Last 90 days</button>
        <button class="ghost small" onclick="setRange(null)">All time</button>
      </div>
      <div class="row">
        <label style="display:flex;align-items:center;gap:8px;margin:0;color:#1a1a1a;font-weight:500;font-size:14px;cursor:pointer">
          <input type="radio" name="metric" value="count" checked style="width:auto;margin:0" onchange="setMetric('count')"> Count
        </label>
        <label style="display:flex;align-items:center;gap:8px;margin:0;color:#1a1a1a;font-weight:500;font-size:14px;cursor:pointer">
          <input type="radio" name="metric" value="spend" style="width:auto;margin:0" onchange="setMetric('spend')"> Spend (£ ex VAT)
        </label>
      </div>
    </div>
    <div class="stat-grid" id="overview"></div>
    <div class="card"><h2>By Supplier</h2><div id="by-supplier" class="bar-chart"></div></div>
    <div class="card"><h2>By Engineer</h2><div id="by-engineer" class="bar-chart"></div></div>
    <div class="card"><h2>By Office User</h2><div id="by-office-user" class="bar-chart"></div></div>
    <div class="card"><h2>By Site</h2><div id="by-site" class="bar-chart"></div></div>
    <div class="card"><h2>By Source</h2><div id="by-source" class="bar-chart"></div></div>
    <div class="card"><h2>By Month</h2><div id="by-month" class="bar-chart"></div></div>
    <div class="card"><h2>Recent Days</h2><div id="by-day" class="bar-chart"></div></div>
  </div>
<script>
let metric = 'count';
function formatMoney(n) { return '£' + Number(n).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ','); }
async function init() {
  const [engineers, suppliers] = await Promise.all([
    fetch('/api/engineers').then(r => r.json()),
    fetch('/api/suppliers').then(r => r.json())
  ]);
  document.getElementById('f-engineer').innerHTML = '<option value="">All engineers</option>' + engineers.filter(e=>e.active).map(e => '<option value="' + e.slug + '">' + escapeHtml(e.name) + '</option>').join('');
  document.getElementById('f-supplier').innerHTML = '<option value="">All suppliers</option>' + suppliers.map(s => '<option value="' + escapeAttr(s.name) + '">' + escapeHtml(s.name) + '</option>').join('');
  ['f-engineer','f-supplier','f-source','f-from','f-to'].forEach(id => document.getElementById(id).onchange = load);
  load();
}
function setMetric(m) { metric = m; load(); }
function setRange(days) {
  if (days) {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    document.getElementById('f-from').value = from;
    document.getElementById('f-to').value = to;
  } else {
    document.getElementById('f-from').value = '';
    document.getElementById('f-to').value = '';
  }
  load();
}
async function load() {
  const params = new URLSearchParams();
  ['engineer','supplier','source','from','to'].forEach(k => {
    const v = document.getElementById('f-' + k).value;
    if (v) params.set(k, v);
  });
  const s = await fetch('/api/stats?' + params).then(r => r.json());
  const totalSpend = s.total_spend_ex_vat || 0;
  document.getElementById('overview').innerHTML = \`
    <div class="stat"><div class="v">\${s.total}</div><div class="l">Total POs</div></div>
    <div class="stat"><div class="v">\${formatMoney(totalSpend)}</div><div class="l">Total Spend ex VAT</div></div>
    <div class="stat"><div class="v">\${s.uncosted || 0}</div><div class="l">Uncosted POs</div></div>
    <div class="stat"><div class="v">\${s.by_engineer.length}</div><div class="l">Engineers</div></div>\`;
  renderBars('by-supplier', s.by_supplier, 'supplier', 15);
  renderBars('by-engineer', s.by_engineer, 'engineer', 15);
  renderBars('by-office-user', s.by_office_user || [], 'office_user', 15);
  renderBars('by-site', s.by_site || [], 'site', 15);
  renderBars('by-source', s.by_source.map(x => ({ name: x.source === 'engineer' ? 'Engineer (OOH)' : 'Office', count: x.count, total_ex_vat: 0 })), 'name', 10);
  renderBars('by-month', (s.by_month || []).map(x => ({ name: fmtMonth(x.month), count: x.count, total_ex_vat: x.total_ex_vat || 0 })), 'name', 12);
  renderBars('by-day', s.by_day.map(x => ({ name: fmtDate(x.day), count: x.count, total_ex_vat: x.total_ex_vat || 0 })), 'name', 30);
}
function fmtDate(s) {
  s = String(s || '');
  if (s.length === 10 && s.charAt(4) === '-') return s.slice(8,10) + '-' + s.slice(5,7) + '-' + s.slice(2,4);
  return s;
}
function fmtMonth(ym) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const s = String(ym || '');
  if (s.length === 7 && s.charAt(4) === '-') return MONTHS[Number(s.slice(5,7)) - 1] + ' ' + s.slice(2,4);
  return s;
}
function renderBars(containerId, items, nameKey, limit) {
  const container = document.getElementById(containerId);
  if (!items || !items.length) { container.innerHTML = '<div class="empty">No data</div>'; return; }
  // Pick value field based on metric
  const valFn = metric === 'spend' ? (i => Number(i.total_ex_vat || 0)) : (i => i.count);
  const labelFn = metric === 'spend' ? (i => formatMoney(i.total_ex_vat || 0)) : (i => i.count);
  const sorted = [...items].sort((a, b) => valFn(b) - valFn(a)).slice(0, limit);
  const max = Math.max(...sorted.map(valFn));
  container.innerHTML = sorted.map(i => {
    const v = valFn(i);
    const pct = max ? (v / max * 100) : 0;
    return \`<div class="bar-row"><div class="name" title="\${escapeAttr(i[nameKey])}">\${escapeHtml(i[nameKey])}</div><div class="bar"><div class="fill" style="width:\${pct}%"></div></div><div class="count">\${labelFn(i)}</div></div>\`;
  }).join('');
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }
init();
</script></body></html>`;
}

function adminPage() {
  return `${pageHead('Admin — PO System')}${topbar('admin')}
  <div class="wrap">
    <div class="tab-bar">
      <div class="tab active" data-tab="config">System</div>
      <div class="tab" data-tab="engineers">Engineers</div>
      <div class="tab" data-tab="office-users">Office Users</div>
      <div class="tab" data-tab="suppliers">Suppliers</div>
      <div class="tab" data-tab="subcontractors">Subcontractors</div>
      <div class="tab" data-tab="trades">Trades</div>
      <div class="tab" data-tab="sites">Sites</div>
      <div class="tab" data-tab="closures">Closures</div>
    </div>
    <div id="tab-config" class="tab-pane" style="display:block">
      <div class="card">
        <h2>System Status</h2>
        <div class="alert" id="current-status"></div>
        <div class="field"><label>Mode</label>
          <select id="system_status">
            <option value="live">Live (normal operation)</option>
            <option value="disabled">Disabled (no POs can be issued)</option>
          </select>
        </div>
        <div class="field"><label style="display:flex;align-items:center;gap:10px;color:#1a1a1a;font-weight:500;cursor:pointer">
          <input type="checkbox" id="force_open_ooh" style="width:auto"> Force open out-of-hours mode (engineers can use form regardless of time)
        </label></div>
      </div>
      <div class="card">
        <h2>Office Hours</h2>
        <div class="grid-2">
          <div class="field"><label>Start</label><input id="office_hours_start" type="time"></div>
          <div class="field"><label>End</label><input id="office_hours_end" type="time"></div>
        </div>
        <div class="field"><label>Working days</label><input id="office_days" type="text" placeholder="MON,TUE,WED,THU,FRI"></div>
        <div class="field"><label>Office phone</label><input id="office_phone" type="text"></div>
      </div>
      <button onclick="saveConfig()">💾 Save</button>
    </div>
    <div id="tab-engineers" class="tab-pane" style="display:none">
      <div class="card">
        <h2>Engineers</h2>
        <p class="muted">Each engineer has a private, unguessable URL — share it so they can bookmark it on their phone. <strong>Suspend</strong> blocks access (their link shows a "suspended" message) but keeps the same link for when you <strong>Reinstate</strong> them. <strong>♻ New link</strong> revokes and replaces the link. <strong>Remove</strong> takes them off entirely.</p>
        <div class="table-scroll"><table>
          <thead><tr><th>Name</th><th>URL</th><th></th></tr></thead>
          <tbody id="eng-tbody"></tbody>
        </table></div>
      </div>
      <div class="card"><h3>Add Engineer</h3>
        <div class="row"><input id="new-eng-name" type="text" placeholder="Full name" style="flex:1;min-width:180px"><button class="small" onclick="addEngineer()">Add</button></div>
      </div>
    </div>
    <div id="tab-office-users" class="tab-pane" style="display:none">
      <div class="card">
        <h2>Office Users</h2>
        <p class="muted">Each office user has a private, unguessable URL. Issued POs and edits are stamped with the user. Use ♻ New link to revoke and reissue a link.</p>
        <div class="table-scroll"><table>
          <thead><tr><th>Name</th><th>URL</th><th></th></tr></thead>
          <tbody id="ou-tbody"></tbody>
        </table></div>
      </div>
      <div class="card"><h3>Add Office User</h3>
        <div class="row"><input id="new-ou-name" type="text" placeholder="First name" style="flex:1;min-width:180px"><button class="small" onclick="addOfficeUser()">Add</button></div>
      </div>
    </div>
    <div id="tab-suppliers" class="tab-pane" style="display:none">
      <div class="card"><h2>Suppliers</h2>
        <div id="sup-list" style="display:flex;flex-wrap:wrap;gap:6px"></div>
      </div>
      <div class="card"><h3>Add Supplier</h3>
        <div class="row"><input id="new-sup-name" type="text" placeholder="Supplier name" style="flex:1;min-width:180px"><button class="small" onclick="addSupplier()">Add</button></div>
      </div>
    </div>
    <div id="tab-subcontractors" class="tab-pane" style="display:none">
      <div class="card"><h2>Subcontractors</h2>
        <p class="muted" style="margin-bottom:12px">Companies you raise subcontractor POs to (roofers, plumbers…). Office-only — engineers never see these.</p>
        <div id="subc-list" style="display:flex;flex-wrap:wrap;gap:6px"></div>
      </div>
      <div class="card"><h3>Add Subcontractor</h3>
        <div class="row"><input id="new-subc-name" type="text" placeholder="Subcontractor company" style="flex:1;min-width:180px"><button class="small" onclick="addSubcontractor()">Add</button></div>
      </div>
    </div>
    <div id="tab-trades" class="tab-pane" style="display:none">
      <div class="card"><h2>Trades</h2>
        <p class="muted" style="margin-bottom:12px">Trade categories for subcontractor POs (used in job costing). Add sub-trades as you need them.</p>
        <div id="trade-list" style="display:flex;flex-wrap:wrap;gap:6px"></div>
      </div>
      <div class="card"><h3>Add Trade</h3>
        <div class="row"><input id="new-trade-name" type="text" placeholder="Trade name" style="flex:1;min-width:180px"><button class="small" onclick="addTrade()">Add</button></div>
      </div>
    </div>
    <div id="tab-sites" class="tab-pane" style="display:none">
      <div class="card"><h2>Sites</h2>
        <p class="muted" style="margin-bottom:12px">Master sites list. Engineers can type free-text on the form, but POs with unmatched sites get flagged for office review. Add new sites here as they come up.</p>
        <div id="site-list" style="display:flex;flex-wrap:wrap;gap:6px"></div>
      </div>
      <div class="card"><h3>Add Site</h3>
        <div class="row"><input id="new-site-name" type="text" placeholder="Site name" style="flex:1;min-width:180px"><button class="small" onclick="addSite()">Add</button></div>
      </div>
    </div>
    <div id="tab-closures" class="tab-pane" style="display:none">
      <div class="card">
        <h2>Closures / Bank Holidays</h2>
        <p class="muted">Days the office is closed. Engineers can use the OOH form on these dates.</p>
        <div class="table-scroll"><table>
          <thead><tr><th>Date</th><th>Reason</th><th></th></tr></thead>
          <tbody id="clo-tbody"></tbody>
        </table></div>
      </div>
      <div class="card"><h3>Add Closure</h3>
        <div class="row"><input id="new-clo-date" type="date"><input id="new-clo-reason" type="text" placeholder="Reason" style="flex:1;min-width:150px"><button class="small" onclick="addClosure()">Add</button></div>
      </div>
    </div>
  </div>
<script>
// Attach tab handlers IMMEDIATELY, before any async work, so they always work
function setupTabs() {
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(x => { x.style.display = 'none'; });
      t.classList.add('active');
      const target = document.getElementById('tab-' + t.dataset.tab);
      if (target) target.style.display = 'block';
    });
  });
}
setupTabs();
async function init() {
  // Load each piece independently so one failure doesn't break the rest
  const safe = async (fn, label) => { try { await fn(); } catch (e) { console.error(label + ' failed:', e); } };
  await Promise.all([
    safe(loadConfig, 'loadConfig'),
    safe(loadEngineers, 'loadEngineers'),
    safe(loadOfficeUsers, 'loadOfficeUsers'),
    safe(loadSuppliers, 'loadSuppliers'),
    safe(loadSubcontractors, 'loadSubcontractors'),
    safe(loadTrades, 'loadTrades'),
    safe(loadSites, 'loadSites'),
    safe(loadClosures, 'loadClosures'),
    safe(loadStatus, 'loadStatus')
  ]);
}
async function loadStatus() {
  const s = await fetch('/api/status').then(r => r.json());
  let txt = '<strong>Current mode:</strong> ' + s.mode;
  if (s.message) txt += '<br><span class="muted">' + s.message + '</span>';
  if (s.forced) txt += ' <em>(force-open enabled)</em>';
  document.getElementById('current-status').innerHTML = txt;
}
async function loadConfig() {
  const c = await fetch('/api/config').then(r => r.json());
  document.getElementById('system_status').value = c.system_status || 'live';
  document.getElementById('force_open_ooh').checked = c.force_open_ooh === '1';
  document.getElementById('office_hours_start').value = c.office_hours_start || '08:30';
  document.getElementById('office_hours_end').value = c.office_hours_end || '16:30';
  document.getElementById('office_days').value = c.office_days || 'MON,TUE,WED,THU,FRI';
  document.getElementById('office_phone').value = c.office_phone || '';
}
async function saveConfig() {
  await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_status: document.getElementById('system_status').value,
      force_open_ooh: document.getElementById('force_open_ooh').checked ? '1' : '0',
      office_hours_start: document.getElementById('office_hours_start').value,
      office_hours_end: document.getElementById('office_hours_end').value,
      office_days: document.getElementById('office_days').value,
      office_phone: document.getElementById('office_phone').value
    }) });
  await loadStatus();
  alert('Saved');
}
async function loadEngineers() {
  const engs = await fetch('/api/engineers').then(r => r.json());
  const base = window.location.origin;
  document.getElementById('eng-tbody').innerHTML = engs.filter(e => e.active).map(e => {
    const susp = Number(e.suspended) === 1;
    const badge = susp ? '<span class="badge danger-badge" title="' + escapeAttr(e.suspend_reason || 'No reason given') + '">Suspended</span>' : '';
    const suspBtn = susp
      ? '<button class="ghost small" onclick="reinstateEngineer(\\'' + e.slug + '\\', \\'' + escapeJs(e.name) + '\\')">Reinstate</button>'
      : '<button class="ghost small" title="Block access, keep the link" onclick="suspendEngineer(\\'' + e.slug + '\\', \\'' + escapeJs(e.name) + '\\')">Suspend</button>';
    return '<tr' + (susp ? ' style="background:#fdf3f2"' : '') + '>' +
      '<td><strong>' + escapeHtml(e.name) + '</strong> ' + badge + '</td>' +
      '<td><a href="/e/' + e.token + '" target="_blank" style="font-family:ui-monospace,monospace;font-size:12px;color:#1A4F8F">' + base + '/e/' + e.token + '</a></td>' +
      '<td><div class="row"><button class="ghost small" onclick="copyLink(\\'' + base + '/e/' + e.token + '\\')">Copy</button>' + suspBtn +
      '<button class="ghost small" title="Invalidate the current link and issue a new one" onclick="rotateLink(\\'engineers\\', \\'' + e.slug + '\\', \\'' + escapeJs(e.name) + '\\')">♻ New link</button>' +
      '<button class="danger small" onclick="removeEngineer(\\'' + e.slug + '\\')">Remove</button></div></td></tr>';
  }).join('');
}
function escapeJs(s) { return String(s).replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'"); }
async function suspendEngineer(slug, name) {
  const reason = prompt('Suspend ' + name + '?\\n\\nTheir link keeps working but shows a "suspended" message until you reinstate them.\\n\\nOptional reason to show them (leave blank for none):', '');
  if (reason === null) return; // cancelled
  await fetch('/api/engineers/' + slug, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suspended: 1, suspend_reason: reason.trim() }) });
  loadEngineers();
}
async function reinstateEngineer(slug, name) {
  if (!confirm('Reinstate ' + name + '? Their existing link will work again straight away.')) return;
  await fetch('/api/engineers/' + slug, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suspended: 0 }) });
  loadEngineers();
}
async function suspendEngineer(slug, name) {
  const reason = prompt('Suspend ' + name + '?\\n\\nTheir link keeps working but shows a "suspended" message until you reinstate them.\\n\\nOptional reason to show them (leave blank for none):', '');
  if (reason === null) return; // cancelled
  await fetch('/api/engineers/' + slug, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suspended: 1, suspend_reason: reason.trim() }) });
  loadEngineers();
}
async function reinstateEngineer(slug, name) {
  if (!confirm('Reinstate ' + name + '? Their existing link will work again straight away.')) return;
  await fetch('/api/engineers/' + slug, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suspended: 0 }) });
  loadEngineers();
}
async function addEngineer() {
  const name = document.getElementById('new-eng-name').value.trim();
  if (!name) return;
  await fetch('/api/engineers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  document.getElementById('new-eng-name').value = ''; loadEngineers();
}
async function removeEngineer(slug) {
  if (!confirm('Remove this engineer?')) return;
  await fetch('/api/engineers/' + slug, { method: 'DELETE' }); loadEngineers();
}
async function loadOfficeUsers() {
  const users = await fetch('/api/office-users').then(r => r.json());
  const base = window.location.origin;
  const active = users.filter(u => u.active);
  if (!active.length) { document.getElementById('ou-tbody').innerHTML = '<tr><td colspan="3"><div class="empty">No office users yet</div></td></tr>'; return; }
  document.getElementById('ou-tbody').innerHTML = active.map(u => \`
    <tr>
      <td><strong>\${escapeHtml(u.name)}</strong></td>
      <td><a href="/o/\${u.token}" target="_blank" style="font-family:ui-monospace,monospace;font-size:12px;color:#1A4F8F">\${base}/o/\${u.token}</a></td>
      <td><div class="row"><button class="ghost small" onclick='copyLink("\${base}/o/\${u.token}")'>Copy</button><button class="ghost small" title="Invalidate the current link and issue a new one" onclick='rotateLink("office-users", "\${u.slug}", "\${escapeAttr(u.name)}")'>♻ New link</button><button class="danger small" onclick='removeOfficeUser("\${u.slug}")'>Remove</button></div></td>
    </tr>\`).join('');
}
async function addOfficeUser() {
  const name = document.getElementById('new-ou-name').value.trim();
  if (!name) return;
  await fetch('/api/office-users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  document.getElementById('new-ou-name').value = ''; loadOfficeUsers();
}
async function removeOfficeUser(slug) {
  if (!confirm('Remove this office user?')) return;
  await fetch('/api/office-users/' + slug, { method: 'DELETE' }); loadOfficeUsers();
}
async function loadSuppliers() {
  const sups = await fetch('/api/suppliers').then(r => r.json());
  document.getElementById('sup-list').innerHTML = sups.map(s => \`<div class="chip">\${escapeHtml(s.name)} <button onclick='removeSupplier(\${s.id})' title="Remove">✕</button></div>\`).join('');
}
async function addSupplier() {
  const name = document.getElementById('new-sup-name').value.trim();
  if (!name) return;
  await fetch('/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  document.getElementById('new-sup-name').value = ''; loadSuppliers();
}
async function removeSupplier(id) { await fetch('/api/suppliers/' + id, { method: 'DELETE' }); loadSuppliers(); }
async function loadSubcontractors() {
  const subs = await fetch('/api/subcontractors').then(r => r.json());
  const el = document.getElementById('subc-list');
  el.innerHTML = subs.length ? subs.map(s => \`<div class="chip">\${escapeHtml(s.name)} <button onclick='removeSubcontractor(\${s.id})' title="Remove">✕</button></div>\`).join('') : '<div class="empty" style="padding:16px;width:100%">No subcontractors yet — add roofers, plumbers, etc.</div>';
}
async function addSubcontractor() {
  const name = document.getElementById('new-subc-name').value.trim();
  if (!name) return;
  await fetch('/api/subcontractors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  document.getElementById('new-subc-name').value = ''; loadSubcontractors();
}
async function removeSubcontractor(id) { await fetch('/api/subcontractors/' + id, { method: 'DELETE' }); loadSubcontractors(); }
async function loadTrades() {
  const trades = await fetch('/api/trades').then(r => r.json());
  document.getElementById('trade-list').innerHTML = trades.map(t => \`<div class="chip">\${escapeHtml(t.name)} <button onclick='removeTrade(\${t.id})' title="Remove">✕</button></div>\`).join('');
}
async function addTrade() {
  const name = document.getElementById('new-trade-name').value.trim();
  if (!name) return;
  await fetch('/api/trades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  document.getElementById('new-trade-name').value = ''; loadTrades();
}
async function removeTrade(id) { await fetch('/api/trades/' + id, { method: 'DELETE' }); loadTrades(); }
async function loadSites() {
  const sites = await fetch('/api/sites').then(r => r.json());
  if (!sites.length) { document.getElementById('site-list').innerHTML = '<div class="empty" style="padding:20px;width:100%">No sites added yet. Add the ones you use most often — engineers can still type free-text for one-offs.</div>'; return; }
  document.getElementById('site-list').innerHTML = sites.map(s => \`<div class="chip">\${escapeHtml(s.name)} <button onclick='removeSite(\${s.id})' title="Remove">✕</button></div>\`).join('');
}
async function addSite() {
  const name = document.getElementById('new-site-name').value.trim();
  if (!name) return;
  await fetch('/api/sites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  document.getElementById('new-site-name').value = ''; loadSites();
}
async function removeSite(id) { await fetch('/api/sites/' + id, { method: 'DELETE' }); loadSites(); }
async function loadClosures() {
  const cls = await fetch('/api/closures').then(r => r.json());
  if (!cls.length) { document.getElementById('clo-tbody').innerHTML = '<tr><td colspan="3"><div class="empty">No closures added</div></td></tr>'; return; }
  document.getElementById('clo-tbody').innerHTML = cls.map(c => \`<tr><td>\${fmtDate(c.date)}</td><td>\${escapeHtml(c.reason || '')}</td><td><button class="danger small" onclick='removeClosure("\${c.date}")'>Remove</button></td></tr>\`).join('');
}
async function addClosure() {
  const date = document.getElementById('new-clo-date').value;
  const reason = document.getElementById('new-clo-reason').value.trim();
  if (!date) return;
  await fetch('/api/closures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, reason }) });
  document.getElementById('new-clo-date').value = ''; document.getElementById('new-clo-reason').value = ''; loadClosures();
}
async function removeClosure(date) { await fetch('/api/closures/' + encodeURIComponent(date), { method: 'DELETE' }); loadClosures(); }
function copyLink(url) { navigator.clipboard.writeText(url).then(() => alert('Copied: ' + url)); }
async function rotateLink(kind, slug, name) {
  if (!confirm('Issue a new link for ' + name + '?\\n\\nTheir current link stops working immediately — send them the new one.')) return;
  await fetch('/api/' + kind + '/' + slug + '/rotate', { method: 'POST' });
  if (kind === 'engineers') loadEngineers(); else loadOfficeUsers();
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }
function fmtDate(s) {
  s = String(s || '');
  if (s.length === 10 && s.charAt(4) === '-') return s.slice(8,10) + '-' + s.slice(5,7) + '-' + s.slice(2,4);
  return s;
}
init();
</script></body></html>`;
}

function escapeHtmlServer(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
