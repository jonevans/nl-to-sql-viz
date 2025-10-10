/**
 * Centralized configuration for the application
 * All hardcoded values should be defined here
 */

export const config = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '8000'),
    env: process.env.NODE_ENV || 'development',
    apiUrl: process.env.API_URL || 'http://localhost:8000',
  },

  // Database Configuration
  database: {
    postgres: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      name: process.env.DB_NAME || 'hardware_store_db',
      user: process.env.DB_USER || 'jevans',
      password: process.env.DB_PASSWORD,
      maxConnections: 20,
      idleTimeout: 30000,
      connectionTimeout: 2000,
    },
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/nlsql_db',
    },
  },

  // Authentication Configuration
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
    jwtExpiresIn: (process.env.JWT_EXPIRES_IN || '24h') as string,
    saltRounds: 12,
    enabled: process.env.AUTH_ENABLED !== 'false', // Defaults to true
  },

  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    defaultModel: 'gpt-4-turbo-preview',
    fallbackModel: 'gpt-3.5-turbo',
    temperature: 0.1,
    maxTokens: 500,
    analysisMaxTokens: 200,
    analysisTemperature: 0.3,
  },

  // Conversation Service Configuration
  conversation: {
    maxConversations: 1000, // Maximum conversations in memory
    ttlMs: 3600000, // 1 hour TTL
    maxMessagesPerConversation: 100,
    cleanupIntervalMs: 300000, // Run cleanup every 5 minutes
    contextWindow: 6, // Number of recent messages to include in context
    dataPreviewLimit: 3, // Number of sample rows to send
  },

  // Data Query Configuration
  query: {
    maxRowsToReturn: 10000, // Maximum rows to return from a single query
    truncationThreshold: 100, // Truncate data above this threshold
    aggregateRowThreshold: 100, // Treat queries with <= this many rows as aggregates
    summarizationThreshold: 50, // Summarize datasets larger than this for LLM context
    maxSampleRows: 5, // Number of sample rows to include in summaries
    topCategoricalValues: 10, // Number of top values to show for categorical columns
  },

  // Rate Limiting Configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    llmWindowMs: 60000, // 1 minute for LLM requests
    llmMaxRequests: 20,
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    maxFileSize: 5242880, // 5MB
    maxFiles: 5,
    dir: 'logs',
  },

  // SQL Security Configuration
  sql: {
    maxComplexity: 1000,
    maxJoins: 50,
    maxSubqueries: 20,
  },

  // Colony Hardware Specific
  colony: {
    dbName: 'colony_hardware_db',
    stateCodes: {
      michigan: 'MI',
      ohio: 'OH',
      indiana: 'IN',
      // Add more as needed
    },
  },
};

/**
 * Validate critical configuration on startup
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check critical environment variables
  if (!config.openai.apiKey) {
    errors.push('OPENAI_API_KEY is not set');
  }

  if (config.auth.enabled && config.auth.jwtSecret === 'your-secret-key-change-this-in-production') {
    errors.push('JWT_SECRET must be changed from default value when authentication is enabled');
  }

  if (!config.database.postgres.user) {
    errors.push('DB_USER is not set');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if we're using Colony Hardware database
 */
export function isColonyHardwareDB(): boolean {
  return config.database.postgres.name === config.colony.dbName;
}

export default config;
