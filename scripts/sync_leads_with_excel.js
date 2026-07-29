import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { normalizePhoneNumber } from '../src/utils/phone.js';

const prisma = new PrismaClient();

function cleanPhone(raw) {
  if (!raw) return '';
  let str = raw.toString().trim().split('\n')[0].trim();
  let digits = normalizePhoneNumber(str);
  if (digits.startsWith('08')) {
    digits = '628' + digits.slice(2);
  }
  return digits;
}

// Clean Kode Lead helper
function fixKodeLead(rawKode) {
  if (!rawKode) return null;
  let str = rawKode.toString().trim();
  if (str.startsWith(',')) str = str.slice(1).trim();

  // Handle known typos in year/month from sheet
  if (str.startsWith('2697D')) str = str.replace('2697D', '2607D');
  if (str.startsWith('2696D')) str = str.replace('2696D', '2606D');
  if (str.startsWith('1607D')) str = str.replace('1607D', '2607D');
  if (str.startsWith('4607H')) str = str.replace('4607H', '2607H');
  if (str.startsWith('2807H')) str = str.replace('2807H', '2607H');

  const match = str.match(/^(\d{4})([A-Za-z])(\d+)$/);
  if (match) {
    const ym = match[1];
    const adminChar = match[2].toUpperCase();
    const num = parseInt(match[3], 10);
    const numStr = num.toString().padStart(3, '0');
    return `${ym}${adminChar}${numStr}`;
  }
  return null;
}

function parseDate(dateVal) {
  if (!dateVal) return null;
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) return dateVal;
  if (typeof dateVal === 'number') {
    const parsed = XLSX.SSF.parse_date_code(dateVal);
    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    }
  }
  if (typeof dateVal === 'string') {
    const parts = dateVal.trim().split(/[\/\-]/);
    if (parts.length === 3) {
      let day = parseInt(parts[0], 10);
      let month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && month >= 0 && month < 12 && day > 0 && day <= 31) {
        return new Date(Date.UTC(year, month, day));
      }
    }
  }
  return null;
}

function parsePax(paxStr) {
  if (!paxStr) return null;
  const match = paxStr.toString().trim().match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function parseNominal(nominalStr) {
  if (!nominalStr) return null;
  const clean = nominalStr.toString().replace(/[^\d]/g, '');
  return clean ? parseInt(clean, 10) : null;
}

function mapStatus(statusStr, tahapanStr, ketStr) {
  const statusLower = (statusStr || '').toString().trim().toLowerCase();
  const ketLower = (ketStr || '').toString().trim().toLowerCase();
  const tahapan = (tahapanStr || '').toString().trim();

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

function mapSource(sourceStr) {
  if (!sourceStr) return 'tidak diketahui';
  const clean = sourceStr.toString().trim().toLowerCase();
  const validSources = ['instagram', 'tiktok', 'website', 'rekomendasi', 'facebook', 'lainnya', 'tidak diketahui'];
  return validSources.includes(clean) ? clean : 'lainnya';
}

async function runSync() {
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
    console.log(`ℹ️ Admin "Holiday" exists with ID: ${holidayAdmin.id}`);
  }

  const allAdmins = await prisma.admin.findMany();
  const adminMap = new Map();
  allAdmins.forEach(a => {
    adminMap.set(a.nama_admin.toLowerCase(), a.id);
  });

  const getAdminId = (agenStr) => {
    if (!agenStr) return adminMap.get('dela') || 9;
    const lower = agenStr.toString().trim().toLowerCase();
    if (lower.includes('alvin')) return adminMap.get('alvin') || 11;
    if (lower.includes('dela')) return adminMap.get('dela') || 9;
    if (lower.includes('holiday')) return holidayAdmin.id;
    if (lower.includes('eko')) return adminMap.get('eko bagus') || 10;
    return adminMap.get('dela') || 9;
  };

  console.log('\n📖 STEP 2: READING EXCEL "Data Leads 2026.xlsx"...');
  const excelPath = path.resolve(process.cwd(), 'Data Leads 2026.xlsx');
  if (!fs.existsSync(excelPath)) {
    throw new Error(`Excel file not found at ${excelPath}`);
  }

  const wb = XLSX.readFile(excelPath);
  const inputSheet = wb.Sheets['Input Data'];
  const inputRows = XLSX.utils.sheet_to_json(inputSheet, { header: 1 });

  const excelByPhone = new Map();
  const maxSeqPerMonthAdmin = {};

  for (let i = 1; i < inputRows.length; i++) {
    const row = inputRows[i];
    if (!row || !row[0]) continue;
    const rawKode = row[0].toString().trim();
    if (!rawKode || rawKode === 'KODE') continue;
    const kode = fixKodeLead(rawKode);
    const phone = cleanPhone(row[3]);
    if (!phone) continue;

    const entry = {
      rowIdx: i,
      rawKode,
      kode: kode || rawKode,
      tgl: row[1],
      nama: row[2] ? row[2].toString().trim() : '',
      phone,
      source: row[4],
      agen: row[5],
      status: row[6],
      destinasi: row[7],
      tripDate: row[8],
      pax: row[9],
      nominal: row[10],
      ket: row[11],
      tahapan: row[12]
    };

    if (kode) {
      const match = kode.match(/^(\d{4})([A-Z])(\d{3})$/);
      if (match) {
        const ym = match[1];
        const adminChar = match[2];
        const num = parseInt(match[3], 10);
        const key = `${ym}${adminChar}`;
        if (!maxSeqPerMonthAdmin[key] || num > maxSeqPerMonthAdmin[key]) {
          maxSeqPerMonthAdmin[key] = num;
        }
      }
    }

    if (!excelByPhone.has(phone)) {
      excelByPhone.set(phone, entry);
    }
  }

  console.log(`Excel Input Data: Loaded ${excelByPhone.size} unique phone entries.`);
  console.log('Max Sequence Numbers per Month & Admin:', maxSeqPerMonthAdmin);

  console.log('\n📖 STEP 3: PREPARING TARGET DATA & PASS 1 (SET TEMPORARY CODES)...');

  const dbLeads = await prisma.lead.findMany({
    include: { customer: true, admin: true },
    orderBy: { id: 'asc' }
  });

  const updatePlan = [];
  const nonExcelLeads = [];
  const usedTargetCodes = new Set();

  for (const lead of dbLeads) {
    const phone = cleanPhone(lead.customer?.nomor_hp);
    if (phone && excelByPhone.has(phone)) {
      const ex = excelByPhone.get(phone);
      let targetKode = ex.kode;

      if (usedTargetCodes.has(targetKode)) {
        let suffix = 2;
        while (usedTargetCodes.has(`${ex.kode}_${suffix}`)) {
          suffix++;
        }
        targetKode = `${ex.kode}_${suffix}`;
      }
      usedTargetCodes.add(targetKode);

      const createdAt = parseDate(ex.tgl) || lead.createdAt;
      const estimasi_waktu = parseDate(ex.tripDate);
      const pax = parsePax(ex.pax);
      const nominal = parseNominal(ex.nominal);
      const mappedStatus = mapStatus(ex.status, ex.tahapan, ex.ket);
      const source = mapSource(ex.source);
      const admin_id = getAdminId(ex.agen);

      let noteParts = [];
      if (ex.ket) noteParts.push(ex.ket.toString().trim());
      if (ex.tripDate && !estimasi_waktu) noteParts.push(`[Jadwal Trip: ${ex.tripDate}]`);
      const catatan_khusus = noteParts.length > 0 ? noteParts.join(' | ') : null;

      const isClosed = mappedStatus === 'CLOSED WON' || mappedStatus === 'CLOSED LOST';

      updatePlan.push({
        leadId: lead.id,
        customerId: lead.customer.id,
        phone,
        oldKode: lead.kode_lead,
        targetKode,
        nama: ex.nama,
        data: {
          kode_lead: targetKode,
          admin_id,
          status_lead: mappedStatus,
          minat_destinasi: ex.destinasi ? ex.destinasi.toString().trim() : lead.minat_destinasi,
          jumlah_peserta: pax !== null ? pax : lead.jumlah_peserta,
          estimasi_waktu: estimasi_waktu || lead.estimasi_waktu,
          catatan_khusus: catatan_khusus || lead.catatan_khusus,
          referral_source: source !== 'tidak diketahui' ? source : lead.referral_source,
          estimasi_nilai_order: nominal !== null ? nominal : lead.estimasi_nilai_order,
          closed_at: isClosed ? (lead.closed_at || createdAt) : null
        }
      });
    } else {
      nonExcelLeads.push(lead);
    }
  }

  // Calculate re-sequenced codes for non-Excel leads
  const currentCounter = { ...maxSeqPerMonthAdmin };

  for (const lead of nonExcelLeads) {
    const createdDate = new Date(lead.createdAt);
    const yy = createdDate.getFullYear().toString().slice(-2);
    const mm = (createdDate.getMonth() + 1).toString().padStart(2, '0');
    const ym = `${yy}${mm}`;
    
    const adminName = lead.admin?.nama_admin?.trim() || 'Dela';
    const adminChar = adminName.charAt(0).toUpperCase();
    const key = `${ym}${adminChar}`;

    currentCounter[key] = (currentCounter[key] || 0) + 1;
    let newSeqNum = currentCounter[key];
    let targetKode = `${ym}${adminChar}${newSeqNum.toString().padStart(3, '0')}`;

    while (usedTargetCodes.has(targetKode)) {
      currentCounter[key]++;
      newSeqNum = currentCounter[key];
      targetKode = `${ym}${adminChar}${newSeqNum.toString().padStart(3, '0')}`;
    }

    usedTargetCodes.add(targetKode);

    updatePlan.push({
      leadId: lead.id,
      customerId: lead.customer.id,
      phone: cleanPhone(lead.customer?.nomor_hp),
      oldKode: lead.kode_lead,
      targetKode,
      isResequenced: true,
      data: {
        kode_lead: targetKode
      }
    });
  }

  console.log(`Total Leads to update: ${updatePlan.length}`);
  console.log('Pass 1: Setting temporary unique kode_lead (TEMP_id)...');
  for (const plan of updatePlan) {
    await prisma.lead.update({
      where: { id: plan.leadId },
      data: { kode_lead: `TEMP_${plan.leadId}` }
    });
  }
  console.log('✅ Pass 1 Completed cleanly.');

  console.log('\n📖 STEP 4: PASS 2 (APPLYING FINAL CLEAN KODE_LEAD & UPDATED FIELDS)...');

  let renamedCount = 0;
  let resequencedCount = 0;

  for (const plan of updatePlan) {
    if (plan.nama) {
      await prisma.customer.update({
        where: { id: plan.customerId },
        data: { nama_kontak: plan.nama }
      });
    }

    await prisma.lead.update({
      where: { id: plan.leadId },
      data: plan.data
    });

    if (plan.oldKode !== plan.targetKode) {
      if (plan.isResequenced) {
        resequencedCount++;
      } else {
        renamedCount++;
      }
    }
  }

  console.log('\n======================================================');
  console.log('🎉 DATABASE LEAD CODES SUCCESSFULLY SYNCHRONIZED!');
  console.log('======================================================');
  console.log(`- Total Leads in DB         : ${dbLeads.length}`);
  console.log(`- Matched with Excel        : ${updatePlan.length - nonExcelLeads.length}`);
  console.log(`- Renamed to Excel Codes    : ${renamedCount}`);
  console.log(`- Resequenced (Non-Excel)   : ${resequencedCount}`);
  console.log('======================================================\n');
}

runSync()
  .catch(err => {
    console.error('❌ Sync failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
