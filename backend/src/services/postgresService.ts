import { Pool, PoolClient } from 'pg';

class PostgresService {
  private pool: Pool;

  constructor() {
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'hardware_store_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

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

  async executeQuery(sql: string): Promise<{
    data: any[];
    columns: string[];
    rowCount: number;
    executionTime: number;
  }> {
    const startTime = Date.now();
    let client: PoolClient | null = null;

    try {
      client = await this.pool.connect();
      
      // Security: Basic SQL injection prevention
      // In production, you'd want more sophisticated validation
      const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE'];
      const upperSQL = sql.toUpperCase();
      
      for (const keyword of dangerousKeywords) {
        if (upperSQL.includes(keyword)) {
          throw new Error(`Dangerous SQL operation detected: ${keyword}. Only SELECT queries are allowed.`);
        }
      }

      const result = await client.query(sql);
      const executionTime = Date.now() - startTime;

      return {
        data: result.rows,
        columns: result.fields.map(field => field.name),
        rowCount: result.rowCount || 0,
        executionTime
      };
    } catch (error: any) {
      console.error('SQL Execution Error:', error);
      throw new Error(`SQL execution failed: ${error.message}`);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async validateSQL(sql: string): Promise<{ valid: boolean; message: string }> {
    try {
      // Basic validation - check for dangerous operations
      const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE'];
      const upperSQL = sql.toUpperCase();
      
      for (const keyword of dangerousKeywords) {
        if (upperSQL.includes(keyword)) {
          return {
            valid: false,
            message: `Dangerous SQL operation detected: ${keyword}. Only SELECT queries are allowed.`
          };
        }
      }

      // Try to explain the query (doesn't execute it)
      const client = await this.pool.connect();
      try {
        await client.query(`EXPLAIN ${sql}`);
        client.release();
        return { valid: true, message: 'SQL is valid' };
      } catch (error: any) {
        client.release();
        return { valid: false, message: error.message };
      }
    } catch (error: any) {
      return { valid: false, message: error.message };
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