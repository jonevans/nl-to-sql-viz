import { ErrorContext } from '../types';

export interface ErrorDetails {
  code: string;
  message: string;
  phase: string;
  recoverable: boolean;
  context?: any;
  suggestedActions?: string[];
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private retryAttempts: Map<string, number> = new Map();
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 1000;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  async handleError(error: any, context: ErrorContext): Promise<ErrorDetails> {
    const errorDetails = this.analyzeError(error, context);
    
    // Log error for monitoring
    this.logError(errorDetails, context);

    // Update retry tracking if applicable
    if (errorDetails.recoverable && context.conversationId) {
      this.updateRetryCount(context.conversationId);
    }

    return errorDetails;
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    customRetryCondition?: (error: any) => boolean
  ): Promise<T> {
    const retryKey = context.conversationId || 'global';
    let lastError: any;

    for (let attempt = 1; attempt <= this.MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        const result = await operation();
        // Reset retry count on success
        this.retryAttempts.delete(retryKey);
        return result;
      } catch (error) {
        lastError = error;
        
        const shouldRetry = this.shouldRetry(error, attempt, customRetryCondition);
        if (!shouldRetry) {
          break;
        }

        // Wait before retrying with exponential backoff
        const delay = this.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await this.sleep(delay);
        
        console.log(`Retry attempt ${attempt} for ${context.phase} operation`);
      }
    }

    // All retries failed
    throw await this.handleError(lastError, { ...context, attemptCount: this.MAX_RETRY_ATTEMPTS });
  }

  createFallbackResponse(originalRequest: any, error: ErrorDetails): any {
    switch (error.phase) {
      case 'parsing':
        return this.createParsingFallback(originalRequest, error);
      case 'generation':
        return this.createGenerationFallback(originalRequest, error);
      case 'execution':
        return this.createExecutionFallback(originalRequest, error);
      case 'visualization':
        return this.createVisualizationFallback(originalRequest, error);
      default:
        return this.createGenericFallback(originalRequest, error);
    }
  }

  private analyzeError(error: any, context: ErrorContext): ErrorDetails {
    // OpenAI/Anthropic API errors
    if (this.isLLMAPIError(error)) {
      return this.handleLLMAPIError(error, context);
    }

    // Network/timeout errors
    if (this.isNetworkError(error)) {
      return this.handleNetworkError(error, context);
    }

    // Rate limiting errors
    if (this.isRateLimitError(error)) {
      return this.handleRateLimitError(error, context);
    }

    // Validation errors
    if (this.isValidationError(error)) {
      return this.handleValidationError(error, context);
    }

    // SQL generation errors
    if (this.isSQLError(error)) {
      return this.handleSQLError(error, context);
    }

    // Generic error
    return this.handleGenericError(error, context);
  }

  private isLLMAPIError(error: any): boolean {
    return error.response?.status >= 400 && error.response?.status < 500 ||
           error.message?.includes('OpenAI') ||
           error.message?.includes('Anthropic') ||
           error.code?.includes('api');
  }

  private isNetworkError(error: any): boolean {
    return error.code === 'ECONNREFUSED' ||
           error.code === 'ETIMEDOUT' ||
           error.code === 'ENOTFOUND' ||
           error.message?.includes('network') ||
           error.message?.includes('timeout');
  }

  private isRateLimitError(error: any): boolean {
    return error.response?.status === 429 ||
           error.message?.includes('rate limit') ||
           error.message?.includes('quota exceeded');
  }

  private isValidationError(error: any): boolean {
    return error.name === 'ValidationError' ||
           error.message?.includes('validation') ||
           error.message?.includes('invalid input');
  }

  private isSQLError(error: any): boolean {
    return error.message?.includes('SQL') ||
           error.message?.includes('syntax') ||
           error.message?.includes('database');
  }

  private handleLLMAPIError(error: any, context: ErrorContext): ErrorDetails {
    const status = error.response?.status;
    
    switch (status) {
      case 401:
        return {
          code: 'LLM_AUTH_ERROR',
          message: 'Authentication failed with LLM provider. Please check API key.',
          phase: context.phase,
          recoverable: false,
          suggestedActions: [
            'Verify API key is correct and active',
            'Check if API key has necessary permissions',
            'Try using a different LLM provider'
          ]
        };

      case 403:
        return {
          code: 'LLM_PERMISSION_ERROR',
          message: 'Access denied by LLM provider.',
          phase: context.phase,
          recoverable: false,
          suggestedActions: [
            'Check API key permissions',
            'Verify account status with provider',
            'Switch to alternative provider'
          ]
        };

      case 429:
        return {
          code: 'LLM_RATE_LIMIT',
          message: 'LLM provider rate limit exceeded.',
          phase: context.phase,
          recoverable: true,
          suggestedActions: [
            'Wait before retrying',
            'Implement request queuing',
            'Use alternative provider',
            'Reduce request frequency'
          ]
        };

      case 500:
      case 502:
      case 503:
        return {
          code: 'LLM_SERVER_ERROR',
          message: 'LLM provider server error.',
          phase: context.phase,
          recoverable: true,
          suggestedActions: [
            'Retry the request',
            'Switch to backup provider',
            'Simplify the request'
          ]
        };

      default:
        return {
          code: 'LLM_UNKNOWN_ERROR',
          message: `LLM provider error: ${error.message}`,
          phase: context.phase,
          recoverable: true,
          suggestedActions: ['Retry with different parameters', 'Use fallback provider']
        };
    }
  }

  private handleNetworkError(error: any, context: ErrorContext): ErrorDetails {
    return {
      code: 'NETWORK_ERROR',
      message: 'Network connectivity issue encountered.',
      phase: context.phase,
      recoverable: true,
      context: { errorCode: error.code },
      suggestedActions: [
        'Check internet connectivity',
        'Verify service endpoints are accessible',
        'Retry after brief delay',
        'Use cached responses if available'
      ]
    };
  }

  private handleRateLimitError(error: any, context: ErrorContext): ErrorDetails {
    return {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Request rate limit exceeded.',
      phase: context.phase,
      recoverable: true,
      suggestedActions: [
        'Implement exponential backoff',
        'Queue requests for later processing',
        'Use alternative endpoints',
        'Reduce request frequency'
      ]
    };
  }

  private handleValidationError(error: any, context: ErrorContext): ErrorDetails {
    return {
      code: 'VALIDATION_ERROR',
      message: `Input validation failed: ${error.message}`,
      phase: context.phase,
      recoverable: false,
      suggestedActions: [
        'Check input format and requirements',
        'Sanitize user input',
        'Provide clearer input instructions',
        'Use input validation helpers'
      ]
    };
  }

  private handleSQLError(error: any, context: ErrorContext): ErrorDetails {
    return {
      code: 'SQL_GENERATION_ERROR',
      message: `SQL generation failed: ${error.message}`,
      phase: context.phase,
      recoverable: true,
      suggestedActions: [
        'Simplify the natural language query',
        'Provide more context about database schema',
        'Break complex queries into steps',
        'Use template-based fallback'
      ]
    };
  }

  private handleGenericError(error: any, context: ErrorContext): ErrorDetails {
    return {
      code: 'UNKNOWN_ERROR',
      message: `Unexpected error: ${error.message || 'Unknown error occurred'}`,
      phase: context.phase,
      recoverable: true,
      context: { stack: error.stack },
      suggestedActions: [
        'Retry the operation',
        'Check system logs for details',
        'Report the issue if it persists'
      ]
    };
  }

  private shouldRetry(error: any, attempt: number, customCondition?: (error: any) => boolean): boolean {
    if (attempt >= this.MAX_RETRY_ATTEMPTS) {
      return false;
    }

    // Custom retry condition takes precedence
    if (customCondition) {
      return customCondition(error);
    }

    // Default retry conditions
    return this.isNetworkError(error) ||
           this.isRateLimitError(error) ||
           (this.isLLMAPIError(error) && error.response?.status >= 500);
  }

  private createParsingFallback(originalRequest: any, error: ErrorDetails): any {
    return {
      sql: `-- Error parsing request: ${error.message}\n-- Please provide a clearer description`,
      confidence: 0.1,
      explanation: 'Failed to parse the natural language request. Please try rephrasing your query.',
      fallback: true
    };
  }

  private createGenerationFallback(originalRequest: any, error: ErrorDetails): any {
    // Try to extract basic intent and create simple SQL
    const query = originalRequest.query?.toLowerCase() || '';
    let fallbackSQL = 'SELECT * FROM ';

    // Basic table detection
    if (query.includes('users')) fallbackSQL += 'users';
    else if (query.includes('orders')) fallbackSQL += 'orders';
    else if (query.includes('products')) fallbackSQL += 'products';
    else fallbackSQL += '{table_name}';

    // Basic limitations
    if (query.includes('top') || query.includes('limit')) {
      fallbackSQL += ' LIMIT 10';
    }

    return {
      sql: fallbackSQL,
      confidence: 0.3,
      explanation: 'Generated basic fallback query due to generation error. Please refine your request.',
      fallback: true,
      suggestions: [
        'Try a simpler query description',
        'Specify the table name clearly',
        'Break complex queries into smaller parts'
      ]
    };
  }

  private createExecutionFallback(originalRequest: any, error: ErrorDetails): any {
    return {
      data: [],
      columns: [],
      rowCount: 0,
      executionTime: 0,
      error: error.message,
      fallback: true,
      suggestions: [
        'Check database connection',
        'Verify table and column names',
        'Simplify the SQL query'
      ]
    };
  }

  private createVisualizationFallback(originalRequest: any, error: ErrorDetails): any {
    return {
      chartType: 'table',
      reasoning: 'Defaulting to table view due to visualization analysis error',
      confidence: 0.2,
      configurations: {
        chartjs: { type: 'table', data: originalRequest.data || [] },
        recharts: { type: 'table', data: originalRequest.data || [] },
        d3: { type: 'table', data: originalRequest.data || [] }
      },
      fallback: true
    };
  }

  private createGenericFallback(originalRequest: any, error: ErrorDetails): any {
    return {
      success: false,
      error: error.message,
      fallback: true,
      suggestions: error.suggestedActions || ['Please try again with different parameters']
    };
  }

  private updateRetryCount(key: string): void {
    const current = this.retryAttempts.get(key) || 0;
    this.retryAttempts.set(key, current + 1);
  }

  private logError(error: ErrorDetails, context: ErrorContext): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      error: error,
      context: context,
      severity: error.recoverable ? 'warning' : 'error'
    };

    // In production, this would go to a proper logging service
    console.error('LLM Service Error:', JSON.stringify(logEntry, null, 2));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Circuit breaker pattern for repeated failures
  private circuitBreakers: Map<string, {
    failures: number;
    lastFailure: Date;
    state: 'closed' | 'open' | 'half-open';
  }> = new Map();

  checkCircuitBreaker(service: string): boolean {
    const breaker = this.circuitBreakers.get(service);
    if (!breaker) return true;

    const now = new Date();
    const timeSinceLastFailure = now.getTime() - breaker.lastFailure.getTime();

    if (breaker.state === 'open') {
      // Check if we should transition to half-open
      if (timeSinceLastFailure > 60000) { // 1 minute
        breaker.state = 'half-open';
        return true;
      }
      return false;
    }

    return true;
  }

  recordCircuitBreakerSuccess(service: string): void {
    const breaker = this.circuitBreakers.get(service);
    if (breaker) {
      breaker.failures = 0;
      breaker.state = 'closed';
    }
  }

  recordCircuitBreakerFailure(service: string): void {
    let breaker = this.circuitBreakers.get(service);
    if (!breaker) {
      breaker = { failures: 0, lastFailure: new Date(), state: 'closed' };
      this.circuitBreakers.set(service, breaker);
    }

    breaker.failures++;
    breaker.lastFailure = new Date();

    // Open circuit if too many failures
    if (breaker.failures >= 5) {
      breaker.state = 'open';
    }
  }

  getErrorStats(): {
    totalErrors: number;
    errorsByPhase: Record<string, number>;
    recoverableErrors: number;
    circuitBreakerStates: Record<string, string>;
  } {
    // This would typically be stored in a database or monitoring system
    return {
      totalErrors: 0,
      errorsByPhase: {},
      recoverableErrors: 0,
      circuitBreakerStates: Object.fromEntries(
        Array.from(this.circuitBreakers.entries()).map(([service, breaker]) => [service, breaker.state])
      )
    };
  }
}