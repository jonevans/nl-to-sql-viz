import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validateQuery } from '../utils/validation';
import { suggestionsSchema } from '../utils/validation';
import { readOnlyRateLimiter } from '../middleware/rateLimiter';
import Query from '../models/Query';
import { SchemaService } from '../services/schemaService';

const router = express.Router();
const schemaService = SchemaService.getInstance();

// GET /api/suggestions - Get real-time query suggestions
router.get('/',
  readOnlyRateLimiter,
  validateQuery(suggestionsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { 
      partial = '', 
      limit = 10, 
      maxSuggestions = 10,
      includeTemplates = true,
      includeSchemaAware = true,
      includeContextual = true,
      conversationId,
      userId 
    } = req.query;
    
    // Use maxSuggestions if provided, otherwise fallback to limit
    const suggestionLimit = maxSuggestions ? parseInt(maxSuggestions as string) : parseInt(limit as string);
    
    const suggestions = await generateSuggestions(
      partial as string, 
      suggestionLimit,
      userId as string,
      {
        includeTemplates: includeTemplates === 'true' || includeTemplates === true,
        includeSchemaAware: includeSchemaAware === 'true' || includeSchemaAware === true,
        includeContextual: includeContextual === 'true' || includeContextual === true,
        conversationId: conversationId as string
      }
    );
    
    res.json({
      partial: partial,
      suggestions,
      count: suggestions.length,
      timestamp: new Date().toISOString()
    });
  })
);

// GET /api/suggestions/popular - Get popular queries
router.get('/popular',
  readOnlyRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { limit = 10 } = req.query;
    
    try {
      // Get most frequently used queries
      const popularQueries = await Query.aggregate([
        {
          $group: {
            _id: '$naturalLanguage',
            count: { $sum: 1 },
            avgConfidence: { $avg: '$confidence' },
            lastUsed: { $max: '$createdAt' },
            sql: { $first: '$sql' }
          }
        },
        { $sort: { count: -1, lastUsed: -1 } },
        { $limit: parseInt(limit as string) },
        {
          $project: {
            _id: 0,
            query: '$_id',
            usage_count: '$count',
            avg_confidence: { $round: ['$avgConfidence', 2] },
            last_used: '$lastUsed',
            sql: 1
          }
        }
      ]);
      
      res.json({
        popular_queries: popularQueries,
        count: popularQueries.length
      });
    } catch (error) {
      // MongoDB not available, return empty array
      res.json({
        popular_queries: [],
        count: 0
      });
    }
  })
);

// GET /api/suggestions/recent - Get recent queries for user
router.get('/recent',
  readOnlyRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, limit = 5 } = req.query;
    
    try {
      const filter = userId ? { userId } : {};
      
      const recentQueries = await Query.find(filter)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit as string))
        .select('naturalLanguage sql confidence createdAt -_id');
      
      res.json({
        recent_queries: recentQueries.map(q => ({
          query: q.naturalLanguage,
          sql: q.sql,
          confidence: q.confidence,
          created_at: q.createdAt
        })),
        count: recentQueries.length
      });
    } catch (error) {
      // MongoDB not available, return empty array
      res.json({
        recent_queries: [],
        count: 0
      });
    }
  })
);

// GET /api/suggestions/templates - Get query templates
router.get('/templates',
  readOnlyRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const templates = getQueryTemplates();
    
    res.json({
      templates,
      count: templates.length
    });
  })
);

// GET /api/suggestions/context - Get context-aware suggestions
router.get('/context',
  readOnlyRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { table, database = 'default' } = req.query;
    
    if (!table) {
      return res.status(400).json({ error: 'Table name is required' });
    }
    
    const tableInfo = await schemaService.getTableInfo(table as string, database as string);
    
    if (!tableInfo) {
      return res.status(404).json({ error: 'Table not found' });
    }
    
    const contextSuggestions = generateContextSuggestions(tableInfo);
    
    res.json({
      table: table,
      suggestions: contextSuggestions,
      count: contextSuggestions.length
    });
  })
);

async function generateSuggestions(partial: string, limit: number, userId?: string, options?: {
  includeTemplates?: boolean;
  includeSchemaAware?: boolean;
  includeContextual?: boolean;
  conversationId?: string;
}): Promise<any[]> {
  const suggestions: any[] = [];
  
  // If no partial text, return default suggestions
  if (!partial || partial.trim() === '') {
    if (options?.includeTemplates !== false) {
      const templates = getQueryTemplates();
      return templates.slice(0, limit).map(template => ({
        type: 'template',
        text: template.text,
        description: template.description,
        sql: template.sql,
        confidence: 0.8,
        source: 'template'
      }));
    }
    return [];
  }
  
  // 1. Search in previous queries (but only if we have MongoDB connection)
  try {
    const queryMatches = await Query.find({
      naturalLanguage: { $regex: partial, $options: 'i' }
    })
    .sort({ confidence: -1, createdAt: -1 })
    .limit(Math.floor(limit / 2))
    .select('naturalLanguage sql confidence');
    
    suggestions.push(...queryMatches.map(q => ({
      type: 'previous_query',
      text: q.naturalLanguage,
      sql: q.sql,
      confidence: q.confidence,
      source: 'history'
    })));
  } catch (error) {
    // MongoDB not available, skip history queries
    console.log('MongoDB not available for query history');
  }
  
  // 2. Template-based suggestions
  if (options?.includeTemplates !== false) {
    const templates = getQueryTemplates();
    const templateMatches = templates.filter(template => 
      template.text.toLowerCase().includes(partial.toLowerCase()) ||
      template.keywords.some((keyword: string) => keyword.toLowerCase().includes(partial.toLowerCase()))
    ).slice(0, Math.floor(limit / 2));
    
    suggestions.push(...templateMatches.map(template => ({
      type: 'template',
      text: template.text,
      description: template.description,
      sql: template.sql,
      confidence: 0.8,
      source: 'template'
    })));
  }
  
  // 3. Auto-complete based on partial text
  const autoComplete = generateAutoComplete(partial);
  suggestions.push(...autoComplete);
  
  // Sort by relevance and limit
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

function generateAutoComplete(partial: string): any[] {
  const autoCompletes: any[] = [];
  const partialLower = partial.toLowerCase();
  
  const commonPhrases = [
    'show me all users',
    'count the number of orders',
    'find users who registered today',
    'get the total sales amount',
    'list products by category',
    'show recent orders',
    'find top selling products',
    'get user registration trends',
    'show order status distribution',
    'find customers with highest orders'
  ];
  
  commonPhrases.forEach(phrase => {
    if (phrase.toLowerCase().startsWith(partialLower)) {
      autoCompletes.push({
        type: 'autocomplete',
        text: phrase,
        confidence: 0.6,
        source: 'autocomplete'
      });
    }
  });
  
  return autoCompletes;
}

function getQueryTemplates(): any[] {
  return [
    {
      text: 'Show me all records from {table}',
      description: 'Get all data from a specific table',
      sql: 'SELECT * FROM {table}',
      keywords: ['show', 'all', 'records', 'table'],
      category: 'basic'
    },
    {
      text: 'Count the number of {items} in {table}',
      description: 'Count rows in a table',
      sql: 'SELECT COUNT(*) FROM {table}',
      keywords: ['count', 'number', 'total'],
      category: 'aggregation'
    },
    {
      text: 'Find {column} greater than {value}',
      description: 'Filter records by numeric comparison',
      sql: 'SELECT * FROM {table} WHERE {column} > {value}',
      keywords: ['find', 'greater', 'more than', 'above'],
      category: 'filtering'
    },
    {
      text: 'Get the top 10 {items} by {column}',
      description: 'Get top records ordered by a column',
      sql: 'SELECT * FROM {table} ORDER BY {column} DESC LIMIT 10',
      keywords: ['top', 'highest', 'best', 'maximum'],
      category: 'sorting'
    },
    {
      text: 'Show {column} grouped by {group_column}',
      description: 'Group and aggregate data',
      sql: 'SELECT {group_column}, COUNT(*) FROM {table} GROUP BY {group_column}',
      keywords: ['group', 'by', 'category', 'aggregate'],
      category: 'grouping'
    },
    {
      text: 'Find records created in the last 7 days',
      description: 'Filter by recent date range',
      sql: 'SELECT * FROM {table} WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
      keywords: ['recent', 'last', 'days', 'week'],
      category: 'date_filtering'
    }
  ];
}

function generateContextSuggestions(tableInfo: any): any[] {
  const suggestions: any[] = [];
  const tableName = tableInfo.name;
  const columns = tableInfo.columns;
  
  // Basic queries
  suggestions.push({
    text: `Show all ${tableName}`,
    sql: `SELECT * FROM ${tableName}`,
    type: 'basic'
  });
  
  suggestions.push({
    text: `Count total ${tableName}`,
    sql: `SELECT COUNT(*) as total FROM ${tableName}`,
    type: 'aggregation'
  });
  
  // Column-specific suggestions
  columns.forEach((column: any) => {
    if (column.type.includes('INT') || column.type.includes('DECIMAL')) {
      suggestions.push({
        text: `Show ${tableName} with highest ${column.name}`,
        sql: `SELECT * FROM ${tableName} ORDER BY ${column.name} DESC LIMIT 10`,
        type: 'sorting'
      });
    }
    
    if (column.type.includes('VARCHAR') || column.type.includes('TEXT')) {
      suggestions.push({
        text: `Search ${tableName} by ${column.name}`,
        sql: `SELECT * FROM ${tableName} WHERE ${column.name} LIKE '%search_term%'`,
        type: 'search'
      });
    }
    
    if (column.name.includes('date') || column.type.includes('TIMESTAMP')) {
      suggestions.push({
        text: `Show recent ${tableName}`,
        sql: `SELECT * FROM ${tableName} ORDER BY ${column.name} DESC LIMIT 10`,
        type: 'recent'
      });
    }
  });
  
  return suggestions.slice(0, 10); // Limit suggestions
}

export default router;