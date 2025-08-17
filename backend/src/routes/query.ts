import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest } from '../utils/validation';
import { querySchema } from '../utils/validation';
import { llmRateLimiter } from '../middleware/rateLimiter';
import { LLMService } from '../services/llmService';
import { postgresService } from '../services/postgresService';
import Query from '../models/Query';

const router = express.Router();

// POST /api/query - Convert natural language to SQL
router.post('/', 
  llmRateLimiter,
  validateRequest(querySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { query, provider, model, userId } = req.body;

    // Get database schema
    const schema = await postgresService.getSchema();

    // Generate SQL using LLM with schema context (get instance inside route handler)
    const llmService = LLMService.getInstance();
    const llmResponse = await llmService.generateSQL({
      query,
      provider,
      model,
      schema
    });

    // Save query to database
    const queryRecord = new Query({
      naturalLanguage: query,
      sql: llmResponse.sql,
      executionTime: Date.now(), // Mock execution time
      confidence: llmResponse.confidence,
      provider: provider || 'openai',
      llmModel: model || 'gpt-3.5-turbo',
      userId
    });

    await queryRecord.save();

    res.json({
      id: queryRecord._id,
      sql: llmResponse.sql,
      confidence: llmResponse.confidence,
      explanation: llmResponse.explanation,
      provider: provider || 'openai',
      llmModel: model || 'gpt-3.5-turbo',
      executionTime: Date.now(),
      createdAt: queryRecord.createdAt
    });
  })
);

// GET /api/query/history - Get query history
router.get('/history',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = userId ? { userId } : {};
    
    const queries = await Query.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('-__v');

    const total = await Query.countDocuments(filter);

    res.json({
      queries,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  })
);

// GET /api/query/:id - Get specific query
router.get('/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const query = await Query.findById(req.params.id).select('-__v');
    
    if (!query) {
      return res.status(404).json({ error: 'Query not found' });
    }

    res.json(query);
  })
);

export default router;