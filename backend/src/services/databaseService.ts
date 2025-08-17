import { MongoClient, Db } from 'mongodb';
import { createError } from '../middleware/errorHandler';
import { QueryResponse } from '../types';

export class DatabaseService {
  private static instance: DatabaseService;
  private connections: Map<string, Db> = new Map();

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async executeSQL(sql: string, database?: string): Promise<QueryResponse> {
    const startTime = Date.now();
    
    try {
      // Note: This is a simplified implementation
      // In a real application, you'd need to handle different database types
      // For now, we'll simulate execution since we're using MongoDB as the backend
      
      const result = await this.simulateExecution(sql);
      
      return {
        sql,
        data: result.data,
        columns: result.columns,
        executionTime: Date.now() - startTime,
        rowCount: result.data.length
      };
    } catch (error: any) {
      throw createError(500, `Database execution error: ${error.message}`);
    }
  }

  private async simulateExecution(sql: string): Promise<{ data: any[], columns: string[] }> {
    // This is a simulation - in a real app, you'd execute against actual databases
    // For demonstration, we'll return mock data based on common SQL patterns
    
    const sqlLower = sql.toLowerCase();
    
    if (sqlLower.includes('select') && sqlLower.includes('users')) {
      return {
        data: [
          { id: 1, name: 'John Doe', email: 'john@example.com', created_at: '2023-01-01' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com', created_at: '2023-01-02' }
        ],
        columns: ['id', 'name', 'email', 'created_at']
      };
    }
    
    if (sqlLower.includes('select') && sqlLower.includes('orders')) {
      return {
        data: [
          { id: 1, user_id: 1, total: 99.99, status: 'completed', order_date: '2023-01-01' },
          { id: 2, user_id: 2, total: 149.99, status: 'pending', order_date: '2023-01-02' }
        ],
        columns: ['id', 'user_id', 'total', 'status', 'order_date']
      };
    }
    
    if (sqlLower.includes('select') && sqlLower.includes('products')) {
      return {
        data: [
          { id: 1, name: 'Product A', price: 29.99, category: 'Electronics', stock: 100 },
          { id: 2, name: 'Product B', price: 49.99, category: 'Electronics', stock: 50 }
        ],
        columns: ['id', 'name', 'price', 'category', 'stock']
      };
    }
    
    if (sqlLower.includes('count')) {
      return {
        data: [{ count: 42 }],
        columns: ['count']
      };
    }
    
    if (sqlLower.includes('sum')) {
      return {
        data: [{ sum: 1234.56 }],
        columns: ['sum']
      };
    }
    
    // Default response
    return {
      data: [{ result: 'Query executed successfully' }],
      columns: ['result']
    };
  }

  async validateSQL(sql: string): Promise<boolean> {
    // Basic SQL validation
    const sqlLower = sql.toLowerCase().trim();
    
    // Block dangerous operations
    const dangerousPatterns = [
      'drop table',
      'delete from',
      'truncate',
      'alter table',
      'create table',
      'insert into',
      'update set',
      'exec',
      'execute',
      'xp_',
      'sp_',
      '--',
      '/*',
      '*/',
      ';'
    ];
    
    for (const pattern of dangerousPatterns) {
      if (sqlLower.includes(pattern)) {
        throw createError(400, `Potentially dangerous SQL operation detected: ${pattern}`);
      }
    }
    
    // Must be a SELECT statement
    if (!sqlLower.startsWith('select')) {
      throw createError(400, 'Only SELECT statements are allowed');
    }
    
    return true;
  }

  async getConnectionInfo(database?: string): Promise<any> {
    // Return mock connection info
    return {
      database: database || 'default',
      status: 'connected',
      type: 'mongodb',
      version: '7.0',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 27017
    };
  }
}