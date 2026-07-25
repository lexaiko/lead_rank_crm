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

lines.slice(1).forEach((l, idx) => {
  const parts = parseCSVLine(l);
  const statusStr = parts[6] || '';
  const tahapanStr = parts[12] || '';
  if (tahapanStr === '99' || statusStr.toLowerCase() === 'review') {
    console.log(`Line ${idx+2}:`, parts.slice(0, 13));
  }
});
