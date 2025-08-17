import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest } from '../utils/validation';
import { executeSchema } from '../utils/validation';
import { expensiveOperationLimiter } from '../middleware/rateLimiter';
import { postgresService } from '../services/postgresService';

const router = express.Router();

// POST /api/execute - Execute SQL query
router.post('/',
  expensiveOperationLimiter,
  validateRequest(executeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sql, database, userId } = req.body;

    // Validate SQL for security
    const validation = await postgresService.validateSQL(sql);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    // Execute the SQL query
    const result = await postgresService.executeQuery(sql);

    // Log execution (in a real app, you might want to save this)
    console.log(`SQL executed by user ${userId || 'anonymous'}: ${sql}`);

    res.json({
      ...result,
      executedAt: new Date().toISOString(),
      database: database || 'hardware_store_db',
      security: result.securityInfo
    });
  })
);

// GET /api/execute/connection - Get database connection info
router.get('/connection',
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      database: 'hardware_store_db',
      type: 'postgresql',
      status: 'connected'
    });
  })
);

// POST /api/execute/validate - Validate SQL without executing
router.post('/validate',
  validateRequest(executeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sql } = req.body;

    const validation = await postgresService.validateSQL(sql);
    res.json(validation);
  })
);

export default router;