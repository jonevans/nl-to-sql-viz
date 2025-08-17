import Joi from 'joi';

export const querySchema = Joi.object({
  query: Joi.string().required().min(1).max(1000).trim(),
  provider: Joi.string().valid('openai', 'anthropic', 'local').optional(),
  model: Joi.string().optional(),
  userId: Joi.string().optional()
});

export const executeSchema = Joi.object({
  sql: Joi.string().required().min(1).max(5000).trim(),
  database: Joi.string().optional(),
  userId: Joi.string().optional()
});

export const visualizeSchema = Joi.object({
  data: Joi.array().items(Joi.object()).required(),
  columns: Joi.array().items(Joi.string()).required(),
  chartType: Joi.string().valid('bar', 'line', 'pie', 'scatter', 'area', 'table').optional(),
  userId: Joi.string().optional()
});

export const favoriteSchema = Joi.object({
  name: Joi.string().required().min(1).max(100).trim(),
  description: Joi.string().optional().max(500).trim(),
  naturalLanguage: Joi.string().required().min(1).max(1000).trim(),
  sql: Joi.string().required().min(1).max(5000).trim(),
  tags: Joi.array().items(Joi.string().trim()).optional(),
  userId: Joi.string().optional()
});

export const updateFavoriteSchema = Joi.object({
  name: Joi.string().optional().min(1).max(100).trim(),
  description: Joi.string().optional().max(500).trim(),
  naturalLanguage: Joi.string().optional().min(1).max(1000).trim(),
  sql: Joi.string().optional().min(1).max(5000).trim(),
  tags: Joi.array().items(Joi.string().trim()).optional(),
  userId: Joi.string().optional()
});

export const suggestionsSchema = Joi.object({
  partial: Joi.string().optional().allow('').max(500).trim().default(''),
  limit: Joi.number().integer().min(1).max(20).optional().default(10),
  maxSuggestions: Joi.number().integer().min(1).max(20).optional().default(10),
  includeTemplates: Joi.boolean().optional().default(true),
  includeSchemaAware: Joi.boolean().optional().default(true),
  includeContextual: Joi.boolean().optional().default(true),
  conversationId: Joi.string().optional(),
  userId: Joi.string().optional()
});

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(10),
  sort: Joi.string().valid('createdAt', 'updatedAt', 'name').optional().default('createdAt'),
  order: Joi.string().valid('asc', 'desc').optional().default('desc')
});

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};