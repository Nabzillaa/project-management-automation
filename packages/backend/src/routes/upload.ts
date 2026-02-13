import { Router, Request, Response } from 'express';
import multer from 'multer';
import { importFromExcel, updateCostsFromExcel } from '../services/excelImport.js';
import { importFromCSV } from '../services/csvImport.js';
import { importFromMSProject } from '../services/msProjectImport.js';
import { ApiResponse } from '@pm-app/shared';
import { logger } from '../utils/logger.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Configure multer for memory storage (file buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept Excel, CSV, and MS Project XML files
    const allowedMimeTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.oasis.opendocument.spreadsheet',
      'text/csv',
      'application/csv',
      'text/xml',
      'application/xml',
    ];

    const allowedExtensions = /\.(xlsx|xls|ods|csv|xml)$/i;

    if (allowedMimeTypes.includes(file.mimetype) || file.originalname.match(allowedExtensions)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls, .ods), CSV (.csv), and MS Project XML (.xml) files are allowed. Binary .mpp files must be exported to XML format first.'));
    }
  },
});

/**
 * POST /api/upload/file
 * Upload and import Excel, CSV, or MS Project file with project and task data
 */
router.post(
  '/file',
  upload.single('file'),
  async (req: Request, res: Response<ApiResponse<any>>) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      const { organizationId } = req.body;

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          error: 'Organization ID is required',
        });
      }

      const userId = req.user!.id;
      const fileName = req.file.originalname.toLowerCase();

      logger.info(
        `Processing file upload: ${req.file.originalname} (${req.file.size} bytes) for org ${organizationId}`
      );

      // Determine file type and import accordingly
      let result;
      let fileType = 'Unknown';

      if (fileName.endsWith('.csv')) {
        fileType = 'CSV';
        result = await importFromCSV(req.file.buffer, organizationId, userId);
      } else if (fileName.endsWith('.xml')) {
        fileType = 'Microsoft Project XML';
        result = await importFromMSProject(req.file.buffer, organizationId, userId);
      } else if (fileName.match(/\.(xlsx|xls|ods)$/i)) {
        fileType = 'Excel';
        result = await importFromExcel(req.file.buffer, organizationId, userId);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Unsupported file format. Please use Excel (.xlsx, .xls, .ods), CSV (.csv), or MS Project XML (.xml) files.',
        });
      }

      if (result.errors.length > 0 && result.projectsImported === 0 && result.tasksImported === 0) {
        // Complete failure - use the first error message if available
        const errorMessage = result.errors[0] || `Import failed for ${fileType} file`;
        return res.status(400).json({
          success: false,
          error: errorMessage,
          data: result,
        });
      }

      // Partial or complete success
      return res.status(200).json({
        success: true,
        message: `Successfully imported ${result.projectsImported} projects and ${result.tasksImported} tasks from ${fileType} file`,
        data: result,
      });
    } catch (error: any) {
      logger.error('File upload error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to process file',
      });
    }
  }
);

// Keep /excel endpoint for backwards compatibility
router.post('/excel', upload.single('file'), async (req: Request, res: Response<ApiResponse<any>>) => {
  // Redirect to /file endpoint
  req.url = '/file';
  return router.handle(req, res, () => {});
});

/**
 * POST /api/upload/update-costs/:projectId
 * Update cost data from Excel file for existing tasks in a project
 * This only updates estimatedCost, actualCost, estimatedHours, actualHours - doesn't modify other task properties
 */
router.post(
  '/update-costs/:projectId',
  upload.single('file'),
  async (req: Request, res: Response<ApiResponse<any>>) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      const { projectId } = req.params;
      const fileName = req.file.originalname.toLowerCase();

      // Only accept Excel files for cost updates
      if (!fileName.match(/\.(xlsx|xls|ods)$/i)) {
        return res.status(400).json({
          success: false,
          error: 'Only Excel files (.xlsx, .xls, .ods) are supported for cost updates',
        });
      }

      logger.info(
        `Processing cost update from Excel: ${req.file.originalname} (${req.file.size} bytes) for project ${projectId}`
      );

      const result = await updateCostsFromExcel(req.file.buffer, projectId);

      if (result.errors.length > 0 && result.tasksUpdated === 0) {
        return res.status(400).json({
          success: false,
          error: result.errors[0] || 'Cost update failed',
          data: result,
        });
      }

      return res.status(200).json({
        success: true,
        message: `Updated costs for ${result.tasksUpdated} tasks. Budget: $${result.totalBudget.toLocaleString()}, Actual: $${result.totalActualCost.toLocaleString()}`,
        data: result,
      });
    } catch (error: any) {
      logger.error('Cost update from Excel error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to update costs from Excel',
      });
    }
  }
);

export default router;
