import { prisma } from '../config/prisma.js';

/**
 * Enqueues a Lead for AI analysis with a 15-minute debounce timer.
 * If there is already a WAITING job for this lead, its execution time is postponed.
 * 
 * @param {number} leadId 
 */
export async function enqueueAIJob(leadId) {
  try {
    const debounceMinutes = parseInt(process.env.AI_DEBOUNCE_MINUTES, 10) || 15;
    const executeAt = new Date(Date.now() + debounceMinutes * 60 * 1000);

    // Atomic update to extend debounce window without SELECT-then-UPDATE race condition (prevents MySQL 1020 error)
    const updated = await prisma.aIJob.updateMany({
      where: {
        lead_id: leadId,
        status: 'WAITING'
      },
      data: {
        execute_at: executeAt
      }
    });

    if (updated.count > 0) {
      console.log(`[AI Queue] Updated WAITING job for Lead ${leadId}. Debounced to ${executeAt.toISOString()}`);
    } else {
      // Create a brand new WAITING job if none exists
      try {
        const newJob = await prisma.aIJob.create({
          data: {
            lead_id: leadId,
            status: 'WAITING',
            execute_at: executeAt
          }
        });
        console.log(`[AI Queue] Enqueued new WAITING job ID ${newJob.id} for Lead ${leadId}. Scheduled for ${executeAt.toISOString()}`);
      } catch (createErr) {
        // Fallback: If concurrent creation occurred, extend the debounce window
        await prisma.aIJob.updateMany({
          where: { lead_id: leadId, status: 'WAITING' },
          data: { execute_at: executeAt }
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error(`[AI Queue] Failed to enqueue job for Lead ${leadId}:`, err);
  }
}
