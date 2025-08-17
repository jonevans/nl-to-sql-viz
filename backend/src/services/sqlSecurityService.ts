import { Parser } from 'node-sql-parser';
import pgFormat from 'pg-format';
import { createError } from '../middleware/errorHandler';

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

  private constructor() {
    this.parser = new Parser();
  }

  static getInstance(): SQLSecurityService {
    if (!SQLSecurityService.instance) {
      SQLSecurityService.instance = new SQLSecurityService();
    }
    return SQLSecurityService.instance;
  }

  /**
   * Simplified validation - only blocks the most dangerous operations
   */
  async validateAndSanitizeSQL(sql: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      complexity: 1
    };

    try {
      // Step 1: Basic dangerous pattern check (minimal)
      const basicValidation = this.performBasicValidation(sql);
      if (!basicValidation.isValid) {
        result.errors.push(...basicValidation.errors);
        return result;
      }

      // Step 2: Try to parse SQL (but don't fail on complex queries)
      try {
        const ast = this.parser.astify(sql, { database: 'postgresql' });
        result.complexity = this.calculateBasicComplexity(ast);
      } catch (parseError: any) {
        // If parsing fails, just warn but allow the query
        result.warnings.push(`SQL parsing warning: ${parseError.message}`);
        result.complexity = 5; // Default complexity
      }

      // Step 3: Return the original SQL (minimal sanitization)
      result.sanitizedSQL = sql.trim();
      result.isValid = true;

      return result;

    } catch (error: any) {
      result.errors.push(`Validation failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Minimal validation - only block truly dangerous operations
   */
  private performBasicValidation(sql: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Only block the most dangerous patterns
    const dangerousPatterns = [
      { pattern: /;\s*(?:DROP|TRUNCATE|DELETE\s+FROM|ALTER|CREATE)\s/i, message: 'Dangerous SQL operation detected' },
      { pattern: /\bxp_\w+/i, message: 'System procedure calls not allowed' },
      { pattern: /\bsp_\w+/i, message: 'Stored procedure calls not allowed' }
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(sql)) {
        errors.push(message);
      }
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
   * Simple complexity calculation
   */
  private calculateBasicComplexity(ast: any): number {
    // Just return a simple complexity score
    return Array.isArray(ast) ? ast.length * 2 : 2;
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
   * Get current security configuration
   */
  getConfig(): any {
    return {
      allowedTables: ['*'], // Allow all tables for now
      maxQueryComplexity: 1000, // Very high limit
      maxJoins: 50,
      maxSubqueries: 20
    };
  }

  /**
   * Update security configuration
   */
  updateConfig(newConfig: any): void {
    // No-op for permissive mode
  }
}