import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import crypto from 'crypto';
import { UserRole, RegisterData, LoginCredentials } from '@pm-app/shared';
import prisma from '../utils/db.js';
import { logger } from '../utils/logger.js';
import {
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  authenticate,
} from '../middleware/auth.js';
import { MicrosoftAuthService } from '../services/microsoftAuthService.js';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const validationResult = registerSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validationResult.error.issues,
      });
      return;
    }

    const { email, password, firstName, lastName }: RegisterData = validationResult.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        error: 'User already exists',
      });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        role: UserRole.MEMBER,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const accessToken = generateToken(user.id, user.email, user.role as UserRole);
    const refreshToken = generateRefreshToken(user.id);

    logger.info(`User registered: ${user.email}`);

    res.status(201).json({
      success: true,
      data: {
        user,
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
    });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validationResult.error.issues,
      });
      return;
    }

    const { email, password }: LoginCredentials = validationResult.data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
      return;
    }

    // Generate tokens
    const accessToken = generateToken(user.id, user.email, user.role as UserRole);
    const refreshToken = generateRefreshToken(user.id);

    logger.info(`User logged in: ${user.email}`);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          avatarUrl: user.avatarUrl,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: 'Refresh token required',
      });
      return;
    }

    // Verify refresh token
    const { userId } = verifyRefreshToken(refreshToken);

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Generate new access token
    const accessToken = generateToken(user.id, user.email, user.role as UserRole);

    res.json({
      success: true,
      data: {
        accessToken,
      },
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user',
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout (client should discard tokens)
 */
router.post('/logout', authenticate, (_req: Request, res: Response): void => {
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * GET /api/auth/microsoft
 * Redirect to Microsoft OAuth
 */
router.get('/microsoft', (req: Request, res: Response): void => {
  try {
    const microsoftAuth = new MicrosoftAuthService();
    const state = crypto.randomBytes(32).toString('hex');

    // Store state in session/cookie for verification
    res.cookie('microsoft_oauth_state', state, { httpOnly: true, maxAge: 600000 });

    const authUrl = microsoftAuth.getAuthUrl(state);
    res.redirect(authUrl);
  } catch (error) {
    logger.error('Error initiating Microsoft OAuth:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate Microsoft OAuth',
    });
  }
});

/**
 * GET /api/auth/microsoft/callback
 * Handle Microsoft OAuth callback
 */
router.get('/microsoft/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      logger.error('Microsoft OAuth error:', error);
      res.redirect(`${process.env.FRONTEND_URL}?error=${error}`);
      return;
    }

    if (!code || !state) {
      res.status(400).json({
        success: false,
        error: 'Missing code or state',
      });
      return;
    }

    // Verify state
    const storedState = req.cookies.microsoft_oauth_state;
    if (storedState !== state) {
      logger.error('Invalid OAuth state');
      res.status(400).json({
        success: false,
        error: 'Invalid OAuth state',
      });
      return;
    }

    const microsoftAuth = new MicrosoftAuthService();
    const tokens = await microsoftAuth.handleCallback(code as string);
    const microsoftUser = await microsoftAuth.getUserProfile(tokens.accessToken);

    // Default organization - TODO: get from request or context
    const organization = await prisma.organization.findFirst();
    if (!organization) {
      throw new Error('No organization found');
    }

    const user = await microsoftAuth.createOrUpdateUser(
      microsoftUser,
      tokens,
      organization.id
    );

    const accessToken = generateToken(user.id, user.email, user.role as UserRole);
    const refreshToken = generateRefreshToken(user.id);

    // Redirect with tokens
    const redirectUrl = new URL(`${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    redirectUrl.searchParams.append('accessToken', accessToken);
    redirectUrl.searchParams.append('refreshToken', refreshToken);

    res.redirect(redirectUrl.toString());
  } catch (error: any) {
    logger.error('Error in Microsoft callback:', error);
    res.redirect(`${process.env.FRONTEND_URL}?error=authentication_failed`);
  }
});

/**
 * POST /api/auth/microsoft/link
 * Link Microsoft account to existing user
 */
router.post('/microsoft/link', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    const userId = req.user!.id;

    if (!code) {
      res.status(400).json({
        success: false,
        error: 'Authorization code required',
      });
      return;
    }

    const microsoftAuth = new MicrosoftAuthService();
    const tokens = await microsoftAuth.handleCallback(code);
    const microsoftUser = await microsoftAuth.getUserProfile(tokens.accessToken);

    // Update user with Microsoft ID
    const user = await prisma.user.update({
      where: { id: userId },
      data: { microsoftId: microsoftUser.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        microsoftId: true,
      },
    });

    res.json({
      success: true,
      message: 'Microsoft account linked successfully',
      data: user,
    });
  } catch (error: any) {
    logger.error('Error linking Microsoft account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to link Microsoft account',
    });
  }
});

export default router;
