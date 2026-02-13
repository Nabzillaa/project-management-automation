export interface CPMTask {
  id: string;
  duration: number; // in days or hours
  dependencies: string[]; // IDs of predecessor tasks
  startDate?: Date;
}

export interface CPMResult {
  taskId: string;
  earliestStart: Date;
  earliestFinish: Date;
  latestStart: Date;
  latestFinish: Date;
  slack: number; // Total float
  isCritical: boolean;
}

export interface PERTEstimate {
  optimistic: number;
  mostLikely: number;
  pessimistic: number;
}

export interface PERTResult {
  expected: number;
  variance: number;
  stdDev: number;
  confidence68: { min: number; max: number };
  confidence95: { min: number; max: number };
}

export interface TaskDependency {
  predecessorId: string;
  successorId: string;
  type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';
  lagDays: number;
}

export interface ResourceAllocation {
  resourceId: string;
  taskId: string;
  startDate: Date;
  endDate: Date;
  hoursPerDay: number;
}

export interface ResourceConflict {
  resourceId: string;
  date: Date;
  allocatedHours: number;
  availableHours: number;
  conflictingTasks: string[];
}
