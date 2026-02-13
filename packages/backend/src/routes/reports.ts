import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { generateExecutiveSummary, formatExecutiveSummaryHTML } from '../services/reportGenerator.js';
import { sendEmail } from '../services/emailService.js';

const router = Router();
router.use(authenticate);

// Generate executive summary report
router.get('/executive-summary/:organizationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const { startDate, endDate, format = 'json' } = req.query;

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const summary = await generateExecutiveSummary(organizationId, start, end);

    if (format === 'html') {
      const html = formatExecutiveSummaryHTML(summary);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
      return;
    }

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error generating executive summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate executive summary',
    });
  }
});

// Email executive summary
router.post('/executive-summary/:organizationId/email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const { email, startDate, endDate } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email address is required',
      });
      return;
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const summary = await generateExecutiveSummary(organizationId, start, end);
    const html = formatExecutiveSummaryHTML(summary);

    await sendEmail({
      to: email,
      subject: `Executive Summary Report - ${summary.generatedAt.toLocaleDateString()}`,
      html,
    });

    res.json({
      success: true,
      message: 'Report sent successfully',
    });
  } catch (error) {
    console.error('Error sending executive summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send executive summary',
    });
  }
});

export default router;
