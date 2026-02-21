import { parse } from 'csv-parse/sync';
import prisma from '../utils/db.js';
import { logger } from '../utils/logger.js';

export interface ImportResult {
  projectsImported: number;
  tasksImported: number;
  errors: string[];
}

interface CSVRow {
  [key: string]: string;
}

/**
 * Helper function to get value from row with case-insensitive column matching
 */
function getColumnValue(row: CSVRow, ...columnNames: string[]): string {
  for (const name of columnNames) {
    // Try exact match first
    if (row[name]) return row[name];

    // Try case-insensitive match
    const key = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
    if (key && row[key]) return row[key];
  }
  return '';
}

/**
 * Import projects and tasks from CSV file
 * Expected columns: Project/Epic, Task ID, Task Name/Summary, Status, Priority, Type, Start Date, End Date, Assignee, Description
 */
export async function importFromCSV(
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

    // Parse CSV file
    const records: CSVRow[] = parse(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });

    if (records.length === 0) {
      result.errors.push('CSV file is empty');
      return result;
    }

    logger.info(`Parsing CSV file with ${records.length} rows`);

    // Group tasks by project/epic
    const projectMap = new Map<string, CSVRow[]>();

    for (const row of records) {
      const projectName = getColumnValue(
        row,
        'Project name',
        'Project',
        'Epic',
        'Epic Name',
        'Project Name'
      ) || 'Imported Project';

      if (!projectMap.has(projectName)) {
        projectMap.set(projectName, []);
      }
      projectMap.get(projectName)!.push(row);
    }

    logger.info(`Found ${projectMap.size} unique projects`);

    // Import each project and its tasks
    for (const [projectName, tasks] of projectMap.entries()) {
      try {
        // Determine project start and end dates from tasks
        const taskDates = tasks
          .map((t) => ({
            start: parseDate(getColumnValue(t, 'Start Date', 'Created', 'Created Date')),
            end: parseDate(getColumnValue(t, 'End Date', 'Due Date', 'Due date', 'Due')),
          }))
          .filter((d) => d.start || d.end);

        const startDates = taskDates.map((d) => d.start).filter(Boolean) as Date[];
        const endDates = taskDates.map((d) => d.end).filter(Boolean) as Date[];

        const projectStartDate = startDates.length > 0 ? new Date(Math.min(...startDates.map((d) => d.getTime()))) : new Date();
        const projectEndDate = endDates.length > 0 ? new Date(Math.max(...endDates.map((d) => d.getTime()))) : undefined;

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
              description: `Imported from CSV - ${tasks.length} tasks`,
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
        for (const taskRow of tasks) {
          try {
            const taskId = getColumnValue(
              taskRow,
              'Issue key',
              'Task ID',
              'ID',
              'Issue Key',
              'Key'
            );

            const taskTitle = getColumnValue(
              taskRow,
              'Summary',
              'Task Name',
              'Title',
              'Task'
            ) || 'Imported Task';

            const taskDescription = getColumnValue(
              taskRow,
              'Description',
              'Details',
              'Notes'
            );

            const status = mapStatus(
              getColumnValue(taskRow, 'Status', 'State')
            );

            const priority = mapPriority(
              getColumnValue(taskRow, 'Priority') || 'Medium'
            );

            const taskType = mapTaskType(
              getColumnValue(taskRow, 'Type', 'Task Type', 'Issue Type') || 'Task'
            );

            const startDate = parseDate(
              getColumnValue(taskRow, 'Start Date', 'Created', 'Created Date')
            );

            let endDate = parseDate(
              getColumnValue(taskRow, 'End Date', 'Due Date', 'Due date', 'Due')
            );

            // Extract estimated hours
            const estimateStr = getColumnValue(
              taskRow,
              'Original estimate',
              'Original Estimate',
              'Estimated Effort',
              'Story Points',
              'Time estimate'
            );

            let estimatedHours = estimateStr ? parseEstimateHours(estimateStr) : 40; // Default 40 hours (1 week)

            // If no end date, calculate from start date + estimated duration
            if (!endDate && startDate) {
              const durationDays = Math.ceil(estimatedHours / 8); // Convert hours to days (8 hour workday)

              // Calculate end date
              endDate = new Date(startDate);
              endDate.setDate(endDate.getDate() + durationDays);
            }

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
                  taskType,
                  startDate,
                  endDate,
                  estimatedHours: estimatedHours || 40,
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
                  taskType,
                  assignedTo: userId,
                  createdBy: userId,
                  startDate,
                  endDate,
                  estimatedHours: estimatedHours || 40,
                  jiraIssueKey: taskId,
                },
              });
              result.tasksImported++;
            }
          } catch (taskError: any) {
            logger.error(`Failed to import task: ${taskError.message}`);
            result.errors.push(`Task import error: ${taskError.message}`);
          }
        }

        // After importing all tasks, aggregate costs to project level
        const projectTasks = await prisma.task.findMany({
          where: { projectId: project.id },
          select: {
            estimatedCost: true,
            actualCost: true,
          },
        });

        const totalBudget = projectTasks.reduce((sum, task) => sum + Number(task.estimatedCost || 0), 0);
        const totalActualCost = projectTasks.reduce((sum, task) => sum + Number(task.actualCost || 0), 0);

        // Update project with aggregated costs
        await prisma.project.update({
          where: { id: project.id },
          data: {
            budget: totalBudget,
            actualCost: totalActualCost,
          },
        });

        logger.info(`Project "${projectName}" - Budget: $${totalBudget}, Actual: $${totalActualCost}`);

      } catch (projectError: any) {
        logger.error(`Failed to import project ${projectName}: ${projectError.message}`);
        result.errors.push(`Project ${projectName}: ${projectError.message}`);
      }
    }

    logger.info(
      `CSV import completed: ${result.projectsImported} projects, ${result.tasksImported} tasks, ${result.errors.length} errors`
    );
  } catch (error: any) {
    logger.error('CSV import failed:', error);
    result.errors.push(`Import failed: ${error.message}`);
  }

  return result;
}

/**
 * Parse date from various formats
 */
function parseDate(value: string): Date | undefined {
  if (!value || value.trim() === '') return undefined;

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
 * Map CSV status to our status
 */
function mapStatus(status: string): string {
  const statusLower = status.toLowerCase().trim();

  if (statusLower.includes('done') || statusLower.includes('closed') || statusLower.includes('complete')) {
    return 'completed';
  }
  if (statusLower.includes('progress') || statusLower.includes('development') || statusLower.includes('in dev')) {
    return 'in_progress';
  }
  if (statusLower.includes('review') || statusLower.includes('testing') || statusLower.includes('qa')) {
    return 'in_review';
  }
  if (statusLower.includes('blocked') || statusLower.includes('hold')) {
    return 'blocked';
  }

  return 'todo';
}

/**
 * Map CSV priority to our priority
 */
function mapPriority(priority: string): string {
  const priorityLower = priority.toLowerCase().trim();

  if (
    priorityLower.includes('high') ||
    priorityLower.includes('critical') ||
    priorityLower.includes('blocker') ||
    priorityLower.includes('urgent')
  ) {
    return 'high';
  }
  if (priorityLower.includes('low') || priorityLower.includes('trivial') || priorityLower.includes('minor')) {
    return 'low';
  }

  return 'medium';
}

/**
 * Map CSV task type to our task type
 */
function mapTaskType(type: string): string {
  const typeLower = type.toLowerCase().trim();

  if (typeLower.includes('bug') || typeLower.includes('defect')) {
    return 'bug';
  }
  if (typeLower.includes('epic') || typeLower.includes('milestone')) {
    return 'milestone';
  }

  return 'task';
}

/**
 * Parse estimate from various formats (hours, story points, seconds from JIRA, etc.)
 */
function parseEstimateHours(estimate: string): number {
  if (!estimate || estimate.trim() === '') return 0;

  const trimmed = estimate.trim().toLowerCase();

  // Try to extract number from string
  const match = trimmed.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  if (isNaN(value)) return 0;

  // Check for explicit units first
  if (trimmed.includes('hr') || trimmed.includes('hour')) {
    return value;
  } else if (trimmed.includes('d') || trimmed.includes('day')) {
    return value * 8; // Convert days to hours
  } else if (trimmed.includes('w') || trimmed.includes('week')) {
    return value * 40; // Convert weeks to hours
  } else if (trimmed.includes('pt') || trimmed.includes('point')) {
    // Story points: assume 1 point = 4 hours
    return value * 4;
  } else if (trimmed.includes('sec') || trimmed.includes('second')) {
    return value / 3600; // Convert seconds to hours
  }

  // If no unit specified, check if value looks like seconds (JIRA format)
  // JIRA stores time in seconds, so large values (>360 = 6 minutes) are likely seconds
  if (value > 360) {
    // Convert from seconds to hours
    return value / 3600;
  }

  // Small values without units are assumed to be hours
  return value;
}
