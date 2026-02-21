import axios from 'axios';
import prisma from '../utils/db.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

export interface MicrosoftTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface MicrosoftUser {
  id: string;
  displayName: string;
  mail: string;
  givenName: string;
  surname: string;
}

export class MicrosoftAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private tenantId: string;

  constructor() {
    this.clientId = process.env.MICROSOFT_CLIENT_ID || '';
    this.clientSecret = process.env.MICROSOFT_CLIENT_SECRET || '';
    this.redirectUri = process.env.MICROSOFT_REDIRECT_URI || '';
    this.tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      response_mode: 'query',
      scope: 'openid profile email',
      state,
    });

    return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async handleCallback(code: string): Promise<MicrosoftTokens> {
    try {
      const response = await axios.post(
        `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
          scope: 'openid profile email offline_access',
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error: any) {
      logger.error('Failed to handle Microsoft callback:', error.message);
      throw new Error('Failed to authenticate with Microsoft');
    }
  }

  async refreshToken(refreshToken: string): Promise<MicrosoftTokens> {
    try {
      const response = await axios.post(
        `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          scope: 'openid profile email offline_access',
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error: any) {
      logger.error('Failed to refresh Microsoft token:', error.message);
      throw new Error('Failed to refresh token');
    }
  }

  async getUserProfile(accessToken: string): Promise<MicrosoftUser> {
    try {
      const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return {
        id: response.data.id,
        displayName: response.data.displayName,
        mail: response.data.mail || response.data.userPrincipalName,
        givenName: response.data.givenName,
        surname: response.data.surname,
      };
    } catch (error: any) {
      logger.error('Failed to get Microsoft user profile:', error.message);
      throw new Error('Failed to get user profile');
    }
  }

  async createOrUpdateUser(
    microsoftUser: MicrosoftUser,
    tokens: MicrosoftTokens,
    organizationId: string
  ): Promise<any> {
    try {
      let user = await prisma.user.findUnique({
        where: { email: microsoftUser.mail },
      });

      if (user) {
        // Update existing user
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            microsoftId: microsoftUser.id,
            firstName: microsoftUser.givenName,
            lastName: microsoftUser.surname,
          },
        });
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            email: microsoftUser.mail,
            firstName: microsoftUser.givenName,
            lastName: microsoftUser.surname,
            microsoftId: microsoftUser.id,
            passwordHash: null,
          },
        });
      }

      // Add to organization if not already member
      const isMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: user.id,
          },
        },
      });

      if (!isMember) {
        await prisma.organizationMember.create({
          data: {
            organizationId,
            userId: user.id,
            role: 'member',
          },
        });
      }

      // Store tokens in integration credentials
      await prisma.integrationCredential.upsert({
        where: {
          organizationId_integrationType: {
            organizationId,
            integrationType: 'microsoft',
          },
        },
        create: {
          organizationId,
          userId: user.id,
          integrationType: 'microsoft',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
          isActive: true,
        },
        update: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        },
      });

      return user;
    } catch (error: any) {
      logger.error('Failed to create/update user:', error.message);
      throw error;
    }
  }
}
