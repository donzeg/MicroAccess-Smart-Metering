#!/usr/bin/env node

/*
 * Reproducible generator for the MicroAccess Smart Metering management pack.
 * Run with:
 *   NODE_PATH=/tmp/msm-office-deps/node_modules node deliverables/build_management_artifacts.js
 */

const path = require('path');
const fs = require('fs');
const PptxGenJS = require('pptxgenjs');
const ExcelJS = require('exceljs');

const OUT_DIR = path.join(__dirname, 'management');
fs.mkdirSync(OUT_DIR, { recursive: true });

const REPORT_DATE = new Date(Date.UTC(2026, 10, 3));
const START_DATE = new Date(Date.UTC(2026, 9, 26));
const TOTAL_DAYS = 30;

const C = {
  navy: '0B1F33',
  ink: '17324D',
  teal: '0E7C86',
  aqua: '1FB7A6',
  blue: '2D6CDF',
  green: '2BA84A',
  amber: 'F4A261',
  red: 'E45756',
  purple: '7467E8',
  light: 'F4F7FA',
  paleBlue: 'EAF1FF',
  paleTeal: 'E7F7F5',
  paleAmber: 'FFF4E8',
  paleRed: 'FDEEEE',
  gray: '64748B',
  line: 'D9E2EC',
  white: 'FFFFFF',
  soft: 'E9EEF4',
  darkSoft: 'C7D2DE'
};

const meters = [
  [1, 'DONSUN 3 Phase Bulk Meter', 'DS3100', '0308000187531', 'BOI', '', '', '', 'Tested', '', '', '', '', '', '', '', '', '', 'Confirm GPRS hardware and final result', '', '', ''],
  [2, 'DONSUN 3 Phase Bulk Meter', 'DS3100', '0308000187515', 'Solar meter', 'Yes', '081 066 371 85', '', 'Tested', 'Active', '', '', '', '', '', '', '', '', 'Monitor stability and confirm reading flow', '', '', ''],
  [3, 'DONSUN 3 Phase Bulk Meter', 'DS3100', '0308000187523', 'GRID meter', 'Yes', '070 486 425 94', '', 'Tested', 'Active', '', '', '', '', '', '', '', '', 'Monitor stability and confirm reading flow', '', '', ''],
  [4, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0379', '', '', '', '', 'Awaiting test', '', '', '', '', '', '', '', '', '', 'Run full bench test', '', '', ''],
  [5, 'SAVI 3 Phase Smart Meter', 'DS3600', '015925093 0197', '', '', '', '', 'Awaiting test', '', '', '', '', '', '', '', '', '', 'Run full bench test', '', '', ''],
  [6, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0395', '', '', '', '', 'Awaiting test', '', '', '', '', '', '', '', '', '', 'Run full bench test', '', '', ''],
  [7, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0262', '', '', '', '', 'Awaiting test', '', '', '', '', '', '', '', '', '', 'Run full bench test', '', '', ''],
  [8, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0270', '', '', '', '', 'Awaiting test', '', '', '', '', '', '', '', '', '', 'Run full bench test', '', '', ''],
  [9, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0411', '', '', '070 661 908 39', '', 'Awaiting test', '', '', '', '', '', '', '', '', '', 'Run full bench test', '', '', ''],
  [10, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0304', '', '', '', '', 'Awaiting test', '', '', '', '', '', '', '', '', '', 'Run full bench test', '', '', ''],
  [11, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0338', '', '', '', '', 'Awaiting test', '', '', '', '', '', '', '', '', '', 'Run full bench test', '', '', ''],
  [12, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0437', '', '', '', '', 'Awaiting test', '', '', '', '', '', '', '', '', '', 'Run full bench test', '', '', ''],
  [13, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0320', '', '', '', '', 'Awaiting test', '', '', '', '', '', '', '', '', '', 'Run full bench test', '', '', ''],
  [14, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0205', '', '', '', '', 'Tested', 'Not Active', 'Firmware mismatch — fixed', 'Returned', '', '', '', '', new Date(Date.UTC(2026, 10, 3)), 'Metering operator', 'Confirm backend activation, reading flow and 24h stability', '', '', 'Firmware mismatch fixed by SteamaCo on 3 November 2026'],
  [15, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0171', '', '', '', '', 'Awaiting test', '', '', '', '', '', '', '', '', '', 'Run full bench test', '', '', ''],
  [16, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0213', '', '', '', '', 'Awaiting test', '', '', '', '', '', '', '', '', '', 'Run full bench test', '', '', ''],
  [17, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0163', '', '', '', '', 'Tested', 'Not Active', '', '', '', '', '', '', new Date(Date.UTC(2026, 10, 3)), 'Metering operator', 'Confirm backend activation and reading flow', '', '', 'Functional test passed; tracker shows Not Active'],
  [18, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0239', '', '', '', '', 'Awaiting test', '', '', '', '', '', '', '', '', '', 'Run full bench test', '', '', ''],
  [19, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0346', '', '', '', '', 'Tested', 'Not Active', '', '', '', '', '', '', new Date(Date.UTC(2026, 10, 3)), 'Metering operator', 'Confirm backend activation and reading flow', '', '', 'Functional test passed; tracker shows Not Active'],
  [20, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0288', '', '', '', '', 'Awaiting test', '', '', '', '', '', '', '', '', '', 'Run full bench test', '', '', ''],
  [21, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0429', 'MicroAccess C O', 'Yes', '07066148627', 'MTN', 'Testing', 'Active', 'Not connected', 'Candidate', '', '', '', '', new Date(Date.UTC(2026, 10, 3)), 'Metering operator', 'Reconcile the conflicting Active and Not Connected entries; verify current reading', '', '', 'Updated tracker shows Active and Not Connected simultaneously'],
  [22, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0254', '', '', '', '', 'Awaiting test', '', '', '', '', '', '', '', '', '', 'Run full bench test', '', '', ''],
  [23, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0296', '', '', '', '', 'Tested', 'Not Active', '', '', '', '', '', '', new Date(Date.UTC(2026, 10, 3)), 'Metering operator', 'Confirm backend activation and reading flow', '', '', 'Functional test passed; tracker shows Not Active'],
  [24, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0403', '', '', '', '', 'Tested', 'Not Active', '', '', '', '', '', '', new Date(Date.UTC(2026, 10, 3)), 'Metering operator', 'Confirm backend activation and reading flow', '', '', 'Functional test passed; tracker shows Not Active'],
  [25, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0312', '', '', '', '', 'Tested', 'Not Active', 'No cell signal — fixed', 'Returned', '', '', '', '', new Date(Date.UTC(2026, 10, 2)), 'Metering operator', 'Restore current telemetry and complete stability monitoring', '', '', 'SteamaCo UI evidence: On; telemetry Offline (23 hours)'],
  [26, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0247', '', '', '', '', 'Tested', 'Not Active', '', '', '', '', '', '', new Date(Date.UTC(2026, 10, 3)), 'Metering operator', 'Confirm backend activation and reading flow', '', '', 'Functional test passed; tracker shows Not Active'],
  [27, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0189', '', '', '', '', 'Tested', 'Not Active', 'No cell signal — fixed', 'Returned', '', '', '', '', new Date(Date.UTC(2026, 10, 2)), 'Metering operator', 'Restore current telemetry and complete stability monitoring', '', '', 'SteamaCo UI evidence: On; telemetry Offline (1 day)'],
  [28, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0361', '', '', '', '', 'Tested', 'Not Active', 'Not connecting — fixed', 'Returned', '', '', '', '', new Date(Date.UTC(2026, 10, 2)), 'Metering operator', 'Restore current telemetry and complete stability monitoring', '', '', 'SteamaCo UI evidence: On; telemetry Offline (23 hours)'],
  [29, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0221', '', '', '', '', 'Tested', 'Not Active', 'Not connecting — fixed', 'Returned', '', '', '', '', new Date(Date.UTC(2026, 10, 2)), 'Metering operator', 'Restore current telemetry and complete stability monitoring', '', '', 'SteamaCo UI evidence: On; telemetry Offline (1 day)'],
  [30, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0387', '', '', '', '', 'Awaiting test', '', '', '', '', '', '', '', '', '', 'Run full bench test', '', '', ''],
  [31, 'SAVI 3 Phase Smart Meter', 'DS3600', '017925093 0353', '', '', '', '', 'Tested', 'Not Active', '', '', '', '', '', '', new Date(Date.UTC(2026, 10, 3)), 'Metering operator', 'Confirm backend activation and reading flow', '', '', 'Functional test passed; tracker shows Not Active']
];

const workingMeterIds = new Set([1, 2, 3, 14, 17, 19, 23, 24, 25, 26, 27, 28, 29, 31]);

const simPool = [
  ['SIM-01', '081 066 371 85', '', '', 'Available for controlled testing', '', '', 'Independent test-pool record; row position does not map to a meter'],
  ['SIM-02', '070 486 425 94', '', '', 'Available for controlled testing', '', '', 'Independent test-pool record; row position does not map to a meter'],
  ['SIM-03', '070 661 908 39', '', '', 'Available for controlled testing', '', '', 'Independent test-pool record; row position does not map to a meter'],
  ['SIM-04', '070 661 486 27', '', '', 'Available for controlled testing', '', '', 'Independent test-pool record; row position does not map to a meter'],
  ['SIM-05', '070 663 074 77', '', '', 'Available for controlled testing', '', '', 'Independent test-pool record; row position does not map to a meter'],
  ['SIM-06', '070 660 793 72', '', '', 'Available for controlled testing', '', '', 'Independent test-pool record; row position does not map to a meter']
];

const planTasks = [
  ['M01', 'Meter estate', 'Create controlled 31-meter register', 'Metering operator', 1, 3, 'Complete', '31 meters recorded', ''],
  ['M02', 'Meter estate', 'Bench-test every meter', 'Metering operator', 1, 14, 'In Progress', '14 working; 17 remaining', 'Test tools and SIM pool'],
  ['M03', 'Meter estate', 'Reconcile nameplate, firmware and backend serials', 'Metering operator', 1, 10, 'In Progress', 'Three-way identity match', 'Optical probe / IDIT'],
  ['M04', 'Meter estate', 'Verify GPRS module, SIM, APN and GSM signal', 'Metering operator', 1, 12, 'In Progress', 'Communications checklist', 'Working test SIMs'],
  ['V01', 'Vendor support', 'Complete five-meter SteamaCo escalation', 'Metering operator', 3, 9, 'Complete', '5 of 5 units functionally repaired', 'Attach serial-specific repair evidence'],
  ['V02', 'Vendor support', 'SteamaCo/OEM diagnosis and repair', 'SteamaCo / OEM', 4, 9, 'Complete', 'Four units fixed by 2 Nov; firmware unit fixed 3 Nov', 'Detailed repair notes'],
  ['V03', 'Vendor support', 'Retest returned meters against acceptance criteria', 'Metering operator', 8, 14, 'In Progress', 'Working result confirmed; readings and stability pending', 'V02'],
  ['V04', 'Vendor support', 'Monitor 24h, 72h and 7-day stability', 'Metering operator', 7, 21, 'In Progress', 'Stable last-seen and readings', 'Returned meters'],
  ['A01', 'Application MVP', 'Secure read-only engineering foundation', 'Technical lead', 1, 6, 'Complete', 'Runtime safety, schema and tests', 'Existing repository review'],
  ['A02', 'Application MVP', 'Live provider synchronization and mappings', 'Integration lead', 5, 14, 'In Progress', 'Repeatable read-only sync', 'Vendor credentials and API'],
  ['A03', 'Application MVP', 'Operations dashboard and exception view', 'Application team', 10, 20, 'Not Started', 'Management pilot screen', 'A02'],
  ['C01', 'Customer integration', 'Reconcile customers, service accounts and meters', 'Operations / billing', 8, 18, 'Not Started', 'Approved mapping register', 'Meter identity'],
  ['C02', 'Customer integration', 'Approve representative pilot cohort', 'Product / billing owner', 10, 16, 'Decision Required', 'Named pilot customers/meters', 'C01'],
  ['B01', 'Billing readiness', 'Approve pilot tariff and billing rules', 'Finance / billing owner', 10, 20, 'Decision Required', 'Approved policy decisions', 'Management decision'],
  ['B02', 'Billing readiness', 'Validate readings and consumption calculations', 'Metering / billing', 14, 23, 'Not Started', 'Traceable sample calculations', 'Stable readings'],
  ['B03', 'Billing readiness', 'Produce sample shadow bills', 'Billing team', 20, 27, 'Not Started', 'Reviewed sample bills', 'B01 and B02'],
  ['Q01', 'Pilot assurance', 'Run end-to-end read-only pilot validation', 'Project team', 21, 28, 'Not Started', 'Acceptance evidence pack', 'Pilot cohort'],
  ['Q02', 'Pilot assurance', 'MD demonstration and continuation register', 'Project lead', 28, 30, 'Not Started', 'Demo, decisions and owned exceptions', 'Q01'],
  ['O01', 'Governance', 'Issue daily progress scorecard', 'Project lead', 1, 30, 'In Progress', 'Daily numerical report', 'All workstreams']
];

const issues = [
  ['I-001', 'Technical issue', 'Firmware/nameplate serial mismatch', '1 meter', 'High', 'Complete', 'SteamaCo / OEM', 'Retain repair evidence and complete stability monitoring', new Date(Date.UTC(2026, 10, 3)), '017925093 0205 fixed by SteamaCo on 3 Nov 2026'],
  ['I-002', 'Technical issue', 'No cellular signal on submitted units', '2 meters', 'High', 'Complete', 'SteamaCo / metering operator', 'Retain repair evidence and complete telemetry monitoring', new Date(Date.UTC(2026, 10, 2)), '0179250930312 and 0179250930189 repaired'],
  ['I-003', 'Technical issue', 'Not-connecting submitted units', '2 meters', 'High', 'Complete', 'SteamaCo / metering operator', 'Retain repair evidence and complete telemetry monitoring', new Date(Date.UTC(2026, 10, 2)), '0179250930361 and 0179250930221 repaired'],
  ['I-004', 'Data-quality issue', 'Tracker says Active and Not Connected', '1 meter', 'High', 'In Progress', 'Metering operator', 'Verify backend state and current reading, then correct the tracker', '', '0179250930429'],
  ['I-005', 'Readiness issue', 'Meters remaining to be tested', '17 meters', 'Medium', 'In Progress', 'Metering operator', 'Complete the remaining test sequence', '', '14 of 31 tested and working as at 3 Nov 2026'],
  ['I-006', 'Assurance issue', 'Returned-meter telemetry and stability evidence', '5 repaired meters', 'High', 'In Progress', 'Metering operator', 'Capture current reading, backend-active state, 24h, 72h and 7-day stability results', '', 'Four connection units show On but telemetry Offline for 23 hours to 1 day; firmware unit is Not Active'],
  ['D-001', 'Management decision', 'Name accountable workstream owners', 'Project-wide', 'High', 'Decision Required', 'Executive sponsor', 'Name product, operations, billing, finance and technical owners', '', ''],
  ['D-002', 'Management decision', 'Approve pilot billing and tariff policy', 'Pilot', 'High', 'Decision Required', 'Finance / executive sponsor', 'Approve the controlled pilot rules before shadow billing', '', ''],
  ['D-003', 'Management decision', 'Approve pilot cohort', 'Representative meters/customers', 'Medium', 'Decision Required', 'Product / billing owner', 'Select source, bulk and customer meters with valid assignments', '', ''],
  ['H-001', 'Vendor hold', 'Formal API questionnaire', 'Vendor contract', 'Medium', 'On Hold', 'Vendor relationship owner', 'Resume only after the planned call with Mr. Marco', '', 'Internal hold by agreement']
];

function dateForDay(day) {
  const d = new Date(START_DATE);
  d.setUTCDate(d.getUTCDate() + day - 1);
  return d;
}

function fmtDate(d) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function statusColor(status) {
  const map = {
    'Complete': C.green,
    'In Progress': C.blue,
    'Not Started': C.darkSoft,
    'External Hold': C.red,
    'Decision Required': C.amber,
    'On Hold': C.purple
  };
  return map[status] || C.gray;
}

function addBrand(slide, number, section) {
  slide.addShape(pptx.ShapeType.line, { x: 0.55, y: 7.08, w: 12.2, h: 0, line: { color: C.line, width: 0.8 } });
  slide.addText('MICROACCESS  |  SMART METERING', {
    x: 0.58, y: 7.15, w: 3.2, h: 0.18, fontFace: 'Aptos', fontSize: 7.5,
    color: C.gray, charSpacing: 1.2, margin: 0
  });
  slide.addText(section, {
    x: 4.3, y: 7.15, w: 4.8, h: 0.18, fontFace: 'Aptos', fontSize: 7.5,
    color: C.gray, align: 'center', margin: 0
  });
  slide.addText(String(number).padStart(2, '0'), {
    x: 12.15, y: 7.13, w: 0.55, h: 0.22, fontFace: 'Aptos', fontSize: 8,
    bold: true, color: C.teal, align: 'right', margin: 0
  });
}

function addSlideTitle(slide, kicker, title, subtitle) {
  slide.addText(kicker.toUpperCase(), {
    x: 0.6, y: 0.38, w: 4.8, h: 0.22, fontFace: 'Aptos', fontSize: 8,
    bold: true, color: C.teal, charSpacing: 1.8, margin: 0
  });
  slide.addText(title, {
    x: 0.6, y: 0.7, w: 12.0, h: 0.56, fontFace: 'Aptos Display', fontSize: 25,
    bold: true, color: C.navy, margin: 0, breakLine: false, fit: 'shrink'
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.6, y: 1.31, w: 11.8, h: 0.36, fontFace: 'Aptos', fontSize: 11,
      color: C.gray, margin: 0, fit: 'shrink'
    });
  }
}

function addPill(slide, text, x, y, w, color, textColor) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: x, y: y, w: w, h: 0.32, rectRadius: 0.06,
    fill: { color: color }, line: { color: color, transparency: 100 }
  });
  slide.addText(text, {
    x: x + 0.08, y: y + 0.055, w: w - 0.16, h: 0.19, fontFace: 'Aptos',
    fontSize: 8, bold: true, color: textColor || C.white, align: 'center', margin: 0,
    fit: 'shrink'
  });
}

function addKpi(slide, x, y, w, value, label, note, accent) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: x, y: y, w: w, h: 1.25, rectRadius: 0.05,
    fill: { color: C.white }, line: { color: C.line, width: 0.8 },
    shadow: { type: 'outer', color: 'AAB7C4', blur: 1.5, angle: 45, distance: 1, opacity: 0.12 }
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: x, y: y, w: 0.07, h: 1.25, fill: { color: accent }, line: { color: accent, transparency: 100 }
  });
  slide.addText(String(value), {
    x: x + 0.22, y: y + 0.17, w: w - 0.36, h: 0.42, fontFace: 'Aptos Display',
    fontSize: 25, bold: true, color: C.navy, margin: 0, fit: 'shrink'
  });
  slide.addText(label, {
    x: x + 0.22, y: y + 0.65, w: w - 0.36, h: 0.22, fontFace: 'Aptos',
    fontSize: 9.5, bold: true, color: C.ink, margin: 0, fit: 'shrink'
  });
  slide.addText(note, {
    x: x + 0.22, y: y + 0.94, w: w - 0.36, h: 0.18, fontFace: 'Aptos',
    fontSize: 7.5, color: C.gray, margin: 0, fit: 'shrink'
  });
}

function addIssueCard(slide, x, y, w, count, title, description, accent, tag) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: x, y: y, w: w, h: 2.0, rectRadius: 0.05,
    fill: { color: C.white }, line: { color: C.line, width: 0.8 }
  });
  slide.addShape(pptx.ShapeType.ellipse, {
    x: x + 0.22, y: y + 0.24, w: 0.58, h: 0.58,
    fill: { color: accent }, line: { color: accent, transparency: 100 }
  });
  slide.addText(String(count), {
    x: x + 0.22, y: y + 0.345, w: 0.58, h: 0.23, fontFace: 'Aptos Display',
    fontSize: 15, bold: true, color: C.white, align: 'center', margin: 0
  });
  addPill(slide, tag, x + w - 1.08, y + 0.27, 0.86, C.light, C.gray);
  slide.addText(title, {
    x: x + 0.22, y: y + 0.96, w: w - 0.44, h: 0.33, fontFace: 'Aptos Display',
    fontSize: 14, bold: true, color: C.navy, margin: 0, fit: 'shrink'
  });
  slide.addText(description, {
    x: x + 0.22, y: y + 1.36, w: w - 0.44, h: 0.42, fontFace: 'Aptos',
    fontSize: 9, color: C.gray, margin: 0.01, valign: 'mid', fit: 'shrink'
  });
}

function addWorkstream(slide, x, y, w, num, title, line1, line2, accent) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: x, y: y, w: w, h: 1.68, rectRadius: 0.05,
    fill: { color: C.white }, line: { color: C.line, width: 0.8 }
  });
  slide.addText(num, {
    x: x + 0.2, y: y + 0.18, w: 0.48, h: 0.35, fontFace: 'Aptos Display', fontSize: 17,
    bold: true, color: accent, margin: 0
  });
  slide.addText(title, {
    x: x + 0.72, y: y + 0.22, w: w - 0.94, h: 0.28, fontFace: 'Aptos Display',
    fontSize: 14, bold: true, color: C.navy, margin: 0, fit: 'shrink'
  });
  slide.addShape(pptx.ShapeType.line, {
    x: x + 0.2, y: y + 0.68, w: w - 0.4, h: 0, line: { color: C.line, width: 0.7 }
  });
  slide.addText('• ' + line1 + '\n• ' + line2, {
    x: x + 0.24, y: y + 0.85, w: w - 0.48, h: 0.58, fontFace: 'Aptos',
    fontSize: 9.2, color: C.ink, breakLine: false, margin: 0.01, breakLineOnOverflow: false,
    fit: 'shrink', paraSpaceAfterPt: 4
  });
}

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'MicroAccess Smart Metering Project';
pptx.company = 'MicroAccess';
pptx.subject = '30-Day Meter Stabilisation and Application MVP Plan';
pptx.title = 'MicroAccess Smart Metering – 30-Day Executive Delivery Plan';
pptx.lang = 'en-NG';
pptx.theme = {
  headFontFace: 'Aptos Display',
  bodyFontFace: 'Aptos',
  lang: 'en-NG'
};
pptx.defineSlideMaster({
  title: 'MSM_MASTER',
  background: { color: C.light },
  objects: [],
  slideNumber: { x: 12.15, y: 7.13, color: C.teal, fontFace: 'Aptos', fontSize: 8 }
});
pptx.layout = 'LAYOUT_WIDE';
pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'en-NG' };

// Slide 1 — Cover
{
  const slide = pptx.addSlide();
  slide.background = { color: C.navy };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 4.65, h: 7.5, fill: { color: '102A43' }, line: { color: '102A43', transparency: 100 }
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 4.65, y: 0, w: 0.12, h: 7.5, fill: { color: C.aqua }, line: { color: C.aqua, transparency: 100 }
  });
  for (let i = 0; i < 6; i++) {
    slide.addShape(pptx.ShapeType.ellipse, {
      x: 8.65 + (i % 3) * 1.18, y: 0.85 + Math.floor(i / 3) * 1.18, w: 0.9, h: 0.9,
      fill: { color: i === 0 ? C.teal : '183B56', transparency: i === 0 ? 0 : 16 },
      line: { color: i === 0 ? C.aqua : '2E526F', width: 0.8 }
    });
  }
  slide.addShape(pptx.ShapeType.line, { x: 9.1, y: 1.3, w: 2.36, h: 1.18, line: { color: C.aqua, transparency: 45, width: 1.5 } });
  slide.addShape(pptx.ShapeType.line, { x: 10.28, y: 1.3, w: 1.18, h: 1.18, line: { color: C.aqua, transparency: 45, width: 1.5 } });
  addPill(slide, 'EXECUTIVE DELIVERY PLAN', 0.72, 0.74, 2.25, C.teal, C.white);
  slide.addText('30-Day Meter\nStabilisation &\nApplication MVP', {
    x: 0.72, y: 1.48, w: 6.85, h: 2.2, fontFace: 'Aptos Display', fontSize: 31,
    bold: true, color: C.white, margin: 0, breakLine: false, fit: 'shrink', valign: 'mid'
  });
  slide.addText('A measurable working pilot—supported by daily evidence, vendor accountability and a controlled continuation register.', {
    x: 0.75, y: 4.05, w: 6.9, h: 0.82, fontFace: 'Aptos', fontSize: 14.5,
    color: 'D9EAF2', margin: 0, fit: 'shrink', breakLine: false
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 8.1, y: 4.05, w: 4.4, h: 1.66, rectRadius: 0.06,
    fill: { color: '102A43' }, line: { color: '31556F', width: 0.8 }
  });
  slide.addText('DAY 9 UPDATE', {
    x: 8.42, y: 4.37, w: 1.7, h: 0.22, fontFace: 'Aptos', fontSize: 8,
    bold: true, color: C.aqua, charSpacing: 1.5, margin: 0
  });
  slide.addText('14', {
    x: 8.38, y: 4.72, w: 1.15, h: 0.52, fontFace: 'Aptos Display', fontSize: 28,
    bold: true, color: C.white, margin: 0
  });
  slide.addText('meters tested & working', {
    x: 9.35, y: 4.86, w: 2.7, h: 0.24, fontFace: 'Aptos', fontSize: 11,
    color: 'D9EAF2', margin: 0
  });
  slide.addText('Started Monday, 26 October 2026  •  Position at Tuesday, 3 November 2026  •  14 of 31 working', {
    x: 0.75, y: 6.73, w: 9.7, h: 0.25, fontFace: 'Aptos', fontSize: 9,
    color: 'AFC6D5', margin: 0
  });
  slide.addText('MICROACCESS', {
    x: 10.55, y: 6.65, w: 1.95, h: 0.28, fontFace: 'Aptos', fontSize: 9,
    bold: true, color: C.white, charSpacing: 2.1, align: 'right', margin: 0
  });
}

// Slide 2 — Day 9 snapshot
{
  const slide = pptx.addSlide();
  slide.background = { color: C.light };
  addSlideTitle(slide, 'Current position', 'Day 9 progress snapshot', 'Vendor repairs are complete, testing continues, and 45% of the estate is now confirmed working.');
  addKpi(slide, 0.6, 1.92, 2.26, 31, 'Meters inventoried', 'Estate register complete', C.teal);
  addKpi(slide, 3.03, 1.92, 2.26, 14, 'Tested & working', '45% of the estate', C.green);
  addKpi(slide, 5.46, 1.92, 2.26, 5, 'SteamaCo fixes', '5 of 5 working', C.blue);
  addKpi(slide, 7.89, 1.92, 2.26, 3, 'Recovered today', 'Continued local testing', C.purple);
  addKpi(slide, 10.32, 1.92, 2.26, 17, 'Remaining to test', 'Next test queue', C.amber);

  slide.addText('Testing coverage', {
    x: 0.68, y: 3.58, w: 2.0, h: 0.25, fontFace: 'Aptos Display', fontSize: 13,
    bold: true, color: C.navy, margin: 0
  });
  slide.addText('14 of 31 meters are confirmed tested and working', {
    x: 2.42, y: 3.61, w: 4.2, h: 0.2, fontFace: 'Aptos', fontSize: 9,
    color: C.gray, margin: 0
  });
  const barX = 0.68;
  const barY = 4.02;
  const barW = 11.88;
  slide.addShape(pptx.ShapeType.roundRect, {
    x: barX, y: barY, w: barW, h: 0.44, rectRadius: 0.08,
    fill: { color: C.soft }, line: { color: C.soft, transparency: 100 }
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: barX, y: barY, w: barW * 14 / 31, h: 0.44, rectRadius: 0.08,
    fill: { color: C.green }, line: { color: C.green, transparency: 100 }
  });
  slide.addText('45%', {
    x: barX + 4.55, y: barY + 0.11, w: 0.56, h: 0.18, fontFace: 'Aptos', fontSize: 8.5,
    bold: true, color: C.white, align: 'center', margin: 0
  });

  const bands = [
    [0.68, 4.93, 3.72, C.green, '14', 'WORKING TOTAL', 'Confirmed tested and working'],
    [4.55, 4.93, 3.72, C.blue, '2', 'BACKEND ACTIVE', 'Confirmed active in the updated tracker'],
    [8.42, 4.93, 4.14, C.amber, '17', 'REMAINING', 'Testing continues meter by meter']
  ];
  bands.forEach(function (b) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: b[0], y: b[1], w: b[2], h: 1.17, rectRadius: 0.04,
      fill: { color: C.white }, line: { color: C.line, width: 0.8 }
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: b[0], y: b[1], w: 0.09, h: 1.17, fill: { color: b[3] }, line: { color: b[3], transparency: 100 }
    });
    slide.addText(b[4], {
      x: b[0] + 0.26, y: b[1] + 0.2, w: 0.7, h: 0.4, fontFace: 'Aptos Display',
      fontSize: 23, bold: true, color: C.navy, margin: 0
    });
    slide.addText(b[5], {
      x: b[0] + 1.03, y: b[1] + 0.22, w: b[2] - 1.27, h: 0.22, fontFace: 'Aptos',
      fontSize: 9, bold: true, color: b[3], margin: 0, fit: 'shrink'
    });
    slide.addText(b[6], {
      x: b[0] + 1.03, y: b[1] + 0.55, w: b[2] - 1.27, h: 0.34, fontFace: 'Aptos',
      fontSize: 8.3, color: C.gray, margin: 0, fit: 'shrink'
    });
  });
  addPill(slide, 'UPDATE • 3 NOV 2026', 9.95, 6.43, 2.6, C.navy, C.white);
  addBrand(slide, 2, 'Executive baseline');
}

// Slide 3 — Vendor recovery
{
  const slide = pptx.addSlide();
  slide.background = { color: C.light };
  addSlideTitle(slide, 'Recovery outcome', 'All five submitted faults were repaired', 'Functional recovery is confirmed; current backend telemetry and stability remain the next acceptance gate.');
  addIssueCard(slide, 0.6, 1.93, 2.9, 4, 'Connection units fixed', 'Reported working by Monday; UI shows On but telemetry remains offline for 23h–1 day.', C.blue, 'REPAIRED');
  addIssueCard(slide, 3.7, 1.93, 2.9, 1, 'Firmware unit fixed', 'Mismatch repaired Tuesday; updated tracker still shows the unit as Not Active.', C.purple, 'REPAIRED');
  addIssueCard(slide, 6.8, 1.93, 2.9, 3, 'Additional recoveries', 'Continued testing recovered three more meters on Tuesday.', C.teal, 'TODAY');
  addIssueCard(slide, 9.9, 1.93, 2.82, 14, 'Working total', 'Fourteen of the thirty-one meters are now confirmed tested and working.', C.green, '45%');

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: 4.28, w: 12.12, h: 1.55, rectRadius: 0.05,
    fill: { color: C.navy }, line: { color: C.navy, transparency: 100 }
  });
  slide.addText('Returned-meter assurance', {
    x: 0.92, y: 4.61, w: 2.65, h: 0.31, fontFace: 'Aptos Display', fontSize: 14,
    bold: true, color: C.white, margin: 0
  });
  slide.addText('01  Three-way serial match', {
    x: 3.62, y: 4.57, w: 1.72, h: 0.34, fontFace: 'Aptos', fontSize: 9,
    bold: true, color: 'D9EAF2', margin: 0, fit: 'shrink'
  });
  slide.addText('02  GSM network detected', {
    x: 5.45, y: 4.57, w: 1.78, h: 0.34, fontFace: 'Aptos', fontSize: 9,
    bold: true, color: 'D9EAF2', margin: 0, fit: 'shrink'
  });
  slide.addText('03  TCP/backend online', {
    x: 7.38, y: 4.57, w: 1.75, h: 0.34, fontFace: 'Aptos', fontSize: 9,
    bold: true, color: 'D9EAF2', margin: 0, fit: 'shrink'
  });
  slide.addText('04  Current reading received', {
    x: 9.22, y: 4.57, w: 1.82, h: 0.34, fontFace: 'Aptos', fontSize: 9,
    bold: true, color: 'D9EAF2', margin: 0, fit: 'shrink'
  });
  slide.addText('05  24h stability passed', {
    x: 11.13, y: 4.57, w: 1.3, h: 0.34, fontFace: 'Aptos', fontSize: 9,
    bold: true, color: 'D9EAF2', margin: 0, fit: 'shrink'
  });
  slide.addShape(pptx.ShapeType.line, { x: 3.56, y: 5.06, w: 8.88, h: 0, line: { color: '31556F', width: 0.8 } });
  slide.addText('Control note', {
    x: 0.92, y: 5.15, w: 1.1, h: 0.2, fontFace: 'Aptos', fontSize: 8,
    bold: true, color: C.aqua, margin: 0
  });
  slide.addText('Original four: 0179250930312 • 0179250930361 • 0179250930221 • 0179250930189. Current telemetry must still be restored.', {
    x: 2.02, y: 5.12, w: 9.9, h: 0.28, fontFace: 'Aptos', fontSize: 8.7,
    color: 'D9EAF2', margin: 0, fit: 'shrink'
  });
  addPill(slide, 'REPAIRS COMPLETE • BACKEND READING AND STABILITY EVIDENCE PENDING', 3.55, 6.31, 6.25, C.paleTeal, C.teal);
  addBrand(slide, 3, 'Meter and vendor work');
}

// Slide 4 — Workstreams
{
  const slide = pptx.addSlide();
  slide.background = { color: C.light };
  addSlideTitle(slide, 'Delivery model', 'Four workstreams move together', 'Meter work produces the evidence that customer integration and billing depend on.');
  addWorkstream(slide, 0.6, 1.9, 5.92, '01', 'Meter stabilisation', 'Test and reconcile all 31 meters', 'Resolve identity, SIM, signal and connection exceptions', C.teal);
  addWorkstream(slide, 6.8, 1.9, 5.92, '02', 'Vendor & connectivity', 'Five submitted faults repaired', 'Restore telemetry and prove 24h / 72h / 7-day stability', C.red);
  addWorkstream(slide, 0.6, 3.86, 5.92, '03', 'Application MVP', 'Read-only provider integration and operations view', 'Evidence-led dashboard, exceptions and audit trail', C.blue);
  addWorkstream(slide, 6.8, 3.86, 5.92, '04', 'Customer & billing readiness', 'Approve meter-to-customer mappings and pilot cohort', 'Validate readings and produce controlled shadow bills', C.amber);

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: 5.91, w: 12.12, h: 0.57, rectRadius: 0.05,
    fill: { color: C.navy }, line: { color: C.navy, transparency: 100 }
  });
  slide.addText('Daily control', {
    x: 0.86, y: 6.08, w: 1.12, h: 0.19, fontFace: 'Aptos', fontSize: 8.5,
    bold: true, color: C.aqua, margin: 0
  });
  slide.addText('Every workstream reports completed evidence, numbers moved, blockers, owner and next-day action.', {
    x: 2.02, y: 6.06, w: 8.72, h: 0.22, fontFace: 'Aptos', fontSize: 9.5,
    color: C.white, margin: 0, fit: 'shrink'
  });
  addPill(slide, 'ONE PLAN', 11.18, 6.02, 1.18, C.teal, C.white);
  addBrand(slide, 4, 'Integrated delivery');
}

// Slide 5 — 30-day Gantt
{
  const slide = pptx.addSlide();
  slide.background = { color: C.light };
  addSlideTitle(slide, '30-day sprint', 'A working pilot in four delivery waves', 'The month creates demonstrable capability and an owned continuation register—not an unsupported production promise.');
  const xLabel = 0.62;
  const xGrid = 4.25;
  const weekW = 2.08;
  const top = 2.03;
  const rowH = 0.62;
  const headers = [
    ['WEEK 1', 'CONTROL', 'Days 1–7'],
    ['WEEK 2', 'CONNECT', 'Days 8–14'],
    ['WEEK 3', 'INTEGRATE', 'Days 15–21'],
    ['WEEK 4', 'VALIDATE', 'Days 22–30']
  ];
  headers.forEach(function (h, i) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: xGrid + i * weekW, y: top, w: weekW - 0.08, h: 0.7, rectRadius: 0.04,
      fill: { color: i === 0 ? C.teal : C.navy }, line: { color: i === 0 ? C.teal : C.navy, transparency: 100 }
    });
    slide.addText(h[0], {
      x: xGrid + i * weekW + 0.14, y: top + 0.12, w: 0.7, h: 0.17, fontFace: 'Aptos',
      fontSize: 7.5, bold: true, color: C.aqua, margin: 0
    });
    slide.addText(h[1], {
      x: xGrid + i * weekW + 0.14, y: top + 0.31, w: 1.25, h: 0.22, fontFace: 'Aptos',
      fontSize: 10.2, bold: true, color: C.white, margin: 0
    });
    slide.addText(h[2], {
      x: xGrid + i * weekW + 1.25, y: top + 0.14, w: 0.58, h: 0.16, fontFace: 'Aptos',
      fontSize: 6.8, color: 'BCD0DD', align: 'right', margin: 0
    });
  });
  const ganttRows = [
    ['Meter control & identity', 0, 1, C.teal, 'IN PROGRESS'],
    ['SteamaCo diagnosis & repair', 0, 1, C.green, '5 FIXED'],
    ['Read-only application MVP', 0, 3, C.blue, 'STARTED'],
    ['Customer mapping & pilot', 1, 3, C.purple, 'PLANNED'],
    ['Reading validation & shadow bills', 2, 3, C.amber, 'PLANNED'],
    ['Pilot test, demo & continuation', 3, 3, C.green, 'PLANNED']
  ];
  ganttRows.forEach(function (r, idx) {
    const y = top + 0.94 + idx * rowH;
    slide.addText(r[0], {
      x: xLabel, y: y + 0.12, w: 3.24, h: 0.22, fontFace: 'Aptos', fontSize: 9.6,
      bold: idx < 3, color: C.ink, margin: 0, fit: 'shrink'
    });
    for (let i = 0; i < 4; i++) {
      slide.addShape(pptx.ShapeType.rect, {
        x: xGrid + i * weekW, y: y, w: weekW - 0.08, h: 0.48,
        fill: { color: i % 2 === 0 ? C.white : 'F0F4F8' }, line: { color: C.line, width: 0.4 }
      });
    }
    const sx = xGrid + r[1] * weekW + 0.09;
    const sw = (r[2] - r[1] + 1) * weekW - 0.26;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: sx, y: y + 0.1, w: sw, h: 0.28, rectRadius: 0.04,
      fill: { color: r[3] }, line: { color: r[3], transparency: 100 }
    });
    slide.addText(r[4], {
      x: sx + 0.12, y: y + 0.155, w: Math.min(sw - 0.2, 1.04), h: 0.14,
      fontFace: 'Aptos', fontSize: 6.7, bold: true, color: C.white, margin: 0, fit: 'shrink'
    });
  });
  slide.addShape(pptx.ShapeType.line, {
    x: xGrid + weekW + (2 / 7) * weekW, y: top - 0.08, w: 0, h: 4.86,
    line: { color: C.red, width: 1.4, dash: 'dash' }
  });
  addPill(slide, 'TODAY • DAY 9', xGrid + weekW + (2 / 7) * weekW - 0.58, 6.57, 1.16, C.red, C.white);
  addBrand(slide, 5, '30-day pilot plan');
}

// Slide 6 — Daily assurance
{
  const slide = pptx.addSlide();
  slide.background = { color: C.light };
  addSlideTitle(slide, 'Management assurance', 'Progress is visible every day', 'The daily report separates completed evidence, cumulative movement, blockers and tomorrow’s priorities.');
  const steps = [
    ['01', 'WORK DONE', 'Meters, application, customer and billing activities completed'],
    ['02', 'NUMBERS MOVED', 'Cumulative inspection, online, stable, mapped and validated counts'],
    ['03', 'EVIDENCE', 'Photos, readings, test output, handover record or application demonstration'],
    ['04', 'BLOCKERS', 'Named dependency, owner, decision required and due date'],
    ['05', 'NEXT DAY', 'Concrete actions and expected measurable outcome']
  ];
  steps.forEach(function (s, i) {
    const x = 0.62 + i * 2.48;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: x, y: 1.94, w: 2.25, h: 2.02, rectRadius: 0.05,
      fill: { color: C.white }, line: { color: C.line, width: 0.8 }
    });
    slide.addText(s[0], {
      x: x + 0.2, y: 2.18, w: 0.48, h: 0.3, fontFace: 'Aptos Display', fontSize: 16,
      bold: true, color: i === 3 ? C.red : C.teal, margin: 0
    });
    slide.addText(s[1], {
      x: x + 0.2, y: 2.68, w: 1.78, h: 0.24, fontFace: 'Aptos', fontSize: 9,
      bold: true, color: C.navy, margin: 0, fit: 'shrink'
    });
    slide.addText(s[2], {
      x: x + 0.2, y: 3.08, w: 1.8, h: 0.56, fontFace: 'Aptos', fontSize: 8.4,
      color: C.gray, margin: 0, fit: 'shrink', valign: 'top'
    });
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.62, y: 4.42, w: 12.02, h: 1.38, rectRadius: 0.05,
    fill: { color: C.navy }, line: { color: C.navy, transparency: 100 }
  });
  slide.addText('TODAY’S ASSURANCE', {
    x: 0.92, y: 4.75, w: 1.85, h: 0.22, fontFace: 'Aptos', fontSize: 8,
    bold: true, color: C.aqua, charSpacing: 1.2, margin: 0
  });
  slide.addText('31', { x: 3.05, y: 4.67, w: 0.72, h: 0.46, fontFace: 'Aptos Display', fontSize: 24, bold: true, color: C.white, margin: 0 });
  slide.addText('inventory', { x: 3.05, y: 5.16, w: 0.9, h: 0.17, fontFace: 'Aptos', fontSize: 7.5, color: 'BCD0DD', margin: 0 });
  slide.addText('14', { x: 4.42, y: 4.67, w: 0.72, h: 0.46, fontFace: 'Aptos Display', fontSize: 24, bold: true, color: C.white, margin: 0 });
  slide.addText('working', { x: 4.42, y: 5.16, w: 0.9, h: 0.17, fontFace: 'Aptos', fontSize: 7.5, color: 'BCD0DD', margin: 0 });
  slide.addText('5', { x: 5.77, y: 4.67, w: 0.52, h: 0.46, fontFace: 'Aptos Display', fontSize: 24, bold: true, color: C.white, margin: 0 });
  slide.addText('vendor fixes', { x: 5.77, y: 5.16, w: 0.9, h: 0.17, fontFace: 'Aptos', fontSize: 7.5, color: 'BCD0DD', margin: 0 });
  slide.addText('3', { x: 6.96, y: 4.67, w: 0.52, h: 0.46, fontFace: 'Aptos Display', fontSize: 24, bold: true, color: C.white, margin: 0 });
  slide.addText('recovered today', { x: 6.96, y: 5.16, w: 1.08, h: 0.17, fontFace: 'Aptos', fontSize: 7.5, color: 'BCD0DD', margin: 0 });
  slide.addText('17', { x: 8.27, y: 4.67, w: 0.52, h: 0.46, fontFace: 'Aptos Display', fontSize: 24, bold: true, color: C.white, margin: 0 });
  slide.addText('remaining', { x: 8.27, y: 5.16, w: 1.2, h: 0.17, fontFace: 'Aptos', fontSize: 7.5, color: 'BCD0DD', margin: 0 });
  slide.addText('Report by close of business  •  Friday evidence review  •  Weekly management demonstration', {
    x: 9.47, y: 4.77, w: 2.8, h: 0.52, fontFace: 'Aptos', fontSize: 8.7,
    bold: true, color: 'D9EAF2', margin: 0, fit: 'shrink'
  });
  addPill(slide, 'BACKED BY THE LIVE EXCEL TRACKER', 4.74, 6.28, 3.72, C.paleBlue, C.blue);
  addBrand(slide, 6, 'Daily reporting');
}

// Slide 7 — Definition of done
{
  const slide = pptx.addSlide();
  slide.background = { color: C.light };
  addSlideTitle(slide, 'Month-end commitment', 'What management should expect by Day 30', 'A controlled working pilot with measurable evidence and transparent unresolved dependencies.');
  const done = [
    ['31/31', 'Every meter classified', 'Identity, communications, status and next action recorded'],
    ['PILOT', 'Representative meters stable', 'Online, reading and stability evidence captured'],
    ['MAPPED', 'Customers linked correctly', 'Approved service-account and meter relationships'],
    ['VISIBLE', 'Operations MVP demonstrated', 'Read-only provider, meter and exception visibility'],
    ['PROVEN', 'Sample shadow billing', 'Traceable calculations without affecting live balances'],
    ['OWNED', 'Continuation register', 'Every remaining issue has an owner, dependency and target']
  ];
  done.forEach(function (d, i) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.62 + col * 4.08;
    const y = 1.89 + row * 1.5;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: x, y: y, w: 3.8, h: 1.22, rectRadius: 0.05,
      fill: { color: C.white }, line: { color: C.line, width: 0.8 }
    });
    addPill(slide, d[0], x + 0.2, y + 0.2, 0.92, i === 0 ? C.teal : C.navy, C.white);
    slide.addText(d[1], {
      x: x + 1.28, y: y + 0.22, w: 2.25, h: 0.25, fontFace: 'Aptos Display',
      fontSize: 11.5, bold: true, color: C.navy, margin: 0, fit: 'shrink'
    });
    slide.addText(d[2], {
      x: x + 1.28, y: y + 0.59, w: 2.22, h: 0.38, fontFace: 'Aptos',
      fontSize: 8.2, color: C.gray, margin: 0, fit: 'shrink'
    });
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.62, y: 5.13, w: 8.08, h: 1.06, rectRadius: 0.05,
    fill: { color: C.navy }, line: { color: C.navy, transparency: 100 }
  });
  slide.addText('Management support required now', {
    x: 0.92, y: 5.42, w: 2.25, h: 0.26, fontFace: 'Aptos Display', fontSize: 13,
    bold: true, color: C.white, margin: 0
  });
  slide.addText('Restore telemetry for repaired units • continue the remaining 17 tests • approve the pilot cohort • close priority billing-policy decisions', {
    x: 3.18, y: 5.34, w: 5.08, h: 0.4, fontFace: 'Aptos', fontSize: 8.8,
    color: 'D9EAF2', margin: 0, fit: 'shrink'
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 8.96, y: 5.13, w: 3.76, h: 1.06, rectRadius: 0.05,
    fill: { color: C.paleAmber }, line: { color: C.amber, width: 0.9 }
  });
  slide.addText('Boundary', {
    x: 9.24, y: 5.36, w: 0.82, h: 0.2, fontFace: 'Aptos', fontSize: 8,
    bold: true, color: C.amber, margin: 0
  });
  slide.addText('Production payments, live credit and remote commands remain gated until vendor and finance controls are proven.', {
    x: 10.08, y: 5.29, w: 2.34, h: 0.48, fontFace: 'Aptos', fontSize: 8.2,
    color: C.ink, margin: 0, fit: 'shrink'
  });
  addPill(slide, 'WORKING PILOT • DAILY EVIDENCE • CONTROLLED CONTINUATION', 3.67, 6.48, 6.02, C.teal, C.white);
  addBrand(slide, 7, 'Month-end outcome');
}

function setSheetTitle(ws, title, subtitle, endCol) {
  ws.mergeCells('A1:' + endCol + '2');
  ws.getCell('A1').value = title;
  ws.getCell('A1').font = { name: 'Aptos Display', size: 22, bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.navy } };
  ws.mergeCells('A3:' + endCol + '3');
  ws.getCell('A3').value = subtitle;
  ws.getCell('A3').font = { name: 'Aptos', size: 10, color: { argb: 'FF' + C.gray } };
  ws.getCell('A3').alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 28;
  ws.getRow(2).height = 12;
  ws.getRow(3).height = 24;
}

function styleHeader(row, fillColor) {
  row.eachCell({ includeEmpty: true }, function (cell) {
    cell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (fillColor || C.teal) } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF' + C.white } },
      left: { style: 'thin', color: { argb: 'FF' + C.white } },
      bottom: { style: 'thin', color: { argb: 'FF' + C.white } },
      right: { style: 'thin', color: { argb: 'FF' + C.white } }
    };
  });
  row.height = 34;
}

function styleBody(ws, startRow, endRow, startCol, endCol) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = ws.getCell(r, c);
      cell.font = { name: 'Aptos', size: 9, color: { argb: 'FF' + C.ink } };
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FF' + C.line } },
        right: { style: 'hair', color: { argb: 'FF' + C.line } }
      };
      if (r % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    }
  }
}

function fillMerged(ws, range, value, fillColor, fontColor, fontSize, bold, align) {
  ws.mergeCells(range);
  const cell = ws.getCell(range.split(':')[0]);
  cell.value = value;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + fillColor } };
  cell.font = { name: 'Aptos', size: fontSize || 10, bold: Boolean(bold), color: { argb: 'FF' + fontColor } };
  cell.alignment = { vertical: 'middle', horizontal: align || 'center', wrapText: true };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FF' + C.line } },
    left: { style: 'thin', color: { argb: 'FF' + C.line } },
    bottom: { style: 'thin', color: { argb: 'FF' + C.line } },
    right: { style: 'thin', color: { argb: 'FF' + C.line } }
  };
}

async function buildWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MicroAccess Smart Metering Project';
  wb.lastModifiedBy = 'MicroAccess Smart Metering Project';
  wb.created = REPORT_DATE;
  wb.modified = REPORT_DATE;
  wb.subject = '30-Day Meter Stabilisation and Application MVP management tracker';
  wb.title = 'MicroAccess Smart Metering Management Tracker';
  wb.company = 'MicroAccess';
  wb.calcProperties.fullCalcOnLoad = true;
  wb.calcProperties.forceFullCalc = true;
  wb.definedNames.add("'Meter Register'!$D$6:$D$36", 'MeterSerials');

  // Executive dashboard
  {
    const ws = wb.addWorksheet('Executive Dashboard', {
      views: [{ showGridLines: false, state: 'frozen', ySplit: 3 }]
    });
    for (let i = 1; i <= 32; i++) ws.getColumn(i).width = i === 1 ? 2.5 : 4.2;
    setSheetTitle(ws, '30-Day Meter Stabilisation & Application MVP', 'Executive dashboard • Day 9 position • Data as at 3 November 2026', 'AF');

    fillMerged(ws, 'B5:F5', 'TOTAL METERS', C.teal, C.white, 9, true);
    fillMerged(ws, 'B6:F8', { formula: "COUNTA('Meter Register'!$A$6:$A$36)", result: 31 }, C.white, C.navy, 26, true);
    fillMerged(ws, 'H5:L5', 'TESTED & WORKING', C.green, C.white, 9, true);
    fillMerged(ws, 'H6:L8', { formula: "COUNTIF('Meter Register'!$W$6:$W$36,\"Working\")", result: 14 }, C.white, C.navy, 26, true);
    fillMerged(ws, 'N5:R5', 'STEAMACO FIXES', C.blue, C.white, 9, true);
    fillMerged(ws, 'N6:R8', { formula: "COUNTIF('Meter Register'!$L$6:$L$36,\"Returned\")", result: 5 }, C.white, C.navy, 26, true);
    fillMerged(ws, 'T5:X5', 'RECOVERED TODAY', C.purple, C.white, 9, true);
    fillMerged(ws, 'T6:X8', { formula: "LOOKUP(2,1/('Daily Report'!$D$6:$D$35<>\"\"),'Daily Report'!$D$6:$D$35)", result: 3 }, C.white, C.navy, 26, true);
    fillMerged(ws, 'Z5:AD5', 'REMAINING TO TEST', C.amber, C.white, 9, true);
    fillMerged(ws, 'Z6:AD8', { formula: 'B6-H6', result: 17 }, C.white, C.navy, 26, true);

    ws.mergeCells('B10:AF10');
    ws.getCell('B10').value = 'TESTED & WORKING • 14 OF 31 METERS • 45%';
    ws.getCell('B10').font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF' + C.navy } };
    ws.getCell('B10').alignment = { horizontal: 'left', vertical: 'middle' };
    for (let col = 2; col <= 32; col++) {
      const cell = ws.getCell(12, col);
      let color = C.soft;
      if (col <= 15) color = C.green;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color } };
      cell.border = { right: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
    }
    ws.getRow(12).height = 20;
    fillMerged(ws, 'B14:F14', '14 TESTED & WORKING', C.paleTeal, C.green, 9, true);
    fillMerged(ws, 'H14:L14', '5 OF 5 VENDOR FIXES', C.paleBlue, C.blue, 9, true);
    fillMerged(ws, 'N14:R14', '3 RECOVERED TODAY', 'F0EDFF', C.purple, 9, true);
    fillMerged(ws, 'T14:X14', '17 REMAINING', C.paleAmber, C.amber, 9, true);
    fillMerged(ws, 'Z14:AF14', 'DAY 9 • 3 NOVEMBER 2026', C.navy, C.white, 9, true);

    fillMerged(ws, 'B17:P17', 'ACHIEVED BY DAY 9', C.navy, C.white, 10, true, 'left');
    fillMerged(ws, 'B18:P23',
      '• 14 of 31 meters tested and working\n• Four connectivity units fixed by SteamaCo by 2 November\n• Firmware-mismatch unit fixed by SteamaCo on 3 November\n• 5 of 5 vendor-submitted units now working\n• Three additional meters recovered during continued testing today\n• Read-only application foundation remains established',
      C.white, C.ink, 10, false, 'left');
    fillMerged(ws, 'R17:AF17', 'IMMEDIATE NEXT ACTIONS', C.teal, C.white, 10, true, 'left');
    fillMerged(ws, 'R18:AF23',
      '• Attach detailed SteamaCo repair notes for all five serials\n• Restore current telemetry for the repaired units\n• Continue testing the remaining 17 meters\n• Capture 24h / 72h stability evidence\n• Reconcile nameplate, firmware and backend identities\n• Advance live read-only synchronization and pilot mappings',
      C.white, C.ink, 10, false, 'left');

    fillMerged(ws, 'B26:H26', 'MONTH-END OUTCOME', C.teal, C.white, 10, true);
    fillMerged(ws, 'B27:H32', 'Working pilot\n\nAll meters classified, representative units stable, customer mappings approved, operations MVP demonstrated and sample shadow bills reviewed.', C.paleTeal, C.ink, 10, false);
    fillMerged(ws, 'J26:P26', 'DAILY ASSURANCE', C.blue, C.white, 10, true);
    fillMerged(ws, 'J27:P32', 'Numerical scorecard\n\nCompleted evidence, cumulative movement, blockers, accountable owner and next-day actions reported each working day.', C.paleBlue, C.ink, 10, false);
    fillMerged(ws, 'R26:X26', 'MANAGEMENT SUPPORT', C.amber, C.white, 10, true);
    fillMerged(ws, 'R27:X32', 'Decisions required\n\nConfirm repair evidence, name owners, approve the pilot cohort and close priority billing-policy decisions.', C.paleAmber, C.ink, 10, false);
    fillMerged(ws, 'Z26:AF26', 'CONTROL BOUNDARY', C.red, C.white, 10, true);
    fillMerged(ws, 'Z27:AF32', 'Not yet production launch\n\nLive payments, provider credit and remote commands remain gated until vendor, finance and safety controls are proven.', C.paleRed, C.ink, 10, false);

    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 1, printArea: 'A1:AF34', margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.1, footer: 0.1 } };
  }

  // 30-Day Plan
  {
    const ws = wb.addWorksheet('30-Day Plan', { views: [{ state: 'frozen', xSplit: 9, ySplit: 5, showGridLines: false }] });
    setSheetTitle(ws, '30-Day Integrated Workplan', 'Start: 26 October 2026 • Day 30: 24 November 2026 • Status is evidence-based', 'AM');
    const staticHeaders = ['ID', 'Workstream', 'Task', 'Owner Role', 'Start Day', 'End Day', 'Status', 'Deliverable / Evidence', 'Dependency'];
    staticHeaders.forEach(function (h, idx) { ws.getCell(5, idx + 1).value = h; });
    for (let d = 1; d <= TOTAL_DAYS; d++) {
      ws.getCell(4, 9 + d).value = 'D' + d;
      ws.getCell(5, 9 + d).value = dateForDay(d);
      ws.getCell(5, 9 + d).numFmt = 'd mmm';
      ws.getCell(4, 9 + d).alignment = { horizontal: 'center' };
      ws.getCell(4, 9 + d).font = { name: 'Aptos', size: 7, bold: true, color: { argb: 'FF' + C.gray } };
    }
    ws.getCell('J4').value = 'DAY';
    styleHeader(ws.getRow(5), C.navy);
    planTasks.forEach(function (t, idx) {
      const rowNum = 6 + idx;
      for (let i = 0; i < 9; i++) ws.getCell(rowNum, i + 1).value = t[i];
      const color = statusColor(t[6]);
      ws.getCell(rowNum, 7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color } };
      ws.getCell(rowNum, 7).font = { name: 'Aptos', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getCell(rowNum, 7).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      for (let d = 1; d <= TOTAL_DAYS; d++) {
        const cell = ws.getCell(rowNum, 9 + d);
        const isWeekend = [0, 6].includes(dateForDay(d).getUTCDay());
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (isWeekend ? 'EEF2F6' : 'FAFCFE') } };
        cell.border = { right: { style: 'hair', color: { argb: 'FF' + C.line } }, bottom: { style: 'hair', color: { argb: 'FF' + C.line } } };
        if (d >= t[4] && d <= t[5]) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color } };
        }
      }
      ws.getRow(rowNum).height = 32;
    });
    styleBody(ws, 6, 5 + planTasks.length, 1, 9);
    for (let row = 6; row <= 5 + planTasks.length; row++) {
      ws.getCell(row, 7).dataValidation = { type: 'list', allowBlank: false, formulae: ['"Complete,In Progress,Not Started,External Hold,Decision Required,On Hold,Blocked"'] };
    }
    ws.getColumn(1).width = 9;
    ws.getColumn(2).width = 19;
    ws.getColumn(3).width = 38;
    ws.getColumn(4).width = 22;
    ws.getColumn(5).width = 10;
    ws.getColumn(6).width = 10;
    ws.getColumn(7).width = 18;
    ws.getColumn(8).width = 30;
    ws.getColumn(9).width = 24;
    for (let c = 10; c <= 39; c++) ws.getColumn(c).width = 4.1;
    ws.autoFilter = { from: 'A5', to: 'AM' + (5 + planTasks.length) };
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, repeatRows: '4:5', printArea: 'A1:AM' + (5 + planTasks.length), margins: { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.1, footer: 0.1 } };
  }

  // Daily report
  {
    const ws = wb.addWorksheet('Daily Report', { views: [{ state: 'frozen', ySplit: 5, xSplit: 3, showGridLines: false }] });
    setSheetTitle(ws, 'Smart Metering Daily Progress Report', 'Enter actual daily movement. Day 3 preserves the first baseline; Day 9 records the latest confirmed progress.', 'T');
    const headers = ['Day', 'Date', 'Reporting Status', 'Meters Recovered / Passed Today', 'Cumulative Testing Started', 'Cumulative Tested & Working', 'Communications Passed', 'Meters Working', '24h Stable', 'Installed / Commissioned', 'Customer Mappings Approved', 'Readings Validated', 'Application Items Completed', 'Open Exceptions', 'Vendor Fixes Completed', 'Achievements / Work Completed', 'Evidence Reference', 'Blockers / Decisions Required', 'Tomorrow Plan', 'Prepared By'];
    headers.forEach(function (h, i) { ws.getCell(5, i + 1).value = h; });
    styleHeader(ws.getRow(5), C.teal);
    for (let d = 1; d <= TOTAL_DAYS; d++) {
      const row = 5 + d;
      ws.getCell(row, 1).value = d;
      ws.getCell(row, 2).value = dateForDay(d);
      ws.getCell(row, 2).numFmt = 'ddd, d mmm';
      ws.getCell(row, 3).value = d === 3 || d === 9 ? 'Reported' : d < 9 ? 'Backfill detail' : 'Planned';
      if (d === 3) {
        ws.getCell(row, 5).value = 12;
        ws.getCell(row, 6).value = 2;
        ws.getCell(row, 8).value = 2;
        ws.getCell(row, 14).value = 6;
        ws.getCell(row, 15).value = 4;
        ws.getCell(row, 16).value = '31-meter inventory established; 12 meters entered testing; two active bulk meters confirmed; six exceptions identified; four-unit vendor handover planned.';
        ws.getCell(row, 18).value = 'Exact four handover serials must be recorded; SteamaCo/OEM diagnosis is required for communications and firmware issues.';
        ws.getCell(row, 19).value = 'Prepare signed handover, continue bench testing, verify installed SIM/APN/GSM/TCP evidence and advance the read-only application integration.';
      }
      if (d === 9) {
        ws.getCell(row, 4).value = 3;
        ws.getCell(row, 5).value = 14;
        ws.getCell(row, 6).value = 14;
        ws.getCell(row, 7).value = 2;
        ws.getCell(row, 8).value = 14;
        ws.getCell(row, 15).value = 5;
        ws.getCell(row, 16).value = 'Four connectivity meters were fixed by SteamaCo by Monday; the firmware-mismatch meter was fixed on Tuesday; continued testing recovered three additional meters. Total tested and working: 14 of 31.';
        ws.getCell(row, 17).value = 'Updated tracker and SteamaCo UI evidence identify all four connection-repair serials and the firmware-repair serial.';
        ws.getCell(row, 18).value = 'Four repaired units show On but telemetry Offline for 23 hours to 1 day; firmware unit is Not Active; meter 0179250930429 shows Active and Not Connected simultaneously.';
        ws.getCell(row, 19).value = 'Continue the remaining 17 tests; restore repaired-meter telemetry; capture readings and stability; reconcile the conflicting backend status.';
      }
      ws.getCell(row, 3).dataValidation = { type: 'list', allowBlank: false, formulae: ['"Planned,Reported,Backfill detail,No workday"'] };
      ws.getRow(row).height = d === 3 || d === 9 ? 78 : 30;
    }
    styleBody(ws, 6, 35, 1, 20);
    [1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].forEach(function (c) { ws.getColumn(c).width = 13; });
    ws.getColumn(2).width = 17;
    ws.getColumn(3).width = 16;
    ws.getColumn(16).width = 44;
    ws.getColumn(17).width = 26;
    ws.getColumn(18).width = 38;
    ws.getColumn(19).width = 38;
    ws.getColumn(20).width = 18;
    ws.autoFilter = { from: 'A5', to: 'T35' };
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, repeatRows: '1:5', margins: { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.1, footer: 0.1 } };
  }

  // Meter register
  {
    const ws = wb.addWorksheet('Meter Register', { views: [{ state: 'frozen', ySplit: 5, xSplit: 4, showGridLines: false }] });
    setSheetTitle(ws, 'Controlled Meter Register', 'Updated 3 November 2026 • Functional test results are kept separate from backend operational status', 'W');
    const headers = ['Meter ID', 'Meter Type', 'Model', 'Nameplate Serial', 'Allocated Use / User', 'SIM Present Record', 'Installed SIM MSISDN', 'Provider', 'Test Stage', 'Operational Status', 'Issue', 'Vendor Handover', 'Firmware / Logical Serial', 'Backend / API Serial', 'GSM Signal Result', 'TCP / Backend Result', 'Last Test Date', 'Owner', 'Next Action', 'Due Date', 'Evidence Reference', 'Notes', 'Functional Test Result'];
    headers.forEach(function (h, i) { ws.getCell(5, i + 1).value = h; });
    styleHeader(ws.getRow(5), C.navy);
    meters.forEach(function (m, idx) {
      const row = 6 + idx;
      m.forEach(function (v, col) { ws.getCell(row, col + 1).value = v; });
      ws.getCell(row, 4).numFmt = '@';
      ws.getCell(row, 7).numFmt = '@';
      ws.getCell(row, 9).dataValidation = { type: 'list', allowBlank: false, formulae: ['"Awaiting test,Testing,Tested"'] };
      ws.getCell(row, 10).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Active,Not Active,Online - Monitoring,Offline,Unknown"'] };
      ws.getCell(row, 12).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Candidate,Selected,Transferred,Returned,Software/OEM follow-up,No"'] };
      ws.getCell(row, 8).dataValidation = { type: 'list', allowBlank: true, formulae: ['"MTN,Airtel,Glo,9mobile,Other"'] };
      ws.getCell(row, 17).numFmt = 'dd-mmm-yyyy';
      ws.getCell(row, 20).numFmt = 'dd-mmm-yyyy';
      ws.getCell(row, 23).value = workingMeterIds.has(m[0]) ? 'Working' : '';
      ws.getCell(row, 23).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Working,Failed,Pending,Not Tested"'] };
      if (workingMeterIds.has(m[0]) && !ws.getCell(row, 21).value) {
        ws.getCell(row, 21).value = [25, 27, 28, 29].includes(m[0])
          ? 'SteamaCo status screenshot and updated tracker, 3 Nov 2026'
          : 'Updated meter tracker screenshot, 3 Nov 2026';
      }
      ws.getRow(row).height = 34;
      const stage = String(m[8] || '');
      const stageColor = stage === 'Tested' ? C.paleBlue : stage === 'Testing' ? C.paleAmber : C.soft;
      ws.getCell(row, 9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + stageColor } };
      if (m[9] === 'Active') {
        ws.getCell(row, 10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.paleTeal } };
        ws.getCell(row, 10).font = { name: 'Aptos', size: 9, bold: true, color: { argb: 'FF' + C.green } };
      }
      if (m[10]) {
        ws.getCell(row, 11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.paleRed } };
        ws.getCell(row, 11).font = { name: 'Aptos', size: 9, bold: true, color: { argb: 'FF' + C.red } };
      }
      if (workingMeterIds.has(m[0])) {
        ws.getCell(row, 23).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.paleTeal } };
        ws.getCell(row, 23).font = { name: 'Aptos', size: 9, bold: true, color: { argb: 'FF' + C.green } };
      }
    });
    styleBody(ws, 6, 36, 1, 23);
    meters.forEach(function (m, idx) {
      const row = 6 + idx;
      if (workingMeterIds.has(m[0])) {
        ws.getCell(row, 23).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.paleTeal } };
        ws.getCell(row, 23).font = { name: 'Aptos', size: 9, bold: true, color: { argb: 'FF' + C.green } };
      }
    });
    const widths = [10, 31, 12, 22, 20, 17, 20, 12, 15, 18, 23, 20, 23, 22, 20, 22, 16, 18, 42, 16, 26, 38, 19];
    widths.forEach(function (w, idx) { ws.getColumn(idx + 1).width = w; });
    ws.autoFilter = { from: 'A5', to: 'W36' };
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, repeatRows: '1:5', margins: { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.1, footer: 0.1 } };
  }

  // SIM Test Pool
  {
    const ws = wb.addWorksheet('SIM Test Pool', { views: [{ state: 'frozen', ySplit: 6, showGridLines: false }] });
    setSheetTitle(ws, 'SIM Test Pool', 'Independent inventory of SIMs available for testing. Row position does not associate a SIM with a meter.', 'H');
    ws.mergeCells('A4:H4');
    ws.getCell('A4').value = 'Important: installed SIM assignments belong in the Meter Register. This sheet is the separate testing pool described by the project owner.';
    ws.getCell('A4').font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF' + C.teal } };
    ws.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.paleTeal } };
    ws.getCell('A4').alignment = { vertical: 'middle', wrapText: true };
    ws.getRow(4).height = 32;
    const headers = ['Pool ID', 'SIM MSISDN', 'Provider', 'ICCID', 'Test-Pool Status', 'Last Used Date', 'Currently Installed Meter', 'Notes'];
    headers.forEach(function (h, i) { ws.getCell(6, i + 1).value = h; });
    styleHeader(ws.getRow(6), C.teal);
    simPool.forEach(function (s, idx) {
      const row = 7 + idx;
      s.forEach(function (v, col) { ws.getCell(row, col + 1).value = v; });
      ws.getCell(row, 2).numFmt = '@';
      ws.getCell(row, 3).dataValidation = { type: 'list', allowBlank: true, formulae: ['"MTN,Airtel,Glo,9mobile,Other"'] };
      ws.getCell(row, 5).dataValidation = { type: 'list', allowBlank: false, formulae: ['"Available for controlled testing,In use,Data inactive,Faulty,Retired"'] };
      ws.getCell(row, 6).numFmt = 'dd-mmm-yyyy';
      ws.getRow(row).height = 32;
    });
    styleBody(ws, 7, 12, 1, 8);
    [13, 21, 15, 25, 28, 18, 26, 58].forEach(function (w, idx) { ws.getColumn(idx + 1).width = w; });
    ws.autoFilter = { from: 'A6', to: 'H12' };
  }

  // SteamaCo handover
  {
    const ws = wb.addWorksheet('SteamaCo Handover', { views: [{ state: 'frozen', ySplit: 5, xSplit: 2, showGridLines: false }] });
    setSheetTitle(ws, 'SteamaCo Meter Handover & Retest', 'All five submitted serials are identified and functionally repaired. Backend telemetry and stability acceptance remain open.', 'R');
    const headers = ['Slot', 'Nameplate Serial', 'Issue Observed', 'Nameplate Photo Ref', 'Firmware / Logical Serial', 'Installed SIM', 'Provider', 'GSM Result', 'TCP Result', 'Handover Date', 'Received By', 'Vendor Diagnosis', 'Corrective Action', 'Expected Return', 'Return Date', 'Current Reading Received', '24h Stability', 'Outcome'];
    headers.forEach(function (h, i) { ws.getCell(5, i + 1).value = h; });
    styleHeader(ws.getRow(5), C.red);
    for (let i = 0; i < 5; i++) {
      const row = 6 + i;
      ws.getCell(row, 1).value = i + 1;
      ws.getCell(row, 2).dataValidation = { type: 'list', allowBlank: false, formulae: ['MeterSerials'] };
      ws.getCell(row, 7).dataValidation = { type: 'list', allowBlank: true, formulae: ['"MTN,Airtel,Glo,9mobile,Other"'] };
      ws.getCell(row, 10).numFmt = 'dd-mmm-yyyy';
      ws.getCell(row, 14).numFmt = 'dd-mmm-yyyy';
      ws.getCell(row, 15).numFmt = 'dd-mmm-yyyy';
      ws.getCell(row, 16).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Yes,No,Pending"'] };
      ws.getCell(row, 17).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Passed,Failed,Pending"'] };
      ws.getCell(row, 18).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Accepted,Rejected,Fixed - telemetry validation,Monitoring,Pending"'] };
      if (i < 4) {
        const submitted = [
          ['017925093 0312', 'No cell signal', 'Offline (23 hours)'],
          ['017925093 0361', 'Not connecting', 'Offline (23 hours)'],
          ['017925093 0221', 'Not connecting', 'Offline (1 day)'],
          ['017925093 0189', 'No cell signal', 'Offline (1 day)']
        ][i];
        ws.getCell(row, 2).value = submitted[0];
        ws.getCell(row, 3).value = submitted[1];
        ws.getCell(row, 8).value = 'Repair reported working';
        ws.getCell(row, 9).value = submitted[2];
        ws.getCell(row, 12).value = 'Fixed by SteamaCo; detailed diagnosis to be attached';
        ws.getCell(row, 13).value = 'Repair completed; corrective details pending';
        ws.getCell(row, 15).value = new Date(Date.UTC(2026, 10, 2));
        ws.getCell(row, 16).value = 'No';
        ws.getCell(row, 17).value = 'Pending';
        ws.getCell(row, 18).value = 'Fixed - telemetry validation';
      } else {
        ws.getCell(row, 2).value = '017925093 0205';
        ws.getCell(row, 3).value = 'Firmware / nameplate serial mismatch';
        ws.getCell(row, 10).value = new Date(Date.UTC(2026, 10, 3));
        ws.getCell(row, 12).value = 'Firmware mismatch fixed by SteamaCo';
        ws.getCell(row, 13).value = 'Firmware corrected / regularised; technical note to be attached';
        ws.getCell(row, 15).value = new Date(Date.UTC(2026, 10, 3));
        ws.getCell(row, 16).value = 'Pending';
        ws.getCell(row, 17).value = 'Pending';
        ws.getCell(row, 18).value = 'Fixed - telemetry validation';
      }
      ws.getRow(row).height = 46;
    }
    styleBody(ws, 6, 10, 1, 18);
    ws.mergeCells('A12:R12');
    ws.getCell('A12').value = 'RETURN ACCEPTANCE CHECKLIST';
    ws.getCell('A12').font = { name: 'Aptos', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getCell('A12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.navy } };
    ws.getCell('A12').alignment = { horizontal: 'left', vertical: 'middle' };
    const checks = [
      ['1', 'Nameplate, firmware and SteamaCo/backend serials match'],
      ['2', 'SIM is detected and the intended network is registered'],
      ['3', 'Meter establishes the required TCP/backend connection'],
      ['4', 'Meter appears under the correct identity in SteamaCo'],
      ['5', 'A current reading is received and timestamped'],
      ['6', 'Meter remains stable for at least 24 hours before installation']
    ];
    checks.forEach(function (c, idx) {
      const row = 13 + idx;
      ws.getCell(row, 1).value = c[0];
      ws.mergeCells(row, 2, row, 15);
      ws.getCell(row, 2).value = c[1];
      ws.getCell(row, 16).value = 'Pending';
      ws.getCell(row, 16).dataValidation = { type: 'list', allowBlank: false, formulae: ['"Passed,Failed,Pending,Not Applicable"'] };
      ws.mergeCells(row, 17, row, 18);
      ws.getCell(row, 17).value = '';
      ws.getCell(row, 17).alignment = { wrapText: true };
      ws.getRow(row).height = 26;
    });
    styleBody(ws, 13, 18, 1, 18);
    const widths = [8, 21, 24, 22, 23, 18, 14, 16, 18, 17, 20, 32, 32, 18, 17, 20, 17, 18];
    widths.forEach(function (w, idx) { ws.getColumn(idx + 1).width = w; });
    ws.autoFilter = { from: 'A5', to: 'R10' };
  }

  // Customer and application
  {
    const ws = wb.addWorksheet('Customer & App', { views: [{ showGridLines: false, state: 'frozen', ySplit: 5 }] });
    setSheetTitle(ws, 'Customer Integration & Application MVP', 'Customer figures are from the authenticated SteamaCo read-only snapshot dated 26 October 2026 and require controlled reconciliation.', 'I');
    const headers = ['ID', 'Area', 'Deliverable', 'Baseline / Current Position', 'Target Evidence', 'Owner Role', 'Status', 'Dependency', 'Notes'];
    headers.forEach(function (h, i) { ws.getCell(5, i + 1).value = h; });
    styleHeader(ws.getRow(5), C.blue);
    const rows = [
      ['C-01', 'Customer data', 'Reconcile provider customers', '33 provider customers observed', 'Approved customer register', 'Operations owner', 'Not Started', 'Controlled customer list', 'Snapshot requires business validation'],
      ['C-02', 'Meter assignments', 'Reconcile meter-to-customer assignments', '5 meters had observed assignment; 26 appeared unassigned', 'Approved current assignment for every billable pilot meter', 'Billing owner', 'In Progress', 'Meter identity', 'Do not infer assignment from provider balance'],
      ['C-03', 'Customer coverage', 'Resolve customers without observed assignment', '28 customers lacked an observed meter assignment', 'Each customer classified: mapped, inactive, duplicate or exception', 'Operations owner', 'Not Started', 'C-01 and C-02', 'Snapshot requires validation'],
      ['C-04', 'Pilot cohort', 'Select representative source, bulk and customer meters', 'Not yet approved', 'Named cohort with stable meters and approved assignments', 'Product / billing owner', 'Decision Required', 'Meter stability and mappings', ''],
      ['A-01', 'Application', 'Secure read-only foundation', 'Runtime safety, Phase 1 schema and tests implemented', 'Controlled engineering baseline', 'Technical lead', 'Complete', 'Repository baseline', 'Not production release'],
      ['A-02', 'Application', 'Live provider synchronization', 'Read-only provider client foundation exists', 'Repeatable idempotent sync with audit evidence', 'Integration lead', 'In Progress', 'Provider access', 'No mutation calls'],
      ['A-03', 'Application', 'Operations dashboard', 'Not yet demonstrated', 'Meter/customer/readiness views using pilot records', 'Application team', 'Not Started', 'A-02', ''],
      ['A-04', 'Application', 'Exception and handover workflow', 'Excel operational control established', 'Application exception queue and evidence links', 'Application team', 'Not Started', 'A-03', ''],
      ['B-01', 'Billing', 'Approve pilot billing rules', 'Decision pack prepared; answers pending', 'Approved tariffs, rounding and reading-quality rules', 'Finance / billing owner', 'Decision Required', 'Management approval', ''],
      ['B-02', 'Billing', 'Validate representative readings', 'Provider reading semantics reviewed', 'Traceable register-delta and usage comparison', 'Metering / billing', 'Not Started', 'Stable pilot readings', ''],
      ['B-03', 'Billing', 'Produce controlled shadow bills', 'Not started', 'Reviewed sample bills without live financial effect', 'Billing team', 'Not Started', 'B-01 and B-02', 'Production payment/credit remains gated']
    ];
    rows.forEach(function (r, idx) {
      const row = 6 + idx;
      r.forEach(function (v, c) { ws.getCell(row, c + 1).value = v; });
      ws.getCell(row, 7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + statusColor(r[6]) } };
      ws.getCell(row, 7).font = { name: 'Aptos', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getCell(row, 7).dataValidation = { type: 'list', allowBlank: false, formulae: ['"Complete,In Progress,Not Started,External Hold,Decision Required,On Hold,Blocked"'] };
      ws.getRow(row).height = 48;
    });
    styleBody(ws, 6, 16, 1, 9);
    [10, 18, 37, 38, 40, 20, 18, 25, 34].forEach(function (w, idx) { ws.getColumn(idx + 1).width = w; });
    ws.autoFilter = { from: 'A5', to: 'I16' };
  }

  // Issues and decisions
  {
    const ws = wb.addWorksheet('Issues & Decisions', { views: [{ state: 'frozen', ySplit: 5, showGridLines: false }] });
    setSheetTitle(ws, 'Issues, Dependencies & Management Decisions', 'Nothing disappears into narrative: each unresolved item requires an owner, next action and evidence.', 'J');
    const headers = ['ID', 'Type', 'Item', 'Scope / Count', 'Priority', 'Status', 'Owner', 'Next Action', 'Due Date', 'Evidence / Notes'];
    headers.forEach(function (h, i) { ws.getCell(5, i + 1).value = h; });
    styleHeader(ws.getRow(5), C.red);
    issues.forEach(function (r, idx) {
      const row = 6 + idx;
      r.forEach(function (v, c) { ws.getCell(row, c + 1).value = v; });
      ws.getCell(row, 5).dataValidation = { type: 'list', allowBlank: false, formulae: ['"Critical,High,Medium,Low"'] };
      ws.getCell(row, 6).dataValidation = { type: 'list', allowBlank: false, formulae: ['"Complete,In Progress,Not Started,External Hold,Decision Required,On Hold,Blocked"'] };
      ws.getCell(row, 6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + statusColor(r[5]) } };
      ws.getCell(row, 6).font = { name: 'Aptos', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getCell(row, 9).numFmt = 'dd-mmm-yyyy';
      ws.getRow(row).height = 46;
    });
    styleBody(ws, 6, 15, 1, 10);
    [10, 20, 36, 23, 12, 18, 25, 45, 16, 39].forEach(function (w, idx) { ws.getColumn(idx + 1).width = w; });
    ws.autoFilter = { from: 'A5', to: 'J15' };
  }

  // Read Me
  {
    const ws = wb.addWorksheet('Read Me', { views: [{ showGridLines: false }] });
    setSheetTitle(ws, 'How to Use This Workbook', 'Management presentation and working control for the 30-day smart-metering pilot', 'H');
    const sections = [
      ['EXECUTIVE DASHBOARD', 'Use for the MD’s numerical position. KPIs recalculate from the controlled Meter Register and latest reported Daily Report row.'],
      ['30-DAY PLAN', 'Update task status and evidence daily. Calendar bars show the planned delivery window.'],
      ['DAILY REPORT', 'Complete one row at close of business. Report actual movement, evidence, blockers and tomorrow’s plan.'],
      ['METER REGISTER', 'The controlled source for physical meter status. Do not invent blank identity, SIM, connectivity or owner fields.'],
      ['SIM TEST POOL', 'A separate inventory of the six test SIMs. Its row order is not an assignment to any meter.'],
      ['STEAMACO HANDOVER', 'All five repaired serials are recorded. Attach vendor repair details and close every reading and stability acceptance check.'],
      ['CUSTOMER & APP', 'Tracks customer reconciliation, pilot mappings, application MVP and shadow-billing readiness.'],
      ['ISSUES & DECISIONS', 'Escalation register for vendor dependencies and management decisions.']
    ];
    sections.forEach(function (s, idx) {
      const row = 5 + idx * 2;
      ws.mergeCells(row, 1, row, 2);
      ws.getCell(row, 1).value = s[0];
      ws.getCell(row, 1).font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF' + C.teal } };
      ws.mergeCells(row, 3, row + 1, 8);
      ws.getCell(row, 3).value = s[1];
      ws.getCell(row, 3).font = { name: 'Aptos', size: 10, color: { argb: 'FF' + C.ink } };
      ws.getCell(row, 3).alignment = { vertical: 'middle', wrapText: true };
      ws.getCell(row, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      ws.getRow(row).height = 24;
      ws.getRow(row + 1).height = 18;
    });
    ws.mergeCells('A23:H26');
    ws.getCell('A23').value = 'CONTROL BOUNDARY\nThis workbook manages a working pilot. It does not authorize production payments, provider credit, remote meter commands or customer billing. Those capabilities remain gated until vendor contracts, finance policies, security controls and acceptance tests are approved.';
    ws.getCell('A23').font = { name: 'Aptos', size: 11, bold: true, color: { argb: 'FF' + C.ink } };
    ws.getCell('A23').alignment = { vertical: 'middle', wrapText: true };
    ws.getCell('A23').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.paleAmber } };
    ws.getColumn(1).width = 18;
    ws.getColumn(2).width = 6;
    for (let c = 3; c <= 8; c++) ws.getColumn(c).width = 18;
  }

  const xlsxPath = path.join(OUT_DIR, 'MicroAccess_Smart_Metering_30_Day_Management_Tracker.xlsx');
  await wb.xlsx.writeFile(xlsxPath);
  return xlsxPath;
}

async function main() {
  const pptxPath = path.join(OUT_DIR, 'MicroAccess_Smart_Metering_30_Day_Executive_Plan.pptx');
  await pptx.writeFile({ fileName: pptxPath });
  const xlsxPath = await buildWorkbook();
  console.log(JSON.stringify({ pptx: pptxPath, xlsx: xlsxPath }, null, 2));
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
