import cron from 'node-cron';
import { prisma } from '../config/prisma.js';

/**
 * Modul B: Ghosting Sweeper (Every day at 01:00 AM)
 * Cari Lead aktif yang tidak memiliki aktivitas (tidak ada update) selama 3 hari terakhir.
 * Tutup secara otomatis.
 */
export async function runGhostingSweeper() {
  console.log('[Ghosting Sweeper] Starting sweep at:', new Date().toISOString());
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    
    const result = await prisma.lead.updateMany({
      where: {
        status_lead: {
          in: ['NEW', 'PROSPEK', 'QUALIFIED', 'HOT']
        },
        updatedAt: {
          lt: threeDaysAgo
        }
      },
      data: {
        status_lead: 'CLOSED LOST',
        catatan_sistem: 'Auto-Closed Lost: Customer terindikasi ghosting (tidak ada respon > 3 hari).',
        closed_at: new Date()
      }
    });

    console.log(`[Ghosting Sweeper] Finished. Swept and closed ${result.count} inactive leads.`);
    return result.count;
  } catch (err) {
    console.error('[Ghosting Sweeper] Error during sweep:', err);
    throw err;
  }
}

/**
 * Initialize active Cron Jobs
 */
export function initCronJobs() {
  // Modul B: Cron Job Jam 01:00 Pagi (Ghosting Sweeper)
  cron.schedule('0 1 * * *', async () => {
    try {
      await runGhostingSweeper();
    } catch (e) {
      console.error('Scheduled Ghosting Sweeper failed:', e);
    }
  });

  console.log('Cron Jobs scheduled successfully (01:00 for Sweeper).');
}
