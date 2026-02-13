import apiClient from './client';

export const adminApi = {
  resetAllData: async (): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete('/admin/reset-data');
    return response.data;
  },
};
