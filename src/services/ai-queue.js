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

    // Find existing WAITING job for this lead
    const existingJob = await prisma.aIJob.findFirst({
      where: {
        lead_id: leadId,
        status: 'WAITING'
      }
    });

    if (existingJob) {
      // Update execution time to extend the debounce window
      await prisma.aIJob.update({
        where: { id: existingJob.id },
        data: { execute_at: executeAt }
      });
      console.log(`[AI Queue] Updated WAITING job ID ${existingJob.id} for Lead ${leadId}. Debounced to ${executeAt.toISOString()}`);
    } else {
      // Create a brand new WAITING job
      const newJob = await prisma.aIJob.create({
        data: {
          lead_id: leadId,
          status: 'WAITING',
          execute_at: executeAt
        }
      });
      console.log(`[AI Queue] Enqueued new WAITING job ID ${newJob.id} for Lead ${leadId}. Scheduled for ${executeAt.toISOString()}`);
    }
  } catch (err) {
    console.error(`[AI Queue] Failed to enqueue job for Lead ${leadId}:`, err);
  }
}
