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

async function migrateMonth07Leads() {
  console.log('=== MEMULAI RE-INDEX KODE LEAD BULAN 07 (JULI 2026) ===');

  const wb = XLSX.readFile('Data Leads 2026.xlsx');
  const inputSheet = wb.Sheets['Input Data'];
  const rows = XLSX.utils.sheet_to_json(inputSheet, { header: 1 });

  const excelLeadsByPhone = new Map();
  const excelLeadsByCode = new Map();
  let maxExcelIndex = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;
    const kode = row[0].toString().trim();
    if (!kode.startsWith('2607')) continue;

    const match = kode.match(/^2607[A-Z](\d+)/);
    if (match) {
      const idx = parseInt(match[1], 10);
      if (!isNaN(idx) && idx > maxExcelIndex) maxExcelIndex = idx;
    }

    const phone = cleanPhone(row[3]);
    const item = { kode, nama: row[2], phone, admin: row[5] };
    excelLeadsByCode.set(kode, item);
    if (phone) excelLeadsByPhone.set(phone, item);
  }

  console.log(`[Excel Data] Index Tertinggi di Sheet Excel Bulan 07: ${maxExcelIndex}`);

  const dbLeads = await prisma.lead.findMany({
    where: { kode_lead: { startsWith: '2607' } },
    include: { customer: true, admin: true },
    orderBy: { id: 'asc' }
  });

  console.log(`[DB Data] Total Lead Terdaftar di Database Bulan 07: ${dbLeads.length}`);

  const usedCodes = new Set();
  const updatePlan = [];
  let nextGlobalIndex = maxExcelIndex + 1;

  // Step 1: Retain exact Excel codes for DB leads matching Excel rows
  dbLeads.forEach(l => {
    const hp = l.customer.nomor_hp;
    const matchedExcel = excelLeadsByCode.get(l.kode_lead) || excelLeadsByPhone.get(hp);

    if (matchedExcel) {
      let targetCode = matchedExcel.kode;
      if (usedCodes.has(targetCode)) {
        const adminInitial = l.admin.nama_admin?.trim().charAt(0).toUpperCase() || 'X';
        targetCode = `2607${adminInitial}${nextGlobalIndex.toString().padStart(3, '0')}`;
        nextGlobalIndex++;
      }
      usedCodes.add(targetCode);
      updatePlan.push({ id: l.id, oldCode: l.kode_lead, newCode: targetCode, isExcel: true });
    } else {
      updatePlan.push({ id: l.id, oldCode: l.kode_lead, newCode: null, isExcel: false });
    }
  });

  // Step 2: Assign global sequential indices for new/non-excel leads
  updatePlan.forEach(p => {
    if (!p.isExcel) {
      const leadObj = dbLeads.find(l => l.id === p.id);
      const adminInitial = leadObj.admin.nama_admin?.trim().charAt(0).toUpperCase() || 'X';
      let targetCode = `2607${adminInitial}${nextGlobalIndex.toString().padStart(3, '0')}`;
      while (usedCodes.has(targetCode)) {
        nextGlobalIndex++;
        targetCode = `2607${adminInitial}${nextGlobalIndex.toString().padStart(3, '0')}`;
      }
      p.newCode = targetCode;
      usedCodes.add(targetCode);
      nextGlobalIndex++;
    }
  });

  console.log(`[Re-index Engine] Memproses ${updatePlan.length} pembaruan di database...`);

  // To avoid MySQL unique constraint errors during mass update, temporarily clear old codes to a temp prefix
  for (const item of updatePlan) {
    if (item.oldCode !== item.newCode) {
      await prisma.lead.update({
        where: { id: item.id },
        data: { kode_lead: `TEMP_${item.id}` }
      });
    }
  }

  // Assign final unique codes
  let updatedCount = 0;
  for (const item of updatePlan) {
    await prisma.lead.update({
      where: { id: item.id },
      data: { kode_lead: item.newCode }
    });
    if (item.oldCode !== item.newCode) updatedCount++;
  }

  console.log(`\n=== SUKSES MERAPIKAN DATA BULAN 07 ===`);
  console.log(`- Total Lead Bulan 07: ${dbLeads.length}`);
  console.log(`- Total Lead Diperbarui Kode: ${updatedCount}`);
  console.log(`- Total Unique Code Akhir: ${usedCodes.size}`);
  console.log(`- Index Terakhir Bulan 07 Saat Ini: ${nextGlobalIndex - 1}`);

  await prisma.$disconnect();
}

migrateMonth07Leads().catch(err => {
  console.error('Error migrating month 07 leads:', err);
  process.exit(1);
});
