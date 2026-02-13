import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import prisma from '@pm-app/database';
import { logger } from '../utils/logger.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * DELETE /api/admin/reset-data
 * Clear all project-related data from the database
 * WARNING: This is destructive and cannot be undone
 */
router.delete('/reset-data', async (req: Request, res: Response) => {
  try {
    logger.warn(`User ${req.user!.id} initiated data reset`);

    // Delete in order to respect foreign key constraints
    await prisma.$transaction(async (tx) => {
      // Delete cost entries
      const costEntriesDeleted = await tx.costEntry.deleteMany({});
      logger.info(`Deleted ${costEntriesDeleted.count} cost entries`);

      // Delete resource allocations
      const allocationsDeleted = await tx.resourceAllocation.deleteMany({});
      logger.info(`Deleted ${allocationsDeleted.count} resource allocations`);

      // Delete resources
      const resourcesDeleted = await tx.resource.deleteMany({});
      logger.info(`Deleted ${resourcesDeleted.count} resources`);

      // Delete task dependencies
      const dependenciesDeleted = await tx.taskDependency.deleteMany({});
      logger.info(`Deleted ${dependenciesDeleted.count} task dependencies`);

      // Delete tasks
      const tasksDeleted = await tx.task.deleteMany({});
      logger.info(`Deleted ${tasksDeleted.count} tasks`);

      // Delete projects
      const projectsDeleted = await tx.project.deleteMany({});
      logger.info(`Deleted ${projectsDeleted.count} projects`);

      logger.info('All project data cleared successfully');
    });

    res.json({
      success: true,
      message: 'All project data has been cleared successfully',
    });
  } catch (error: any) {
    logger.error('Data reset error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reset data',
    });
  }
});

export default router;
