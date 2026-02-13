import { Task, CreateTaskRequest, UpdateTaskRequest, ApiResponse } from '@pm-app/shared';
import apiClient from './client';

export const tasksApi = {
  /**
   * Get all tasks for a project
   */
  getAll: async (projectId: string, params?: { assignedTo?: string; status?: string }) => {
    const response = await apiClient.get<ApiResponse<Task[]>>('/tasks', {
      params: { projectId, ...params },
    });
    return response.data.data!;
  },

  /**
   * Get task by ID
   */
  getById: async (id: string) => {
    const response = await apiClient.get<ApiResponse<Task>>(`/tasks/${id}`);
    return response.data.data!;
  },

  /**
   * Create new task
   */
  create: async (data: CreateTaskRequest) => {
    const response = await apiClient.post<ApiResponse<Task>>('/tasks', data);
    return response.data.data!;
  },

  /**
   * Update task
   */
  update: async (id: string, data: UpdateTaskRequest) => {
    const response = await apiClient.patch<ApiResponse<Task>>(`/tasks/${id}`, data);
    return response.data.data!;
  },

  /**
   * Delete task
   */
  delete: async (id: string) => {
    const response = await apiClient.delete<ApiResponse<void>>(`/tasks/${id}`);
    return response.data;
  },
};
