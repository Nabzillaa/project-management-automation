import { Router, Request, Response, raw } from 'express';
import { JiraWebhookHandler } from '../services/jiraWebhookHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();
const webhookHandler = new JiraWebhookHandler();

// JIRA webhook - uses raw body for signature verification
router.post(
  '/jira',
  raw({ type: 'application/json' }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const signature = req.headers['x-hub-signature'] as string;

      // Verify signature
      if (!webhookHandler.verifySignature(req.body.toString(), signature)) {
        logger.warn('Invalid JIRA webhook signature');
        res.status(401).json({ success: false, error: 'Invalid signature' });
        return;
      }

      const payload = JSON.parse(req.body.toString());
      await webhookHandler.handleWebhook(payload);

      res.json({ success: true, message: 'Webhook processed' });
    } catch (error: any) {
      logger.error('Error processing JIRA webhook:', error);
      res.status(500).json({ success: false, error: 'Failed to process webhook' });
    }
  }
);

export default router;
