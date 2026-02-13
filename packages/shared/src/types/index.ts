// ===================================
// USER & AUTHENTICATION TYPES
// ===================================

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  MEMBER = 'member',
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: UserRole;
  microsoftId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

// ===================================
// ORGANIZATION TYPES
// ===================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: UserRole;
  user?: User;
  createdAt: Date;
}

// ===================================
// PROJECT TYPES
// ===================================

export enum ProjectStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  priority: Priority;
  startDate?: Date;
  endDate?: Date;
  plannedStartDate?: Date;
  plannedEndDate?: Date;
  budget?: number;
  actualCost: number;
  jiraProjectKey?: string;
  jiraProjectId?: string;
  color?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectDashboard {
  project: Project;
  taskStats: {
    total: number;
    completed: number;
    inProgress: number;
    todo: number;
    blocked: number;
  };
  budgetStats: {
    budget: number;
    spent: number;
    remaining: number;
    percentageUsed: number;
  };
  timelineStats: {
    startDate?: Date;
    endDate?: Date;
    daysElapsed: number;
    daysRemaining: number;
    percentageComplete: number;
  };
  criticalPathLength?: number;
  resourceUtilization: number;
}

// ===================================
// TASK TYPES
// ===================================

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
}

export enum TaskType {
  TASK = 'task',
  MILESTONE = 'milestone',
  EPIC = 'epic',
}

export interface Task {
  id: string;
  projectId: string;
  parentTaskId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  taskType: TaskType;
  estimatedHours?: number;
  actualHours: number;
  optimisticHours?: number;
  mostLikelyHours?: number;
  pessimisticHours?: number;
  expectedHours?: number;
  startDate?: Date;
  endDate?: Date;
  plannedStartDate?: Date;
  plannedEndDate?: Date;
  completedAt?: Date;
  earliestStart?: Date;
  earliestFinish?: Date;
  latestStart?: Date;
  latestFinish?: Date;
  slackTime?: number;
  isCriticalPath: boolean;
  estimatedCost?: number;
  actualCost: number;
  jiraIssueKey?: string;
  jiraIssueId?: string;
  assignedTo?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ===================================
// TASK DEPENDENCY TYPES
// ===================================

export enum DependencyType {
  FINISH_TO_START = 'finish_to_start',
  START_TO_START = 'start_to_start',
  FINISH_TO_FINISH = 'finish_to_finish',
  START_TO_FINISH = 'start_to_finish',
}

export interface TaskDependency {
  id: string;
  predecessorTaskId: string;
  successorTaskId: string;
  dependencyType: DependencyType;
  lagDays: number;
  createdAt: Date;
}

// ===================================
// RESOURCE TYPES
// ===================================

export enum ResourceType {
  PERSON = 'person',
  EQUIPMENT = 'equipment',
  MATERIAL = 'material',
  BUDGET = 'budget',
}

export interface Resource {
  id: string;
  organizationId: string;
  name: string;
  type: ResourceType;
  userId?: string;
  costPerHour?: number;
  availabilityHoursPerDay: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResourceAllocation {
  id: string;
  resourceId: string;
  taskId: string;
  projectId: string;
  allocatedHours: number;
  startDate: Date;
  endDate: Date;
  allocationPercentage: number;
  resource?: Resource;
  task?: Task;
  createdAt: Date;
  updatedAt: Date;
}

// ===================================
// COST TRACKING TYPES
// ===================================

export enum CostCategory {
  LABOR = 'labor',
  MATERIALS = 'materials',
  EQUIPMENT = 'equipment',
  SOFTWARE = 'software',
  OVERHEAD = 'overhead',
}

export interface CostEntry {
  id: string;
  projectId: string;
  taskId?: string;
  category: CostCategory;
  description?: string;
  amount: number;
  entryDate: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum BudgetAlertType {
  WARNING = 'warning',
  EXCEEDED = 'exceeded',
  CRITICAL = 'critical',
}

export interface BudgetAlert {
  id: string;
  projectId: string;
  alertType: BudgetAlertType;
  thresholdPercentage: number;
  budgetAmount: number;
  actualAmount: number;
  message: string;
  isResolved: boolean;
  createdAt: Date;
}

export interface BudgetSuggestion {
  type: 'resource_substitution' | 'scope_reduction' | 'timeline_extension';
  description: string;
  potentialSavings?: number;
  tasks?: string[];
  impact?: string;
}

// ===================================
// TIME TRACKING TYPES
// ===================================

export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  hours: number;
  entryDate: Date;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ===================================
// NOTIFICATION TYPES
// ===================================

export enum NotificationType {
  TASK_ASSIGNED = 'task_assigned',
  TASK_OVERDUE = 'task_overdue',
  BUDGET_ALERT = 'budget_alert',
  PROJECT_UPDATE = 'project_update',
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  linkUrl?: string;
  isRead: boolean;
  emailSent: boolean;
  teamsSent: boolean;
  createdAt: Date;
}

export interface Reminder {
  id: string;
  userId: string;
  taskId: string;
  reminderDate: Date;
  isSent: boolean;
  createdAt: Date;
}

// ===================================
// INTEGRATION TYPES
// ===================================

export enum IntegrationType {
  JIRA = 'jira',
  MICROSOFT = 'microsoft',
  SLACK = 'slack',
}

export interface IntegrationCredential {
  id: string;
  organizationId: string;
  userId: string;
  integrationType: IntegrationType;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  additionalData?: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum SyncStatus {
  SUCCESS = 'success',
  PARTIAL = 'partial',
  FAILED = 'failed',
}

export interface SyncHistory {
  id: string;
  integrationType: IntegrationType;
  organizationId: string;
  syncType: 'import' | 'export' | 'bidirectional';
  status: SyncStatus;
  itemsSynced: number;
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
}

// ===================================
// REPORT TYPES
// ===================================

export enum ReportType {
  BURNDOWN = 'burndown',
  BUDGET = 'budget',
  EXECUTIVE_SUMMARY = 'executive_summary',
  TIMELINE = 'timeline',
}

export interface Report {
  id: string;
  organizationId: string;
  projectId: string;
  reportType: ReportType;
  title: string;
  content: Record<string, unknown>;
  generatedForDate: Date;
  generatedBy: string;
  createdAt: Date;
}

export interface BurndownChartData {
  date: Date;
  idealRemainingHours: number;
  actualRemainingHours: number;
  completedHours: number;
}

export interface ExecutiveSummary {
  projectId: string;
  projectName: string;
  weekStartDate: Date;
  weekEndDate: Date;
  status: ProjectStatus;
  overallHealth: 'on_track' | 'at_risk' | 'critical';
  accomplishments: string[];
  upcomingMilestones: string[];
  risks: string[];
  budgetStatus: {
    budget: number;
    spent: number;
    remaining: number;
    percentageUsed: number;
  };
  scheduleStatus: {
    onSchedule: boolean;
    daysAhead?: number;
    daysBehind?: number;
  };
  teamUtilization: number;
}

// ===================================
// PLANNING ALGORITHM TYPES
// ===================================

export interface CPMTask {
  id: string;
  duration: number;
  dependencies: string[];
}

export interface CPMResult {
  taskId: string;
  earliestStart: Date;
  earliestFinish: Date;
  latestStart: Date;
  latestFinish: Date;
  slack: number;
  isCritical: boolean;
}

export interface PERTEstimate {
  optimistic: number;
  mostLikely: number;
  pessimistic: number;
  expected: number;
  variance: number;
  stdDev: number;
}

export interface PlanningSession {
  id: string;
  projectId: string;
  algorithmUsed: string;
  inputParameters: Record<string, unknown>;
  outputResults: Record<string, unknown>;
  executionTimeMs: number;
  createdBy: string;
  createdAt: Date;
}

// ===================================
// API RESPONSE TYPES
// ===================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ===================================
// COMMON TYPES
// ===================================

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface ChartDataPoint {
  x: number | string | Date;
  y: number;
  label?: string;
}

// ===================================
// FORM & REQUEST TYPES
// ===================================

export interface CreateProjectRequest {
  organizationId: string;
  name: string;
  description?: string;
  priority: Priority;
  budget?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  priority?: Priority;
  budget?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface CreateTaskRequest {
  projectId: string;
  parentTaskId?: string;
  title: string;
  description?: string;
  priority: Priority;
  taskType: TaskType;
  estimatedHours?: number;
  optimisticHours?: number;
  mostLikelyHours?: number;
  pessimisticHours?: number;
  startDate?: Date;
  endDate?: Date;
  assignedTo?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  estimatedHours?: number;
  actualHours?: number;
  startDate?: Date;
  endDate?: Date;
  assignedTo?: string;
}

export interface CreateResourceRequest {
  organizationId: string;
  name: string;
  type: ResourceType;
  userId?: string;
  costPerHour?: number;
  availabilityHoursPerDay: number;
}

export interface CreateAllocationRequest {
  resourceId: string;
  taskId: string;
  projectId: string;
  allocatedHours: number;
  startDate: Date;
  endDate: Date;
  allocationPercentage: number;
}

export interface CreateCostEntryRequest {
  projectId: string;
  taskId?: string;
  category: CostCategory;
  description?: string;
  amount: number;
  entryDate: Date;
}
