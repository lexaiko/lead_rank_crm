import fs from 'fs';
import { prisma } from '../src/config/prisma.js';
import { normalizePhoneNumber } from '../src/utils/phone.js';

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

function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(Date.UTC(year, month, day));
    }
  }
  return null;
}

function parsePax(paxStr) {
  if (!paxStr) return null;
  const match = paxStr.trim().match(/^(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

function parseNominal(nominalStr) {
  if (!nominalStr) return null;
  const clean = nominalStr.replace(/[^\d]/g, '');
  if (clean) return parseInt(clean, 10);
  return null;
}

async function runImport() {
  console.log('=== STEP 1: CLEARING EXISTING DATABASE DATA ===');
  await prisma.aIAnalysis.deleteMany({});
  await prisma.aIJob.deleteMany({});
  await prisma.chatMessage.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.customer.deleteMany({});
  console.log('✅ Previous customers, leads, chat messages, and AI jobs deleted successfully.');

  console.log('\n=== STEP 2: READING CSV & PARSING DATA ===');
  const csvPath = 'c:\\coding\\TripBwi\\classifier\\Data Leads 2026 - Input Data.csv';
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);

  const usedPhones = new Set();
  const usedCodes = new Set();

  let importedCount = 0;
  const statusCounts = {};

  console.log(`Processing ${lines.length - 1} rows from CSV...`);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = parseCSVLine(line);
    const rawKode = parts[0] || `2600_${i}`;
    const tglStr = parts[1] || '';
    const nama = parts[2] || 'Pelanggan WA';
    const rawWa = parts[3] || '';
    let source = (parts[4] || 'tidak diketahui').toLowerCase().trim();
    const agenStr = parts[5] || '';
    const statusStr = parts[6] || '';
    const destinasi = parts[7] || '';
    const tglTripStr = parts[8] || '';
    const paxStr = parts[9] || '';
    const nominalStr = parts[10] || '';
    const keterangan = parts[11] || '';
    const tahapanStr = parts[12] || '';

    if (!rawKode || rawKode === 'KODE') continue;

    // Handle unique kode_lead
    let kode_lead = rawKode.trim();
    if (usedCodes.has(kode_lead)) {
      let suffix = 2;
      while (usedCodes.has(`${kode_lead}_${suffix}`)) {
        suffix++;
      }
      kode_lead = `${kode_lead}_${suffix}`;
    }
    usedCodes.add(kode_lead);

    // Handle unique phone number for customer
    let cleanPhone = normalizePhoneNumber(rawWa) || `6280000${String(i).padStart(6, '0')}`;
    let nomor_hp = cleanPhone;
    if (usedPhones.has(nomor_hp)) {
      let suffix = 2;
      while (usedPhones.has(`${cleanPhone}_${suffix}`)) {
        suffix++;
      }
      nomor_hp = `${cleanPhone}_${suffix}`;
    }
    usedPhones.add(nomor_hp);

    // Map date
    const createdAt = parseDate(tglStr) || new Date('2026-01-01');
    const estimasi_waktu = parseDate(tglTripStr);
    const pax = parsePax(paxStr);
    const nominal = parseNominal(nominalStr);

    // Map source
    if (!['website', 'instagram', 'tiktok', 'rekomendasi', 'facebook', 'lainnya'].includes(source)) {
      source = 'tidak diketahui';
    }

    // Map Admin
    let admin_id = 12; // System Administrator default
    const lowerAgen = agenStr.toLowerCase();
    if (lowerAgen.includes('alvin')) admin_id = 11;
    else if (lowerAgen.includes('dela')) admin_id = 9;
    else if (lowerAgen.includes('eko')) admin_id = 10;

    // Map Status
    let mappedStatus = 'NEW';
    const lowerStatus = statusStr.toLowerCase();
    if (tahapanStr === '7' || lowerStatus === 'closing') {
      mappedStatus = 'CLOSED WON';
    } else if (tahapanStr === '8' || lowerStatus.includes('gagal')) {
      mappedStatus = 'CLOSED LOST';
    } else if (tahapanStr === '1' || lowerStatus.includes('baru')) {
      mappedStatus = 'NEW';
    } else if (tahapanStr === '2' || lowerStatus.includes('qualified')) {
      mappedStatus = 'QUALIFIED';
    } else if (tahapanStr === '3' || lowerStatus.includes('prospek') || lowerStatus.includes('warm')) {
      mappedStatus = 'PROSPECT';
    } else if (tahapanStr === '4' || lowerStatus.includes('follow up')) {
      mappedStatus = 'QUALIFIED';
    } else if (tahapanStr === '6' || lowerStatus.includes('hot')) {
      mappedStatus = 'HOT';
    } else if (tahapanStr === '99' || lowerStatus.includes('review')) {
      const lowerKet = keterangan.toLowerCase();
      if (lowerKet.includes('closing') || lowerKet.includes('order')) {
        mappedStatus = 'CLOSED WON';
      } else if (lowerKet.includes('penawaran') || lowerKet.includes('itinerary')) {
        mappedStatus = 'PROSPECT';
      } else {
        mappedStatus = 'QUALIFIED';
      }
    }

    // Build notes
    let noteParts = [];
    if (keterangan) noteParts.push(keterangan.trim());
    if (tglTripStr && !estimasi_waktu) noteParts.push(`[Jadwal Trip: ${tglTripStr.trim()}]`);
    const catatan_khusus = noteParts.length > 0 ? noteParts.join(' | ') : null;

    statusCounts[mappedStatus] = (statusCounts[mappedStatus] || 0) + 1;

    // Create Customer & Lead
    const customer = await prisma.customer.create({
      data: {
        nomor_hp,
        nama_kontak: nama || 'Pelanggan WA',
        createdAt,
        updatedAt: createdAt
      }
    });

    const isClosed = mappedStatus === 'CLOSED WON' || mappedStatus === 'CLOSED LOST';

    await prisma.lead.create({
      data: {
        kode_lead,
        customer_id: customer.id,
        admin_id,
        status_lead: mappedStatus,
        minat_destinasi: destinasi || null,
        jumlah_peserta: pax,
        estimasi_waktu,
        catatan_khusus,
        referral_source: source,
        estimasi_nilai_order: nominal,
        last_activity_at: createdAt,
        closed_at: isClosed ? createdAt : null,
        createdAt,
        updatedAt: createdAt
      }
    });

    importedCount++;
    if (importedCount % 250 === 0) {
      console.log(`Imported ${importedCount} leads...`);
    }
  }

  console.log('\n=== IMPORT COMPLETE ===');
  console.log(`Successfully imported ${importedCount} leads!`);
  console.log('Status Breakdown:', statusCounts);
}

runImport()
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
