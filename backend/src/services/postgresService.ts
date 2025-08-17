import { Pool, PoolClient } from 'pg';
import { SQLSecurityService } from './sqlSecurityService';

class PostgresService {
  private pool: Pool;
  private securityService: SQLSecurityService;

  constructor() {
    console.log('PostgresService initializing:');
    console.log('  DB_NAME from env:', process.env.DB_NAME);
    console.log('  DB_USER from env:', process.env.DB_USER);
    console.log('  Using database:', process.env.DB_NAME || 'hardware_store_db');
    
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'hardware_store_db',
      user: process.env.DB_USER || 'jevans',
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.securityService = SQLSecurityService.getInstance();

    // Test connection on startup
    this.testConnection();
  }

  private async testConnection(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log('✅ Connected to PostgreSQL successfully');
    } catch (error) {
      console.error('❌ Failed to connect to PostgreSQL:', error);
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
      console.log(`Validating SQL: ${sql.substring(0, 100)}...`);
      
      // Step 1: Comprehensive security validation
      const validation = await this.securityService.validateAndSanitizeSQL(sql);
      
      if (!validation.isValid) {
        const errorMessage = `SQL security validation failed:\n${validation.errors.join('\n')}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
      }

      // Step 2: Use sanitized SQL
      const sanitizedSQL = validation.sanitizedSQL!;
      console.log(`Executing sanitized SQL with complexity: ${validation.complexity}`);

      // Step 3: Execute with connection pooling
      client = await this.pool.connect();
      
      // Step 4: Execute the validated and sanitized query
      const result = await client.query(sanitizedSQL, params);
      const executionTime = Date.now() - startTime;

      console.log(`Query executed successfully in ${executionTime}ms, returned ${result.rowCount} rows`);

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
      console.error(`SQL Execution Error after ${executionTime}ms:`, error.message);
      
      // Provide minimal error information to prevent information leakage
      if (error.message.includes('security validation failed')) {
        throw error; // Security errors can be shown
      } else {
        throw new Error('Query execution failed. Please check your SQL syntax and try again.');
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
      console.log(`Validating SQL: ${sql.substring(0, 100)}...`);
      
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
        return { 
          valid: false, 
          message: `PostgreSQL validation failed: ${error.message}` 
        };
      }
    } catch (error: any) {
      console.error('SQL validation error:', error);
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
      console.error('Schema fetch error:', error);
      throw new Error(`Failed to fetch schema: ${error.message}`);
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const postgresService = new PostgresService();