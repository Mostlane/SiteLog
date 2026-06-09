/* Shared document rendering + PDF — used by documents.html (admin) and app.html
   (end user) so both show and export the identical form. Generated from the
   documents.html implementation; keep changes there and regenerate. */
(function () {
"use strict";
let logoDataUrl = null;
async function ensureLogo() {
  if (logoDataUrl) return;
  try {
    const res = await fetch("Mostlane Logo.jpg");
    const blob = await res.blob();
    logoDataUrl = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => r(null); fr.readAsDataURL(blob); });
  } catch (e) { logoDataUrl = null; }
}

const PF = "font-family:Arial,Helvetica,sans-serif;";
const PB = "#004a99";
const PLB = "#eaeff7";
const PBD = "1px solid #b8c4d4";
const pdfGap = '<div style="height:8px;"></div>';
const _imgSizeCache = {};

const INDUCTION_BRIEFING = [
  "Site rules and expected conduct",
  "PPE requirements (hi-vis, boots, gloves, etc.)",
  "Welfare arrangements (toilets, mess area)",
  "Emergency procedures and muster point",
  "Location of fire extinguishers and first aid kit",
  "Site hazards (asbestos, live services, etc.)",
  "Requirement to follow RAMS and safe systems of work",
  "Permit-to-work systems (hot works, roof access, confined space)",
  "Working at height procedures",
  "Housekeeping and material storage",
  "Accident / near miss reporting procedure"
];
const HWP_PREC = ["Area inspected and deemed safe","Combustibles removed (10m where possible)","Combustibles protected with fire blankets","Openings / voids sealed or protected","Minimum 2 fire extinguishers present","Fire alarm isolation agreed (if required)","Fire watch appointed during works","Gas cylinders secured & flashback arrestors fitted","Adequate ventilation confirmed"];
const HWP_FW = ["Continuous fire watch during works","Fire watch to remain minimum 60 minutes after completion","Area re-inspected after 1 hour"];

function formatDMY(v) {
  if (!v) return "";
  if (v instanceof Date) return isNaN(v.getTime()) ? "" : String(v.getDate()).padStart(2, "0") + "/" + String(v.getMonth() + 1).padStart(2, "0") + "/" + String(v.getFullYear()).slice(2);
  var s = String(v);
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[3] + "/" + m[2] + "/" + m[1].slice(2);
  var d = new Date(s);
  return isNaN(d.getTime()) ? s : formatDMY(d);
}
function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escAttr(s) {
  return escHtml(s);
}
function measureImage(dataUrl) {
  if (!dataUrl) return Promise.resolve(null);
  if (_imgSizeCache[dataUrl]) return Promise.resolve(_imgSizeCache[dataUrl]);
  return new Promise(resolve => {
    const im = new Image();
    im.onload = () => { const s = { w: im.naturalWidth || 1, h: im.naturalHeight || 1 }; _imgSizeCache[dataUrl] = s; resolve(s); };
    im.onerror = () => resolve(null);
    im.src = dataUrl;
  });
}
function pdfLogo() {
  return logoDataUrl
    ? '<img src="' + logoDataUrl + '" style="height:26px;width:auto;background:#fff;padding:2px 5px;border-radius:2px;vertical-align:middle;">'
    : '<span style="color:#fff;font-weight:800;font-size:13px;">Mostlane</span>';
}
function pdfDocHeader(title, sub) {
  return '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:0;"><tr><td style="background:' + PB + ';padding:7px 10px;border-radius:3px 3px 0 0;"><table cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td style="vertical-align:middle;">' + pdfLogo() + '</td><td style="vertical-align:middle;padding-left:10px;"><div style="' + PF + 'font-size:13px;font-weight:700;color:#fff;line-height:1.2;">' + title + '</div>' + (sub ? '<div style="' + PF + 'font-size:10px;color:rgba(255,255,255,0.75);margin-top:1px;">' + sub + '</div>' : '') + '</td></tr></table></td></tr></table>';
}
function pdfSecHead(text) {
  return '<div style="' + PF + 'font-size:9.5px;font-weight:700;color:' + PB + ';text-transform:uppercase;letter-spacing:0.7px;padding:7px 0 4px;border-bottom:2px solid ' + PB + ';margin-bottom:0;">' + text + '</div>';
}
function pdfGrid2(pairs) {
  const rows = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const l1 = pairs[i][0], v1 = pairs[i][1];
    const l2 = pairs[i+1] ? pairs[i+1][0] : "";
    const v2 = pairs[i+1] ? pairs[i+1][1] : "";
    rows.push('<tr><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';background:' + PLB + ';font-size:10px;font-weight:700;width:17%;white-space:nowrap;">' + escHtml(l1) + '</td><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';font-size:11px;width:33%;">' + (escHtml(String(v1 || "")) || "&mdash;") + '</td><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';background:' + PLB + ';font-size:10px;font-weight:700;width:17%;white-space:nowrap;">' + escHtml(l2) + '</td><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';font-size:11px;width:33%;">' + (l2 ? (escHtml(String(v2 || "")) || "&mdash;") : "&nbsp;") + '</td></tr>');
  }
  return '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">' + rows.join("") + '</table>';
}
function pdfGrid1(pairs) {
  return '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">' + pairs.map(function(p){ return '<tr><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';background:' + PLB + ';font-size:10px;font-weight:700;width:26%;white-space:nowrap;">' + escHtml(p[0]) + '</td><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';font-size:11px;">' + (escHtml(String(p[1] || "")) || "—") + '</td></tr>'; }).join("") + '</table>';
}
function pdfSigRow(label, name, b64) {
  return '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';background:' + PLB + ';font-size:10px;font-weight:700;width:26%;white-space:nowrap;">Print Name</td><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';font-size:11px;">' + escHtml(name || "") + '&nbsp;</td></tr><tr><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';background:' + PLB + ';font-size:10px;font-weight:700;">' + escHtml(label || "Signature") + '</td><td style="border:' + PBD + ';height:48px;background:#fff;padding:4px;">' + (b64 ? '<img src="' + b64 + '" style="max-height:40px;max-width:220px;display:block;">' : "&nbsp;") + '</td></tr></table>';
}
function pdfBullets2Col(items) {
  const half = Math.ceil(items.length / 2);
  const c1 = items.slice(0, half);
  const c2 = items.slice(half);
  const li = t => '<div style="' + PF + 'font-size:11px;padding:2px 0;line-height:1.35;">&#8226;&nbsp;' + escHtml(t) + '</div>';
  return '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:' + PBD + ';background:#f6f8fb;"><tr><td style="padding:6px 9px;vertical-align:top;width:50%;border-right:' + PBD + ';">' + c1.map(li).join("") + '</td><td style="padding:6px 9px;vertical-align:top;width:50%;">' + c2.map(li).join("") + '</td></tr></table>';
}
function pdfCheckboxes2Col(labels, checked) {
  const half = Math.ceil(labels.length / 2);
  const c1 = labels.slice(0, half);
  const c2 = labels.slice(half);
  const cb = (l, i, offset) => {
    const on = !!(checked[i + (offset || 0)]);
    return '<div style="' + PF + 'font-size:11px;padding:2px 0;line-height:1.35;">' + (on ? "&#9745;" : "&#9744;") + '&nbsp;' + escHtml(l) + '</div>';
  };
  return '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:' + PBD + ';background:#f6f8fb;"><tr><td style="padding:5px 8px;vertical-align:top;width:50%;border-right:' + PBD + ';">' + c1.map((l, i) => cb(l, i, 0)).join("") + '</td><td style="padding:5px 8px;vertical-align:top;width:50%;">' + c2.map((l, i) => cb(l, i, half)).join("") + '</td></tr></table>';
}
function previewInduction(doc, fd, atts) {
  const contractorRows = atts.map((a, i) => {
    return '<div style="margin-bottom:6px;"><div style="' + PF + 'font-size:10px;font-weight:700;background:#dde5f0;padding:3px 8px;border:' + PBD + ';border-bottom:none;letter-spacing:0.3px;">CONTRACTOR ' + (i+1) + ': ' + escHtml((a.person_name || "").toUpperCase()) + '</div>' + pdfGrid2([["Full Name", a.person_name],["Company", a.company],["Trade / Role", a.trade],["Contact Number", a.contact_number],["CSCS No.", a.cscs_number],["Date", formatDMY(doc.issued_at)]]) + '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';background:' + PLB + ';font-size:10px;font-weight:700;width:26%;">Contractor Signature</td><td style="border:' + PBD + ';height:48px;background:#fff;padding:4px;">' + (a.signature ? '<img src="' + a.signature + '" style="max-height:40px;max-width:220px;display:block;">' : "&nbsp;") + '</td></tr></table></div>';
  }).join("");

  return '<div style="' + PF + 'font-size:11px;color:#1d1d1f;">' + pdfDocHeader("Contractor Site Induction Form") + pdfSecHead("Site Details") + pdfGrid2([["Project", fd.project],["Site Address", fd.address || doc.site_address || ""],["Site Manager", fd.site_manager],["Start Date", formatDMY(fd.date)]]) + pdfGap + pdfSecHead("Site Induction Briefing Includes") + pdfBullets2Col(["Site rules and expected conduct","PPE requirements (hi-vis, boots, gloves, etc.)","Welfare arrangements (toilets, mess area)","Emergency procedures and muster point","Location of fire extinguishers and first aid kit","Site hazards (asbestos, live services, etc.)","Requirement to follow RAMS and safe systems of work","Permit-to-work systems (hot works, roof access, confined space)","Working at height procedures","Housekeeping and material storage","Accident / near miss reporting procedure"]) + pdfGap + pdfSecHead("Contractor Details") + contractorRows + pdfGap + pdfSecHead("Induction Given By") + pdfSigRow("Signature", fd.giver_name, doc.manager_signature) + '</div>';
}
function previewHWP(doc, fd, atts) {
  const precLabels = ["Area inspected and deemed safe","Combustibles removed (10m where possible)","Combustibles protected with fire blankets","Openings / voids sealed or protected","Minimum 2 fire extinguishers present","Fire alarm isolation agreed (if required)","Fire watch appointed during works","Gas cylinders secured & flashback arrestors fitted","Adequate ventilation confirmed"];
  const fwLabels = ["Continuous fire watch during works","Fire watch to remain minimum 60 minutes after completion","Area re-inspected after 1 hour"];

  const operativeRows = atts.map((a, i) => {
    return '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:5px;"><tr><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';background:#dde5f0;font-size:10px;font-weight:700;width:17%;">Operative ' + (i+1) + '</td><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';font-size:11px;width:33%;">' + escHtml(a.person_name || "") + '</td><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';background:' + PLB + ';font-size:10px;font-weight:700;width:17%;">Company</td><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';font-size:11px;width:33%;">' + escHtml(a.company || "") + '</td></tr><tr><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';background:' + PLB + ';font-size:10px;font-weight:700;">Signature</td><td colspan="3" style="border:' + PBD + ';height:48px;background:#fff;padding:4px;">' + (a.signature ? '<img src="' + a.signature + '" style="max-height:40px;max-width:280px;display:block;">' : "&nbsp;") + '</td></tr></table>';
  }).join("");

  const closeoutSection = doc.status === "closed"
    ? pdfGap + pdfSecHead("Close Out") + pdfGrid2([["Completion Time", doc.completion_time],["Final Area", doc.final_area_safe === 1 ? "Area declared SAFE" : "Area declared NOT SAFE"]]) + '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';background:' + PLB + ';font-size:10px;font-weight:700;width:26%;">Manager Signature</td><td style="border:' + PBD + ';height:48px;background:#fff;padding:4px;">' + (doc.manager_signature ? '<img src="' + doc.manager_signature + '" style="max-height:40px;max-width:220px;display:block;">' : "&nbsp;") + '</td></tr></table>'
    : pdfGap + '<div style="' + PF + 'padding:5px 8px;background:#fffbeb;border:1px solid #f0d060;border-radius:2px;font-size:11px;color:#7a5800;"><strong>Open Permit</strong> &mdash; Close out required after works complete.</div>';

  return '<div style="' + PF + 'font-size:11px;color:#1d1d1f;">' + pdfDocHeader("Hot Works Permit", "Permit No: " + escHtml(fd.permit_no || doc.permit_no || "")) + pdfSecHead("Project Details") + pdfGrid2([["Project", fd.project],["Site", fd.site || doc.site_name],["Client / PC", fd.client],["Date", formatDMY(fd.date)],["Issued By", fd.issued_by],["Valid From", fd.valid_from]]) + pdfGap + pdfSecHead("1. Description of Hot Works") + pdfGrid1([["Location", fd.location],["Nature of Works", (fd.nature || []).join(", ")],["Equipment", fd.equipment]]) + pdfGap + pdfSecHead("2. Fire & Safety Precautions") + pdfCheckboxes2Col(precLabels, fd.precautions || []) + pdfGap + pdfSecHead("3. Fire Watch Requirements") + pdfCheckboxes2Col(fwLabels, fd.fire_watch || []) + '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';background:' + PLB + ';font-size:10px;font-weight:700;width:26%;">Fire Watch Name</td><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';font-size:11px;">' + escHtml(fd.fire_watch_name || "") + '&nbsp;</td></tr></table>' + pdfGap + pdfSecHead("4. Operatives") + operativeRows + pdfGap + pdfSecHead("5. Permit Issued By") + pdfSigRow("Signature", fd.issued_by, doc.manager_signature) + closeoutSection + '<div style="margin-top:10px;border-top:1px solid #ccc;padding-top:5px;' + PF + 'font-size:9px;color:#888;line-height:1.4;">Permit valid for one shift only. Must be displayed at work location. Void if works stop for more than 2 hours. All works must comply with CDM Regulations and approved RAMS.</div></div>';
}
function previewTBT(doc, fd, atts) {
  const attendeeRows = atts.map((a, i) => {
    return '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:5px;"><tr><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';background:#dde5f0;font-size:10px;font-weight:700;width:17%;">Attendee ' + (i+1) + '</td><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';font-size:11px;width:33%;">' + escHtml(a.person_name || "") + '</td><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';background:' + PLB + ';font-size:10px;font-weight:700;width:17%;">Company</td><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';font-size:11px;width:33%;">' + escHtml(a.company || "") + '</td></tr><tr><td style="' + PF + 'padding:3px 7px;border:' + PBD + ';background:' + PLB + ';font-size:10px;font-weight:700;">Signature</td><td colspan="3" style="border:' + PBD + ';height:48px;background:#fff;padding:4px;">' + (a.signature ? '<img src="' + a.signature + '" style="max-height:40px;max-width:280px;display:block;">' : "&nbsp;") + '</td></tr></table>';
  }).join("");

  return '<div style="' + PF + 'font-size:11px;color:#1d1d1f;">' + pdfDocHeader("Toolbox Talk") + pdfSecHead("Session Details") + pdfGrid2([["Project", fd.project],["Site Address", fd.address || doc.site_address || ""],["Site Manager", fd.site_manager],["Date", formatDMY(fd.date)],["Talk Title", fd.title],["Delivered By", fd.delivered_by],["Duration", fd.duration ? fd.duration + " mins" : ""],["",""]]) + pdfGap + pdfSecHead("Talk Content") + pdfGrid1([["Summary of Talk", fd.summary],["Key Points Raised", fd.key_points],["Site-Specific Hazards", fd.hazards]]) + pdfGap + pdfSecHead("Attendees") + attendeeRows + pdfGap + pdfSecHead("Delivered By — Manager Sign-Off") + pdfSigRow("Signature", fd.delivered_by, doc.manager_signature) + '</div>';
}
function buildPreview(doc) {
  const fd = doc.form_data || {};
  const at = doc.attendees || [];
  if (doc.type === "induction") return previewInduction(doc, fd, at);
  if (doc.type === "hwp") return previewHWP(doc, fd, at);
  if (doc.type === "tbt") return previewTBT(doc, fd, at);
  return "<p>Unknown document type.</p>";
}
function generateDocPdf(doc) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const PW = 210, M = 12, CW = PW - 2 * M, PAD = 1.6, MINROW = 6.4, PH = 297;
  const BLUE = [0, 74, 153], LB = [234, 239, 247], BD = [184, 196, 212], TX = [29, 29, 31], CH = [221, 229, 240], GBX = [246, 248, 251];
  const mm = pt => pt * 0.3528;
  let y = M;
  const fd = doc.form_data || {};
  const atts = doc.attendees || [];

  // Image sizes pre-measured by prefetchDocImages (on view). Use cache only so
  // this stays synchronous; an unmeasured image simply renders without it.
  const logoSize = logoDataUrl ? (_imgSizeCache[logoDataUrl] || null) : null;
  const sigSizes = {};
  for (const a of atts) { if (a.signature) sigSizes[a.signature] = _imgSizeCache[a.signature] || null; }
  if (doc.manager_signature) sigSizes[doc.manager_signature] = _imgSizeCache[doc.manager_signature] || null;

  function setText(size, bold, color) { pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(size); pdf.setTextColor(color ? color[0] : TX[0], color ? color[1] : TX[1], color ? color[2] : TX[2]); }
  function wrap(text, w, size, bold) { setText(size, bold); return pdf.splitTextToSize(String(text == null || text === "" ? "—" : text), Math.max(2, w - 2 * PAD)); }
  function linesH(lines, size) { return lines.length * mm(size) * 1.2 + 2 * PAD; }
  function need(h) { if (y + h > PH - M) { pdf.addPage(); y = M; } }
  function gap(h) { y += (h == null ? 2.5 : h); }
  function imgFmt(url) { return /image\/jpe?g/i.test(url) ? "JPEG" : "PNG"; }

  function drawCell(x, w, h, o) {
    if (o.fill) { pdf.setFillColor(o.fill[0], o.fill[1], o.fill[2]); pdf.rect(x, y, w, h, "F"); }
    pdf.setDrawColor(BD[0], BD[1], BD[2]); pdf.setLineWidth(0.2); pdf.rect(x, y, w, h, "S");
    if (o.lines && o.lines.length) {
      setText(o.size, o.bold, o.color);
      const lh = mm(o.size) * 1.2;
      let ty = y + PAD + mm(o.size) * 0.92;
      o.lines.forEach(ln => { pdf.text(ln, x + PAD, ty); ty += lh; });
    }
  }
  function placeImage(url, x, yy, maxW, maxH) {
    const s = sigSizes[url] || _imgSizeCache[url];
    if (!s) return;
    const sc = Math.min(maxW / s.w, maxH / s.h);
    try { pdf.addImage(url, imgFmt(url), x, yy, s.w * sc, s.h * sc); } catch (e) {}
  }
  function header(title, sub) {
    const h = 13; need(h + 2);
    pdf.setFillColor(BLUE[0], BLUE[1], BLUE[2]); pdf.rect(M, y, CW, h, "F");
    let tx = M + 4;
    if (logoDataUrl && logoSize) {
      const lh = 7, lw = lh * (logoSize.w / logoSize.h);
      try { pdf.addImage(logoDataUrl, imgFmt(logoDataUrl), M + 4, y + (h - lh) / 2, lw, lh); tx = M + 4 + lw + 4; } catch (e) {}
    }
    setText(13, true, [255, 255, 255]); pdf.text(String(title), tx, y + (sub ? 5.6 : 7.6));
    if (sub) { setText(8.5, false, [223, 232, 243]); pdf.text(String(sub), tx, y + 10); }
    y += h;
  }
  function section(text) {
    need(8); y += 2.5;
    setText(8, true, BLUE); pdf.text(String(text).toUpperCase(), M, y + 3.8);
    pdf.setDrawColor(BLUE[0], BLUE[1], BLUE[2]); pdf.setLineWidth(0.5); pdf.line(M, y + 5.2, M + CW, y + 5.2);
    y += 6.4;
  }
  function grid2(pairs) {
    const Lw = CW * 0.17, Vw = CW * 0.33;
    for (let i = 0; i < pairs.length; i += 2) {
      const p1 = pairs[i], p2 = pairs[i + 1] || ["", ""];
      const v1 = wrap(p1[1], Vw, 8.5), v2 = wrap(p2[0] ? p2[1] : "", Vw, 8.5);
      const rh = Math.max(MINROW, linesH(v1, 8.5), linesH(v2, 8.5));
      need(rh);
      drawCell(M, Lw, rh, { fill: LB, lines: wrap(p1[0], Lw, 7.6, true), size: 7.6, bold: true });
      drawCell(M + Lw, Vw, rh, { lines: v1, size: 8.5 });
      drawCell(M + Lw + Vw, Lw, rh, { fill: p2[0] ? LB : [255, 255, 255], lines: p2[0] ? wrap(p2[0], Lw, 7.6, true) : [], size: 7.6, bold: true });
      drawCell(M + 2 * Lw + Vw, Vw, rh, { lines: p2[0] ? v2 : [], size: 8.5 });
      y += rh;
    }
  }
  function grid1(pairs) {
    const Lw = CW * 0.26, Vw = CW * 0.74;
    pairs.forEach(p => {
      const v = wrap(p[1], Vw, 8.5);
      const rh = Math.max(MINROW, linesH(v, 8.5));
      need(rh);
      drawCell(M, Lw, rh, { fill: LB, lines: wrap(p[0], Lw, 7.6, true), size: 7.6, bold: true });
      drawCell(M + Lw, Vw, rh, { lines: v, size: 8.5 });
      y += rh;
    });
  }
  function listBox(items, checks) {
    const colW = CW / 2, half = Math.ceil(items.length / 2);
    const build = (arr, off) => {
      let out = [];
      arr.forEach((t, idx) => {
        // jsPDF's built-in fonts are WinAnsi — Unicode checkbox glyphs don't
        // render, so use ASCII boxes (the • bullet is WinAnsi-safe).
        const mark = checks ? (checks[idx + off] ? "[X]  " : "[  ]  ") : "•  ";
        setText(8.5, false);
        out = out.concat(pdf.splitTextToSize(mark + String(t), colW - 2 * PAD - 1));
      });
      return out;
    };
    const l1 = build(items.slice(0, half), 0), l2 = build(items.slice(half), half);
    const lh = mm(8.5) * 1.32, h = Math.max(l1.length, l2.length) * lh + 2 * PAD;
    need(h);
    pdf.setFillColor(GBX[0], GBX[1], GBX[2]); pdf.rect(M, y, CW, h, "F");
    pdf.setDrawColor(BD[0], BD[1], BD[2]); pdf.setLineWidth(0.2); pdf.rect(M, y, CW, h, "S"); pdf.line(M + colW, y, M + colW, y + h);
    setText(8.5, false, TX);
    let ty = y + PAD + mm(8.5) * 0.92; l1.forEach(ln => { pdf.text(ln, M + PAD, ty); ty += lh; });
    ty = y + PAD + mm(8.5) * 0.92; l2.forEach(ln => { pdf.text(ln, M + colW + PAD, ty); ty += lh; });
    y += h;
  }
  function headerBar(text) {
    const lines = wrap(text, CW, 8, true), h = Math.max(6, linesH(lines, 8));
    need(h); drawCell(M, CW, h, { fill: CH, lines: lines, size: 8, bold: true }); y += h;
  }
  function sigRow(label, sig) {
    const Lw = CW * 0.26, Vw = CW * 0.74, rh = 18; need(rh);
    drawCell(M, Lw, rh, { fill: LB, lines: wrap(label, Lw, 7.6, true), size: 7.6, bold: true });
    drawCell(M + Lw, Vw, rh, {});
    if (sig) placeImage(sig, M + Lw + PAD, y + PAD, Vw - 2 * PAD, rh - 2 * PAD);
    y += rh;
  }
  function signatureBlock(printName, sig) {
    grid1([["Print Name", printName || ""]]);
    sigRow("Signature", sig);
  }
  function warnBox(text) {
    setText(9, false); const lines = pdf.splitTextToSize(text, CW - 2 * PAD);
    const lh = mm(9) * 1.25, h = lines.length * lh + 2 * PAD + 1; need(h);
    pdf.setFillColor(255, 251, 235); pdf.rect(M, y, CW, h, "F");
    pdf.setDrawColor(240, 208, 96); pdf.setLineWidth(0.3); pdf.rect(M, y, CW, h, "S");
    setText(9, false, [122, 88, 0]); let ty = y + PAD + mm(9) * 0.92; lines.forEach(ln => { pdf.text(ln, M + PAD, ty); ty += lh; });
    y += h;
  }
  function noteText(text) {
    setText(7.5, false, [120, 120, 120]); const lines = pdf.splitTextToSize(text, CW);
    const lh = mm(7.5) * 1.3, h = lines.length * lh + 3; need(h);
    pdf.setDrawColor(205, 205, 205); pdf.setLineWidth(0.2); pdf.line(M, y + 1, M + CW, y + 1);
    let ty = y + 3.6; lines.forEach(ln => { pdf.text(ln, M, ty); ty += lh; });
    y += h;
  }

  if (doc.type === "induction") {
    header("Contractor Site Induction Form", doc.doc_number ? "Document No: " + doc.doc_number : "");
    section("Site Details");
    grid2([["Project", fd.project], ["Site Address", fd.address || doc.site_address || ""], ["Site Manager", fd.site_manager], ["Start Date", formatDMY(fd.date)]]);
    gap(); section("Site Induction Briefing Includes"); listBox(INDUCTION_BRIEFING);
    gap(); section("Contractor Details");
    const dt = formatDMY(doc.issued_at);
    atts.forEach((a, i) => {
      headerBar("CONTRACTOR " + (i + 1) + ": " + String(a.person_name || "").toUpperCase());
      grid2([["Full Name", a.person_name], ["Company", a.company], ["Trade / Role", a.trade], ["Contact Number", a.contact_number], ["CSCS No.", a.cscs_number], ["Date", dt]]);
      sigRow("Contractor Signature", a.signature); gap(2);
    });
    gap(); section("Induction Given By"); signatureBlock(fd.giver_name, doc.manager_signature);
  } else if (doc.type === "hwp") {
    header("Hot Works Permit", (doc.doc_number ? doc.doc_number + "  ·  " : "") + "Permit No: " + (fd.permit_no || doc.permit_no || ""));
    section("Project Details");
    grid2([["Project", fd.project], ["Site", fd.site || doc.site_name], ["Client / PC", fd.client], ["Date", formatDMY(fd.date)], ["Issued By", fd.issued_by], ["Valid From", fd.valid_from]]);
    gap(); section("1. Description of Hot Works");
    grid1([["Location", fd.location], ["Nature of Works", (fd.nature || []).join(", ")], ["Equipment", fd.equipment]]);
    gap(); section("2. Fire & Safety Precautions"); listBox(HWP_PREC, fd.precautions || []);
    gap(); section("3. Fire Watch Requirements"); listBox(HWP_FW, fd.fire_watch || []);
    grid1([["Fire Watch Name", fd.fire_watch_name || ""]]);
    gap(); section("4. Operatives");
    atts.forEach((a, i) => { grid2([["Operative " + (i + 1), a.person_name], ["Company", a.company]]); sigRow("Signature", a.signature); gap(1.5); });
    gap(); section("5. Permit Issued By"); signatureBlock(fd.issued_by, doc.manager_signature);
    if (doc.status === "closed") {
      gap(); section("Close Out");
      grid2([["Completion Time", doc.completion_time], ["Final Area", doc.final_area_safe === 1 ? "Area declared SAFE" : "Area declared NOT SAFE"]]);
      sigRow("Manager Signature", doc.manager_signature);
    } else { gap(); warnBox("Open Permit  —  Close out required after works complete."); }
    gap(); noteText("Permit valid for one shift only. Must be displayed at work location. Void if works stop for more than 2 hours. All works must comply with CDM Regulations and approved RAMS.");
  } else if (doc.type === "tbt") {
    header("Toolbox Talk", doc.doc_number ? "Document No: " + doc.doc_number : "");
    section("Session Details");
    grid2([["Project", fd.project], ["Site Address", fd.address || doc.site_address || ""], ["Site Manager", fd.site_manager], ["Date", formatDMY(fd.date)], ["Talk Title", fd.title], ["Delivered By", fd.delivered_by], ["Duration", fd.duration ? fd.duration + " mins" : ""], ["", ""]]);
    gap(); section("Talk Content");
    grid1([["Summary of Talk", fd.summary], ["Key Points Raised", fd.key_points], ["Site-Specific Hazards", fd.hazards]]);
    gap(); section("Attendees");
    atts.forEach((a, i) => { grid2([["Attendee " + (i + 1), a.person_name], ["Company", a.company]]); sigRow("Signature", a.signature); gap(1.5); });
    gap(); section("Delivered By — Manager Sign-Off"); signatureBlock(fd.delivered_by, doc.manager_signature);
  } else {
    header("Document"); noteText("Unknown document type.");
  }

  return pdf;
}
function docFileName(doc) {
  const tc = { induction: "Induction", hwp: "HWP", tbt: "TBT" }[doc.type] || String(doc.type || "").toUpperCase();
  const si = (doc.site_name || "Site").replace(/[^A-Za-z0-9]/g, "");
  const dt = (doc.issued_at || "").slice(0, 10);
  const nm = (doc.attendee_names || "").split(",")[0].trim().split(" ").pop() || "Unknown";
  return (doc.doc_number ? doc.doc_number + "_" : "") + tc + "_" + nm + "_" + si + "_" + dt;
}
async function prefetchDocImages(doc) {
  await ensureLogo(); await measureImage(logoDataUrl);
  for (const a of (doc.attendees || [])) { if (a.signature) await measureImage(a.signature); }
  if (doc.manager_signature) await measureImage(doc.manager_signature);
}

window.DocRender = { buildPreview: buildPreview, generateDocPdf: generateDocPdf, prefetchDocImages: prefetchDocImages, docFileName: docFileName, ensureLogo: ensureLogo, escHtml: escHtml, formatDMY: formatDMY };
})();