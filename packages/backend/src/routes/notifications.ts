import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import prisma from '../utils/db.js';
import { z } from 'zod';
import { queueEmail, queueBudgetAlert, queueTaskReminder } from '../queues/notificationQueue.js';

const router = Router();
router.use(authenticate);

const createNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(['info', 'warning', 'error', 'success']),
  title: z.string().min(1),
  message: z.string().min(1),
  link: z.string().optional(),
});

// Get notifications for a user
router.get('/user/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { unreadOnly } = req.query;

    const where: any = { userId };
    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications',
    });
  }
});

// Create notification
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = createNotificationSchema.parse(req.body);

    const notification = await prisma.notification.create({
      data: validatedData,
    });

    res.status(201).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create notification',
    });
  }
});

// Mark notification as read
router.patch('/:id/read', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read',
    });
  }
});

// Mark all as read
router.post('/user/:userId/mark-all-read', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all as read',
    });
  }
});

// Delete notification
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.notification.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification',
    });
  }
});

// Send test email
router.post('/test-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    await queueEmail({
      to: email,
      subject: 'Test Email from PM App',
      html: '<h1>Test Email</h1><p>This is a test email from the Project Management App.</p>',
    });

    res.json({
      success: true,
      message: 'Test email queued successfully',
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test email',
    });
  }
});

export default router;
