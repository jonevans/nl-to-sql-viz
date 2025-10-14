import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { createError } from '../middleware/errorHandler';
import config from '../config';
import { createLogger } from '../utils/logger';

const logger = createLogger('AuthService');

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export class AuthService {
  private static instance: AuthService;

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Register a new user
   */
  async register(data: {
    email: string;
    password: string;
    name: string;
    role?: 'admin' | 'user' | 'readonly';
    company?: string;
  }): Promise<{ user: IUser; token: string }> {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email: data.email.toLowerCase() });
      if (existingUser) {
        throw createError(409, 'User with this email already exists');
      }

      // Validate password strength
      if (data.password.length < 8) {
        throw createError(400, 'Password must be at least 8 characters long');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, config.auth.saltRounds);

      // Create user
      const user = await User.create({
        email: data.email.toLowerCase(),
        password: hashedPassword,
        name: data.name,
        role: data.role || 'user',
        company: data.company,
        isActive: true
      });

      // Generate token
      const token = this.generateToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role
      });

      // Remove password from response
      const userObject = user.toObject();
      delete (userObject as any).password;

      return { user: userObject as IUser, token };
    } catch (error: any) {
      if (error.status) throw error;
      // Log detailed error but return generic message to user
      logger.error('Registration failed', { error: error.message, stack: error.stack });
      throw createError(500, 'Registration failed. Please try again later.');
    }
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<{ user: IUser; token: string }> {
    try {
      // Find user with password field
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

      if (!user) {
        throw createError(401, 'Invalid email or password');
      }

      if (!user.isActive) {
        throw createError(403, 'Account is deactivated. Please contact support.');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw createError(401, 'Invalid email or password');
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate token
      const token = this.generateToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role
      });

      // Remove password from response
      const userObject = user.toObject();
      delete (userObject as any).password;

      return { user: userObject as IUser, token };
    } catch (error: any) {
      if (error.status) throw error;
      // Log detailed error but return generic message to user
      logger.error('Login failed', { error: error.message, stack: error.stack, email });
      throw createError(500, 'Login failed. Please try again later.');
    }
  }

  /**
   * Generate JWT token
   */
  generateToken(payload: TokenPayload): string {
    // Type assertion needed due to jsonwebtoken's strict StringValue typing
    return jwt.sign(payload, config.auth.jwtSecret, {
      expiresIn: config.auth.jwtExpiresIn as any
    });
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, config.auth.jwtSecret) as TokenPayload;
    } catch (error: any) {
      throw createError(401, 'Invalid or expired token');
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<IUser | null> {
    return User.findById(userId);
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await User.findById(userId).select('+password');

      if (!user) {
        throw createError(404, 'User not found');
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        throw createError(401, 'Current password is incorrect');
      }

      // Validate new password
      if (newPassword.length < 8) {
        throw createError(400, 'New password must be at least 8 characters long');
      }

      // Hash and update password
      user.password = await bcrypt.hash(newPassword, config.auth.saltRounds);
      await user.save();
    } catch (error: any) {
      if (error.status) throw error;
      // Log detailed error but return generic message to user
      logger.error('Password update failed', { error: error.message, stack: error.stack, userId });
      throw createError(500, 'Password update failed. Please try again later.');
    }
  }

  /**
   * Deactivate user
   */
  async deactivateUser(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw createError(404, 'User not found');
    }
    user.isActive = false;
    await user.save();
  }

  /**
   * Activate user
   */
  async activateUser(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw createError(404, 'User not found');
    }
    user.isActive = true;
    await user.save();
  }

  /**
   * Accept POC terms
   */
  async acceptPocTerms(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw createError(404, 'User not found');
    }
    user.pocTermsAccepted = true;
    user.pocTermsAcceptedAt = new Date();
    await user.save();
    logger.info('POC terms accepted', { userId, email: user.email });
  }

  /**
   * Reset POC terms acceptance for a user by email
   */
  async resetPocTermsByEmail(email: string): Promise<void> {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw createError(404, 'User not found');
    }
    user.pocTermsAccepted = false;
    user.pocTermsAcceptedAt = undefined;
    await user.save();
    logger.info('POC terms reset', { userId: user._id, email: user.email });
  }
}
