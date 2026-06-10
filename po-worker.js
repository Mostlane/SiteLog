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
          // Verify it's still a valid active user
          const user = await env.DB.prepare(`SELECT slug FROM office_users WHERE slug = ? AND active = 1`).bind(remembered).first();
          if (user) return Response.redirect(new URL('/o/' + user.slug, request.url).toString(), 302);
        }
        return html(officeAccessRequiredPage());
      }
      if (path.startsWith('/o/')) return handleOfficeUserView(path, env);
      if (path === '/admin') return html(adminPage());
      if (path === '/stats') return html(statsPage());

      if (path === '/api/config' && method === 'GET') return json(await getConfig(env.DB));
      if (path === '/api/config' && method === 'POST') return json(await updateConfig(env.DB, await request.json()));
      if (path === '/api/engineers' && method === 'GET') return json(await getEngineers(env.DB));
      if (path === '/api/engineers' && method === 'POST') return json(await addEngineer(env.DB, await request.json()));
      if (path.startsWith('/api/engineers/') && method === 'DELETE') return json(await deleteEngineer(env.DB, path.split('/').pop()));
      if (path === '/api/office-users' && method === 'GET') return json(await getOfficeUsers(env.DB));
      if (path === '/api/office-users' && method === 'POST') return json(await addOfficeUser(env.DB, await request.json()));
      if (path.startsWith('/api/office-users/') && method === 'DELETE') return json(await deleteOfficeUser(env.DB, path.split('/').pop()));
      if (path === '/api/suppliers' && method === 'GET') return json(await getSuppliers(env.DB));
      if (path === '/api/suppliers' && method === 'POST') return json(await addSupplier(env.DB, await request.json()));
      if (path.startsWith('/api/suppliers/') && method === 'DELETE') return json(await deleteSupplier(env.DB, path.split('/').pop()));
      if (path === '/api/sites' && method === 'GET') return json(await getSites(env.DB));
      if (path === '/api/sites' && method === 'POST') return json(await addSite(env.DB, await request.json()));
      if (path.startsWith('/api/sites/') && method === 'DELETE') return json(await deleteSite(env.DB, path.split('/').pop()));
      if (path === '/api/closures' && method === 'GET') return json(await getClosures(env.DB));
      if (path === '/api/closures' && method === 'POST') return json(await addClosure(env.DB, await request.json()));
      if (path.startsWith('/api/closures/') && method === 'DELETE') return json(await deleteClosure(env.DB, decodeURIComponent(path.split('/').pop())));
      if (path === '/api/pos' && method === 'GET') return json(await getPOs(env.DB, url.searchParams));
      if (path === '/api/pos' && method === 'POST') return json(await issuePO(env.DB, await request.json()));
      if (path.startsWith('/api/pos/') && method === 'PATCH') return json(await updatePO(env.DB, path.split('/').pop(), await request.json()));
      if (path === '/api/status' && method === 'GET') return json(await getSystemStatus(env.DB));
      if (path === '/api/stats' && method === 'GET') return json(await getStats(env.DB, url.searchParams));
      if (path === '/api/export' && method === 'GET') return csvExport(env.DB, url.searchParams);
      if (path === '/logo.jpg' || path === '/logo.svg') return logoResponse();

      return new Response('Not found', { status: 404 });
    } catch (err) {
      return new Response('Error: ' + err.message, { status: 500 });
    }
  }
};

// ============================================================
// SCHEMA
// ============================================================
async function ensureSchema(db) {
  await db.exec(`CREATE TABLE IF NOT EXISTS engineers (slug TEXT PRIMARY KEY, name TEXT NOT NULL, active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  await db.exec(`CREATE TABLE IF NOT EXISTS office_users (slug TEXT PRIMARY KEY, name TEXT NOT NULL, active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  await db.exec(`CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, active INTEGER DEFAULT 1)`);
  await db.exec(`CREATE TABLE IF NOT EXISTS sites (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, active INTEGER DEFAULT 1)`);
  await db.exec(`CREATE TABLE IF NOT EXISTS closures (date TEXT PRIMARY KEY, reason TEXT)`);
  await db.exec(`CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)`);
  await db.exec(`CREATE TABLE IF NOT EXISTS po_log (po_number INTEGER PRIMARY KEY AUTOINCREMENT, engineer_slug TEXT, engineer_name TEXT, issued_at TEXT NOT NULL, source TEXT NOT NULL, site TEXT, supplier TEXT, description TEXT, needs_review INTEGER DEFAULT 1, reviewed_at TEXT, reviewed_by TEXT, deleted INTEGER DEFAULT 0)`);

  // Migrations - add new columns if missing (idempotent)
  await addColumnIfMissing(db, 'po_log', 'cost_ex_vat', 'REAL');
  await addColumnIfMissing(db, 'po_log', 'vat_rate', 'REAL');
  await addColumnIfMissing(db, 'po_log', 'status', "TEXT DEFAULT 'open'");
  await addColumnIfMissing(db, 'po_log', 'flag_reason', 'TEXT');
  await addColumnIfMissing(db, 'po_log', 'credit_note', 'TEXT');
  await addColumnIfMissing(db, 'po_log', 'cost_entered_at', 'TEXT');
  await addColumnIfMissing(db, 'po_log', 'office_user_slug', 'TEXT');
  await addColumnIfMissing(db, 'po_log', 'office_user_name', 'TEXT');
  await addColumnIfMissing(db, 'po_log', 'last_edited_by_slug', 'TEXT');
  await addColumnIfMissing(db, 'po_log', 'last_edited_by_name', 'TEXT');
  await addColumnIfMissing(db, 'po_log', 'last_edited_at', 'TEXT');

  const defaults = [
    ['office_hours_start', '08:30'],
    ['office_hours_end', '16:30'],
    ['office_days', 'MON,TUE,WED,THU,FRI'],
    ['system_status', 'live'],
    ['office_phone', '02380 262000'],
    ['force_open_ooh', '0']
  ];
  for (const [k, v] of defaults) {
    await db.prepare(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`).bind(k, v).run();
  }

  const counterCheck = await db.prepare(`SELECT COUNT(*) as c FROM po_log`).first();
  if (counterCheck.c === 0) {
    await db.prepare(`INSERT INTO po_log (po_number, issued_at, source, deleted) VALUES (10010, ?, 'seed', 1)`).bind(new Date().toISOString()).run();
    await db.prepare(`DELETE FROM po_log WHERE po_number = 10010`).run();
  }

  const engineers = ['David Molloy', 'Connor Brady', 'Ryan Diggens', 'Daniel Walker', 'Chris Cooke', 'Chris Freeman', 'Tony Pelin', 'Joe Line', 'Jamie Line', 'Greg Line'];
  for (const name of engineers) {
    await db.prepare(`INSERT OR IGNORE INTO engineers (slug, name) VALUES (?, ?)`).bind(slugify(name), name).run();
  }

  const officeUsers = [
    ['jamie', 'Jamie'],
    ['joe', 'Joe'],
    ['greg', 'Greg'],
    ['joanna', 'Joanna'],
    ['tanya', 'Tanya'],
    ['megan', 'Megan'],
    ['chloe', 'Chloe']
  ];
  for (const [slug, name] of officeUsers) {
    await db.prepare(`INSERT OR IGNORE INTO office_users (slug, name) VALUES (?, ?)`).bind(slug, name).run();
  }

  const suppliers = ['Howdens', 'Trade UK', 'Brewers', 'CEF', 'Rexel - WF Senate', 'Electric Center', 'Elliotts', 'Travis Perkins', 'CCF', 'Speedy', 'HSS', 'Dulux', 'Auto Trade Tyres', 'Collard', 'NICEIC', 'Ace Liftaway', 'Huws Gray Ltd', 'Covers', 'Ironmangery', 'L&S Waste', 'Jewsons', 'Midsummer', 'Eurocell', 'TLC', 'FH Brundle', 'Astroflame', 'TJ Waste Zero Waste', 'Metal Supermarket', 'Toolstation', 'Stalwart Products', 'N&C', 'Envirochem', 'City Plumbing', 'AMEX Card DD 17TH', 'Pickerings', 'Keyline', 'Nutland', 'Borderland', 'GERFLOR', 'Glasdon', 'Reform Electrical', 'Pioneer Welding', 'Soham', 'Basingstoke Skip Hire', 'Eyre & Elliston', 'Sydnhams'];
  for (const name of suppliers) {
    await db.prepare(`INSERT OR IGNORE INTO suppliers (name) VALUES (?)`).bind(name).run();
  }
}

function slugify(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

async function addColumnIfMissing(db, table, column, type) {
  try {
    const info = await db.prepare(`PRAGMA table_info(${table})`).all();
    const exists = info.results.some(r => r.name === column);
    if (!exists) {
      await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  } catch (e) {
    console.error(`Migration failed for ${table}.${column}:`, e.message);
  }
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
// API LOGIC
// ============================================================
async function handleEngineerView(path, env) {
  const slug = path.split('/')[2];
  const eng = await env.DB.prepare(`SELECT * FROM engineers WHERE slug = ? AND active = 1`).bind(slug).first();
  if (!eng) return html(unknownEngineerPage());
  return html(engineerPage(eng));
}

async function handleOfficeUserView(path, env) {
  const slug = path.split('/')[2];
  const user = await env.DB.prepare(`SELECT * FROM office_users WHERE slug = ? AND active = 1`).bind(slug).first();
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
  await db.prepare(`INSERT INTO office_users (slug, name, active) VALUES (?, ?, 1) ON CONFLICT(slug) DO UPDATE SET active = 1, name = ?`).bind(slug, body.name, body.name).run();
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
  await db.prepare(`INSERT INTO engineers (slug, name, active) VALUES (?, ?, 1) ON CONFLICT(slug) DO UPDATE SET active = 1, name = ?`).bind(slug, body.name, body.name).run();
  return { success: true, slug };
}
async function deleteEngineer(db, slug) { await db.prepare(`UPDATE engineers SET active = 0 WHERE slug = ?`).bind(slug).run(); return { success: true }; }
async function getSuppliers(db) { return (await db.prepare(`SELECT * FROM suppliers WHERE active = 1 ORDER BY name`).all()).results; }
async function addSupplier(db, body) {
  await db.prepare(`INSERT INTO suppliers (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET active = 1`).bind(body.name).run();
  return { success: true };
}
async function deleteSupplier(db, id) { await db.prepare(`UPDATE suppliers SET active = 0 WHERE id = ?`).bind(id).run(); return { success: true }; }
async function getSites(db) { return (await db.prepare(`SELECT * FROM sites WHERE active = 1 ORDER BY name`).all()).results; }
async function addSite(db, body) {
  await db.prepare(`INSERT INTO sites (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET active = 1`).bind(body.name).run();
  return { success: true };
}
async function deleteSite(db, id) { await db.prepare(`UPDATE sites SET active = 0 WHERE id = ?`).bind(id).run(); return { success: true }; }
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
    query += ` AND (CAST(po_number AS TEXT) LIKE ? OR LOWER(engineer_name) LIKE ? OR LOWER(site) LIKE ? OR LOWER(supplier) LIKE ? OR LOWER(description) LIKE ? OR LOWER(flag_reason) LIKE ? OR LOWER(credit_note) LIKE ?)`;
    binds.push(term, term, term, term, term, term, term);
  }
  query += ` ORDER BY po_number DESC LIMIT 1000`;
  return (await db.prepare(query).bind(...binds).all()).results;
}

async function issuePO(db, body) {
  const status = await getSystemStatus(db);
  if (status.mode === 'disabled') return { error: status.message };
  if (status.mode === 'office_hours' && body.source !== 'office') return { error: status.message };

  // Validate required fields (engineer source only — office can issue with missing fields if needed for emergency reconciliation)
  if (body.source === 'engineer') {
    if (!body.site || !body.site.trim()) return { error: 'Site is required' };
    if (!body.supplier || !body.supplier.trim()) return { error: 'Supplier is required' };
    if (!body.description || !body.description.trim()) return { error: 'Description is required' };
    // Supplier must be in the active list
    const supplierCheck = await db.prepare(`SELECT 1 FROM suppliers WHERE name = ? AND active = 1`).bind(body.supplier).first();
    if (!supplierCheck) return { error: 'Supplier must be picked from the list' };
  }

  const issuedAt = new Date().toISOString();
  const result = await db.prepare(`INSERT INTO po_log (engineer_slug, engineer_name, issued_at, source, site, supplier, description, needs_review, office_user_slug, office_user_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    body.engineer_slug || null, body.engineer_name || null, issuedAt, body.source || 'office',
    body.site || null, body.supplier || null, body.description || null, body.source === 'office' ? 0 : 1,
    body.office_user_slug || null, body.office_user_name || null
  ).run();
  return { success: true, po_number: result.meta.last_row_id, issued_at: issuedAt };
}

async function updatePO(db, poNumber, body) {
  const allowed = ['site', 'supplier', 'description', 'needs_review', 'reviewed_by', 'engineer_slug', 'engineer_name', 'deleted', 'cost_ex_vat', 'vat_rate', 'status', 'flag_reason', 'credit_note'];
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

async function getStats(db, params) {
  let where = `WHERE deleted = 0`;
  const binds = [];
  if (params.get('engineer')) { where += ` AND engineer_slug = ?`; binds.push(params.get('engineer')); }
  if (params.get('supplier')) { where += ` AND supplier = ?`; binds.push(params.get('supplier')); }
  if (params.get('from')) { where += ` AND issued_at >= ?`; binds.push(params.get('from')); }
  if (params.get('to')) { where += ` AND issued_at <= ?`; binds.push(params.get('to') + 'T23:59:59'); }
  if (params.get('source')) { where += ` AND source = ?`; binds.push(params.get('source')); }

  const total = await db.prepare(`SELECT COUNT(*) as c FROM po_log ${where}`).bind(...binds).first();
  const bySupplier = await db.prepare(`SELECT COALESCE(supplier, '(none)') as supplier, COUNT(*) as count, COALESCE(SUM(cost_ex_vat), 0) as total_ex_vat FROM po_log ${where} GROUP BY supplier ORDER BY count DESC`).bind(...binds).all();
  const byEngineer = await db.prepare(`SELECT COALESCE(engineer_name, '(none)') as engineer, COUNT(*) as count, COALESCE(SUM(cost_ex_vat), 0) as total_ex_vat FROM po_log ${where} GROUP BY engineer_name ORDER BY count DESC`).bind(...binds).all();
  const byOfficeUser = await db.prepare(`SELECT COALESCE(office_user_name, '(no office user)') as office_user, COUNT(*) as count, COALESCE(SUM(cost_ex_vat), 0) as total_ex_vat FROM po_log ${where} AND office_user_name IS NOT NULL GROUP BY office_user_name ORDER BY count DESC`).bind(...binds).all();
  const bySite = await db.prepare(`SELECT COALESCE(site, '(none)') as site, COUNT(*) as count, COALESCE(SUM(cost_ex_vat), 0) as total_ex_vat FROM po_log ${where} GROUP BY site ORDER BY total_ex_vat DESC`).bind(...binds).all();
  const bySource = await db.prepare(`SELECT source, COUNT(*) as count FROM po_log ${where} GROUP BY source ORDER BY count DESC`).bind(...binds).all();
  const byDay = await db.prepare(`SELECT substr(issued_at, 1, 10) as day, COUNT(*) as count, COALESCE(SUM(cost_ex_vat), 0) as total_ex_vat FROM po_log ${where} GROUP BY day ORDER BY day DESC LIMIT 60`).bind(...binds).all();
  const needsReview = await db.prepare(`SELECT COUNT(*) as c FROM po_log ${where} AND needs_review = 1`).bind(...binds).first();
  const byStatus = await db.prepare(`SELECT COALESCE(status, 'open') as status, COUNT(*) as count, COALESCE(SUM(cost_ex_vat), 0) as total_ex_vat FROM po_log ${where} GROUP BY status`).bind(...binds).all();
  const totalSpend = await db.prepare(`SELECT COALESCE(SUM(cost_ex_vat), 0) as total FROM po_log ${where}`).bind(...binds).first();
  const uncosted = await db.prepare(`SELECT COUNT(*) as c FROM po_log ${where} AND cost_ex_vat IS NULL`).bind(...binds).first();

  return {
    total: total.c,
    needs_review: needsReview.c,
    total_spend_ex_vat: totalSpend.total,
    uncosted: uncosted.c,
    by_supplier: bySupplier.results,
    by_engineer: byEngineer.results,
    by_office_user: byOfficeUser.results,
    by_site: bySite.results,
    by_source: bySource.results,
    by_day: byDay.results,
    by_status: byStatus.results
  };
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
  const headers = ['PO Number', 'Issued At', 'Source', 'Issued By (Office)', 'Engineer', 'Site', 'Supplier', 'Description', 'Status', 'Cost Ex VAT', 'VAT Rate', 'Cost Inc VAT', 'Flag Reason', 'Credit Note', 'Needs Review', 'Cost Entered At', 'Last Edited By', 'Last Edited At'];
  const csv = [headers.join(',')];
  for (const r of rows.results) {
    const vatRate = r.vat_rate != null ? r.vat_rate : 20;
    const costInc = r.cost_ex_vat != null ? (r.cost_ex_vat * (1 + vatRate / 100)).toFixed(2) : '';
    csv.push([
      r.po_number, r.issued_at, r.source, r.office_user_name || '', r.engineer_name || '', r.site || '', r.supplier || '', r.description || '',
      r.status || 'open', r.cost_ex_vat != null ? r.cost_ex_vat : '', r.cost_ex_vat != null ? vatRate : '', costInc,
      r.flag_reason || '', r.credit_note || '', r.needs_review ? 'Yes' : 'No', r.cost_entered_at || '',
      r.last_edited_by_name || '', r.last_edited_at || ''
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
    <div class="brand"><img src="/logo.jpg" alt="Mostlane"> PO System</div>
    <nav>${link('/office', 'Office', 'office')}${link('/stats', 'Stats', 'stats')}${link('/admin', 'Admin', 'admin')}</nav>
  </div>`;
}

function pageHead(title) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="theme-color" content="#003366">
    <link rel="icon" type="image/jpeg" href="/logo.jpg">
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
      <p class="muted" style="margin-bottom:12px">Each office user has their own URL so we can track who issues which PO. If you don't have your link, ask Jamie.</p>
      <p class="muted">Format: <code>/o/yourname</code></p>
    </div>
  </div></body></html>`;
}

function engineerPage(eng) {
  return `${pageHead('New PO — ' + eng.name)}
  <div class="topbar">
    <div class="brand"><img src="/logo.jpg" alt="Mostlane"> PO</div>
    <div style="font-size:13px;font-weight:500">👷 ${escapeHtmlServer(eng.name)}</div>
  </div>
  <div class="wrap-narrow">
    <div id="status-area"></div>
    <div id="form-area" style="display:none">
      <div class="card fade-in">
        <h1 style="margin-bottom:4px">Raise a PO</h1>
        <p class="muted">Outside office hours only. All fields required.</p>
        <div class="field" style="position:relative;margin-top:16px">
          <label>Site</label>
          <input id="site" type="text" placeholder="Start typing..." autocomplete="off" oninput="filterSites()" onfocus="filterSites()" onblur="setTimeout(hideSites,200)">
          <div id="site-dropdown" class="ac-dropdown" style="display:none"></div>
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
  loadMyPOs(false);
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
    const pos = await fetch('/api/pos?' + params).then(r => r.json());
    if (!pos.length) return;
    const card = document.getElementById('my-pos-card');
    const list = document.getElementById('my-pos-list');
    if (!card || !list) return;
    card.style.display = 'block';
    list.innerHTML = pos.slice(0, 20).map(p => {
      const d = p.issued_at ? new Date(p.issued_at) : null;
      const dStr = d ? d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      return '<div class="my-po"><div class="my-po-num">'+p.po_number+'</div><div class="my-po-detail"><div><strong>'+escapeHtml(p.supplier || '—')+'</strong> · <span class="muted">'+escapeHtml(p.site || '—')+'</span></div><div class="muted" style="font-size:12px;margin-top:2px">'+dStr+'</div></div></div>';
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
  const supplier = document.getElementById('supplier').value.trim();
  const description = document.getElementById('description').value.trim();
  if (!site) { alert('Site is required'); return; }
  if (!supplier) { alert('Supplier is required'); return; }
  if (!description) { alert('Description is required'); return; }
  const valid = SUPPLIERS.some(s => s.name === supplier);
  if (!valid) { alert('Please pick a supplier from the dropdown list'); return; }
  submittingEngineerPO = true;
  if (btn) { btn.disabled = true; btn.textContent = 'Issuing...'; }
  try {
    const res = await fetch('/api/pos', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engineer_slug: ENGINEER.slug, engineer_name: ENGINEER.name, source: 'engineer', site, supplier, description }) }).then(r => r.json());
    if (res.error) { alert(res.error); if (btn) { btn.disabled = false; btn.textContent = 'Issue PO Number'; } submittingEngineerPO = false; return; }
    document.getElementById('form-area').style.display = 'none';
    document.getElementById('result-area').style.display = 'block';
    document.getElementById('result-area').innerHTML = \`
      <div class="card fade-in" style="text-align:center;padding:40px 20px">
        <p class="muted" style="text-transform:uppercase;font-size:12px;letter-spacing:0.08em;margin-bottom:8px">PO Number Issued</p>
        <div class="po-display">\${res.po_number}</div>
        <div style="margin:24px 0;color:#5a6677;font-size:14px;line-height:1.7">
          <strong style="color:#003366">\${escapeHtml(site)}</strong><br>
          \${escapeHtml(supplier)}<br><span style="font-size:13px">\${escapeHtml(description)}</span>
        </div>
        <button class="ghost" onclick="location.reload()">Raise Another</button>
      </div>\`;
  } catch (err) { alert('Error: ' + err.message); if (btn) { btn.disabled = false; btn.textContent = 'Issue PO Number'; } submittingEngineerPO = false; }
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }
function escapeJsAttr(s) { return String(s).replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'"); }
init();
</script></body></html>`;
}

function officePage(user) {
  return `${pageHead('Office — ' + user.name)}
  <div class="topbar">
    <div class="brand"><img src="/logo.jpg" alt="Mostlane"> PO / Office</div>
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:13px;font-weight:500">👤 ${escapeHtmlServer(user.name)}</div>
      <nav><a href="/stats">Stats</a><a href="/admin">Admin</a></nav>
    </div>
  </div>
  <div class="wrap">
    <div class="row-between">
      <h1 style="margin:0">PO Log</h1>
      <div class="row">
        <button class="ghost small" onclick="exportCSV()">⬇ Export CSV</button>
        <button class="small" onclick="openNewPO()">+ New PO</button>
      </div>
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
        <input id="search-input" type="text" placeholder="🔍 Search PO #, engineer, site, supplier, description..." oninput="loadPOs()">
      </div>
      <div class="filter-bar">
        <select id="filter-engineer"><option value="">All engineers</option></select>
        <select id="filter-office-user"><option value="">All office users</option></select>
        <select id="filter-supplier"><option value="">All suppliers</option></select>
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
          <thead><tr><th>PO #</th><th>Issued</th><th>Issued By</th><th>Engineer</th><th>Site</th><th>Supplier</th><th>Cost</th><th>Status</th><th></th></tr></thead>
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
let allPOs = [], allEngineers = [], allSuppliers = [], allSites = [];
let currentStatus = '';
async function init() {
  const [engineers, suppliers, sites, officeUsers] = await Promise.all([
    fetch('/api/engineers').then(r => r.json()),
    fetch('/api/suppliers').then(r => r.json()),
    fetch('/api/sites').then(r => r.json()),
    fetch('/api/office-users').then(r => r.json())
  ]);
  allEngineers = engineers; allSuppliers = suppliers; allSites = sites;
  document.getElementById('filter-engineer').innerHTML = '<option value="">All engineers</option>' + engineers.filter(e => e.active).map(e => '<option value="' + e.slug + '">' + escapeHtml(e.name) + '</option>').join('');
  document.getElementById('filter-supplier').innerHTML = '<option value="">All suppliers</option>' + suppliers.map(s => '<option value="' + escapeAttr(s.name) + '">' + escapeHtml(s.name) + '</option>').join('');
  document.getElementById('filter-office-user').innerHTML = '<option value="">All office users</option>' + officeUsers.filter(u => u.active).map(u => '<option value="' + u.slug + '">' + escapeHtml(u.name) + '</option>').join('');
  ['filter-engineer','filter-supplier','filter-from','filter-to','filter-office-user'].forEach(id => { document.getElementById(id).onchange = loadPOs; });
  document.querySelectorAll('#status-tabs .tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('#status-tabs .tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      currentStatus = t.dataset.status || '';
      loadPOs();
    });
  });
  loadPOs();
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
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const review = document.getElementById('filter-review').checked;
  const uncosted = document.getElementById('filter-uncosted').checked;
  const unmatchedSite = document.getElementById('filter-unmatched-site').checked;
  const search = document.getElementById('search-input').value.trim();
  if (eng) params.set('engineer', eng);
  if (officeUser) params.set('office_user', officeUser);
  if (sup) params.set('supplier', sup);
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
function clearFilters() {
  ['filter-engineer','filter-office-user','filter-supplier','filter-from','filter-to','search-input'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('filter-review').checked = false;
  document.getElementById('filter-uncosted').checked = false;
  document.getElementById('filter-unmatched-site').checked = false;
  loadPOs();
}
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
    const d = p.issued_at ? new Date(p.issued_at) : null;
    const dStr = d ? d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    const cost = p.cost_ex_vat != null ? formatMoney(p.cost_ex_vat) : '<span class="muted">—</span>';
    const siteUnmatched = p.site && !siteNames.has(p.site);
    const siteCell = (p.site ? escapeHtml(p.site) : '—') + (siteUnmatched ? ' <span title="Site not in master list" style="color:#b58a00">⚠️</span>' : '');
    return \`<tr>
      <td><strong style="color:#003366">\${p.po_number}</strong></td>
      <td class="muted">\${dStr}</td>
      <td>\${escapeHtml(p.office_user_name || (p.source === 'engineer' ? '(engineer)' : '—'))}</td>
      <td>\${escapeHtml(p.engineer_name || '—')}</td>
      <td>\${siteCell}</td>
      <td>\${escapeHtml(p.supplier || '—')}</td>
      <td>\${cost}</td>
      <td>\${statusBadge(p)}</td>
      <td><button class="ghost small" onclick='openEdit(\${p.po_number})'>Edit</button></td>
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
  const activeEngs = (allEngineers || []).filter(e => Number(e.active) === 1);
  const engOptions = activeEngs.map(e => '<option value="' + e.slug + '">' + escapeHtml(e.name) + '</option>').join('');
  document.getElementById('modal-title').textContent = 'New PO';
  document.getElementById('modal-body').innerHTML = \`
    <div class="field"><label>Engineer (optional)</label><select id="m-engineer"><option value="">— None / Office —</option>\${engOptions}</select></div>
    <div class="field" style="position:relative"><label>Site</label><input id="m-site" type="text" autocomplete="off" oninput="filterMSites()" onfocus="filterMSites()" onblur="setTimeout(hideMSites,200)"><div id="m-site-dropdown" class="ac-dropdown" style="display:none"></div></div>
    <div class="field" style="position:relative"><label>Supplier</label><input id="m-supplier" type="text" autocomplete="off" oninput="filterMSuppliers()" onfocus="filterMSuppliers()" onblur="setTimeout(hideMSuppliers,200)"><div id="m-supplier-dropdown" class="ac-dropdown" style="display:none"></div></div>
    <div class="field"><label>Description</label><textarea id="m-description"></textarea></div>
    <button onclick="submitNewPO(this)">Issue PO</button>\`;
  document.getElementById('modal').classList.add('show');
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
  const site = document.getElementById('m-site').value.trim();
  const supplier = document.getElementById('m-supplier').value.trim();
  const description = document.getElementById('m-description').value.trim();
  if (!site) { alert('Site is required'); return; }
  if (!supplier) { alert('Supplier is required'); return; }
  if (!description) { alert('Description is required'); return; }
  const valid = (allSuppliers || []).some(s => s.name === supplier);
  if (!valid) { alert('Please pick a supplier from the dropdown list'); return; }
  submittingNewPO = true;
  if (btn) { btn.disabled = true; btn.textContent = 'Issuing...'; }
  try {
    const engSlug = document.getElementById('m-engineer').value;
    const eng = allEngineers.find(e => e.slug === engSlug);
    const res = await fetch('/api/pos', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engineer_slug: engSlug || null, engineer_name: eng ? eng.name : null, source: 'office',
        site, supplier, description,
        office_user_slug: OFFICE_USER.slug, office_user_name: OFFICE_USER.name }) }).then(r => r.json());
    if (res.error) { alert(res.error); return; }
    alert('PO ' + res.po_number + ' issued');
    closeModal(); loadPOs();
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
    const d = new Date(p.last_edited_at);
    auditBits.push('Last edited by <strong>' + escapeHtml(p.last_edited_by_name) + '</strong> on ' + d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }));
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
    <div class="field" style="position:relative"><label>Supplier</label><input id="e-supplier" type="text" autocomplete="off" value="\${escapeAttr(p.supplier || '')}" oninput="filterESuppliers()" onfocus="filterESuppliers()" onblur="setTimeout(hideESuppliers,200)"><div id="e-supplier-dropdown" class="ac-dropdown" style="display:none"></div></div>
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
      <button class="danger small" onclick='deletePO(\${poNumber})'>Delete</button>
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
      supplier: document.getElementById('e-supplier').value.trim(),
      description: document.getElementById('e-description').value.trim(),
      cost_ex_vat: costEx,
      vat_rate: vatRate,
      status: newStatus,
      flag_reason: newStatus === 'flagged' ? flagReason : null,
      credit_note: newStatus === 'credit_due' ? creditNote : null,
      edited_by_slug: OFFICE_USER.slug,
      edited_by_name: OFFICE_USER.name
    }) });
  closeModal(); loadPOs();
}
async function markReviewed(n) { await fetch('/api/pos/' + n, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ needs_review: 0, edited_by_slug: OFFICE_USER.slug, edited_by_name: OFFICE_USER.name }) }); closeModal(); loadPOs(); }
async function deletePO(n) {
  if (!confirm('Delete PO ' + n + '? Hides from log but the number stays used.')) return;
  await fetch('/api/pos/' + n, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deleted: 1, edited_by_slug: OFFICE_USER.slug, edited_by_name: OFFICE_USER.name }) });
  closeModal(); loadPOs();
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
function closeModal() { document.getElementById('modal').classList.remove('show'); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }
document.getElementById('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
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
  renderBars('by-day', s.by_day.map(x => ({ name: x.day, count: x.count, total_ex_vat: x.total_ex_vat || 0 })), 'name', 30);
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
        <p class="muted">Each engineer has a unique URL — share so they can bookmark on their phone.</p>
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
        <p class="muted">Each office user has a unique URL. Issued POs and edits are stamped with the user.</p>
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
  document.getElementById('eng-tbody').innerHTML = engs.filter(e => e.active).map(e => \`
    <tr>
      <td><strong>\${escapeHtml(e.name)}</strong></td>
      <td><a href="/e/\${e.slug}" target="_blank" style="font-family:ui-monospace,monospace;font-size:12px;color:#1A4F8F">\${base}/e/\${e.slug}</a></td>
      <td><div class="row"><button class="ghost small" onclick='copyLink("\${base}/e/\${e.slug}")'>Copy</button><button class="danger small" onclick='removeEngineer("\${e.slug}")'>Remove</button></div></td>
    </tr>\`).join('');
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
      <td><a href="/o/\${u.slug}" target="_blank" style="font-family:ui-monospace,monospace;font-size:12px;color:#1A4F8F">\${base}/o/\${u.slug}</a></td>
      <td><div class="row"><button class="ghost small" onclick='copyLink("\${base}/o/\${u.slug}")'>Copy</button><button class="danger small" onclick='removeOfficeUser("\${u.slug}")'>Remove</button></div></td>
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
  document.getElementById('clo-tbody').innerHTML = cls.map(c => \`<tr><td>\${c.date}</td><td>\${escapeHtml(c.reason || '')}</td><td><button class="danger small" onclick='removeClosure("\${c.date}")'>Remove</button></td></tr>\`).join('');
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
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
init();
</script></body></html>`;
}

function escapeHtmlServer(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
