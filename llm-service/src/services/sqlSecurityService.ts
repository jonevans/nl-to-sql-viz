import { Parser } from 'node-sql-parser';
import * as pgFormat from 'pg-format';
// Note: Using simple Error instead of createError for LLM service
const createError = (status: number, message: string) => new Error(message);

interface SecurityConfig {
  allowedTables: string[];
  allowedColumns: Record<string, string[]>;
  maxQueryComplexity: number;
  maxJoins: number;
  maxSubqueries: number;
  allowedFunctions: string[];
}

interface ValidationResult {
  isValid: boolean;
  sanitizedSQL?: string;
  errors: string[];
  warnings: string[];
  complexity: number;
}

export class SQLSecurityService {
  private static instance: SQLSecurityService;
  private parser: Parser;
  private config: SecurityConfig;

  private constructor() {
    this.parser = new Parser();
    this.config = {
      allowedTables: [
        'users', 'orders', 'products', 'categories', 'order_items',
        'customers', 'suppliers', 'inventory', 'sales', 'transactions'
      ],
      allowedColumns: {
        users: ['id', 'name', 'email', 'created_at', 'updated_at', 'status'],
        orders: ['id', 'user_id', 'total', 'status', 'order_date', 'created_at'],
        products: ['id', 'name', 'price', 'category', 'stock', 'description', 'created_at'],
        categories: ['id', 'name', 'description', 'parent_id'],
        order_items: ['id', 'order_id', 'product_id', 'quantity', 'price'],
        customers: ['id', 'name', 'email', 'phone', 'address', 'city', 'country'],
        suppliers: ['id', 'name', 'contact_info', 'address'],
        inventory: ['id', 'product_id', 'quantity', 'location', 'last_updated'],
        sales: ['id', 'product_id', 'quantity', 'sale_date', 'revenue'],
        transactions: ['id', 'order_id', 'amount', 'payment_method', 'transaction_date']
      },
      maxQueryComplexity: 100,
      maxJoins: 5,
      maxSubqueries: 3,
      allowedFunctions: [
        'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'UPPER', 'LOWER', 'SUBSTRING',
        'CONCAT', 'COALESCE', 'DATE', 'YEAR', 'MONTH', 'DAY', 'NOW', 'CURRENT_DATE'
      ]
    };
  }

  static getInstance(): SQLSecurityService {
    if (!SQLSecurityService.instance) {
      SQLSecurityService.instance = new SQLSecurityService();
    }
    return SQLSecurityService.instance;
  }

  /**
   * Comprehensive SQL validation and sanitization
   */
  async validateAndSanitizeSQL(sql: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      complexity: 0
    };

    try {
      // Step 1: Basic string validation
      const basicValidation = this.performBasicValidation(sql);
      if (!basicValidation.isValid) {
        result.errors.push(...basicValidation.errors);
        return result;
      }

      // Step 2: Parse SQL into AST
      let ast;
      try {
        ast = this.parser.astify(sql, { database: 'postgresql' });
      } catch (parseError: any) {
        result.errors.push(`Invalid SQL syntax: ${parseError.message}`);
        return result;
      }

      // Step 3: AST-based security validation
      const astValidation = this.validateAST(ast);
      result.errors.push(...astValidation.errors);
      result.warnings.push(...astValidation.warnings);
      result.complexity = astValidation.complexity;

      if (result.errors.length > 0) {
        return result;
      }

      // Step 4: Generate sanitized SQL
      try {
        result.sanitizedSQL = this.parser.sqlify(ast, { database: 'postgresql' });
        result.isValid = true;
      } catch (sqlifyError: any) {
        result.errors.push(`Failed to generate sanitized SQL: ${sqlifyError.message}`);
      }

      return result;

    } catch (error: any) {
      result.errors.push(`Validation failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Basic string-level validation
   */
  private performBasicValidation(sql: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for dangerous patterns that might bypass AST parsing
    const dangerousPatterns = [
      { pattern: /;\s*(?:DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)/i, message: 'Dangerous SQL operation detected' },
      { pattern: /--/, message: 'SQL comments not allowed' },
      { pattern: /\/\*[\s\S]*?\*\//, message: 'Block comments not allowed' },
      { pattern: /\bxp_\w+/i, message: 'System procedure calls not allowed' },
      { pattern: /\bsp_\w+/i, message: 'Stored procedure calls not allowed' },
      { pattern: /\bDBCC\b/i, message: 'Database console commands not allowed' },
      { pattern: /\bSHUTDOWN\b/i, message: 'System commands not allowed' },
      { pattern: /\bWAITFOR\b/i, message: 'Time delay commands not allowed' },
      { pattern: /\bBULK\s+INSERT\b/i, message: 'Bulk operations not allowed' },
      { pattern: /\bOPENROWSET\b/i, message: 'External data access not allowed' },
      { pattern: /\bOPENDATASOURCE\b/i, message: 'External data source access not allowed' }
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(sql)) {
        errors.push(message);
      }
    }

    // Check length limits
    if (sql.length > 10000) {
      errors.push('Query too long (max 10000 characters)');
    }

    // Must start with SELECT (case insensitive)
    if (!/^\s*SELECT\b/i.test(sql.trim())) {
      errors.push('Only SELECT statements are allowed');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * AST-based validation
   */
  private validateAST(ast: any): { errors: string[]; warnings: string[]; complexity: number } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let complexity = 0;

    // Handle both single queries and arrays of queries
    const queries = Array.isArray(ast) ? ast : [ast];

    for (const query of queries) {
      const queryValidation = this.validateSingleQuery(query);
      errors.push(...queryValidation.errors);
      warnings.push(...queryValidation.warnings);
      complexity += queryValidation.complexity;
    }

    if (complexity > this.config.maxQueryComplexity) {
      errors.push(`Query complexity (${complexity}) exceeds maximum allowed (${this.config.maxQueryComplexity})`);
    }

    return { errors, warnings, complexity };
  }

  /**
   * Validate a single query AST node
   */
  private validateSingleQuery(query: any): { errors: string[]; warnings: string[]; complexity: number } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let complexity = 1; // Base complexity

    // Only allow SELECT statements
    if (query.type !== 'select') {
      errors.push(`Statement type '${query.type}' not allowed. Only SELECT statements permitted.`);
      return { errors, warnings, complexity };
    }

    // Validate tables
    if (query.from) {
      const tableValidation = this.validateTables(query.from);
      errors.push(...tableValidation.errors);
      warnings.push(...tableValidation.warnings);
      complexity += tableValidation.complexity;
    }

    // Validate columns
    if (query.columns) {
      const columnValidation = this.validateColumns(query.columns, query.from);
      errors.push(...columnValidation.errors);
      warnings.push(...columnValidation.warnings);
      complexity += columnValidation.complexity;
    }

    // Validate JOINs
    if (query.from) {
      const joinValidation = this.validateJoins(query.from);
      errors.push(...joinValidation.errors);
      complexity += joinValidation.complexity;
    }

    // Validate WHERE clause
    if (query.where) {
      const whereValidation = this.validateWhereClause(query.where);
      errors.push(...whereValidation.errors);
      complexity += whereValidation.complexity;
    }

    // Validate functions
    const functionValidation = this.validateFunctions(query);
    errors.push(...functionValidation.errors);
    warnings.push(...functionValidation.warnings);

    // Validate subqueries
    const subqueryValidation = this.validateSubqueries(query);
    errors.push(...subqueryValidation.errors);
    complexity += subqueryValidation.complexity;

    return { errors, warnings, complexity };
  }

  /**
   * Validate table access
   */
  private validateTables(fromClause: any[]): { errors: string[]; warnings: string[]; complexity: number } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let complexity = 0;

    for (const table of fromClause) {
      if (table.table) {
        const tableName = table.table.toLowerCase();
        if (!this.config.allowedTables.includes(tableName)) {
          errors.push(`Access to table '${tableName}' not allowed`);
        }
        complexity += 1;
      }
    }

    return { errors, warnings, complexity };
  }

  /**
   * Validate column access
   */
  private validateColumns(columns: any[], fromClause: any[]): { errors: string[]; warnings: string[]; complexity: number } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let complexity = 0;

    // Get list of tables being queried
    const tablesInQuery = fromClause.map(f => f.table?.toLowerCase()).filter(Boolean);

    for (const column of columns) {
      if (column.expr) {
        complexity += this.validateColumnExpression(column.expr, tablesInQuery, errors);
      }
    }

    return { errors, warnings, complexity };
  }

  /**
   * Validate column expressions
   */
  private validateColumnExpression(expr: any, tables: string[], errors: string[]): number {
    let complexity = 1;

    if (expr.type === 'column_ref') {
      const columnName = expr.column?.toLowerCase();
      const tableName = expr.table?.toLowerCase();

      if (tableName && !tables.includes(tableName)) {
        errors.push(`Reference to unauthorized table '${tableName}'`);
      }

      if (tableName && columnName) {
        const allowedColumns = this.config.allowedColumns[tableName];
        if (allowedColumns && !allowedColumns.includes(columnName)) {
          errors.push(`Access to column '${tableName}.${columnName}' not allowed`);
        }
      }
    } else if (expr.type === 'function') {
      const functionName = expr.name?.toUpperCase();
      if (functionName && !this.config.allowedFunctions.includes(functionName)) {
        errors.push(`Function '${functionName}' not allowed`);
      }
      complexity += 2;
    }

    return complexity;
  }

  /**
   * Validate JOINs
   */
  private validateJoins(fromClause: any[]): { errors: string[]; complexity: number } {
    const errors: string[] = [];
    let complexity = 0;
    let joinCount = 0;

    for (const table of fromClause) {
      if (table.join) {
        joinCount++;
        complexity += 3; // JOINs add significant complexity
      }
    }

    if (joinCount > this.config.maxJoins) {
      errors.push(`Too many JOINs (${joinCount}). Maximum allowed: ${this.config.maxJoins}`);
    }

    return { errors, complexity };
  }

  /**
   * Validate WHERE clause
   */
  private validateWhereClause(whereClause: any): { errors: string[]; complexity: number } {
    const errors: string[] = [];
    let complexity = 2; // WHERE clauses add complexity

    // This is a simplified validation - in production, you'd want more thorough checking
    if (whereClause.type === 'binary_expr') {
      complexity += 1;
    }

    return { errors, complexity };
  }

  /**
   * Validate functions throughout the query
   */
  private validateFunctions(query: any): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // This would recursively check all function calls in the query
    // Implementation simplified for brevity

    return { errors, warnings };
  }

  /**
   * Validate and count subqueries
   */
  private validateSubqueries(query: any): { errors: string[]; complexity: number } {
    const errors: string[] = [];
    let complexity = 0;
    let subqueryCount = 0;

    // Count subqueries recursively
    const countSubqueries = (obj: any): void => {
      if (typeof obj === 'object' && obj !== null) {
        if (obj.type === 'select' && obj !== query) {
          subqueryCount++;
          complexity += 5; // Subqueries add significant complexity
        }
        Object.values(obj).forEach(countSubqueries);
      }
    };

    countSubqueries(query);

    if (subqueryCount > this.config.maxSubqueries) {
      errors.push(`Too many subqueries (${subqueryCount}). Maximum allowed: ${this.config.maxSubqueries}`);
    }

    return { errors, complexity };
  }

  /**
   * Create a parameterized query for safe execution
   */
  formatQuery(sql: string, params: any[] = []): string {
    try {
      return pgFormat(sql, ...params);
    } catch (error: any) {
      throw createError(400, `Query formatting failed: ${error.message}`);
    }
  }

  /**
   * Update security configuration
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current security configuration
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }
}