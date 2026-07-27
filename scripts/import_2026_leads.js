import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { normalizePhoneNumber } from '../src/utils/phone.js';

const prisma = new PrismaClient();

function cleanPhone(raw) {
  if (!raw) return '';
  let digits = normalizePhoneNumber(raw);
  if (digits.startsWith('08')) {
    digits = '628' + digits.slice(2);
  }
  return digits;
}

// Date parser helper for DD/MM/YY or DD/MM/YYYY
function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.trim().split(/[\/\-]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1; // 0-indexed
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (!isNaN(day) && !isNaN(month) && !isNaN(year) && month >= 0 && month < 12 && day > 0 && day <= 31) {
      return new Date(Date.UTC(year, month, day));
    }
  }
  return null;
}

// Pax parser helper
function parsePax(paxStr) {
  if (!paxStr) return null;
  const match = paxStr.toString().trim().match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// Order value parser helper
function parseNominal(nominalStr) {
  if (!nominalStr) return null;
  const clean = nominalStr.toString().replace(/[^\d]/g, '');
  return clean ? parseInt(clean, 10) : null;
}

// Status mapper to project lead status enum
function mapStatus(statusStr, tahapanStr, ketStr) {
  const statusLower = (statusStr || '').trim().toLowerCase();
  const ketLower = (ketStr || '').trim().toLowerCase();
  const tahapan = (tahapanStr || '').trim();

  if (tahapan === '7' || statusLower === 'closing') return 'CLOSED WON';
  if (tahapan === '8' || statusLower.includes('gagal')) return 'CLOSED LOST';
  if (tahapan === '6' || statusLower.includes('hot')) return 'HOT';
  if (['3', '4', '5'].includes(tahapan) || statusLower.includes('prospek') || statusLower.includes('follow up') || statusLower.includes('warm')) return 'PROSPECT';
  if (tahapan === '2' || statusLower.includes('qualified')) return 'QUALIFIED';
  if (tahapan === '1' || statusLower.includes('baru')) return 'NEW';
  if (tahapan === '99' || statusLower === 'review') {
    if (ketLower.includes('closing') || ketLower.includes('order')) return 'CLOSED WON';
    if (ketLower.includes('gagal')) return 'CLOSED LOST';
    return 'PROSPECT';
  }
  return 'NEW';
}

const STATUS_RANK = {
  'CLOSED WON': 5,
  'HOT': 4,
  'PROSPECT': 3,
  'QUALIFIED': 2,
  'NEW': 1,
  'CLOSED LOST': 0
};

// Referral source mapper
function mapSource(sourceStr) {
  if (!sourceStr) return 'tidak diketahui';
  const clean = sourceStr.trim().toLowerCase();
  const validSources = ['instagram', 'tiktok', 'website', 'rekomendasi', 'facebook', 'lainnya', 'tidak diketahui'];
  return validSources.includes(clean) ? clean : 'lainnya';
}

// CSV parser handling quotes
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

async function runImport() {
  console.log('🚀 STEP 1: ENSURING ADMIN ACCOUNTS EXIST...');
  
  const csRole = await prisma.role.findFirst({ where: { name: 'CS' } });
  const csRoleId = csRole ? csRole.id : 2;
  const defaultPassword = await bcrypt.hash('pbwi123', 10);

  let holidayAdmin = await prisma.admin.findFirst({
    where: { OR: [{ nama_admin: 'Holiday' }, { username: 'holiday_cs' }] }
  });

  if (!holidayAdmin) {
    holidayAdmin = await prisma.admin.create({
      data: {
        nama_admin: 'Holiday',
        nomor_wa: '6280000000001',
        username: 'holiday_cs',
        password: defaultPassword,
        role_id: csRoleId,
        is_active: true
      }
    });
    console.log(`✅ Admin "Holiday" created with ID: ${holidayAdmin.id}`);
  } else {
    console.log(`ℹ️ Admin "Holiday" already exists with ID: ${holidayAdmin.id}`);
  }

  // Load all admins for mapping
  const allAdmins = await prisma.admin.findMany();
  const adminMap = new Map();
  allAdmins.forEach(a => {
    adminMap.set(a.nama_admin.toLowerCase(), a.id);
  });

  const getAdminId = (agenStr) => {
    if (!agenStr) return 9; // Fallback Dela
    const lower = agenStr.trim().toLowerCase();
    if (lower.includes('alvin')) return adminMap.get('alvin') || 11;
    if (lower.includes('dela')) return adminMap.get('dela') || 9;
    if (lower.includes('holiday')) return holidayAdmin.id;
    if (lower.includes('eko')) return adminMap.get('eko bagus') || 10;
    return adminMap.get('dela') || 9;
  };

  console.log('\n📖 STEP 2: LOADING EXISTING DB CUSTOMERS & LEADS...');
  const existingCustomers = await prisma.customer.findMany({
    include: { lead: true }
  });

  const customerByPhone = new Map();
  existingCustomers.forEach(c => {
    const cleaned = cleanPhone(c.nomor_hp);
    if (cleaned) customerByPhone.set(cleaned, c);
  });

  // Track all used kode_leads in DB to enforce uniqueness
  const usedCodesInDb = new Set();
  const existingLeads = await prisma.lead.findMany({ select: { id: true, kode_lead: true } });
  existingLeads.forEach(l => usedCodesInDb.add(l.kode_lead));

  console.log(`Found ${existingCustomers.length} existing customers and ${existingLeads.length} existing leads in DB.`);

  console.log('\n📂 STEP 3: PARSING CSV & EXECUTING IMPORT / RENAMING...');
  const csvPath = path.resolve(process.cwd(), 'Data Leads 2026 - Input Data.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);

  let createdCustomerCount = 0;
  let createdLeadCount = 0;
  let updatedExistingLeadCount = 0;
  let renamedLeadCount = 0;
  let skippedRowCount = 0;

  const statusBreakdown = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = parseCSVLine(line);

    const csvKode = (parts[0] || '').trim();
    const csvTglStr = (parts[1] || '').trim();
    const csvNama = (parts[2] || '').trim();
    const csvPhoneRaw = (parts[3] || '').trim();
    const csvSource = (parts[4] || '').trim();
    const csvAgen = (parts[5] || '').trim();
    const csvStatus = (parts[6] || '').trim();
    const csvDestinasi = (parts[7] || '').trim();
    const csvTripDateStr = (parts[8] || '').trim();
    const csvPaxStr = (parts[9] || '').trim();
    const csvNominalStr = (parts[10] || '').trim();
    const csvKeterangan = (parts[11] || '').trim();
    const csvTahapan = (parts[12] || '').trim();
    // Column 13 (ANALISA AI) is explicitly ignored!

    if (!csvKode || csvKode === 'KODE') {
      skippedRowCount++;
      continue;
    }

    const phone = cleanPhone(csvPhoneRaw);
    if (!phone) {
      skippedRowCount++;
      continue;
    }

    const createdAt = parseDate(csvTglStr) || new Date('2026-01-01');
    const estimasi_waktu = parseDate(csvTripDateStr);
    const pax = parsePax(csvPaxStr);
    const nominal = parseNominal(csvNominalStr);
    const mappedStatus = mapStatus(csvStatus, csvTahapan, csvKeterangan);
    const source = mapSource(csvSource);
    const admin_id = getAdminId(csvAgen);

    // Build catatan khusus including trip date notes if text
    let noteParts = [];
    if (csvKeterangan) noteParts.push(csvKeterangan);
    if (csvTripDateStr && !estimasi_waktu) noteParts.push(`[Jadwal Trip: ${csvTripDateStr}]`);
    const catatan_khusus = noteParts.length > 0 ? noteParts.join(' | ') : null;

    statusBreakdown[mappedStatus] = (statusBreakdown[mappedStatus] || 0) + 1;

    // Check if customer already exists in DB
    if (customerByPhone.has(phone)) {
      const existingCust = customerByPhone.get(phone);

      // Update customer contact name if needed
      if (csvNama && (existingCust.nama_kontak === 'Pelanggan WA' || !existingCust.nama_kontak || existingCust.nama_kontak.startsWith('2607'))) {
        await prisma.customer.update({
          where: { id: existingCust.id },
          data: { nama_kontak: csvNama }
        });
        existingCust.nama_kontak = csvNama;
      }

      if (existingCust.lead) {
        const lead = existingCust.lead;

        // Ensure unique kode_lead
        let targetKodeLead = csvKode;
        if (usedCodesInDb.has(targetKodeLead) && lead.kode_lead !== targetKodeLead) {
          let suffix = 2;
          while (usedCodesInDb.has(`${csvKode}_${suffix}`)) {
            suffix++;
          }
          targetKodeLead = `${csvKode}_${suffix}`;
        }

        // Rename kode_lead if it differs
        const wasRenamed = lead.kode_lead !== targetKodeLead;
        if (wasRenamed) {
          usedCodesInDb.delete(lead.kode_lead);
          renamedLeadCount++;
        }
        usedCodesInDb.add(targetKodeLead);

        // Status rank comparison (don't downgrade CLOSED WON)
        const currentRank = STATUS_RANK[lead.status_lead] || 0;
        const newRank = STATUS_RANK[mappedStatus] || 0;
        const finalStatus = (currentRank === 5 && newRank < 5) ? 'CLOSED WON' : (newRank >= currentRank ? mappedStatus : lead.status_lead);

        const isClosed = finalStatus === 'CLOSED WON' || finalStatus === 'CLOSED LOST';

        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            kode_lead: targetKodeLead,
            admin_id,
            status_lead: finalStatus,
            minat_destinasi: csvDestinasi || lead.minat_destinasi,
            jumlah_peserta: pax !== null ? pax : lead.jumlah_peserta,
            estimasi_waktu: estimasi_waktu || lead.estimasi_waktu,
            catatan_khusus: catatan_khusus || lead.catatan_khusus,
            referral_source: source !== 'tidak diketahui' ? source : lead.referral_source,
            estimasi_nilai_order: nominal !== null ? nominal : lead.estimasi_nilai_order,
            closed_at: isClosed ? (lead.closed_at || createdAt) : null
          }
        });

        // Update in-memory reference
        lead.kode_lead = targetKodeLead;
        lead.status_lead = finalStatus;
        updatedExistingLeadCount++;
      } else {
        // Customer exists but had no lead -> create lead
        let targetKodeLead = csvKode;
        if (usedCodesInDb.has(targetKodeLead)) {
          let suffix = 2;
          while (usedCodesInDb.has(`${csvKode}_${suffix}`)) {
            suffix++;
          }
          targetKodeLead = `${csvKode}_${suffix}`;
        }
        usedCodesInDb.add(targetKodeLead);

        const isClosed = mappedStatus === 'CLOSED WON' || mappedStatus === 'CLOSED LOST';

        const newLead = await prisma.lead.create({
          data: {
            kode_lead: targetKodeLead,
            customer_id: existingCust.id,
            admin_id,
            status_lead: mappedStatus,
            minat_destinasi: csvDestinasi || null,
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
        existingCust.lead = newLead;
        createdLeadCount++;
      }
    } else {
      // Customer does NOT exist in DB -> Create new Customer & Lead
      let targetKodeLead = csvKode;
      if (usedCodesInDb.has(targetKodeLead)) {
        let suffix = 2;
        while (usedCodesInDb.has(`${csvKode}_${suffix}`)) {
          suffix++;
        }
        targetKodeLead = `${csvKode}_${suffix}`;
      }
      usedCodesInDb.add(targetKodeLead);

      const newCust = await prisma.customer.create({
        data: {
          nomor_hp: phone,
          nama_kontak: csvNama || 'Pelanggan WA',
          createdAt,
          updatedAt: createdAt
        }
      });
      createdCustomerCount++;

      const isClosed = mappedStatus === 'CLOSED WON' || mappedStatus === 'CLOSED LOST';

      const newLead = await prisma.lead.create({
        data: {
          kode_lead: targetKodeLead,
          customer_id: newCust.id,
          admin_id,
          status_lead: mappedStatus,
          minat_destinasi: csvDestinasi || null,
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
      newCust.lead = newLead;
      customerByPhone.set(phone, newCust);
      createdLeadCount++;
    }
  }

  console.log('\n======================================================');
  console.log('🎉 IMPORT & RENAME PROCESS COMPLETED SUCCESSFULLY!');
  console.log('======================================================');
  console.log(`- New Customers Created      : ${createdCustomerCount}`);
  console.log(`- New Leads Created          : ${createdLeadCount}`);
  console.log(`- Existing Leads Updated     : ${updatedExistingLeadCount}`);
  console.log(`- Existing Leads Renamed     : ${renamedLeadCount}`);
  console.log(`- Rows Skipped (empty/hdr)   : ${skippedRowCount}`);
  console.log('- Mapped Status Breakdown   :', statusBreakdown);
  console.log('======================================================\n');
}

runImport()
  .catch((err) => {
    console.error('❌ Import failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
