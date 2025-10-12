import { Pool, PoolClient } from 'pg';
import { SQLSecurityService } from './sqlSecurityService';
import { createLogger } from '../utils/logger';
import config from '../config';

const logger = createLogger('PostgresService');

class PostgresService {
  private pool: Pool;
  private securityService: SQLSecurityService;

  constructor() {
    logger.info('PostgresService initializing');

    // Use DATABASE_URL if provided (for Render/production), otherwise use individual params
    const databaseUrl = process.env.DATABASE_URL;

    if (databaseUrl) {
      logger.info('Using DATABASE_URL for connection');
      this.pool = new Pool({
        connectionString: databaseUrl,
        ssl: {
          rejectUnauthorized: false // Required for Render PostgreSQL
        },
        max: config.database.postgres.maxConnections,
        idleTimeoutMillis: config.database.postgres.idleTimeout,
        connectionTimeoutMillis: config.database.postgres.connectionTimeout,
      });
    } else {
      logger.info('Using individual connection parameters', {
        dbName: config.database.postgres.name,
        dbUser: config.database.postgres.user,
        dbHost: config.database.postgres.host
      });
      this.pool = new Pool({
        host: config.database.postgres.host,
        port: config.database.postgres.port,
        database: config.database.postgres.name,
        user: config.database.postgres.user,
        password: config.database.postgres.password,
        max: config.database.postgres.maxConnections,
        idleTimeoutMillis: config.database.postgres.idleTimeout,
        connectionTimeoutMillis: config.database.postgres.connectionTimeout,
      });
    }

    this.securityService = SQLSecurityService.getInstance();

    // Test connection on startup
    this.testConnection();
  }

  private async testConnection(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('Connected to PostgreSQL successfully');
    } catch (error: any) {
      logger.error('Failed to connect to PostgreSQL', { error: error.message });
    }
  }

  async executeQuery(sql: string, params: any[] = []): Promise<{
    data: any[];
    columns: string[];
    rowCount: number;
    executionTime: number;
    securityInfo: {
      isSecure: boolean;
      complexity: number;
      warnings: string[];
    };
  }> {
    const startTime = Date.now();
    let client: PoolClient | null = null;

    try {
      logger.debug('Validating SQL', { sqlPreview: sql.substring(0, 100) });

      // Step 1: Comprehensive security validation
      const validation = await this.securityService.validateAndSanitizeSQL(sql);
      
      if (!validation.isValid) {
        logger.error('SQL security validation failed', { errors: validation.errors });
        // Generic error for user, detailed logs for debugging
        throw new Error('Query validation failed. Please ensure your query follows security guidelines.');
      }

      // Step 2: Use sanitized SQL
      const sanitizedSQL = validation.sanitizedSQL!;
      logger.debug('Executing sanitized SQL', { complexity: validation.complexity });

      // Step 3: Execute with connection pooling
      client = await this.pool.connect();
      
      // Step 4: Execute the validated and sanitized query
      const result = await client.query(sanitizedSQL, params);
      const executionTime = Date.now() - startTime;

      logger.info('Query executed successfully', {
        executionTime: `${executionTime}ms`,
        rowCount: result.rowCount
      });

      return {
        data: result.rows,
        columns: result.fields.map(field => field.name),
        rowCount: result.rowCount || 0,
        executionTime,
        securityInfo: {
          isSecure: true,
          complexity: validation.complexity,
          warnings: validation.warnings
        }
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logger.error('SQL execution error', {
        executionTime: `${executionTime}ms`,
        error: error.message
      });
      
      // Provide minimal error information to prevent information leakage
      if (error.message.includes('validation failed')) {
        throw error; // Validation errors (already generic) can be shown
      } else {
        // Generic error for database issues
        throw new Error('Query execution failed. Please try again or rephrase your question.');
      }
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async validateSQL(sql: string): Promise<{
    valid: boolean;
    message: string;
    complexity?: number;
    warnings?: string[];
  }> {
    try {
      logger.debug('Validating SQL', { sqlPreview: sql.substring(0, 100) });
      
      // Use comprehensive security validation
      const validation = await this.securityService.validateAndSanitizeSQL(sql);
      
      if (!validation.isValid) {
        return {
          valid: false,
          message: validation.errors.join('; ')
        };
      }

      // Additional PostgreSQL-specific validation using EXPLAIN
      const client = await this.pool.connect();
      try {
        await client.query(`EXPLAIN ${validation.sanitizedSQL}`);
        client.release();
        
        return { 
          valid: true, 
          message: 'SQL is valid and secure',
          complexity: validation.complexity,
          warnings: validation.warnings
        };
      } catch (error: any) {
        client.release();
        logger.error('PostgreSQL validation failed', { error: error.message });
        return {
          valid: false,
          message: 'Query validation failed. Please check your SQL syntax.'
        };
      }
    } catch (error: any) {
      logger.error('SQL validation error', { error: error.message });
      return { 
        valid: false, 
        message: 'Validation failed. Please check your SQL syntax.' 
      };
    }
  }

  async getSchema(): Promise<{
    tables: Array<{
      table_name: string;
      columns: Array<{
        column_name: string;
        data_type: string;
        is_nullable: string;
      }>;
    }>;
  }> {
    try {
      const client = await this.pool.connect();
      
      // Get all tables
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      const tables = [];
      
      for (const table of tablesResult.rows) {
        // Get columns for each table
        const columnsResult = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = $1
          ORDER BY ordinal_position
        `, [table.table_name]);

        tables.push({
          table_name: table.table_name,
          columns: columnsResult.rows
        });
      }

      client.release();
      return { tables };
    } catch (error: any) {
      logger.error('Schema fetch error', { error: error.message, stack: error.stack });
      // Generic error for user
      throw new Error('Failed to fetch database schema. Please try again later.');
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const postgresService = new PostgresService();