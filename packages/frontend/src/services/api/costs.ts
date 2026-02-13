import apiClient from './client';

export interface CostEntry {
  id: string;
  projectId: string;
  amount: number;
  category: 'labor' | 'materials' | 'equipment' | 'software' | 'overhead' | 'other';
  description: string;
  date: string;
  taskId?: string;
  resourceId?: string;
  createdAt: string;
  updatedAt: string;
  task?: {
    id: string;
    title: string;
  };
  resource?: {
    id: string;
    name: string;
    type: string;
  };
}

export interface CostBreakdown {
  category: string;
  amount: number;
  percentage: string;
}

export interface BudgetStatus {
  projectId: string;
  projectName: string;
  budget: number;
  spent: number;
  remaining: number;
  percentageUsed: number;
  status: 'good' | 'warning' | 'critical' | 'over_budget';
  isOverBudget: boolean;
}

export interface CostTrend {
  date: string;
  amount: number;
  cumulative: number;
}

export const costsApi = {
  getProjectCosts: async (
    projectId: string,
    options?: {
      startDate?: string;
      endDate?: string;
      category?: string;
    }
  ): Promise<{ entries: CostEntry[]; total: number; count: number }> => {
    const params = new URLSearchParams();
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);
    if (options?.category) params.append('category', options.category);

    const queryString = params.toString();
    const url = `/costs/project/${projectId}${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient.get(url);
    return response.data.data;
  },

  getById: async (id: string): Promise<CostEntry> => {
    const response = await apiClient.get(`/costs/${id}`);
    return response.data.data;
  },

  create: async (data: {
    projectId: string;
    amount: number;
    category: 'labor' | 'materials' | 'equipment' | 'software' | 'overhead' | 'other';
    description: string;
    date?: string;
    taskId?: string;
    resourceId?: string;
  }): Promise<CostEntry> => {
    const response = await apiClient.post('/costs', data);
    return response.data.data;
  },

  update: async (
    id: string,
    data: {
      amount?: number;
      category?: 'labor' | 'materials' | 'equipment' | 'software' | 'overhead' | 'other';
      description?: string;
      date?: string;
    }
  ): Promise<CostEntry> => {
    const response = await apiClient.patch(`/costs/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/costs/${id}`);
  },

  getBreakdown: async (
    projectId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{ breakdown: CostBreakdown[]; total: number }> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const queryString = params.toString();
    const url = `/costs/project/${projectId}/breakdown${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient.get(url);
    return response.data.data;
  },

  getBudgetStatus: async (projectId: string): Promise<BudgetStatus> => {
    const response = await apiClient.get(`/costs/project/${projectId}/budget-status`);
    return response.data.data;
  },

  getTrend: async (
    projectId: string,
    startDate: string,
    endDate: string,
    interval?: string
  ): Promise<CostTrend[]> => {
    const params = new URLSearchParams({ startDate, endDate });
    if (interval) params.append('interval', interval);

    const response = await apiClient.get(`/costs/project/${projectId}/trend?${params.toString()}`);
    return response.data.data;
  },

  recalculateFromTasks: async (projectId: string): Promise<{
    projectId: string;
    taskCount: number;
    budget: number;
    actualCost: number;
    totalEstimatedHours: number;
    totalActualHours: number;
    costVariance: number;
  }> => {
    const response = await apiClient.post(`/costs/project/${projectId}/recalculate`);
    return response.data.data;
  },

  getTaskCosts: async (projectId: string): Promise<{
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      estimatedCost: number;
      actualCost: number;
      variance: number;
      estimatedHours: number;
      actualHours: number;
    }>;
    summary: {
      totalBudget: number;
      totalActualCost: number;
      totalVariance: number;
      taskCount: number;
      tasksWithCosts: number;
    };
  }> => {
    const response = await apiClient.get(`/costs/project/${projectId}/task-costs`);
    return response.data.data;
  },

  updateCostsFromExcel: async (projectId: string, file: File): Promise<{
    tasksUpdated: number;
    tasksNotFound: number;
    totalBudget: number;
    totalActualCost: number;
    errors: string[];
  }> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post(`/upload/update-costs/${projectId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },
};
