import apiClient from './client';

export interface JiraCredentials {
  domain: string;
  email: string;
  apiToken: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  description?: string;
}

export interface JiraCredentialInfo {
  id: string;
  provider: string;
  isActive: boolean;
  domain: string;
  email: string;
  hasApiToken: boolean;
}

export const integrationsApi = {
  // Test JIRA connection
  testJiraConnection: async (credentials: JiraCredentials): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post('/integrations/jira/test', credentials);
    return response.data;
  },

  // Get JIRA projects
  getJiraProjects: async (credentials: JiraCredentials): Promise<JiraProject[]> => {
    const response = await apiClient.post('/integrations/jira/projects', credentials);
    return response.data.data;
  },

  // Save JIRA credentials
  saveJiraCredentials: async (
    organizationId: string,
    credentials: JiraCredentials
  ): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post('/integrations/jira/credentials', {
      organizationId,
      ...credentials,
    });
    return response.data;
  },

  // Get saved JIRA credentials
  getJiraCredentials: async (organizationId: string): Promise<JiraCredentialInfo | null> => {
    const response = await apiClient.get(`/integrations/jira/credentials/${organizationId}`);
    return response.data.data;
  },

  // Import JIRA project
  importJiraProject: async (
    projectKey: string,
    organizationId: string,
    credentials: JiraCredentials
  ): Promise<{ projectId: string; tasksImported: number }> => {
    const response = await apiClient.post('/integrations/jira/import', {
      projectKey,
      organizationId,
      credentials,
    });
    return response.data.data;
  },

  // Delete JIRA credentials
  deleteJiraCredentials: async (organizationId: string): Promise<void> => {
    await apiClient.delete(`/integrations/jira/credentials/${organizationId}`);
  },

  // Upload file (Excel, CSV, or MS Project)
  uploadFile: async (
    file: File,
    organizationId: string
  ): Promise<{ projectsImported: number; tasksImported: number; errors: string[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('organizationId', organizationId);

    const response = await apiClient.post('/upload/file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  // Legacy Excel upload (deprecated - use uploadFile instead)
  uploadExcelFile: async (
    file: File,
    organizationId: string
  ): Promise<{ projectsImported: number; tasksImported: number; errors: string[] }> => {
    return integrationsApi.uploadFile(file, organizationId);
  },

  // Export task to JIRA
  exportTaskToJira: async (
    taskId: string,
    organizationId: string,
    projectKey: string,
    credentials: JiraCredentials,
    createNew: boolean = false
  ): Promise<{ issueKey: string; issueId: string }> => {
    const response = await apiClient.post(`/integrations/jira/export/${taskId}`, {
      organizationId,
      projectKey,
      createNew,
      credentials,
    });
    return response.data.data;
  },

  // Get JIRA status/priority mappings
  getJiraMappings: async (
    organizationId: string
  ): Promise<{
    status: Record<string, string>;
    priority: Record<string, string>;
  }> => {
    const response = await apiClient.get(`/integrations/jira/mappings/${organizationId}`);
    return response.data.data;
  },

  // Sync JIRA project
  syncJiraProject: async (
    projectId: string,
    organizationId: string,
    credentials: JiraCredentials
  ): Promise<{ status: string; itemsSynced: number; errors: string[] }> => {
    const response = await apiClient.post(`/integrations/jira/sync/${projectId}`, {
      organizationId,
      credentials,
    });
    return response.data.data;
  },

  // Get JIRA sync history
  getSyncHistory: async (organizationId: string): Promise<any[]> => {
    const response = await apiClient.get(`/integrations/jira/sync/history/${organizationId}`);
    return response.data.data;
  },
};
