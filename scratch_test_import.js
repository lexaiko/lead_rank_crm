import fs from 'fs';
import { normalizePhoneNumber } from './src/utils/phone.js';

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

// Date parser helper for DD/MM/YY or DD/MM/YYYY
function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1; // 0-indexed
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(Date.UTC(year, month, day));
    }
  }
  return null;
}

// Pax parser helper
function parsePax(paxStr) {
  if (!paxStr) return null;
  // Handle 10+1 or 10
  const match = paxStr.match(/^(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

// Order value parser helper
function parseNominal(nominalStr) {
  if (!nominalStr) return null;
  const clean = nominalStr.replace(/[^\d]/g, '');
  if (clean) return parseInt(clean, 10);
  return null;
}

const leadsToInsert = [];
const phoneToCustomerMap = new Map();
const statusCounts = {};

lines.slice(1).forEach((l, idx) => {
  const parts = parseCSVLine(l);
  const kode = parts[0] || `2600_${idx + 1}`;
  const tglStr = parts[1] || '';
  const nama = parts[2] || 'Pelanggan WA';
  const rawWa = parts[3] || '';
  const source = (parts[4] || 'tidak diketahui').toLowerCase();
  const agenStr = parts[5] || '';
  const statusStr = parts[6] || '';
  const destinasi = parts[7] || '';
  const tglTripStr = parts[8] || '';
  const paxStr = parts[9] || '';
  const nominalStr = parts[10] || '';
  const keterangan = parts[11] || '';
  const tahapanStr = parts[12] || '';

  // Skip header or totally empty rows
  if (!kode || kode === 'KODE') return;

  const phone = normalizePhoneNumber(rawWa) || `628000000${idx + 1}`;
  const createdAt = parseDate(tglStr) || new Date('2026-01-01');
  const estimasi_waktu = parseDate(tglTripStr);
  const pax = parsePax(paxStr);
  const nominal = parseNominal(nominalStr);

  // Status mapping
  let mappedStatus = 'NEW';
  if (tahapanStr === '7' || statusStr.toLowerCase() === 'closing') {
    mappedStatus = 'CLOSED WON';
  } else if (tahapanStr === '8' || statusStr.toLowerCase().includes('gagal')) {
    mappedStatus = 'CLOSED LOST';
  } else if (tahapanStr === '1' || statusStr.toLowerCase().includes('baru')) {
    mappedStatus = 'NEW';
  } else if (tahapanStr === '2' || statusStr.toLowerCase().includes('qualified')) {
    mappedStatus = 'QUALIFIED';
  } else if (tahapanStr === '3' || statusStr.toLowerCase().includes('prospek') || statusStr.toLowerCase().includes('warm')) {
    mappedStatus = 'PROSPECT';
  } else if (tahapanStr === '4' || statusStr.toLowerCase().includes('follow up')) {
    mappedStatus = 'QUALIFIED';
  } else if (tahapanStr === '6' || statusStr.toLowerCase().includes('hot')) {
    mappedStatus = 'HOT';
  } else if (tahapanStr === '99' || statusStr.toLowerCase().includes('review')) {
    if (keterangan.toLowerCase().includes('closing') || keterangan.toLowerCase().includes('order')) {
      mappedStatus = 'CLOSED WON';
    } else if (keterangan.toLowerCase().includes('penawaran') || keterangan.toLowerCase().includes('itinerary')) {
      mappedStatus = 'PROSPECT';
    } else {
      mappedStatus = 'QUALIFIED';
    }
  }

  // Admin mapping
  let admin_id = 12; // System Administrator fallback
  if (agenStr.toLowerCase().includes('alvin')) admin_id = 11;
  else if (agenStr.toLowerCase().includes('dela')) admin_id = 9;
  else if (agenStr.toLowerCase().includes('eko')) admin_id = 10;

  // Build notes
  let noteParts = [];
  if (keterangan) noteParts.push(keterangan);
  if (tglTripStr && !estimasi_waktu) noteParts.push(`[Jadwal Trip: ${tglTripStr}]`);
  const finalNote = noteParts.join(' | ') || null;

  statusCounts[mappedStatus] = (statusCounts[mappedStatus] || 0) + 1;

  leadsToInsert.push({
    kode_lead: kode,
    phone,
    nama,
    source,
    admin_id,
    mappedStatus,
    destinasi: destinasi || null,
    tglTripStr,
    estimasi_waktu,
    pax,
    nominal,
    finalNote,
    createdAt
  });
});

console.log('--- DRY RUN IMPORT SUMMARY ---');
console.log('Total valid rows parsed:', leadsToInsert.length);
console.log('Status counts breakdown:', statusCounts);

// Check duplicate phones
const phoneCounts = new Map();
leadsToInsert.forEach(l => {
  phoneCounts.set(l.phone, (phoneCounts.get(l.phone) || 0) + 1);
});
let dupPhoneCount = 0;
phoneCounts.forEach((cnt) => { if (cnt > 1) dupPhoneCount++; });
console.log('Unique phone numbers:', phoneCounts.size, '(Duplicate phone numbers:', dupPhoneCount, ')');

// Check duplicate kode_lead
const kodeCounts = new Map();
leadsToInsert.forEach(l => {
  kodeCounts.set(l.kode_lead, (kodeCounts.get(l.kode_lead) || 0) + 1);
});
let dupKodeCount = 0;
kodeCounts.forEach((cnt) => { if (cnt > 1) dupKodeCount++; });
console.log('Unique lead codes:', kodeCounts.size, '(Duplicate lead codes:', dupKodeCount, ')');
