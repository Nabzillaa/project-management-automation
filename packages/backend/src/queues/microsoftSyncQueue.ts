import Queue from 'bull';
import prisma from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { MicrosoftAuthService } from '../services/microsoftAuthService.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const microsoftSyncQueue = new Queue('microsoft-profile-sync', REDIS_URL);

microsoftSyncQueue.process(async (job) => {
  try {
    const { userId } = job.data;

    const credential = await prisma.integrationCredential.findFirst({
      where: {
        userId,
        integrationType: 'microsoft',
      },
    });

    if (!credential || !credential.accessToken) {
      logger.debug(`No Microsoft credentials found for user ${userId}`);
      return { skipped: true };
    }

    const microsoftAuth = new MicrosoftAuthService();
    const profile = await microsoftAuth.getUserProfile(credential.accessToken);

    await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: profile.givenName,
        lastName: profile.surname,
      },
    });

    logger.info(`Synced Microsoft profile for user ${userId}`);
    return { success: true };
  } catch (error: any) {
    logger.error('Microsoft profile sync error:', error);
    throw error;
  }
});

microsoftSyncQueue.on('completed', (job) => {
  logger.info(`Profile sync completed for job ${job.id}`);
});

microsoftSyncQueue.on('failed', (job, err) => {
  logger.error(`Profile sync failed for job ${job.id}:`, err.message);
});

export function scheduleProfileSync(userId: string) {
  microsoftSyncQueue.add({ userId }, { repeat: { cron: '0 0 * * *' } });
}
