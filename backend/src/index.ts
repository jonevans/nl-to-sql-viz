import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// CRITICAL: Load environment variables BEFORE any other imports that might use them
dotenv.config({ path: path.join(__dirname, '../.env') });

import mongoose from 'mongoose';
import winston from 'winston';
import config, { validateConfig } from './config';

import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { authenticate } from './middleware/authMiddleware';
import authRoutes from './routes/auth';
import queryRoutes from './routes/query';
import executeRoutes from './routes/execute';
import visualizeRoutes from './routes/visualize';
import schemaRoutes from './routes/schema';
import suggestionsRoutes from './routes/suggestions';
import favoritesRoutes from './routes/favorites';
import analyzeRoutes from './routes/analyze';
import conversationRoutes from './routes/conversation';
import analyticsRoutes from './routes/analytics';

// Validate configuration on startup
const configValidation = validateConfig();
if (!configValidation.valid) {
  console.error('❌ Configuration validation failed:');
  configValidation.errors.forEach(error => console.error(`  - ${error}`));
  if (config.server.env === 'production') {
    process.exit(1);
  } else {
    console.warn('⚠️  Continuing in development mode with configuration warnings');
  }
}

const app = express();

// Import centralized logger
import logger from './utils/logger';

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(config.database.mongodb.uri);
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

// Health check (public)
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Diagnostic endpoint (public) - tests all services
app.get('/diagnostic', async (req, res) => {
  const results: any = {
    timestamp: new Date().toISOString(),
    services: {}
  };

  // Test MongoDB
  try {
    await mongoose.connection.db.admin().ping();
    results.services.mongodb = { status: 'OK', connected: mongoose.connection.readyState === 1 };
  } catch (error: any) {
    results.services.mongodb = { status: 'ERROR', error: error.message };
  }

  // Test PostgreSQL
  try {
    const { postgresService } = await import('./services/postgresService');
    const result = await postgresService.executeQuery('SELECT 1 as test');
    results.services.postgresql = { status: 'OK', test: result.rows[0] };
  } catch (error: any) {
    results.services.postgresql = { status: 'ERROR', error: error.message };
  }

  // Test OpenAI
  try {
    const { LLMService } = await import('./services/llmService');
    const llmService = LLMService.getInstance();
    // Just check if we can create the service (doesn't make API call)
    results.services.openai = {
      status: 'CONFIGURED',
      hasApiKey: !!config.openai.apiKey,
      apiKeyPrefix: config.openai.apiKey ? config.openai.apiKey.substring(0, 7) + '...' : 'NOT_SET'
    };
  } catch (error: any) {
    results.services.openai = { status: 'ERROR', error: error.message };
  }

  // Environment check
  results.environment = {
    nodeEnv: config.server.env,
    authEnabled: config.auth.enabled,
    port: config.server.port
  };

  res.json(results);
});

// Public routes (no authentication required)
app.use('/api/auth', authRoutes);

// Protected routes (authentication required)
// Note: For development/testing, you can temporarily disable authentication
// by setting AUTH_ENABLED=false in .env
if (config.auth.enabled) {
  logger.info('Authentication is ENABLED for protected routes');
  app.use('/api/query', authenticate, queryRoutes);
  app.use('/api/execute', authenticate, executeRoutes);
  app.use('/api/visualize', authenticate, visualizeRoutes);
  app.use('/api/schema', authenticate, schemaRoutes);
  app.use('/api/suggestions', authenticate, suggestionsRoutes);
  app.use('/api/favorites', authenticate, favoritesRoutes);
  app.use('/api/analyze', authenticate, analyzeRoutes);
  app.use('/api/conversation', authenticate, conversationRoutes);
  app.use('/api/analytics', authenticate, analyticsRoutes); // Admin only
} else {
  logger.warn('⚠️  Authentication is DISABLED - all routes are public!');
  app.use('/api/query', queryRoutes);
  app.use('/api/execute', executeRoutes);
  app.use('/api/visualize', visualizeRoutes);
  app.use('/api/schema', schemaRoutes);
  app.use('/api/suggestions', suggestionsRoutes);
  app.use('/api/favorites', favoritesRoutes);
  app.use('/api/analyze', analyzeRoutes);
  app.use('/api/conversation', conversationRoutes);
  app.use('/api/analytics', analyticsRoutes); // Admin only
}

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const startServer = async () => {
  await connectDB();

  app.listen(config.server.port, () => {
    logger.info(`Server running on port ${config.server.port} in ${config.server.env} mode`);
  });
};

startServer().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

export default app;