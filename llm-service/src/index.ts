import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { AdvancedLLMService } from './services/AdvancedLLMService';
import { ErrorHandler } from './services/ErrorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Initialize services
const llmService = AdvancedLLMService.getInstance();
const errorHandler = ErrorHandler.getInstance();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Strict rate limiting for LLM endpoints
const llmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20 // 20 LLM requests per 15 minutes
});

// Routes

// Health check
app.get('/health', async (req, res) => {
  try {
    const health = await llmService.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: 'Service unavailable' });
  }
});

// Generate SQL from natural language
app.post('/api/generate', llmLimiter, async (req, res) => {
  try {
    const {
      query,
      schema,
      conversationId,
      provider,
      model,
      options
    } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const response = await llmService.processQuery({
      query,
      schema,
      conversationId,
      provider,
      model,
      options
    });

    res.json(response);

  } catch (error) {
    console.error('Generate SQL error:', error);
    res.status(500).json({ 
      error: 'Failed to generate SQL',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Refine existing query
app.post('/api/refine', llmLimiter, async (req, res) => {
  try {
    const {
      originalQuery,
      feedback,
      conversationId,
      previousSQL
    } = req.body;

    if (!originalQuery || !feedback || !conversationId) {
      return res.status(400).json({ 
        error: 'originalQuery, feedback, and conversationId are required' 
      });
    }

    const response = await llmService.refineQuery(
      originalQuery,
      feedback,
      conversationId,
      previousSQL
    );

    res.json(response);

  } catch (error) {
    console.error('Refine query error:', error);
    res.status(500).json({ 
      error: 'Failed to refine query',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Analyze data for visualization
app.post('/api/analyze', async (req, res) => {
  try {
    const { data, columns, rowCount, executionTime, query } = req.body;

    if (!data || !columns) {
      return res.status(400).json({ error: 'data and columns are required' });
    }

    const queryResult = {
      data,
      columns,
      rowCount: rowCount || data.length,
      executionTime: executionTime || 0,
      query: query || ''
    };

    const visualization = await llmService.analyzeDataForVisualization(queryResult);
    res.json(visualization);

  } catch (error) {
    console.error('Analyze data error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get query suggestions
app.get('/api/suggestions', async (req, res) => {
  try {
    const { 
      partial, 
      conversationId, 
      maxSuggestions = 10,
      includeTemplates = true,
      includeSchemaAware = true,
      includeContextual = true
    } = req.query;

    if (!partial) {
      return res.status(400).json({ error: 'partial query is required' });
    }

    const suggestions = await llmService.getSuggestions(
      partial as string,
      conversationId as string,
      {
        maxSuggestions: parseInt(maxSuggestions as string),
        includeTemplates: includeTemplates === 'true',
        includeSchemaAware: includeSchemaAware === 'true',
        includeContextual: includeContextual === 'true'
      }
    );

    res.json({
      partial,
      suggestions,
      count: suggestions.length
    });

  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ 
      error: 'Failed to get suggestions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Conversation management
app.post('/api/conversations', async (req, res) => {
  try {
    const { userId } = req.body;
    const conversationId = llmService.createConversation(userId);
    res.json({ conversationId });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ 
      error: 'Failed to create conversation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = llmService.getConversationHistory(id);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ 
      error: 'Failed to get conversation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.delete('/api/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = llmService.deleteConversation(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ 
      error: 'Failed to delete conversation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Advanced LLM Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 API endpoints: http://localhost:${PORT}/api/`);
});

export default app;