import apiClient from './client';

export interface Resource {
  id: string;
  name: string;
  type: 'person' | 'equipment' | 'material';
  costPerHour?: number;
  availability?: number;
  availabilityHoursPerDay?: number;
  isActive: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  allocations?: ResourceAllocation[];
  _count?: {
    allocations: number;
  };
}

export interface ResourceAllocation {
  id: string;
  resourceId: string;
  taskId: string;
  hoursAllocated: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  task?: {
    id: string;
    title: string;
    status: string;
    startDate?: string;
    endDate?: string;
    project?: {
      id: string;
      name: string;
    };
  };
}

export interface ResourceUtilization {
  resourceId: string;
  resourceName: string;
  totalAllocated: number;
  availableHours: number;
  utilizationPercentage: number;
  allocations: ResourceAllocation[];
  isOverallocated: boolean;
}

export interface ResourceSummary {
  id: string;
  name: string;
  type: string;
  totalAllocated: number;
  availableHours: number;
  utilizationPercentage: number;
  isOverallocated: boolean;
  allocationCount: number;
}

export const resourcesApi = {
  getAll: async (organizationId: string): Promise<Resource[]> => {
    const response = await apiClient.get(`/resources?organizationId=${organizationId}`);
    return response.data.data;
  },

  getById: async (id: string): Promise<Resource> => {
    const response = await apiClient.get(`/resources/${id}`);
    return response.data.data;
  },

  create: async (data: {
    name: string;
    type: 'person' | 'equipment' | 'material';
    costPerHour?: number;
    availability?: number;
    organizationId: string;
  }): Promise<Resource> => {
    const response = await apiClient.post('/resources', data);
    return response.data.data;
  },

  update: async (
    id: string,
    data: {
      name?: string;
      costPerHour?: number;
      availability?: number;
      isActive?: boolean;
    }
  ): Promise<Resource> => {
    const response = await apiClient.patch(`/resources/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/resources/${id}`);
  },

  createAllocation: async (
    resourceId: string,
    data: {
      taskId: string;
      hoursAllocated: number;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<ResourceAllocation> => {
    const response = await apiClient.post(`/resources/${resourceId}/allocations`, data);
    return response.data.data;
  },

  updateAllocation: async (
    resourceId: string,
    allocationId: string,
    data: {
      hoursAllocated?: number;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<ResourceAllocation> => {
    const response = await apiClient.patch(
      `/resources/${resourceId}/allocations/${allocationId}`,
      data
    );
    return response.data.data;
  },

  deleteAllocation: async (resourceId: string, allocationId: string): Promise<void> => {
    await apiClient.delete(`/resources/${resourceId}/allocations/${allocationId}`);
  },

  getUtilization: async (
    id: string,
    startDate: string,
    endDate: string
  ): Promise<ResourceUtilization> => {
    const response = await apiClient.get(
      `/resources/${id}/utilization?startDate=${startDate}&endDate=${endDate}`
    );
    return response.data.data;
  },

  getOrganizationSummary: async (
    organizationId: string,
    startDate: string,
    endDate: string
  ): Promise<ResourceSummary[]> => {
    const response = await apiClient.get(
      `/resources/organization/${organizationId}/summary?startDate=${startDate}&endDate=${endDate}`
    );
    return response.data.data;
  },
};
