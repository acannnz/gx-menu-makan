// Ubah file Excel menu bulanan → menu.json (data bawaan yang dibaca aplikasi)
// Pakai: npm run menu -- "D:\Download\Menu Makan GX - November 2026.xlsx"
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { parseWorkbook } = require('../www/parser.js');

const file = process.argv[2];
if (!file) {
  console.error('Pakai: npm run menu -- "<file excel>"');
  process.exit(1);
}
const out = path.join(__dirname, '..', 'www', 'menu.json');

const res = parseWorkbook(XLSX, XLSX.readFile(file), path.basename(file));
if (!res) {
  console.error('Tidak ada menu yang terbaca dari', file);
  process.exit(1);
}

const data = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : { version: 1, months: {} };
const { dayCount, ...month } = res;
data.months[res.month] = month;
fs.writeFileSync(out, JSON.stringify(data, null, 1) + '\n');
console.log(`${res.label}: ${dayCount} hari → menu.json`);
