import { XMLParser } from 'fast-xml-parser';
import prisma from '../utils/db.js';
import { logger } from '../utils/logger.js';

export interface ImportResult {
  projectsImported: number;
  tasksImported: number;
  errors: string[];
}

/**
 * Import project and tasks from Microsoft Project XML file
 * Supports .xml and .mspdi formats
 * Note: Binary .mpp files must be exported to XML format from Microsoft Project first
 */
export async function importFromMSProject(
  fileBuffer: Buffer,
  organizationId: string,
  userId: string
): Promise<ImportResult> {
  const result: ImportResult = {
    projectsImported: 0,
    tasksImported: 0,
    errors: [],
  };

  try {
    // Check if this is a binary .mpp file (starts with specific magic bytes)
    const fileHeader = fileBuffer.slice(0, 8).toString('hex');
    const isBinaryMpp = fileHeader.startsWith('d0cf11e0a1b11ae1'); // OLE2 format magic bytes

    if (isBinaryMpp) {
      result.errors.push(
        'Binary .mpp files are not supported. Please export your Microsoft Project file to XML format: ' +
        'In MS Project, go to File → Save As → Save as type: XML Format (*.xml). ' +
        'Then upload the .xml file.'
      );
      return result;
    }

    // Ensure organization exists
    let organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          id: organizationId,
          name: 'Default Organization',
          slug: 'default-org',
        },
      });
      logger.info('Created default organization');
    }

    // Parse XML file
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });

    const xmlData = parser.parse(fileBuffer.toString());

    // MS Project XML has a root element "Project"
    const projectData = xmlData.Project;

    if (!projectData) {
      result.errors.push('Invalid Microsoft Project XML file');
      return result;
    }

    const projectName = projectData.Name || projectData.Title || 'Imported MS Project';
    const tasks = Array.isArray(projectData.Tasks?.Task)
      ? projectData.Tasks.Task
      : projectData.Tasks?.Task
        ? [projectData.Tasks.Task]
        : [];

    logger.info(`Parsing MS Project file: ${projectName} with ${tasks.length} tasks`);

    if (tasks.length === 0) {
      result.errors.push('No tasks found in Microsoft Project file');
      return result;
    }

    // Determine project dates from tasks
    const taskDates = tasks
      .map((t: any) => ({
        start: parseDate(t.Start),
        end: parseDate(t.Finish || t.End),
      }))
      .filter((d) => d.start || d.end);

    const startDates = taskDates.map((d) => d.start).filter(Boolean) as Date[];
    const endDates = taskDates.map((d) => d.end).filter(Boolean) as Date[];

    const projectStartDate = startDates.length > 0
      ? new Date(Math.min(...startDates.map((d) => d.getTime())))
      : new Date();
    const projectEndDate = endDates.length > 0
      ? new Date(Math.max(...endDates.map((d) => d.getTime())))
      : undefined;

    // Create or update project
    let project = await prisma.project.findFirst({
      where: {
        name: projectName,
        organizationId,
      },
    });

    if (project) {
      project = await prisma.project.update({
        where: { id: project.id },
        data: {
          startDate: projectStartDate,
          endDate: projectEndDate,
        },
      });
      logger.info(`Updated existing project: ${projectName}`);
    } else {
      project = await prisma.project.create({
        data: {
          organizationId,
          name: projectName,
          description: `Imported from Microsoft Project - ${tasks.length} tasks`,
          status: 'active',
          priority: 'medium',
          startDate: projectStartDate,
          endDate: projectEndDate,
          createdBy: userId,
        },
      });
      result.projectsImported++;
      logger.info(`Created new project: ${projectName}`);
    }

    // Import tasks
    for (const msTask of tasks) {
      try {
        // Skip summary tasks (tasks that are just containers)
        if (msTask.Summary === '1' || msTask.IsSummary === 'true') {
          continue;
        }

        const taskId = msTask.UID || msTask.ID || '';
        const taskTitle = msTask.Name || `Task ${taskId}` || 'Imported Task';
        const taskDescription = msTask.Notes || '';

        // MS Project completion is 0-100
        const percentComplete = parseInt(msTask.PercentComplete || '0', 10);
        const status = mapStatus(percentComplete);

        // MS Project priority is 0-1000, with 500 being normal
        const msPriority = parseInt(msTask.Priority || '500', 10);
        const priority = mapPriority(msPriority);

        const startDate = parseDate(msTask.Start);
        const endDate = parseDate(msTask.Finish || msTask.End);

        // Check if task already exists
        let task = await prisma.task.findFirst({
          where: {
            projectId: project.id,
            title: taskTitle,
          },
        });

        if (task) {
          // Update existing task
          await prisma.task.update({
            where: { id: task.id },
            data: {
              description: taskDescription,
              status,
              priority,
              startDate,
              endDate,
            },
          });
        } else {
          // Create new task
          await prisma.task.create({
            data: {
              projectId: project.id,
              title: taskTitle,
              description: taskDescription,
              status,
              priority,
              taskType: 'task',
              assignedTo: userId,
              createdBy: userId,
              startDate,
              endDate,
            },
          });
          result.tasksImported++;
        }
      } catch (taskError: any) {
        logger.error(`Failed to import task: ${taskError.message}`);
        result.errors.push(`Task import error: ${taskError.message}`);
      }
    }

    logger.info(
      `MS Project import completed: ${result.projectsImported} projects, ${result.tasksImported} tasks, ${result.errors.length} errors`
    );
  } catch (error: any) {
    logger.error('MS Project import failed:', error);
    result.errors.push(`Import failed: ${error.message}`);
  }

  return result;
}

/**
 * Parse date from MS Project format
 * MS Project dates are in ISO format: 2024-01-15T08:00:00
 */
function parseDate(value: any): Date | undefined {
  if (!value) return undefined;

  try {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch {
    // Ignore parse errors
  }

  return undefined;
}

/**
 * Map MS Project completion percentage to our status
 * 0% = todo, 1-99% = in_progress, 100% = completed
 */
function mapStatus(percentComplete: number): string {
  if (percentComplete === 100) {
    return 'completed';
  }
  if (percentComplete > 0) {
    return 'in_progress';
  }
  return 'todo';
}

/**
 * Map MS Project priority (0-1000) to our priority
 * 0-400 = low, 401-600 = medium, 601-1000 = high
 */
function mapPriority(msPriority: number): string {
  if (msPriority > 600) {
    return 'high';
  }
  if (msPriority < 400) {
    return 'low';
  }
  return 'medium';
}
