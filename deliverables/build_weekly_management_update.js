#!/usr/bin/env node

/*
 * Builds the weekly management update for the 30-day MicroAccess Smart
 * Metering stabilisation and application MVP programme.
 *
 * Run with:
 *   NODE_PATH=/tmp/msm-office-deps/node_modules node deliverables/build_weekly_management_update.js
 */

const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');
const ExcelJS = require('exceljs');

const OUT_DIR = path.join(__dirname, 'management');
fs.mkdirSync(OUT_DIR, { recursive: true });

const REPORT_DATE = new Date(Date.UTC(2026, 10, 12));
const START_DATE = new Date(Date.UTC(2026, 9, 26));
const REPORT_DAY = 18;
const TOTAL_DAYS = 30;
const SNAPSHOT_AT = '12 November 2026, 21:05 UTC';

const KPI = {
  totalMeters: 31,
  functionallyTested: 14,
  everConnected: 18,
  neverConnected: 13,
  onlineNow: 1,
  seenWithin24Hours: 3,
  vendorRepairs: 5,
  assignedMeters: 6,
  totalCustomers: 33
};

const C = {
  navy: '002B4F',
  deep: '001D39',
  ink: '15354D',
  blue: '0A4174',
  midBlue: '49769F',
  teal: '4E8EA2',
  aqua: '6EA2B3',
  sky: '7BBDE8',
  pale: 'BDD8E9',
  paper: 'F4F8FB',
  white: 'FFFFFF',
  gray: '607D94',
  line: 'D7E3EB',
  green: '2D9B69',
  amber: 'D89417',
  red: 'C8484B',
  purple: '7467E8',
  paleGreen: 'E9F7F0',
  paleAmber: 'FFF4DA',
  paleRed: 'FCECED',
  paleBlue: 'EAF4FA',
  soft: 'E8F0F5'
};

const workingMeterIds = new Set([
  '0308000187531', '0308000187515', '0308000187523', '0179250930205',
  '0179250930163', '0179250930346', '0179250930296', '0179250930403',
  '0179250930312', '0179250930247', '0179250930189', '0179250930361',
  '0179250930221', '0179250930353'
]);

// Live read-only provider snapshot captured for the weekly report.
const meterSnapshot = [
  ['0159250930197', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Never Online', 'Never online', '', '', 'No', ''],
  ['0179250930163', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Offline', 'Offline 8-14 days', '03-Nov-2026 12:57', '', 'No', ''],
  ['0179250930171', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Never Online', 'Never online', '', '', 'No', ''],
  ['0179250930189', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Offline', 'Offline 8-14 days', '02-Nov-2026 11:51', '', 'No', 'SteamaCo repair completed'],
  ['0179250930205', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Online', 'Online now', '12-Nov-2026 21:00', '', 'No', 'Firmware mismatch repaired'],
  ['0179250930213', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Never Online', 'Never online', '', '', 'No', ''],
  ['0179250930221', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Offline', 'Offline 8-14 days', '02-Nov-2026 12:02', '', 'No', 'SteamaCo repair completed'],
  ['0179250930239', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Offline', 'Offline 4-7 days', '09-Nov-2026 11:01', '', 'No', ''],
  ['0179250930247', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Offline', 'Offline 8-14 days', '03-Nov-2026 10:13', '', 'No', ''],
  ['0179250930254', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Offline', 'Offline 4-7 days', '09-Nov-2026 12:00', '', 'No', ''],
  ['0179250930262', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Never Online', 'Never online', '', '', 'No', ''],
  ['0179250930270', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Never Online', 'Never online', '', '', 'No', ''],
  ['0179250930288', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Never Online', 'Never online', '', '', 'No', ''],
  ['0179250930296', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Offline', 'Offline 8-14 days', '03-Nov-2026 10:47', '', 'No', ''],
  ['0179250930304', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Never Online', 'Never online', '', '', 'No', ''],
  ['0179250930312', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Customer load', 'Offline', 'Offline 8-14 days', '02-Nov-2026 12:48', '1st Floor -07 Na-aka Hub', 'Yes', 'SteamaCo repair completed'],
  ['0179250930320', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Never Online', 'Never online', '', '', 'No', ''],
  ['0179250930338', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Never Online', 'Never online', '', '', 'No', ''],
  ['0179250930346', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Customer load', 'Offline', 'Offline over 14 days', '28-Oct-2026 09:38', '4th Floor -01 MicroAccess Ltd', 'Yes', ''],
  ['0179250930353', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Offline', 'Offline 8-14 days', '03-Nov-2026 10:21', '', 'No', ''],
  ['0179250930361', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Offline', 'Offline 8-14 days', '02-Nov-2026 12:35', '', 'No', 'SteamaCo repair completed'],
  ['0179250930379', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Offline', 'Offline 1-3 days', '11-Nov-2026 10:00', '', 'No', ''],
  ['0179250930387', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Never Online', 'Never online', '', '', 'No', ''],
  ['0179250930395', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Never Online', 'Never online', '', '', 'No', ''],
  ['0179250930403', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Offline', 'Offline 8-14 days', '03-Nov-2026 08:45', '', 'No', ''],
  ['0179250930411', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Never Online', 'Never online', '', '', 'No', ''],
  ['0179250930429', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Customer load', 'Offline', 'Offline 4-7 days', '08-Nov-2026 08:01', '5th Floor -01 MicroAccess Corporate Office', 'Yes', ''],
  ['0179250930437', 'SAVI 3 Phase Smart Meter', 'DS3600', 'Unknown', 'Never Online', 'Never online', '', '', 'No', ''],
  ['0308000187515', 'DONSUN 3 Phase Bulk Meter', 'DS3100', 'Solar source', 'Offline', 'Seen within 24 hours', '12-Nov-2026 19:00', 'Power Room Microaccess Gudu Solar meter', 'Yes', 'Solar source meter'],
  ['0308000187523', 'DONSUN 3 Phase Bulk Meter', 'DS3100', 'Non-solar incomer', 'Offline', 'Seen within 24 hours', '12-Nov-2026 19:00', 'Power Room Microaccess Gudu GRID meter', 'Yes', 'Physically reads grid + generator common feed'],
  ['0308000187531', 'DONSUN 3 Phase Bulk Meter', 'DS3100', 'Distribution / bulk', 'Offline', 'Offline over 14 days', '28-Oct-2026 09:08', '3rd Floor -01 BOI', 'Yes', 'BOI bulk meter']
];

const planTasks = [
  ['M01', 'Meter estate', 'Controlled 31-meter register', 1, 3, 'Complete', '31 meters recorded'],
  ['M02', 'Meter estate', 'Functional bench testing', 1, 24, 'In Progress', '14 confirmed tested and working; latest physical-test count unchanged'],
  ['M03', 'Meter estate', 'Identity, SIM, GPRS and backend reconciliation', 1, 24, 'In Progress', '18 have connected at least once; 13 have never connected'],
  ['V01', 'Vendor support', 'Repair five submitted meters', 3, 9, 'Complete', '5 of 5 functionally repaired'],
  ['V02', 'Vendor support', 'Provider connectivity and interval-data assurance', 8, 27, 'In Progress', 'Current snapshot: 1 online; 3 seen in 24 hours'],
  ['A01', 'Application MVP', 'Secure live read-only provider integration', 1, 15, 'Complete', 'Authenticated SteamaCo read-only data is operational'],
  ['A02', 'Application MVP', 'Multi-page operations and management workspace', 6, 18, 'Complete', 'Command centre, meters, customers, exceptions and reports'],
  ['A03', 'Application MVP', 'Energy mix, revenue/cost and floor analytics', 10, 18, 'Complete', 'Indicative dashboards delivered with data-coverage labels'],
  ['A04', 'Application MVP', 'Historical store and data-quality controls', 14, 27, 'In Progress', 'Long-term independent history and interval-gap handling'],
  ['C01', 'Customer integration', 'Customer, floor and meter mapping validation', 8, 26, 'In Progress', '33 customers; 6 observed meter assignments'],
  ['B01', 'Billing readiness', 'Document tariff, source split and settlement rules', 16, 28, 'In Progress', 'NGN 203/kWh is configurable; settlement remains outside the MVP phase'],
  ['B02', 'Billing readiness', 'Define payment and credit API production workflow', 20, 30, 'Planned', 'Scheduled for the production phase after SteamaCo contracts, sandbox and commercial terms are confirmed'],
  ['Q01', 'Assurance', 'End-to-end pilot, management demonstration and handover', 21, 30, 'In Progress', 'Evidence pack and continuation register'],
  ['O01', 'Governance', 'Daily scorecard and weekly management update', 1, 30, 'In Progress', 'Numerical progress and decision visibility']
];

const appCapabilities = [
  ['Secure staff access', 'Delivered', 'Authenticated login/logout and protected management routes'],
  ['Live provider visibility', 'Delivered', 'Read-only SteamaCo inventory, customers, status and history'],
  ['Command centre', 'Delivered', 'Estate KPIs, freshness, assignment and priority exceptions'],
  ['Meter operations', 'Delivered', 'Searchable estate, meter detail and provider-history views'],
  ['Energy mix', 'Delivered with data caveat', 'Solar vs non-solar contribution, filters and coverage indicators'],
  ['Revenue & cost', 'Delivered with data caveat', 'Configurable NGN 203/kWh analytics; not yet settlement-grade'],
  ['Floor operations', 'Delivered', 'Ground floor through fifth floor, tenant structure and trends'],
  ['Reports & analytics', 'Delivered', 'Management reporting and export-oriented operational analysis'],
  ['Production payments / credit', 'Gated', 'Planned for the production phase after the SteamaCo write contract and operating controls are confirmed'],
  ['Independent long-term history', 'In Progress', 'The preservation of intervals beyond provider retention and communication gaps is being developed']
];

const assuranceItems = [
  ['TF-01', 'Source classification', 'We confirmed that the meter labelled Grid is installed on the shared grid and generator incoming cable.', 'The MVP and this report now describe it as Non-Solar Incoming Supply.'],
  ['TF-02', 'Connectivity reporting', 'We confirmed 18 meters have connected at least once, 13 have never connected, 1 was online and 3 were seen within 24 hours at the snapshot.', 'The application now reports each connectivity state separately.'],
  ['TF-03', 'Historical-data behaviour', 'We confirmed that communication gaps can appear later as cumulative register movement rather than a complete hourly replay.', 'Energy charts now display comparison coverage alongside the reported usage.'],
  ['TF-04', 'Daystar comparison', 'We reviewed the October and November Daystar reports against the available SteamaCo readings.', 'The generator leg and the main differences between both data sources are documented.'],
  ['TF-05', 'Application boundary', 'The current energy and revenue analytics are management indicators within the read-only MVP.', 'Payment, customer credit and remote commands remain outside the current MVP phase.']
];

function statusColor(status) {
  return {
    'Complete': C.green,
    'Delivered': C.green,
    'Delivered with data caveat': C.amber,
    'In Progress': C.blue,
    'Planned': C.gray,
    'Not Started': C.gray,
    'Gated': C.red
  }[status] || C.gray;
}

function fmtDate(d) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function dateForDay(day) {
  const d = new Date(START_DATE);
  d.setUTCDate(d.getUTCDate() + day - 1);
  return d;
}

function addBrand(slide, number, section) {
  slide.addShape(pptx.ShapeType.line, { x: 0.55, y: 7.08, w: 12.2, h: 0, line: { color: C.line, width: 0.8 } });
  slide.addText('MICROACCESS  |  SMART METERING', {
    x: 0.58, y: 7.15, w: 3.4, h: 0.18, fontFace: 'Aptos', fontSize: 7.5,
    color: C.gray, charSpacing: 1.1, margin: 0
  });
  slide.addText(section, {
    x: 4.1, y: 7.15, w: 5.1, h: 0.18, fontFace: 'Aptos', fontSize: 7.5,
    color: C.gray, align: 'center', margin: 0
  });
  slide.addText(String(number).padStart(2, '0'), {
    x: 12.1, y: 7.13, w: 0.58, h: 0.22, fontFace: 'Aptos', fontSize: 8,
    bold: true, color: C.teal, align: 'right', margin: 0
  });
}

function addTitle(slide, kicker, title, subtitle) {
  slide.addText(kicker.toUpperCase(), {
    x: 0.6, y: 0.36, w: 5.4, h: 0.22, fontFace: 'Aptos', fontSize: 8,
    bold: true, color: C.teal, charSpacing: 1.5, margin: 0
  });
  slide.addText(title, {
    x: 0.6, y: 0.69, w: 12.0, h: 0.54, fontFace: 'Aptos Display', fontSize: 25,
    bold: true, color: C.navy, margin: 0, fit: 'shrink'
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.6, y: 1.29, w: 12.0, h: 0.38, fontFace: 'Aptos', fontSize: 10.5,
      color: C.gray, margin: 0, fit: 'shrink'
    });
  }
}

function addPill(slide, text, x, y, w, fill, color = C.white) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 0.32, rectRadius: 0.06,
    fill: { color: fill }, line: { color: fill, transparency: 100 }
  });
  slide.addText(text, {
    x: x + 0.06, y: y + 0.055, w: w - 0.12, h: 0.18, fontFace: 'Aptos',
    fontSize: 7.7, bold: true, color, align: 'center', margin: 0, fit: 'shrink'
  });
}

function addKpi(slide, x, y, w, value, label, note, accent) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 1.25, rectRadius: 0.05,
    fill: { color: C.white }, line: { color: C.line, width: 0.8 }
  });
  slide.addShape(pptx.ShapeType.rect, { x, y, w: 0.08, h: 1.25, fill: { color: accent }, line: { transparency: 100 } });
  slide.addText(String(value), {
    x: x + 0.23, y: y + 0.15, w: w - 0.4, h: 0.43, fontFace: 'Aptos Display',
    fontSize: 25, bold: true, color: C.navy, margin: 0, fit: 'shrink'
  });
  slide.addText(label, {
    x: x + 0.23, y: y + 0.64, w: w - 0.4, h: 0.22, fontFace: 'Aptos',
    fontSize: 9.2, bold: true, color: C.ink, margin: 0, fit: 'shrink'
  });
  slide.addText(note, {
    x: x + 0.23, y: y + 0.93, w: w - 0.4, h: 0.18, fontFace: 'Aptos',
    fontSize: 7.4, color: C.gray, margin: 0, fit: 'shrink'
  });
}

function addCard(slide, x, y, w, h, title, body, accent, tag) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.05,
    fill: { color: C.white }, line: { color: C.line, width: 0.8 }
  });
  slide.addShape(pptx.ShapeType.rect, { x, y, w: 0.08, h, fill: { color: accent }, line: { transparency: 100 } });
  if (tag) addPill(slide, tag, x + w - 1.32, y + 0.2, 1.08, C.paleBlue, accent);
  slide.addText(title, {
    x: x + 0.25, y: y + 0.2, w: w - (tag ? 1.75 : 0.5), h: 0.34,
    fontFace: 'Aptos Display', fontSize: 13.5, bold: true, color: C.navy, margin: 0, fit: 'shrink'
  });
  slide.addText(body, {
    x: x + 0.25, y: y + 0.66, w: w - 0.5, h: h - 0.86,
    fontFace: 'Aptos', fontSize: 9.1, color: C.gray, margin: 0, fit: 'shrink', valign: 'top', breakLine: false
  });
}

function addBulletList(slide, items, x, y, w, h, color = C.ink, fontSize = 9.5) {
  const runs = [];
  items.forEach((item, index) => {
    runs.push({
      text: item,
      options: { bullet: { indent: 13 }, hanging: 3, breakLine: index < items.length - 1, paraSpaceAfterPt: 8 }
    });
  });
  slide.addText(runs, { x, y, w, h, fontFace: 'Aptos', fontSize, color, margin: 0.02, fit: 'shrink', valign: 'top' });
}

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'MicroAccess Smart Metering Project';
pptx.company = 'MicroAccess';
pptx.subject = 'Weekly update for the 30-day meter stabilisation and application MVP programme';
pptx.title = 'MicroAccess Smart Metering Weekly Management Update - 12 November 2026';
pptx.lang = 'en-NG';
pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'en-NG' };

// Slide 1: cover
{
  const slide = pptx.addSlide();
  slide.background = { color: C.deep };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 4.75, h: 7.5, fill: { color: C.navy }, line: { transparency: 100 } });
  slide.addShape(pptx.ShapeType.rect, { x: 4.75, y: 0, w: 0.12, h: 7.5, fill: { color: C.sky }, line: { transparency: 100 } });
  for (let i = 0; i < 6; i++) {
    slide.addShape(pptx.ShapeType.ellipse, {
      x: 8.65 + (i % 3) * 1.2, y: 0.78 + Math.floor(i / 3) * 1.2, w: 0.9, h: 0.9,
      fill: { color: i === 0 ? C.teal : C.blue, transparency: i === 0 ? 0 : 22 },
      line: { color: C.aqua, transparency: 35, width: 0.8 }
    });
  }
  slide.addShape(pptx.ShapeType.line, { x: 9.1, y: 1.23, w: 2.4, h: 1.2, line: { color: C.sky, transparency: 35, width: 1.4 } });
  addPill(slide, 'WEEKLY MANAGEMENT UPDATE', 0.72, 0.72, 2.55, C.teal);
  slide.addText('30-Day Meter\nStabilisation &\nApplication MVP', {
    x: 0.72, y: 1.46, w: 6.9, h: 2.2, fontFace: 'Aptos Display', fontSize: 31,
    bold: true, color: C.white, margin: 0, fit: 'shrink', valign: 'mid'
  });
  slide.addText('Day 18 position: live operational MVP delivered; meter testing, connectivity monitoring and management reporting continue.', {
    x: 0.75, y: 4.03, w: 6.95, h: 0.82, fontFace: 'Aptos', fontSize: 14,
    color: C.pale, margin: 0, fit: 'shrink'
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 8.05, y: 4.02, w: 4.48, h: 1.72, rectRadius: 0.06,
    fill: { color: C.navy }, line: { color: C.midBlue, width: 0.9 }
  });
  slide.addText('DAY 18', { x: 8.36, y: 4.28, w: 1.3, h: 0.22, fontFace: 'Aptos', fontSize: 8, bold: true, color: C.sky, charSpacing: 1.4, margin: 0 });
  slide.addText('18', { x: 8.34, y: 4.65, w: 1.1, h: 0.52, fontFace: 'Aptos Display', fontSize: 28, bold: true, color: C.white, margin: 0 });
  slide.addText('meters connected at least once', { x: 9.3, y: 4.79, w: 2.8, h: 0.25, fontFace: 'Aptos', fontSize: 10.5, color: C.pale, margin: 0, fit: 'shrink' });
  slide.addText('Reporting period: 4-12 November 2026  |  Programme started: 26 October 2026', {
    x: 0.75, y: 6.72, w: 9.3, h: 0.23, fontFace: 'Aptos', fontSize: 9, color: C.pale, margin: 0
  });
  slide.addText('MICROACCESS', { x: 10.55, y: 6.65, w: 1.95, h: 0.28, fontFace: 'Aptos', fontSize: 9, bold: true, color: C.white, charSpacing: 2.1, align: 'right', margin: 0 });
}

// Slide 2: executive snapshot
{
  const slide = pptx.addSlide();
  slide.background = { color: C.paper };
  addTitle(slide, 'Executive position', 'Day 18: MVP delivered and meter visibility established', `Provider snapshot: ${SNAPSHOT_AT}. Functional test and backend connectivity are reported separately.`);
  const kpis = [
    [0.6, KPI.totalMeters, 'Meters in estate', 'Controlled register', C.teal],
    [3.04, KPI.functionallyTested, 'Functionally tested', 'Last confirmed physical result', C.green],
    [5.48, KPI.everConnected, 'Ever connected', '58% reached provider at least once', C.blue],
    [7.92, KPI.neverConnected, 'Never connected', '42% have no provider reading', C.red],
    [10.36, KPI.onlineNow, 'Online at snapshot', '3 seen within 24 hours', C.amber]
  ];
  kpis.forEach(k => addKpi(slide, k[0], 1.9, 2.22, k[1], k[2], k[3], k[4]));

  slide.addText('Connection reach', { x: 0.65, y: 3.55, w: 2.1, h: 0.25, fontFace: 'Aptos Display', fontSize: 13, bold: true, color: C.navy, margin: 0 });
  slide.addText('At least one provider reading is evidence of reachability—not proof of commissioning stability.', { x: 2.43, y: 3.59, w: 6.6, h: 0.22, fontFace: 'Aptos', fontSize: 8.8, color: C.gray, margin: 0 });
  const barX = 0.66, barY = 4.02, barW = 11.94;
  slide.addShape(pptx.ShapeType.roundRect, { x: barX, y: barY, w: barW, h: 0.44, rectRadius: 0.08, fill: { color: C.soft }, line: { transparency: 100 } });
  slide.addShape(pptx.ShapeType.roundRect, { x: barX, y: barY, w: barW * KPI.everConnected / KPI.totalMeters, h: 0.44, rectRadius: 0.08, fill: { color: C.blue }, line: { transparency: 100 } });
  slide.addText('18 connected at least once', { x: 1.0, y: 4.12, w: 2.4, h: 0.18, fontFace: 'Aptos', fontSize: 8, bold: true, color: C.white, margin: 0 });
  slide.addText('13 never connected', { x: 9.95, y: 4.12, w: 1.85, h: 0.18, fontFace: 'Aptos', fontSize: 8, bold: true, color: C.gray, align: 'right', margin: 0 });

  addCard(slide, 0.66, 4.83, 3.77, 1.24, 'Functional recovery', 'Five meters taken to SteamaCo were repaired. Four connectivity units and one firmware unit were returned working.', C.green, '5 OF 5');
  addCard(slide, 4.57, 4.83, 3.77, 1.24, 'Current communications', 'One meter was online at the snapshot; two additional source meters had reported within the previous 24 hours.', C.amber, '3 RECENT');
  addCard(slide, 8.48, 4.83, 4.12, 1.24, 'Management interpretation', 'Backend reachability has been demonstrated; persistent communications and complete interval history are not yet demonstrated.', C.red, 'ASSURANCE');
  addPill(slide, '14 FUNCTIONALLY TESTED  |  18 EVER CONNECTED  |  1 ONLINE NOW', 3.56, 6.43, 6.2, C.navy);
  addBrand(slide, 2, 'Executive snapshot');
}

// Slide 3: achievements
{
  const slide = pptx.addSlide();
  slide.background = { color: C.paper };
  addTitle(slide, 'This week', 'What has been achieved', 'The programme now combines physical meter recovery, live provider visibility and a management-ready operational application.');
  addCard(slide, 0.6, 1.9, 3.88, 1.66, 'Meter estate measured', 'Live status for all 31 meters is now interpreted as ever connected, never connected, currently online and last seen—rather than a single ambiguous Active label.', C.teal, '31 METERS');
  addCard(slide, 4.72, 1.9, 3.88, 1.66, 'MVP deployed', 'The application is running under PM2 with PostgreSQL, protected staff access, provider sync and operational pages available over the VPN.', C.blue, 'LIVE MVP');
  addCard(slide, 8.84, 1.9, 3.88, 1.66, 'Energy interpretation', 'Solar, non-solar incoming supply, revenue/cost and floor views were built with filters and explicit data-coverage warnings.', C.green, 'ANALYTICS');
  addCard(slide, 0.6, 3.84, 3.88, 1.66, 'Source topology clarified', 'The meter labelled Grid actually reads the shared grid + generator incomer. The application and current reporting now reflect that physical position.', C.amber, 'CONTROL');
  addCard(slide, 4.72, 3.84, 3.88, 1.66, 'Daystar reports reviewed', 'The generator leg and monthly energy reports were compared with Steama readings; reconciliation points are now documented for joint verification.', C.purple, 'REVIEWED');
  addCard(slide, 8.84, 3.84, 3.88, 1.66, 'Production boundary retained', 'Payment, customer credit, remote commands and settlement remain disabled until vendor contracts and data-quality controls are certified.', C.red, 'GATED');
  addPill(slide, 'CURRENT RESULT: WORKING MANAGEMENT MVP  |  PRODUCTION INTEGRATION IS A SEPARATE PHASE', 2.48, 6.36, 8.38, C.navy);
  addBrand(slide, 3, 'Weekly achievements');
}

// Slide 4: application MVP
{
  const slide = pptx.addSlide();
  slide.background = { color: C.paper };
  addTitle(slide, 'Application delivery', 'The operational MVP is now a multi-page management workspace', 'It consumes the live read-only interfaces presently available and explains the data more clearly than the provider portal.');
  const modules = [
    ['Command centre', 'Estate KPIs, freshness, assignment and priority exceptions'],
    ['Meter operations', 'Search, status, detail and available provider history'],
    ['Customer accounts', 'Customer, assignment and balance visibility'],
    ['Energy mix', 'Solar vs non-solar usage with date filters and coverage'],
    ['Revenue & cost', 'Configurable NGN 203/kWh indicative allocation'],
    ['Floor operations', 'Ground through fifth floor, tenant structure and trends'],
    ['Exceptions', 'Never-online, stale, unassigned and data-quality actions'],
    ['Reports & analytics', 'Management-ready operational interpretation']
  ];
  modules.forEach((m, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = 0.62 + col * 3.06, y = 1.9 + row * 1.36;
    slide.addShape(pptx.ShapeType.roundRect, { x, y, w: 2.78, h: 1.08, rectRadius: 0.05, fill: { color: C.white }, line: { color: C.line, width: 0.8 } });
    slide.addShape(pptx.ShapeType.ellipse, { x: x + 0.2, y: y + 0.22, w: 0.46, h: 0.46, fill: { color: i < 4 ? C.blue : C.teal }, line: { transparency: 100 } });
    slide.addText(String(i + 1).padStart(2, '0'), { x: x + 0.2, y: y + 0.32, w: 0.46, h: 0.15, fontFace: 'Aptos', fontSize: 7.2, bold: true, color: C.white, align: 'center', margin: 0 });
    slide.addText(m[0], { x: x + 0.78, y: y + 0.17, w: 1.78, h: 0.23, fontFace: 'Aptos Display', fontSize: 11.2, bold: true, color: C.navy, margin: 0, fit: 'shrink' });
    slide.addText(m[1], { x: x + 0.78, y: y + 0.5, w: 1.78, h: 0.38, fontFace: 'Aptos', fontSize: 7.7, color: C.gray, margin: 0, fit: 'shrink' });
  });
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.62, y: 4.9, w: 12.0, h: 1.08, rectRadius: 0.05, fill: { color: C.navy }, line: { transparency: 100 } });
  slide.addText('DELIVERED NOW', { x: 0.94, y: 5.18, w: 1.25, h: 0.22, fontFace: 'Aptos', fontSize: 8, bold: true, color: C.sky, charSpacing: 1.1, margin: 0 });
  slide.addText('Secure live read-only operations MVP', { x: 2.16, y: 5.09, w: 2.65, h: 0.35, fontFace: 'Aptos Display', fontSize: 14, bold: true, color: C.white, margin: 0, fit: 'shrink' });
  slide.addText('PRODUCTION PHASE', { x: 5.03, y: 5.18, w: 1.35, h: 0.22, fontFace: 'Aptos', fontSize: 8, bold: true, color: C.sky, charSpacing: 1.1, margin: 0 });
  slide.addText('Certified data history, payment/credit integration, security monitoring, support and operating controls', { x: 6.39, y: 5.09, w: 5.75, h: 0.38, fontFace: 'Aptos', fontSize: 9.2, color: C.white, margin: 0, fit: 'shrink' });
  addPill(slide, 'LIVE READ-ONLY MVP', 4.92, 6.39, 3.48, C.teal);
  addBrand(slide, 4, 'Application MVP');
}

// Slide 5: technical review completed
{
  const slide = pptx.addSlide();
  slide.background = { color: C.paper };
  addTitle(slide, 'Technical review completed', 'What we confirmed during this week', 'The application now reflects these findings so management can interpret the available data correctly.');
  const items = [
    ['01', 'Source classification confirmed', 'We confirmed that the meter labelled Grid is installed on the shared grid and generator incoming cable.', 'The MVP now presents this source as Non-Solar Incoming Supply.'],
    ['02', 'Connectivity visibility improved', 'We separated ever connected, never connected, currently online and seen-within-24-hours results.', 'Management can now see reachability and current status as distinct measures.'],
    ['03', 'Historical behaviour reviewed', 'We confirmed that communication gaps can appear later as cumulative changes rather than a complete hourly replay.', 'The energy views now display comparison coverage with the usage charts.'],
    ['04', 'Daystar comparison completed', 'October and November reports were reviewed alongside the available SteamaCo readings.', 'The generator leg and the main differences between both data sources are documented.']
  ];
  items.forEach((it, i) => {
    const y = 1.86 + i * 1.13;
    slide.addShape(pptx.ShapeType.roundRect, { x: 0.64, y, w: 12.0, h: 0.9, rectRadius: 0.04, fill: { color: C.white }, line: { color: C.line, width: 0.8 } });
    slide.addShape(pptx.ShapeType.ellipse, { x: 0.86, y: y + 0.18, w: 0.52, h: 0.52, fill: { color: C.blue }, line: { transparency: 100 } });
    slide.addText(it[0], { x: 0.86, y: y + 0.31, w: 0.52, h: 0.16, fontFace: 'Aptos', fontSize: 7.5, bold: true, color: C.white, align: 'center', margin: 0 });
    slide.addText(it[1], { x: 1.58, y: y + 0.18, w: 1.55, h: 0.24, fontFace: 'Aptos Display', fontSize: 12, bold: true, color: C.navy, margin: 0, fit: 'shrink' });
    slide.addText(it[2], { x: 3.24, y: y + 0.15, w: 4.35, h: 0.47, fontFace: 'Aptos', fontSize: 8.5, color: C.ink, margin: 0, fit: 'shrink' });
    slide.addText(it[3], { x: 7.87, y: y + 0.15, w: 4.42, h: 0.47, fontFace: 'Aptos', fontSize: 8.5, bold: true, color: C.teal, margin: 0, fit: 'shrink' });
  });
  addPill(slide, 'OUTCOME: FINDINGS INCORPORATED INTO THE MVP AND CURRENT REPORTING', 2.87, 6.44, 7.58, C.navy);
  addBrand(slide, 5, 'Technical review');
}

// Slide 6: 30-day path
{
  const slide = pptx.addSlide();
  slide.background = { color: C.paper };
  addTitle(slide, '30-day programme', 'Day 18 to Day 30: work continues', 'The programme remains active through 24 November 2026, with daily progress reporting and an evidence-based handover.');
  const x0 = 0.7, y0 = 2.1, w = 11.85;
  slide.addShape(pptx.ShapeType.line, { x: x0, y: y0 + 0.39, w, h: 0, line: { color: C.line, width: 7 } });
  slide.addShape(pptx.ShapeType.line, { x: x0, y: y0 + 0.39, w: w * REPORT_DAY / TOTAL_DAYS, h: 0, line: { color: C.teal, width: 7 } });
  [1, 7, 14, 18, 21, 24, 27, 30].forEach(day => {
    const x = x0 + w * (day - 1) / (TOTAL_DAYS - 1);
    slide.addShape(pptx.ShapeType.ellipse, { x: x - 0.12, y: y0 + 0.27, w: 0.24, h: 0.24, fill: { color: day <= REPORT_DAY ? C.teal : C.white }, line: { color: day === REPORT_DAY ? C.red : C.teal, width: day === REPORT_DAY ? 2 : 1 } });
    slide.addText(`D${day}`, { x: x - 0.24, y: y0 + 0.7, w: 0.48, h: 0.17, fontFace: 'Aptos', fontSize: 7.2, bold: day === REPORT_DAY, color: day === REPORT_DAY ? C.red : C.gray, align: 'center', margin: 0 });
  });
  addPill(slide, 'TODAY', x0 + w * (REPORT_DAY - 1) / (TOTAL_DAYS - 1) - 0.48, y0 - 0.2, 0.96, C.red);
  addCard(slide, 0.68, 3.26, 3.75, 1.6, 'Current work', 'Meter testing and connectivity monitoring continue across the remaining estate, with serial-specific evidence retained.', C.teal, 'DAYS 18-21');
  addCard(slide, 4.58, 3.26, 3.75, 1.6, 'Next reporting period', 'Historical-data capture, customer and floor mapping, and the provider API review continue as part of the MVP programme.', C.blue, 'DAYS 22-27');
  addCard(slide, 8.48, 3.26, 4.08, 1.6, 'Day 30 handover', 'The programme concludes with a management demonstration, evidence pack and documented continuation plan.', C.green, 'DAYS 28-30');
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.68, y: 5.24, w: 11.88, h: 0.78, rectRadius: 0.05, fill: { color: C.navy }, line: { transparency: 100 } });
  slide.addText('Day 30 outcome', { x: 0.95, y: 5.48, w: 1.25, h: 0.22, fontFace: 'Aptos Display', fontSize: 12, bold: true, color: C.white, margin: 0 });
  slide.addText('A demonstrated operational MVP, classified meter estate, transparent data position and documented production-integration scope.', { x: 2.25, y: 5.43, w: 9.75, h: 0.28, fontFace: 'Aptos', fontSize: 9.4, color: C.pale, margin: 0, fit: 'shrink' });
  addPill(slide, 'DAILY UPDATES CONTINUE THROUGH COMPLETION', 4.35, 6.4, 4.55, C.teal);
  addBrand(slide, 6, 'Delivery path');
}

// Slide 7: application and commercial position
{
  const slide = pptx.addSlide();
  slide.background = { color: C.paper };
  addTitle(slide, 'Application and commercial position', 'MVP delivered; production integration is the next phase', 'This week’s work demonstrates the operating concept and defines the scope of the production phase.');
  addCard(slide, 0.62, 1.88, 3.78, 2.18, '1. MVP work completed', 'The live read-only application has been developed and deployed as part of the project. It now provides management and operations visibility across meters, customers, energy, cost and floor performance.', C.teal, 'DELIVERED');
  addCard(slide, 4.77, 1.88, 3.78, 2.18, '2. Vendor API position', 'SteamaCo provides and controls the vendor API layer. The MVP currently consumes the available read-only interfaces; production write functions remain outside the present phase.', C.blue, 'CURRENT');
  addCard(slide, 8.92, 1.88, 3.78, 2.18, '3. Production cost position', 'Production API integration, hosting, data retention, monitoring, security, QA and support will form a separately costed implementation phase.', C.green, 'NEXT PHASE');
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.62, y: 4.44, w: 12.08, h: 1.46, rectRadius: 0.05, fill: { color: C.navy }, line: { transparency: 100 } });
  slide.addText('PROJECT COST NOTE', { x: 0.93, y: 4.75, w: 1.95, h: 0.22, fontFace: 'Aptos', fontSize: 8, bold: true, color: C.sky, charSpacing: 1.2, margin: 0 });
  slide.addText('Development and tooling expenditure associated with the MVP will be documented separately for management and Finance consideration. No unapproved amount is included in this report.', { x: 2.86, y: 4.67, w: 9.18, h: 0.67, fontFace: 'Aptos', fontSize: 10, color: C.white, margin: 0, fit: 'shrink', valign: 'mid' });
  addPill(slide, 'CURRENT RESULT: WORKING MVP  |  NEXT PHASE: COSTED PRODUCTION INTEGRATION', 2.9, 6.37, 7.52, C.teal);
  addBrand(slide, 7, 'Commercial path');
}

function setSheetTitle(ws, title, subtitle, endCol) {
  ws.mergeCells(`A1:${endCol}2`);
  const titleCell = ws.getCell('A1');
  titleCell.value = title;
  titleCell.font = { name: 'Aptos Display', size: 22, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${C.navy}` } };
  ws.mergeCells(`A3:${endCol}3`);
  const sub = ws.getCell('A3');
  sub.value = subtitle;
  sub.font = { name: 'Aptos', size: 10, color: { argb: `FF${C.gray}` } };
  sub.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  ws.getRow(1).height = 28;
  ws.getRow(2).height = 12;
  ws.getRow(3).height = 24;
}

function fillMerged(ws, range, value, fill, color, size = 10, bold = false, align = 'center') {
  ws.mergeCells(range);
  const cell = ws.getCell(range.split(':')[0]);
  cell.value = value;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fill}` } };
  cell.font = { name: 'Aptos', size, bold, color: { argb: `FF${color}` } };
  cell.alignment = { vertical: 'middle', horizontal: align, wrapText: true };
  cell.border = {
    top: { style: 'thin', color: { argb: `FF${C.line}` } },
    left: { style: 'thin', color: { argb: `FF${C.line}` } },
    bottom: { style: 'thin', color: { argb: `FF${C.line}` } },
    right: { style: 'thin', color: { argb: `FF${C.line}` } }
  };
}

function styleHeader(row, fill = C.navy) {
  row.eachCell({ includeEmpty: true }, cell => {
    cell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fill}` } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } }, right: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
  });
  row.height = 36;
}

function styleBody(ws, fromRow, toRow, fromCol, toCol) {
  for (let r = fromRow; r <= toRow; r++) {
    for (let c = fromCol; c <= toCol; c++) {
      const cell = ws.getCell(r, c);
      cell.font = { name: 'Aptos', size: 9, color: { argb: `FF${C.ink}` } };
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: { style: 'hair', color: { argb: `FF${C.line}` } }, right: { style: 'hair', color: { argb: `FF${C.line}` } } };
      if (r % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
  }
}

async function buildWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MicroAccess Smart Metering Project';
  wb.lastModifiedBy = 'MicroAccess Smart Metering Project';
  wb.created = REPORT_DATE;
  wb.modified = REPORT_DATE;
  wb.title = 'MicroAccess Smart Metering Weekly Management Tracker';
  wb.subject = 'Day 18 weekly management update for the 30-day programme';
  wb.company = 'MicroAccess';
  wb.calcProperties.fullCalcOnLoad = true;
  wb.calcProperties.forceFullCalc = true;

  // Executive dashboard
  {
    const ws = wb.addWorksheet('Executive Dashboard', { views: [{ showGridLines: false, state: 'frozen', ySplit: 3 }] });
    for (let i = 1; i <= 32; i++) ws.getColumn(i).width = i === 1 ? 2.5 : 4.2;
    setSheetTitle(ws, '30-Day Meter Stabilisation & Application MVP', `Weekly management update • Day ${REPORT_DAY} • Provider snapshot ${SNAPSHOT_AT}`, 'AF');
    const cards = [
      ['B5:F5', 'B6:F8', 'TOTAL METERS', { formula: "COUNTA('Meter Connectivity'!$B$6:$B$36)", result: KPI.totalMeters }, C.teal],
      ['H5:L5', 'H6:L8', 'FUNCTIONALLY TESTED', { formula: "COUNTIF('Meter Connectivity'!$K$6:$K$36,\"Working\")", result: KPI.functionallyTested }, C.green],
      ['N5:R5', 'N6:R8', 'EVER CONNECTED', { formula: "COUNTIF('Meter Connectivity'!$F$6:$F$36,\"<>Never Online\")", result: KPI.everConnected }, C.blue],
      ['T5:X5', 'T6:X8', 'NEVER CONNECTED', { formula: "COUNTIF('Meter Connectivity'!$F$6:$F$36,\"Never Online\")", result: KPI.neverConnected }, C.red],
      ['Z5:AD5', 'Z6:AD8', 'ONLINE AT SNAPSHOT', { formula: "COUNTIF('Meter Connectivity'!$F$6:$F$36,\"Online\")", result: KPI.onlineNow }, C.amber]
    ];
    cards.forEach(c => {
      fillMerged(ws, c[0], c[2], c[4], C.white, 9, true);
      fillMerged(ws, c[1], c[3], C.white, C.navy, 26, true);
    });
    ws.mergeCells('B10:AF10');
    ws.getCell('B10').value = 'CONNECTION REACH • 18 OF 31 METERS HAVE REPORTED AT LEAST ONCE • 58%';
    ws.getCell('B10').font = { name: 'Aptos', size: 10, bold: true, color: { argb: `FF${C.navy}` } };
    for (let col = 2; col <= 32; col++) {
      const cell = ws.getCell(12, col);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${col <= 19 ? C.blue : C.soft}` } };
      cell.border = { right: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
    }
    ws.getRow(12).height = 20;
    fillMerged(ws, 'B14:F14', '3 SEEN WITHIN 24 HOURS', C.paleBlue, C.blue, 9, true);
    fillMerged(ws, 'H14:L14', '5 OF 5 VENDOR FIXES', C.paleGreen, C.green, 9, true);
    fillMerged(ws, 'N14:R14', '6 OBSERVED ASSIGNMENTS', C.paleBlue, C.teal, 9, true);
    fillMerged(ws, 'T14:X14', '33 PROVIDER CUSTOMERS', C.paleBlue, C.blue, 9, true);
    fillMerged(ws, 'Z14:AF14', 'DAY 18 • 12 NOVEMBER 2026', C.navy, C.white, 9, true);
    fillMerged(ws, 'B17:P17', 'ACHIEVED THIS WEEK', C.navy, C.white, 10, true, 'left');
    fillMerged(ws, 'B18:P24',
      '• Live status interpreted for all 31 meters\n• 18 meters confirmed to have connected at least once\n• Multi-page operational MVP deployed under PM2 and PostgreSQL\n• Command centre, meter, customer, exception and report pages delivered\n• Energy mix, revenue/cost and floor analytics delivered\n• Grid + generator common-incomer topology documented\n• Daystar generator-inclusive reports reviewed against Steama data',
      C.white, C.ink, 10, false, 'left');
    fillMerged(ws, 'R17:AF17', 'WORK CONTINUING NEXT WEEK', C.teal, C.white, 10, true, 'left');
    fillMerged(ws, 'R18:AF24',
      '• Physical testing continues across the remaining meters\n• The 13 never-connected meters remain the next connectivity group\n• Connectivity and available interval history are being monitored\n• Customer and floor mappings continue to be reconciled\n• Provider API and commercial details will be documented for the production phase\n• Daystar and SteamaCo data comparisons continue\n• The Day 30 demonstration and evidence pack are being prepared',
      C.white, C.ink, 10, false, 'left');
    fillMerged(ws, 'B27:H27', 'MVP STATUS', C.green, C.white, 10, true);
    fillMerged(ws, 'B28:H33', 'Working live read-only MVP\n\nSecure staff access, live provider sync, operational dashboards, meter/customer views, energy interpretation and floor analytics are deployed.', C.paleGreen, C.ink, 10, false);
    fillMerged(ws, 'J27:P27', 'DATA POSITION', C.amber, C.white, 10, true);
    fillMerged(ws, 'J28:P33', 'Management indicator\n\nThe MVP shows the available source, connectivity and coverage position. Payment, credit and settlement functions remain outside the present phase.', C.paleAmber, C.ink, 10, false);
    fillMerged(ws, 'R27:X27', 'PRODUCTION PHASE', C.blue, C.white, 10, true);
    fillMerged(ws, 'R28:X33', 'Separately costed implementation\n\nThe next phase covers vendor API arrangements, integration, hosting, monitoring, security, QA and data retention.', C.paleBlue, C.ink, 10, false);
    fillMerged(ws, 'Z27:AF27', 'MVP COST NOTE', C.teal, C.white, 10, true);
    fillMerged(ws, 'Z28:AF33', 'Recorded separately\n\nProject development and tooling expenditure will be documented for management and Finance consideration. No unapproved value is included here.', C.paleBlue, C.ink, 10, false);
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 1, printArea: 'A1:AF34', margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.1, footer: 0.1 } };
  }

  // Weekly update
  {
    const ws = wb.addWorksheet('Weekly Update', { views: [{ showGridLines: false, state: 'frozen', ySplit: 5 }] });
    setSheetTitle(ws, 'Weekly Progress Update', 'Reporting period: 4-12 November 2026 • 30-day programme Day 18', 'H');
    const rows = [
      ['Reporting position', 'Day 18 of 30', 'Programme continues through 24 November 2026.'],
      ['Meter estate', '31 total', 'Controlled estate register remains complete.'],
      ['Functional test', '14 confirmed', 'Latest confirmed physical-test baseline; do not equate with live telemetry.'],
      ['Connected at least once', '18 meters', 'A provider reading/last-seen timestamp has been observed.'],
      ['Never connected', '13 meters', 'No provider reading/last-seen timestamp has been observed.'],
      ['Current communications', '1 online; 3 seen in 24h', `Snapshot taken ${SNAPSHOT_AT}.`],
      ['Vendor repair outcome', '5 of 5 repaired', 'Four connection faults and one firmware mismatch were functionally fixed.'],
      ['Application MVP', 'Live and deployed', 'Secure multi-page operations, energy, revenue/cost, floor and report views.'],
      ['Production boundary', 'Write functions outside the MVP', 'Payment, customer credit, remote commands and settlement remain outside the present phase.'],
      ['Commercial position', 'Next phase identified', 'Production API integration, hosting, security, support and data retention will be separately costed.']
    ];
    ['Area', 'Current position', 'Management interpretation'].forEach((h, i) => ws.getCell(5, i + 1).value = h);
    styleHeader(ws.getRow(5), C.teal);
    rows.forEach((r, i) => {
      r.forEach((v, c) => ws.getCell(6 + i, c + 1).value = v);
      ws.getRow(6 + i).height = 36;
    });
    styleBody(ws, 6, 15, 1, 3);
    ws.getColumn(1).width = 28;
    ws.getColumn(2).width = 25;
    ws.getColumn(3).width = 78;
    ws.mergeCells('A18:H18');
    ws.getCell('A18').value = 'MANAGEMENT SUMMARY';
    ws.getCell('A18').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${C.navy}` } };
    ws.getCell('A18').font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.mergeCells('A19:H24');
    ws.getCell('A19').value = 'This week the programme delivered a working live read-only application MVP and a clearer management view of the 31-meter estate. Eighteen meters have now reached the provider at least once; at the reporting snapshot, one meter was online and three had reported within 24 hours. The application now separates these connectivity measures and presents meter, customer, energy, revenue/cost, floor and exception views. Work continues on the remaining meter tests, connectivity monitoring, historical-data capture, customer/floor reconciliation and documentation of the production integration phase.';
    ws.getCell('A19').alignment = { vertical: 'middle', wrapText: true };
    ws.getCell('A19').font = { name: 'Aptos', size: 11, color: { argb: `FF${C.ink}` } };
    ws.getCell('A19').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${C.paleBlue}` } };
  }

  // Meter connectivity
  {
    const ws = wb.addWorksheet('Meter Connectivity', { views: [{ showGridLines: false, state: 'frozen', ySplit: 5, xSplit: 2 }] });
    setSheetTitle(ws, 'Meter Connectivity Snapshot', `Live read-only SteamaCo snapshot • ${SNAPSHOT_AT} • One-time reachability is not stability`, 'L');
    const headers = ['No.', 'Meter Number', 'Meter Type', 'Model', 'Operational Role', 'Connectivity', 'Freshness', 'Last Reading At', 'Assigned Customer', 'Assigned?', 'Functional Test', 'Notes'];
    headers.forEach((h, i) => ws.getCell(5, i + 1).value = h);
    styleHeader(ws.getRow(5), C.navy);
    meterSnapshot.forEach((m, i) => {
      const row = 6 + i;
      ws.getCell(row, 1).value = i + 1;
      ws.getCell(row, 2).value = m[0];
      ws.getCell(row, 2).numFmt = '@';
      for (let c = 1; c < m.length; c++) ws.getCell(row, c + 2).value = m[c];
      ws.getCell(row, 11).value = workingMeterIds.has(m[0]) ? 'Working' : 'Not confirmed';
      ws.getCell(row, 12).value = m[9];
      const connColor = m[4] === 'Online' ? C.paleGreen : m[4] === 'Never Online' ? C.paleRed : C.paleAmber;
      ws.getCell(row, 6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${connColor}` } };
      ws.getCell(row, 6).font = { name: 'Aptos', size: 9, bold: true, color: { argb: `FF${m[4] === 'Online' ? C.green : m[4] === 'Never Online' ? C.red : C.amber}` } };
      ws.getCell(row, 11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${workingMeterIds.has(m[0]) ? C.paleGreen : C.soft}` } };
      ws.getRow(row).height = 34;
    });
    styleBody(ws, 6, 36, 1, 12);
    meterSnapshot.forEach((m, i) => {
      const row = 6 + i;
      const connColor = m[4] === 'Online' ? C.paleGreen : m[4] === 'Never Online' ? C.paleRed : C.paleAmber;
      ws.getCell(row, 6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${connColor}` } };
      ws.getCell(row, 6).font = { name: 'Aptos', size: 9, bold: true, color: { argb: `FF${m[4] === 'Online' ? C.green : m[4] === 'Never Online' ? C.red : C.amber}` } };
      ws.getCell(row, 11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${workingMeterIds.has(m[0]) ? C.paleGreen : C.soft}` } };
    });
    [7, 22, 31, 12, 22, 16, 22, 22, 42, 12, 18, 36].forEach((v, i) => ws.getColumn(i + 1).width = v);
    ws.autoFilter = { from: 'A5', to: 'L36' };
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, repeatRows: '1:5', margins: { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.1, footer: 0.1 } };
  }

  // Daily reporting ledger
  {
    const ws = wb.addWorksheet('Daily Report', { views: [{ showGridLines: false, state: 'frozen', ySplit: 5, xSplit: 2 }] });
    setSheetTitle(ws, 'Smart Metering Daily Progress Ledger', 'Weekly pack preserves the confirmed Day 9 baseline and the current Day 18 management position', 'M');
    const headers = [
      'Day', 'Date', 'Reporting Status', 'Functionally Tested', 'Ever Connected', 'Never Connected',
      'Online at Snapshot', 'Seen within 24h', 'Vendor Fixes', 'Application Milestone',
      'Meter / Data Work', 'Evidence / Notes', 'Next Action'
    ];
    headers.forEach((h, i) => ws.getCell(5, i + 1).value = h);
    styleHeader(ws.getRow(5), C.teal);
    const rows = [
      [9, new Date(Date.UTC(2026, 10, 3)), 'Confirmed weekly baseline', 14, '', '', '', '', 5,
        'Read-only application foundation established',
        'Four connection units and one firmware unit repaired; physical testing continued',
        'Prior weekly management pack dated 3 November 2026',
        'Continue remaining tests and restore telemetry'],
      [18, REPORT_DATE, 'Current weekly update', KPI.functionallyTested, KPI.everConnected, KPI.neverConnected, KPI.onlineNow, KPI.seenWithin24Hours, KPI.vendorRepairs,
        'Live multi-page operations MVP deployed',
        'Provider snapshot interpreted; source topology and interval-data controls documented',
        `SteamaCo live read-only snapshot at ${SNAPSHOT_AT}; application running under PM2`,
        'Testing, connectivity monitoring, historical capture and production-scope documentation continue']
    ];
    rows.forEach((r, i) => {
      const row = 6 + i;
      r.forEach((v, c) => ws.getCell(row, c + 1).value = v);
      ws.getCell(row, 2).numFmt = 'dd-mmm-yyyy';
      ws.getRow(row).height = 58;
    });
    styleBody(ws, 6, 7, 1, 13);
    [8, 16, 24, 17, 16, 17, 18, 17, 15, 42, 50, 50, 52].forEach((v, i) => ws.getColumn(i + 1).width = v);
    ws.autoFilter = { from: 'A5', to: 'M7' };
  }

  // SIM test pool: deliberately kept separate from installed meter assignments.
  {
    const ws = wb.addWorksheet('SIM Test Pool', { views: [{ showGridLines: false, state: 'frozen', ySplit: 6 }] });
    setSheetTitle(ws, 'SIM Test Pool', 'Independent testing inventory. Row position is not a meter assignment.', 'G');
    ws.mergeCells('A4:G4');
    ws.getCell('A4').value = 'Installed SIM-to-meter assignments are recorded only after physical verification; row order does not imply an association.';
    ws.getCell('A4').font = { name: 'Aptos', size: 10, bold: true, color: { argb: `FF${C.teal}` } };
    ws.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${C.paleBlue}` } };
    ws.getCell('A4').alignment = { vertical: 'middle', wrapText: true };
    ws.getRow(4).height = 32;
    ['Pool ID', 'SIM Number', 'Provider', 'Pool Status', 'Last Used', 'Physically Verified Meter', 'Notes'].forEach((h, i) => ws.getCell(6, i + 1).value = h);
    styleHeader(ws.getRow(6), C.teal);
    const sims = ['081 066 371 85', '070 486 425 94', '070 661 908 39', '070 661 486 27', '070 663 074 77', '070 660 793 72'];
    sims.forEach((sim, i) => {
      const row = 7 + i;
      ws.getCell(row, 1).value = `SIM-${String(i + 1).padStart(2, '0')}`;
      ws.getCell(row, 2).value = sim;
      ws.getCell(row, 2).numFmt = '@';
      ws.getCell(row, 4).value = 'Controlled test pool';
      ws.getCell(row, 7).value = 'Independent pool record; verify before assigning to a meter.';
      ws.getRow(row).height = 34;
    });
    styleBody(ws, 7, 12, 1, 7);
    [12, 22, 15, 24, 17, 30, 55].forEach((v, i) => ws.getColumn(i + 1).width = v);
  }

  // SteamaCo handover and current provider status.
  {
    const ws = wb.addWorksheet('SteamaCo Handover', { views: [{ showGridLines: false, state: 'frozen', ySplit: 5 }] });
    setSheetTitle(ws, 'SteamaCo Repair & Current Telemetry Follow-up', 'All five submitted meters were functionally repaired; provider connectivity remains separately monitored', 'J');
    ['Meter Number', 'Original Issue', 'Repair Outcome', 'Repair Date', 'Provider Status at 12 Nov', 'Last Seen', '24h Stable?', 'Owner', 'Work Continuing', 'Evidence Note'].forEach((h, i) => ws.getCell(5, i + 1).value = h);
    styleHeader(ws.getRow(5), C.red);
    const repairs = [
      ['0179250930312', 'No cell signal', 'Functionally repaired', new Date(Date.UTC(2026, 10, 2)), 'Offline', '02-Nov-2026 12:48', 'No', 'Metering lead', 'Telemetry restoration and interval monitoring continue', 'Provider is stale after repair'],
      ['0179250930361', 'Not connecting', 'Functionally repaired', new Date(Date.UTC(2026, 10, 2)), 'Offline', '02-Nov-2026 12:35', 'No', 'Metering lead', 'Telemetry restoration and interval monitoring continue', 'Provider is stale after repair'],
      ['0179250930221', 'Not connecting', 'Functionally repaired', new Date(Date.UTC(2026, 10, 2)), 'Offline', '02-Nov-2026 12:02', 'No', 'Metering lead', 'Telemetry restoration and interval monitoring continue', 'Provider is stale after repair'],
      ['0179250930189', 'No cell signal', 'Functionally repaired', new Date(Date.UTC(2026, 10, 2)), 'Offline', '02-Nov-2026 11:51', 'No', 'Metering lead', 'Telemetry restoration and interval monitoring continue', 'Provider is stale after repair'],
      ['0179250930205', 'Firmware/nameplate mismatch', 'Firmware regularised', new Date(Date.UTC(2026, 10, 3)), 'Online', '12-Nov-2026 21:00', 'Monitoring', 'Metering lead', 'Stability and reading evidence continue to be retained', 'Only submitted unit online at snapshot']
    ];
    repairs.forEach((r, i) => {
      const row = 6 + i;
      r.forEach((v, c) => ws.getCell(row, c + 1).value = v);
      ws.getCell(row, 1).numFmt = '@';
      ws.getCell(row, 4).numFmt = 'dd-mmm-yyyy';
      ws.getCell(row, 5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${r[4] === 'Online' ? C.paleGreen : C.paleAmber}` } };
      ws.getCell(row, 5).font = { name: 'Aptos', size: 9, bold: true, color: { argb: `FF${r[4] === 'Online' ? C.green : C.amber}` } };
      ws.getRow(row).height = 48;
    });
    styleBody(ws, 6, 10, 1, 10);
    repairs.forEach((r, i) => {
      const cell = ws.getCell(6 + i, 5);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${r[4] === 'Online' ? C.paleGreen : C.paleAmber}` } };
      cell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: `FF${r[4] === 'Online' ? C.green : C.amber}` } };
    });
    [22, 28, 24, 16, 24, 22, 16, 22, 48, 38].forEach((v, i) => ws.getColumn(i + 1).width = v);
    ws.autoFilter = { from: 'A5', to: 'J10' };
  }

  // 30-day plan
  {
    const ws = wb.addWorksheet('30-Day Plan', { views: [{ showGridLines: false, state: 'frozen', ySplit: 5, xSplit: 7 }] });
    setSheetTitle(ws, '30-Day Integrated Workplan', `Start: ${fmtDate(START_DATE)} • Day ${REPORT_DAY}: ${fmtDate(REPORT_DATE)} • Day 30: ${fmtDate(dateForDay(30))}`, 'AK');
    ['ID', 'Workstream', 'Task', 'Start Day', 'End Day', 'Status', 'Evidence / Current Position'].forEach((h, i) => ws.getCell(5, i + 1).value = h);
    for (let d = 1; d <= TOTAL_DAYS; d++) {
      ws.getCell(4, 7 + d).value = `D${d}`;
      ws.getCell(5, 7 + d).value = dateForDay(d);
      ws.getCell(5, 7 + d).numFmt = 'd mmm';
    }
    styleHeader(ws.getRow(5), C.navy);
    planTasks.forEach((t, i) => {
      const row = 6 + i;
      t.forEach((v, c) => ws.getCell(row, c + 1).value = v);
      const color = statusColor(t[5]);
      ws.getCell(row, 6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` } };
      ws.getCell(row, 6).font = { name: 'Aptos', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
      for (let d = 1; d <= TOTAL_DAYS; d++) {
        const cell = ws.getCell(row, 7 + d);
        const active = d >= t[3] && d <= t[4];
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${active ? color : (dateForDay(d).getUTCDay() % 6 === 0 ? 'EEF2F6' : 'FAFCFE')}` } };
        cell.border = { right: { style: 'hair', color: { argb: `FF${C.line}` } }, bottom: { style: 'hair', color: { argb: `FF${C.line}` } } };
      }
      ws.getRow(row).height = 34;
    });
    styleBody(ws, 6, 5 + planTasks.length, 1, 7);
    [9, 20, 42, 10, 10, 19, 58].forEach((v, i) => ws.getColumn(i + 1).width = v);
    for (let c = 8; c <= 37; c++) ws.getColumn(c).width = 4.2;
    ws.autoFilter = { from: 'A5', to: `AK${5 + planTasks.length}` };
  }

  // Application MVP
  {
    const ws = wb.addWorksheet('Application MVP', { views: [{ showGridLines: false, state: 'frozen', ySplit: 5 }] });
    setSheetTitle(ws, 'Application MVP Delivery', 'Current working capability and the boundary to a certified production service', 'F');
    ['Capability', 'Status', 'Delivered / Intended Value', 'Production Dependency', 'Cost Category', 'Management Note'].forEach((h, i) => ws.getCell(5, i + 1).value = h);
    styleHeader(ws.getRow(5), C.blue);
    appCapabilities.forEach((r, i) => {
      const row = 6 + i;
      ws.getCell(row, 1).value = r[0];
      ws.getCell(row, 2).value = r[1];
      ws.getCell(row, 3).value = r[2];
      const production = [
        'Production identity, access review and support',
        'Vendor SLA, API policy and monitoring',
        'Long-term data retention and alert operations',
        'Provider retention and interval-gap controls',
        'Certified source topology and settlement rules',
        'Tariff, source split and finance rules for the production phase',
        'Floor and tenant master-data sign-off',
        'Export, retention and management sign-off',
        'SteamaCo write contract, sandbox, idempotency and reversal rules',
        'Independent database, backfill and retention policy'
      ][i];
      ws.getCell(row, 4).value = production;
      ws.getCell(row, 5).value = i === 8 ? 'Vendor API + integration + QA/support' : i === 9 ? 'Database/hosting/monitoring' : 'MVP development and productionisation';
      ws.getCell(row, 6).value = i < 8 ? 'MVP capability is available now.' : 'Planned for the production phase.';
      const sc = statusColor(r[1]);
      ws.getCell(row, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${sc}` } };
      ws.getCell(row, 2).font = { name: 'Aptos', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(row).height = 48;
    });
    styleBody(ws, 6, 15, 1, 6);
    appCapabilities.forEach((r, i) => {
      const cell = ws.getCell(6 + i, 2);
      const sc = statusColor(r[1]);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${sc}` } };
      cell.font = { name: 'Aptos', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
    });
    [28, 26, 54, 54, 38, 34].forEach((v, i) => ws.getColumn(i + 1).width = v);
    ws.autoFilter = { from: 'A5', to: 'F15' };
  }

  // Technical findings
  {
    const ws = wb.addWorksheet('Technical Findings', { views: [{ showGridLines: false, state: 'frozen', ySplit: 5 }] });
    setSheetTitle(ws, 'Technical Findings Recorded This Week', 'Findings incorporated into the application and current management reporting', 'F');
    ['ID', 'Review Area', 'What We Confirmed', 'How It Is Reflected in the MVP', 'Current Position', 'Evidence'].forEach((h, i) => ws.getCell(5, i + 1).value = h);
    styleHeader(ws.getRow(5), C.amber);
    assuranceItems.forEach((r, i) => {
      const row = 6 + i;
      r.forEach((v, c) => ws.getCell(row, c + 1).value = v);
      ws.getCell(row, 5).value = ['Completed in MVP', 'Completed in MVP', 'Implemented in current reporting', 'Review completed', 'Boundary documented'][i];
      ws.getCell(row, 6).value = [
        'Physical topology review and meter assignment',
        `SteamaCo snapshot at ${SNAPSHOT_AT}`,
        'Available meter history and observed communication gaps',
        'Daystar October and November reports plus SteamaCo readings',
        'Live application mode and disabled write functions'
      ][i];
      ws.getRow(row).height = 64;
    });
    styleBody(ws, 6, 10, 1, 6);
    [10, 28, 66, 60, 27, 54].forEach((v, i) => ws.getColumn(i + 1).width = v);
  }

  // Commercial position
  {
    const ws = wb.addWorksheet('Commercial Position', { views: [{ showGridLines: false, state: 'frozen', ySplit: 5 }] });
    setSheetTitle(ws, 'Application MVP & Production Commercial Position', 'Current achievement and the scope expected in the next implementation phase', 'F');
    const rows = [
      ['CP-01', 'Application MVP', 'A live read-only operations application has been developed and deployed.', 'Completed', 'Management demonstration, documentation and continued enhancement', 'Development and tooling expenditure will be documented separately'],
      ['CP-02', 'SteamaCo API', 'The available read-only provider interfaces are integrated; SteamaCo controls the production API layer.', 'Current MVP position', 'Production write interfaces and operating terms form part of the next phase', 'Vendor commercial terms may apply'],
      ['CP-03', 'Productionisation', 'The production scope has been defined around integration, hosting, data retention, monitoring, security, QA and support.', 'Planned', 'Separately costed production implementation', 'Internal and external implementation cost'],
      ['CP-04', 'Source metering', 'The shared grid and generator incoming-supply position has been documented in the MVP and report.', 'Finding recorded', 'A separate source-meter design may be assessed during the production phase', 'Hardware cost only if later approved'],
      ['CP-05', 'Daystar comparison', 'October and November Daystar reports have been reviewed against the available SteamaCo data.', 'Review completed', 'Further raw-data collaboration can be added to the production workstream', 'No amount included in this report'],
      ['CP-06', 'Payment and credit', 'Payment and customer-credit automation remain intentionally outside the read-only MVP.', 'Outside current phase', 'Production workflow after the vendor write interface and operating rules are confirmed', 'Integration and support cost']
    ];
    ['ID', 'Area', 'Position Reported', 'Current Status', 'Next Phase', 'Commercial Note'].forEach((h, i) => ws.getCell(5, i + 1).value = h);
    styleHeader(ws.getRow(5), C.teal);
    rows.forEach((r, i) => {
      const row = 6 + i;
      r.forEach((v, c) => ws.getCell(row, c + 1).value = v);
      const color = i === 0 ? C.green : i === 2 ? C.gray : C.blue;
      ws.getCell(row, 4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` } };
      ws.getCell(row, 4).font = { name: 'Aptos', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(row).height = 54;
    });
    styleBody(ws, 6, 11, 1, 6);
    rows.forEach((r, i) => {
      const cell = ws.getCell(6 + i, 4);
      const color = i === 0 ? C.green : i === 2 ? C.gray : C.blue;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` } };
      cell.font = { name: 'Aptos', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
    });
    [10, 28, 68, 25, 62, 48].forEach((v, i) => ws.getColumn(i + 1).width = v);
  }

  // Read me
  {
    const ws = wb.addWorksheet('Read Me', { views: [{ showGridLines: false }] });
    setSheetTitle(ws, 'How to Read This Weekly Pack', 'The workbook preserves the distinction between physical test, backend reachability and stable commissioning.', 'H');
    const sections = [
      ['FUNCTIONALLY TESTED', 'A physical/bench result confirmed by the field process. It does not automatically mean the meter is currently online.'],
      ['EVER CONNECTED', 'At least one provider last-seen/reading timestamp exists. It proves reachability at least once, not sustained service.'],
      ['ONLINE / SEEN IN 24H', 'Current provider communications evidence at the weekly snapshot. This is the closest available short-term stability indicator.'],
      ['APPLICATION MVP', 'A working deployed read-only management and operations application. It is not yet an authorised billing or settlement service.'],
      ['PRODUCTION API', 'SteamaCo controls the vendor API layer. The application-side production integration and operations form a separate implementation phase.'],
      ['COST TREATMENT', 'MVP development/tooling expenditure will be documented separately for management and Finance consideration.']
    ];
    sections.forEach((s, i) => {
      const row = 5 + i * 2;
      ws.mergeCells(row, 1, row + 1, 2);
      ws.getCell(row, 1).value = s[0];
      ws.getCell(row, 1).font = { name: 'Aptos', size: 10, bold: true, color: { argb: `FF${C.teal}` } };
      ws.getCell(row, 1).alignment = { vertical: 'middle', wrapText: true };
      ws.mergeCells(row, 3, row + 1, 8);
      ws.getCell(row, 3).value = s[1];
      ws.getCell(row, 3).font = { name: 'Aptos', size: 10, color: { argb: `FF${C.ink}` } };
      ws.getCell(row, 3).alignment = { vertical: 'middle', wrapText: true };
      ws.getCell(row, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      ws.getRow(row).height = 28;
      ws.getRow(row + 1).height = 20;
    });
    ws.mergeCells('A19:H23');
    ws.getCell('A19').value = 'CONTROL BOUNDARY\nPayments, customer credit, remote meter commands, source settlement and production billing remain gated until the vendor contracts, data-quality controls, finance rules, security controls and acceptance evidence are approved.';
    ws.getCell('A19').font = { name: 'Aptos', size: 11, bold: true, color: { argb: `FF${C.ink}` } };
    ws.getCell('A19').alignment = { vertical: 'middle', wrapText: true };
    ws.getCell('A19').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${C.paleAmber}` } };
    ws.getColumn(1).width = 20;
    ws.getColumn(2).width = 8;
    for (let c = 3; c <= 8; c++) ws.getColumn(c).width = 18;
  }

  const dated = path.join(OUT_DIR, 'MicroAccess_Smart_Metering_Weekly_Management_Tracker_2026-11-12.xlsx');
  await wb.xlsx.writeFile(dated);
  const current = path.join(OUT_DIR, 'MicroAccess_Smart_Metering_30_Day_Management_Tracker.xlsx');
  fs.copyFileSync(dated, current);
  return { dated, current };
}

async function main() {
  const datedPptx = path.join(OUT_DIR, 'MicroAccess_Smart_Metering_Weekly_Progress_Update_2026-11-12.pptx');
  await pptx.writeFile({ fileName: datedPptx });
  const currentPptx = path.join(OUT_DIR, 'MicroAccess_Smart_Metering_30_Day_Executive_Plan.pptx');
  fs.copyFileSync(datedPptx, currentPptx);
  const xlsx = await buildWorkbook();
  console.log(JSON.stringify({ pptx: { dated: datedPptx, current: currentPptx }, xlsx }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
