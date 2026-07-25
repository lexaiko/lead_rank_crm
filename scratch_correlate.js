import fs from 'fs';

const csvPath = 'c:\\coding\\TripBwi\\classifier\\Data Leads 2026 - Input Data.csv';
const content = fs.readFileSync(csvPath, 'utf-8');
const lines = content.split('\n').filter(l => l.trim().length > 0);

const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

const mapStatusTahapan = new Map();

lines.slice(1).forEach(l => {
  const parts = parseCSVLine(l);
  const statusStr = parts[6] || '';
  const tahapanStr = parts[12] || '';
  const key = `${tahapanStr} <=> ${statusStr}`;
  mapStatusTahapan.set(key, (mapStatusTahapan.get(key) || 0) + 1);
});

console.log('--- CORRELATION BETWEEN TAHAPAN (NUMBER) AND STATUS (TEXT) ---');
console.log(Array.from(mapStatusTahapan.entries()).sort((a, b) => b[1] - a[1]));
