import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validateQuery } from '../utils/validation';
import { paginationSchema } from '../utils/validation';
import { readOnlyRateLimiter } from '../middleware/rateLimiter';
import { postgresService } from '../services/postgresService';
import { SchemaAdapter } from '../services/schemaAdapter';
import Joi from 'joi';

const router = express.Router();

const databaseQuerySchema = Joi.object({
  database: Joi.string().optional().default('default')
});

const searchQuerySchema = Joi.object({
  q: Joi.string().required().min(1).max(100),
  database: Joi.string().optional()
});

const tableQuerySchema = Joi.object({
  table: Joi.string().required(),
  database: Joi.string().optional().default('default')
});

// GET /api/schema - Get database schema (in LLM-compatible format)
router.get('/',
  readOnlyRateLimiter,
  validateQuery(databaseQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const postgresSchema = await postgresService.getSchema();
    const llmSchema = SchemaAdapter.convertPostgresToLLMFormat(postgresSchema);
    
    res.json({
      database: 'hardware_store_db',
      ...llmSchema,
      lastUpdated: new Date().toISOString(),
      tableCount: llmSchema.tables.length,
      totalColumns: llmSchema.tables.reduce((sum, table) => sum + table.columns.length, 0)
    });
  })
);

// GET /api/schema/all - Get all database schemas
router.get('/all',
  readOnlyRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const schema = await postgresService.getSchema();
    
    res.json({
      schemas: [{
        database: 'hardware_store_db',
        tableCount: schema.tables.length,
        lastUpdated: new Date().toISOString()
      }],
      count: 1
    });
  })
);

// GET /api/schema/search - Search tables and columns
router.get('/search',
  readOnlyRateLimiter,
  validateQuery(searchQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { q } = req.query;
    
    const schema = await postgresService.getSchema();
    const searchTerm = (q as string).toLowerCase();
    
    // Simple search through table and column names
    const results = schema.tables.filter(table => 
      table.table_name.toLowerCase().includes(searchTerm) ||
      table.columns.some(col => col.column_name.toLowerCase().includes(searchTerm))
    );
    
    res.json({
      query: q,
      database: 'hardware_store_db',
      results: results,
      count: results.length
    });
  })
);

// GET /api/schema/table - Get specific table information
router.get('/table',
  readOnlyRateLimiter,
  validateQuery(tableQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { table } = req.query;
    
    const schema = await postgresService.getSchema();
    const tableInfo = schema.tables.find(t => t.table_name === table);
    
    if (!tableInfo) {
      return res.status(404).json({ 
        error: 'Table not found',
        table: table,
        database: 'hardware_store_db'
      });
    }

    res.json({
      table: tableInfo,
      columnCount: tableInfo.columns.length,
      hasRelationships: false
    });
  })
);

// POST /api/schema/refresh - Refresh schema from database
router.post('/refresh',
  validateQuery(databaseQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    // Refresh schema from PostgreSQL
    const schema = await postgresService.getSchema();
    
    res.json({
      message: 'Schema refreshed successfully',
      database: 'hardware_store_db',
      tableCount: schema.tables.length,
      lastUpdated: new Date().toISOString()
    });
  })
);

// DELETE /api/schema - Delete a database schema
router.delete('/',
  validateQuery(databaseQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    // PostgreSQL schema deletion not supported
    return res.status(400).json({ 
      error: 'Schema deletion not supported for PostgreSQL database' 
    });
  })
);

export default router;