import { SQLSecurityService } from './sqlSecurityService';

interface SanitizationResult {
  sanitizedSQL: string;
  isSecure: boolean;
  removedContent: string[];
  securityWarnings: string[];
  confidence: number;
}

export class LLMOutputSanitizer {
  private static instance: LLMOutputSanitizer;
  private sqlSecurityService: SQLSecurityService;

  private constructor() {
    this.sqlSecurityService = SQLSecurityService.getInstance();
  }

  static getInstance(): LLMOutputSanitizer {
    if (!LLMOutputSanitizer.instance) {
      LLMOutputSanitizer.instance = new LLMOutputSanitizer();
    }
    return LLMOutputSanitizer.instance;
  }

  /**
   * Sanitize LLM output to extract and validate SQL
   */
  async sanitizeLLMOutput(rawOutput: string): Promise<SanitizationResult> {
    const result: SanitizationResult = {
      sanitizedSQL: '',
      isSecure: false,
      removedContent: [],
      securityWarnings: [],
      confidence: 0
    };

    try {
      // Step 1: Extract SQL from LLM response
      const extractedSQL = this.extractSQL(rawOutput);
      if (!extractedSQL) {
        result.securityWarnings.push('No valid SQL found in LLM output');
        return result;
      }

      // Step 2: Remove potential prompt injection attempts
      const cleanedSQL = this.removePromptInjection(extractedSQL, result);

      // Step 3: Validate SQL structure and security
      const validation = await this.sqlSecurityService.validateAndSanitizeSQL(cleanedSQL);
      
      if (!validation.isValid) {
        result.securityWarnings.push(...validation.errors);
        return result;
      }

      // Step 4: Final sanitization
      result.sanitizedSQL = validation.sanitizedSQL || '';
      result.isSecure = true;
      result.confidence = this.calculateConfidence(rawOutput, validation);
      result.securityWarnings.push(...validation.warnings);

      return result;

    } catch (error: any) {
      result.securityWarnings.push(`Sanitization failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Extract SQL from various LLM response formats
   */
  private extractSQL(output: string): string | null {
    // Common patterns for SQL in LLM responses
    const sqlPatterns = [
      /SQL:\s*(.+?)(?:\n(?:REASONING|CONFIDENCE|EXPLANATION|$))/s,
      /```sql\s*([\s\S]*?)\s*```/i,
      /```\s*(SELECT[\s\S]*?)\s*```/i,
      /(?:^|\n)\s*(SELECT[\s\S]*?)(?:\n\n|$)/i
    ];

    for (const pattern of sqlPatterns) {
      const match = output.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Fallback: look for SELECT at the beginning of a line
    const lines = output.split('\n');
    for (const line of lines) {
      if (/^\s*SELECT\b/i.test(line)) {
        return line.trim();
      }
    }

    return null;
  }

  /**
   * Remove potential prompt injection attempts
   */
  private removePromptInjection(sql: string, result: SanitizationResult): string {
    let cleaned = sql;

    // Patterns that might indicate prompt injection
    const injectionPatterns = [
      {
        pattern: /;\s*(?:DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|EXEC)/gi,
        replacement: '',
        warning: 'Removed dangerous SQL commands'
      },
      {
        pattern: /--[^\r\n]*/g,
        replacement: '',
        warning: 'Removed SQL comments that could hide malicious code'
      },
      {
        pattern: /\/\*[\s\S]*?\*\//g,
        replacement: '',
        warning: 'Removed block comments'
      },
      {
        pattern: /['"]\s*;\s*[^'"]*['"]/g,
        replacement: (match: string) => {
          result.removedContent.push(match);
          return '';
        },
        warning: 'Removed potential SQL injection in string literals'
      },
      {
        pattern: /\bUNION\s+(?:ALL\s+)?SELECT\b/gi,
        replacement: '',
        warning: 'Removed UNION SELECT which could be used for data exfiltration'
      },
      {
        pattern: /\bINTO\s+(?:OUTFILE|DUMPFILE)\b/gi,
        replacement: '',
        warning: 'Removed file output operations'
      },
      {
        pattern: /\bLOAD_FILE\s*\(/gi,
        replacement: '',
        warning: 'Removed file read operations'
      }
    ];

    for (const { pattern, replacement, warning } of injectionPatterns) {
      const originalLength = cleaned.length;
      if (typeof replacement === 'function') {
        cleaned = cleaned.replace(pattern, replacement);
      } else {
        cleaned = cleaned.replace(pattern, replacement);
      }
      
      if (cleaned.length !== originalLength) {
        result.securityWarnings.push(warning);
      }
    }

    // Remove multiple semicolons
    cleaned = cleaned.replace(/;+/g, ';');
    
    // Ensure it ends with a single semicolon or no semicolon
    cleaned = cleaned.replace(/;+$/, '');

    return cleaned.trim();
  }

  /**
   * Calculate confidence based on various factors
   */
  private calculateConfidence(originalOutput: string, validation: any): number {
    let confidence = 0.8; // Base confidence

    // Reduce confidence for complex extractions
    if (originalOutput.includes('```')) {
      confidence += 0.1; // Code blocks are good
    }

    if (originalOutput.toLowerCase().includes('sql:')) {
      confidence += 0.1; // Explicit SQL labeling is good
    }

    // Reduce confidence for high complexity
    if (validation.complexity > 50) {
      confidence -= 0.2;
    }

    // Reduce confidence for warnings
    confidence -= validation.warnings.length * 0.05;

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Validate that extracted SQL contains expected elements
   */
  validateSQLStructure(sql: string): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Must start with SELECT
    if (!/^\s*SELECT\b/i.test(sql)) {
      issues.push('SQL must start with SELECT');
    }

    // Check for balanced quotes
    const singleQuotes = (sql.match(/'/g) || []).length;
    const doubleQuotes = (sql.match(/"/g) || []).length;
    
    if (singleQuotes % 2 !== 0) {
      issues.push('Unbalanced single quotes detected');
    }
    
    if (doubleQuotes % 2 !== 0) {
      issues.push('Unbalanced double quotes detected');
    }

    // Check for balanced parentheses
    let parenCount = 0;
    for (const char of sql) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount < 0) {
        issues.push('Unbalanced parentheses detected');
        break;
      }
    }
    if (parenCount !== 0) {
      issues.push('Unbalanced parentheses detected');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Create a sanitized error message that doesn't leak information
   */
  createSafeErrorMessage(originalError: string): string {
    // Remove potentially sensitive information from error messages
    const safeError = originalError
      .replace(/password|secret|key|token/gi, '[REDACTED]')
      .replace(/localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+/g, '[HOST]')
      .replace(/port\s*\d+/gi, 'port [REDACTED]')
      .replace(/user\s*=\s*[^\s;]+/gi, 'user=[REDACTED]');

    return safeError;
  }
}