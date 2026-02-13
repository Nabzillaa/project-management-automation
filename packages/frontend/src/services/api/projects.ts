import {
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectDashboard,
  ApiResponse,
} from '@pm-app/shared';
import apiClient from './client';

export const projectsApi = {
  /**
   * Get all projects
   */
  getAll: async (params?: { organizationId?: string; status?: string }) => {
    const response = await apiClient.get<ApiResponse<Project[]>>('/projects', { params });
    return response.data.data!;
  },

  /**
   * Get project by ID
   */
  getById: async (id: string) => {
    const response = await apiClient.get<ApiResponse<Project>>(`/projects/${id}`);
    return response.data.data!;
  },

  /**
   * Create new project
   */
  create: async (data: CreateProjectRequest) => {
    const response = await apiClient.post<ApiResponse<Project>>('/projects', data);
    return response.data.data!;
  },

  /**
   * Update project
   */
  update: async (id: string, data: UpdateProjectRequest) => {
    const response = await apiClient.patch<ApiResponse<Project>>(`/projects/${id}`, data);
    return response.data.data!;
  },

  /**
   * Delete project
   */
  delete: async (id: string) => {
    const response = await apiClient.delete<ApiResponse<void>>(`/projects/${id}`);
    return response.data;
  },

  /**
   * Get project dashboard
   */
  getDashboard: async (id: string) => {
    const response = await apiClient.get<ApiResponse<ProjectDashboard>>(
      `/projects/${id}/dashboard`
    );
    return response.data.data!;
  },
};
