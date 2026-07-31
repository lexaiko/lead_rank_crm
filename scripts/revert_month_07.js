import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { normalizePhoneNumber } from '../src/utils/phone.js';

const prisma = new PrismaClient();

function cleanPhone(raw) {
  if (!raw) return '';
  let str = raw.toString().trim().split('\n')[0].trim();
  let digits = normalizePhoneNumber(str);
  if (digits.startsWith('08')) digits = '628' + digits.slice(2);
  return digits;
}

async function revertMonth07Leads() {
  console.log('=== MEMULAI REVERT DATA BULAN 07 KEMBALI KE PER-ADMIN SEQUENCE ===');

  const wb = XLSX.readFile('Data Leads 2026.xlsx');
  const inputSheet = wb.Sheets['Input Data'];
  const rows = XLSX.utils.sheet_to_json(inputSheet, { header: 1 });

  const excelLeadsByPhone = new Map();
  const excelLeadsByCode = new Map();
  const maxPerAdminInExcel = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;
    const kode = row[0].toString().trim();
    if (!kode.startsWith('2607')) continue;

    const match = kode.match(/^2607([A-Z])(\d+)/);
    if (match) {
      const init = match[1];
      const idx = parseInt(match[2], 10);
      if (!maxPerAdminInExcel[init] || idx > maxPerAdminInExcel[init]) {
        maxPerAdminInExcel[init] = idx;
      }
    }

    const phone = cleanPhone(row[3]);
    const item = { kode, nama: row[2], phone, admin: row[5] };
    excelLeadsByCode.set(kode, item);
    if (phone) excelLeadsByPhone.set(phone, item);
  }

  console.log('[Excel Data] Max Index per Admin di Excel Bulan 07:', maxPerAdminInExcel);

  const dbLeads = await prisma.lead.findMany({
    where: { kode_lead: { startsWith: '2607' } },
    include: { customer: true, admin: true },
    orderBy: { id: 'asc' }
  });

  const nextIndexPerAdmin = {
    D: (maxPerAdminInExcel['D'] || 0) + 1,
    A: (maxPerAdminInExcel['A'] || 0) + 1,
    H: (maxPerAdminInExcel['H'] || 0) + 1,
    S: (maxPerAdminInExcel['S'] || 0) + 1
  };

  const usedCodes = new Set();
  const updatePlan = [];

  // Step 1: Retain exact Excel codes for DB leads matching Excel rows
  dbLeads.forEach(l => {
    const hp = l.customer.nomor_hp;
    const matchedExcel = excelLeadsByCode.get(l.kode_lead) || excelLeadsByPhone.get(hp);

    if (matchedExcel && !usedCodes.has(matchedExcel.kode)) {
      usedCodes.add(matchedExcel.kode);
      updatePlan.push({ id: l.id, oldCode: l.kode_lead, newCode: matchedExcel.kode, isExcel: true });
    } else {
      updatePlan.push({ id: l.id, oldCode: l.kode_lead, newCode: null, isExcel: false });
    }
  });

  // Step 2: Assign per-admin sequential indices for new/non-excel leads
  updatePlan.forEach(p => {
    if (!p.isExcel) {
      const leadObj = dbLeads.find(l => l.id === p.id);
      const adminInitial = leadObj.admin.nama_admin?.trim().charAt(0).toUpperCase() || 'X';
      if (!nextIndexPerAdmin[adminInitial]) nextIndexPerAdmin[adminInitial] = 1;

      let targetCode = `2607${adminInitial}${nextIndexPerAdmin[adminInitial].toString().padStart(3, '0')}`;
      while (usedCodes.has(targetCode)) {
        nextIndexPerAdmin[adminInitial]++;
        targetCode = `2607${adminInitial}${nextIndexPerAdmin[adminInitial].toString().padStart(3, '0')}`;
      }
      p.newCode = targetCode;
      usedCodes.add(targetCode);
      nextIndexPerAdmin[adminInitial]++;
    }
  });

  console.log(`[Revert Engine] Memproses ${updatePlan.length} pembaruan di database...`);

  // Phase 1: Clear old codes to temporary values to prevent unique constraint collisions
  for (const item of updatePlan) {
    if (item.oldCode !== item.newCode) {
      await prisma.lead.update({
        where: { id: item.id },
        data: { kode_lead: `TEMP_${item.id}` }
      });
    }
  }

  // Phase 2: Assign final per-admin unique codes
  let updatedCount = 0;
  for (const item of updatePlan) {
    await prisma.lead.update({
      where: { id: item.id },
      data: { kode_lead: item.newCode }
    });
    if (item.oldCode !== item.newCode) updatedCount++;
  }

  console.log(`\n=== REVERT BERHASIL DILAKUKAN ===`);
  console.log(`- Total Lead Bulan 07: ${dbLeads.length}`);
  console.log(`- Total Lead Diperbarui Kode: ${updatedCount}`);
  console.log(`- Total Unique Code Akhir: ${usedCodes.size}`);
  console.log('Next Index Per Admin Selanjutnya:');
  console.log(nextIndexPerAdmin);

  await prisma.$disconnect();
}

revertMonth07Leads().catch(err => {
  console.error('Error reverting month 07 leads:', err);
  process.exit(1);
});
