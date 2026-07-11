import { prisma } from './config/prisma.js';
import { handleIncomingMessage } from './services/whatsapp.js';
import { processAIQueue } from './cron/ai-worker.js';

// Setup environment configs if not already set
process.env.LEAD_REOPEN_WINDOW_DAYS = '30';
process.env.AI_DEBOUNCE_MINUTES = '15';
process.env.AI_BATCH_SIZE = '1';

async function runTests() {
  console.log('=== STARTING CRM REFACTOR ARCHITECTURE TEST ===\n');

  const testPhone = '628999999999';
  
  // 1. Clean up existing test customer data to keep the test repeatable
  console.log(`[Test Setup] Cleaning up any existing test customer with number ${testPhone}...`);
  const existingCust = await prisma.customer.findUnique({
    where: { nomor_hp: testPhone },
    include: { leads: true }
  });
  if (existingCust) {
    for (const lead of existingCust.leads) {
      await prisma.aIJob.deleteMany({ where: { lead_id: lead.id } });
      await prisma.aIAnalysis.deleteMany({ where: { lead_id: lead.id } });
    }
    await prisma.customer.delete({ where: { id: existingCust.id } });
    console.log('[Test Setup] Existing test data cleaned up successfully.');
  }

  // 2. Ensure we have an active Admin in DB to assign leads
  let admin = await prisma.admin.findFirst({ where: { is_active: true } });
  if (!admin) {
    console.log('[Test Setup] No active Admin found. Creating a mock admin Eko...');
    admin = await prisma.admin.create({
      data: {
        nama_admin: 'Eko',
        nomor_wa: '6289621284046',
        is_active: true
      }
    });
  }
  console.log(`[Test Setup] Using active Admin: ${admin.nama_admin} (${admin.nomor_wa})`);

  // Mock message metadata from Baileys
  const mockBaileysContext = (text, timestamp = Math.floor(Date.now() / 1000), fromMe = false) => ({
    key: {
      remoteJid: `${testPhone}@s.whatsapp.net`,
      fromMe,
      id: `MSG_${Date.now()}_${Math.floor(Math.random() * 1000)}`
    },
    message: { conversation: text },
    messageTimestamp: timestamp
  });

  // =========================================================================
  // TEST 1: Lead Creation & AI Queue Debounce
  // =========================================================================
  console.log('\n--- TEST 1: INCOMING CHAT & AUTOMATIC LEAD CREATION ---');
  
  const msg1 = mockBaileysContext('Halo kak, saya tertarik dengan Open Trip Banyuwangi untuk bulan depan tanggal 15.');
  await handleIncomingMessage({}, msg1, admin.id);

  // Retrieve customer & lead
  const customer = await prisma.customer.findUnique({
    where: { nomor_hp: testPhone },
    include: { leads: { include: { messages: true } } }
  });

  if (!customer || customer.leads.length === 0) {
    throw new Error('Customer or Lead was not automatically created!');
  }

  const firstLead = customer.leads[0];
  console.log(`[PASS] Lead automatically created: ID ${firstLead.id}, Kode: ${firstLead.kode_lead}`);
  console.log(`[PASS] Chat message saved. Total messages: ${firstLead.messages.length}`);

  // Retrieve enqueued AI job
  let aiJob = await prisma.aIJob.findFirst({
    where: { lead_id: firstLead.id, status: 'WAITING' }
  });

  if (!aiJob) {
    throw new Error('AIJob was not enqueued for the lead!');
  }
  const originalExecuteAt = new Date(aiJob.execute_at);
  console.log(`[PASS] AIJob enqueued with status WAITING. Scheduled execute_at: ${originalExecuteAt.toISOString()}`);

  // Simulating debounce postponement
  console.log('\n--- TEST 1B: DEBOUNCE TIMER POSTPONEMENT ---');
  console.log('Sending a second message to check if debounce execute_at gets pushed forward...');
  const msg2 = mockBaileysContext('Untuk 4 orang ya kakk.', Math.floor(Date.now() / 1000) + 10);
  await handleIncomingMessage({}, msg2, admin.id);

  aiJob = await prisma.aIJob.findFirst({
    where: { lead_id: firstLead.id, status: 'WAITING' }
  });

  const updatedExecuteAt = new Date(aiJob.execute_at);
  console.log(`Original execution: ${originalExecuteAt.toISOString()}`);
  console.log(`Postponed execution: ${updatedExecuteAt.toISOString()}`);
  
  if (updatedExecuteAt.getTime() <= originalExecuteAt.getTime()) {
    throw new Error('Debounce did not push execution time forward!');
  }
  console.log('[PASS] Debounce works perfectly! Execution time updated forward.');

  // =========================================================================
  // TEST 2: Reopen Lead (Inside 30 days window)
  // =========================================================================
  console.log('\n--- TEST 2: REOPEN CLOSED LEAD (WITHIN 30 DAYS WINDOW) ---');
  console.log('Manually closing lead 1 as CLOSED WON...');
  await prisma.lead.update({
    where: { id: firstLead.id },
    data: {
      status_lead: 'CLOSED WON',
      closed_at: new Date()
    }
  });

  console.log('Sending chat message to closed lead...');
  const msg3 = mockBaileysContext('Eh kak, ada tambahan request jemput di Stasiun Banyuwangi Baru ya.');
  await handleIncomingMessage({}, msg3, admin.id);

  const updatedCust = await prisma.customer.findUnique({
    where: { nomor_hp: testPhone },
    include: { leads: true }
  });

  console.log(`Total leads: ${updatedCust.leads.length}`);
  const reopenedLead = updatedCust.leads[0];
  console.log(`Lead status after chat: ${reopenedLead.status_lead}, closed_at: ${reopenedLead.closed_at}`);

  if (updatedCust.leads.length !== 1 || reopenedLead.status_lead !== 'PROSPEK' || reopenedLead.closed_at !== null) {
    throw new Error('Lead was not reopened or a new lead was incorrectly created!');
  }
  console.log('[PASS] Closed lead was successfully reopened back to PROSPEK (closed_at reset to null).');

  // =========================================================================
  // TEST 3: Lead Creation (Outside 30 days window)
  // =========================================================================
  console.log('\n--- TEST 3: NEW LEAD CREATION (OUTSIDE 30 DAYS WINDOW) ---');
  console.log('Manually closing lead 1 and setting closed_at to 45 days ago...');
  const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  await prisma.lead.update({
    where: { id: firstLead.id },
    data: {
      status_lead: 'CLOSED LOST',
      closed_at: fortyFiveDaysAgo
    }
  });

  console.log('Sending new chat message...');
  const msg4 = mockBaileysContext('Kak, mau nanya paket trip baru dong untuk Desember nanti.');
  await handleIncomingMessage({}, msg4, admin.id);

  const finalCust = await prisma.customer.findUnique({
    where: { nomor_hp: testPhone },
    include: { leads: true }
  });

  console.log(`Total leads now: ${finalCust.leads.length}`);
  if (finalCust.leads.length !== 2) {
    throw new Error('New lead was not created for chat outside of reopen window!');
  }
  const newLead = finalCust.leads.find(l => l.id !== firstLead.id);
  console.log(`[PASS] New Lead created successfully: ID ${newLead.id}, Kode: ${newLead.kode_lead}, Status: ${newLead.status_lead}`);

  // =========================================================================
  // TEST 4: Force Run Asynchronous AI worker
  // =========================================================================
  console.log('\n--- TEST 4: AI WORKER BATCH EXECUTOR ---');
  console.log('Triggering processAIQueue(force = true) to bypass debounce timer and call Gemini API...');
  
  await processAIQueue(true);

  // Retrieve analysis results
  const analyzedNewLead = await prisma.lead.findUnique({
    where: { id: newLead.id }
  });

  const auditLog = await prisma.aIAnalysis.findFirst({
    where: { lead_id: newLead.id }
  });

  const finalJob = await prisma.aIJob.findFirst({
    where: { lead_id: newLead.id }
  });

  console.log('\n--- RESULTS AFTER GEMINI ANALYSIS ---');
  console.log(`Status Lead: ${analyzedNewLead.status_lead}`);
  console.log(`Destinasi: ${analyzedNewLead.minat_destinasi}`);
  console.log(`Jumlah Peserta: ${analyzedNewLead.jumlah_peserta}`);
  console.log(`Estimasi Waktu: ${analyzedNewLead.estimasi_waktu ? analyzedNewLead.estimasi_waktu.toISOString().split('T')[0] : 'null'}`);
  console.log(`Catatan / Summary: "${analyzedNewLead.catatan_khusus}"`);
  console.log(`Referral Source: ${analyzedNewLead.referral_source}`);
  console.log(`Estimasi Nilai Order: ${analyzedNewLead.estimasi_nilai_order}`);
  console.log(`AI Last Analyzed Msg ID: ${analyzedNewLead.ai_last_analyzed_message_id}`);
  console.log(`AI Job Status: ${finalJob ? finalJob.status : 'null'}`);
  console.log(`Audit Log Available: ${auditLog ? 'YES' : 'NO'}`);

  if (analyzedNewLead.status_lead === 'NEW') {
    throw new Error('AI analysis did not update Lead status!');
  }
  if (!auditLog) {
    throw new Error('AIAnalysis audit log was not created!');
  }
  if (finalJob.status !== 'DONE') {
    throw new Error('AIJob status was not set to DONE!');
  }
  console.log('\n[PASS] Asynchronous AI worker completed successfully and synchronized data!');

  console.log('\n=== ALL CRM REFACTOR TESTS COMPLETED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('\n=== TEST FAILED ===');
  console.error(err);
  process.exit(1);
});
