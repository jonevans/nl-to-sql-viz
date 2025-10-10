import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, authorize } from '../middleware/authMiddleware';
import { AuthService } from '../services/authService';
import { validateRequest } from '../utils/validation';
import Joi from 'joi';

const router = express.Router();
const authService = AuthService.getInstance();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).required(),
  role: Joi.string().valid('admin', 'user', 'readonly').optional(),
  company: Joi.string().optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const updatePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required()
});

// POST /api/auth/register - Register new user
router.post('/register',
  validateRequest(registerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name, role, company } = req.body;

    const result = await authService.register({
      email,
      password,
      name,
      role,
      company
    });

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: result.user._id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        company: result.user.company
      },
      token: result.token
    });
  })
);

// POST /api/auth/login - Login user
router.post('/login',
  validateRequest(loginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const result = await authService.login(email, password);

    res.json({
      message: 'Login successful',
      user: {
        id: result.user._id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        company: result.user.company,
        lastLogin: result.user.lastLogin
      },
      token: result.token
    });
  })
);

// GET /api/auth/me - Get current user profile
router.get('/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getUserById(req.user!.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        company: user.company,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });
  })
);

// POST /api/auth/change-password - Change password
router.post('/change-password',
  authenticate,
  validateRequest(updatePasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;

    await authService.updatePassword(req.user!.userId, currentPassword, newPassword);

    res.json({ message: 'Password updated successfully' });
  })
);

// POST /api/auth/logout - Logout (client-side token removal)
router.post('/logout',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    // JWT is stateless - just return success
    // Client should remove token from storage
    res.json({ message: 'Logout successful' });
  })
);

// Admin routes
// POST /api/auth/admin/deactivate/:userId - Deactivate user (admin only)
router.post('/admin/deactivate/:userId',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    await authService.deactivateUser(req.params.userId);
    res.json({ message: 'User deactivated successfully' });
  })
);

// POST /api/auth/admin/activate/:userId - Activate user (admin only)
router.post('/admin/activate/:userId',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    await authService.activateUser(req.params.userId);
    res.json({ message: 'User activated successfully' });
  })
);

export default router;
