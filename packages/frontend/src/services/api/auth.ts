import { LoginCredentials, RegisterData, User, AuthTokens, ApiResponse } from '@pm-app/shared';
import apiClient from './client';

export const authApi = {
  /**
   * Register a new user
   */
  register: async (data: RegisterData) => {
    const response = await apiClient.post<
      ApiResponse<{ user: User; tokens: AuthTokens }>
    >('/auth/register', data);
    return response.data.data!;
  },

  /**
   * Login with email and password
   */
  login: async (credentials: LoginCredentials) => {
    const response = await apiClient.post<
      ApiResponse<{ user: User; tokens: AuthTokens }>
    >('/auth/login', credentials);
    return response.data.data!;
  },

  /**
   * Get current user
   */
  getCurrentUser: async () => {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me');
    return response.data.data!;
  },

  /**
   * Logout
   */
  logout: async () => {
    const response = await apiClient.post<ApiResponse<void>>('/auth/logout');
    return response.data;
  },

  /**
   * Refresh access token
   */
  refreshToken: async (refreshToken: string) => {
    const response = await apiClient.post<ApiResponse<{ accessToken: string }>>(
      '/auth/refresh',
      { refreshToken }
    );
    return response.data.data!;
  },
};
