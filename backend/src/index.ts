import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import winston from 'winston';

import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import queryRoutes from './routes/query';
import executeRoutes from './routes/execute';
import visualizeRoutes from './routes/visualize';
import schemaRoutes from './routes/schema';
import suggestionsRoutes from './routes/suggestions';
import favoritesRoutes from './routes/favorites';
import analyzeRoutes from './routes/analyze';

import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

// Debug: log if environment variables are loaded
console.log('Environment check:');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Found' : 'Not found');
console.log('DATABASE_URL:', process.env.DATABASE_URL || 'Not found');

const app = express();
const PORT = process.env.PORT || 3001;

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Database connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nlsql_db';
    await mongoose.connect(mongoURI);
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/query', queryRoutes);
app.use('/api/execute', executeRoutes);
app.use('/api/visualize', visualizeRoutes);
app.use('/api/schema', schemaRoutes);
app.use('/api/suggestions', suggestionsRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/analyze', analyzeRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const startServer = async () => {
  await connectDB();
  
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
};

startServer().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

export default app;