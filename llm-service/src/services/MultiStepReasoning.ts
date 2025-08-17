import { QueryStep, DatabaseSchema, LLMRequest } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class MultiStepReasoningEngine {
  private static instance: MultiStepReasoningEngine;

  static getInstance(): MultiStepReasoningEngine {
    if (!MultiStepReasoningEngine.instance) {
      MultiStepReasoningEngine.instance = new MultiStepReasoningEngine();
    }
    return MultiStepReasoningEngine.instance;
  }

  async decompose(request: LLMRequest): Promise<QueryStep[]> {
    const complexity = this.analyzeQueryComplexity(request.query);
    
    if (complexity === 'simple' || !request.options?.enableMultiStep) {
      return this.createSingleStep(request);
    }

    return this.createMultipleSteps(request, complexity);
  }

  private analyzeQueryComplexity(query: string): 'simple' | 'moderate' | 'complex' {
    const queryLower = query.toLowerCase();
    
    // Complex indicators
    const complexPatterns = [
      /\bjoin\b.*\bjoin\b/, // Multiple joins
      /\bsubquery\b|\bsubselect\b|\bwith\b.*\bas\b/, // Subqueries/CTEs
      /\bwindow\b|\bover\b|\bpartition\s+by\b/, // Window functions
      /\bunion\b|\bintersect\b|\bexcept\b/, // Set operations
      /\bcase\s+when\b.*\belse\b.*\bend\b/, // Complex case statements
      /\bhaving\b.*\bgroup\s+by\b/, // Having with group by
      /\bexists\b|\bnot\s+exists\b/, // Exists clauses
    ];

    // Moderate indicators  
    const moderatePatterns = [
      /\bjoin\b/, // Single join
      /\bgroup\s+by\b/, // Grouping
      /\border\s+by\b.*\blimit\b/, // Ordering with limit
      /\bcount\b|\bsum\b|\bavg\b|\bmax\b|\bmin\b/, // Aggregations
      /\bwhere\b.*\band\b.*\bor\b/, // Complex where conditions
      /\bin\s*\(.*,.*\)/, // IN clauses with multiple values
    ];

    if (complexPatterns.some(pattern => pattern.test(queryLower))) {
      return 'complex';
    }

    if (moderatePatterns.some(pattern => pattern.test(queryLower))) {
      return 'moderate';
    }

    return 'simple';
  }

  private createSingleStep(request: LLMRequest): QueryStep[] {
    return [{
      id: uuidv4(),
      description: 'Generate SQL query',
      sql: '', // Will be filled by LLM
      reasoning: 'Simple query that can be handled in a single step',
      dependencies: [],
      confidence: 0.9,
      complexity: 'simple'
    }];
  }

  private createMultipleSteps(request: LLMRequest, complexity: 'moderate' | 'complex'): QueryStep[] {
    const query = request.query.toLowerCase();
    const steps: QueryStep[] = [];

    // Step 1: Identify required tables and basic structure
    steps.push({
      id: uuidv4(),
      description: 'Identify required tables and relationships',
      sql: '',
      reasoning: 'First, determine which tables are needed and how they relate to each other',
      dependencies: [],
      confidence: 0.95,
      complexity: 'simple'
    });

    // Step 2: Handle joins if needed
    if (this.requiresJoins(query, request.schema)) {
      steps.push({
        id: uuidv4(),
        description: 'Establish table relationships with appropriate joins',
        sql: '',
        reasoning: 'Create the foundation query with necessary table joins',
        dependencies: [steps[0].id],
        confidence: 0.85,
        complexity: 'moderate'
      });
    }

    // Step 3: Apply filters and conditions
    if (this.hasFilters(query)) {
      steps.push({
        id: uuidv4(),
        description: 'Apply filtering conditions',
        sql: '',
        reasoning: 'Add WHERE clauses to filter data according to requirements',
        dependencies: [steps[steps.length - 1].id],
        confidence: 0.9,
        complexity: 'simple'
      });
    }

    // Step 4: Handle aggregations
    if (this.hasAggregations(query)) {
      steps.push({
        id: uuidv4(),
        description: 'Apply aggregation functions and grouping',
        sql: '',
        reasoning: 'Group data and apply aggregate functions like COUNT, SUM, AVG',
        dependencies: [steps[steps.length - 1].id],
        confidence: 0.8,
        complexity: 'moderate'
      });
    }

    // Step 5: Handle sorting and limiting
    if (this.hasSortingOrLimiting(query)) {
      steps.push({
        id: uuidv4(),
        description: 'Apply sorting and result limiting',
        sql: '',
        reasoning: 'Sort results and apply any LIMIT clauses',
        dependencies: [steps[steps.length - 1].id],
        confidence: 0.9,
        complexity: 'simple'
      });
    }

    // Step 6: Handle complex operations (subqueries, window functions, etc.)
    if (complexity === 'complex') {
      steps.push({
        id: uuidv4(),
        description: 'Implement advanced SQL features',
        sql: '',
        reasoning: 'Add subqueries, window functions, or other complex SQL constructs',
        dependencies: [steps[steps.length - 1].id],
        confidence: 0.7,
        complexity: 'complex'
      });
    }

    return steps;
  }

  private requiresJoins(query: string, schema?: DatabaseSchema): boolean {
    if (!schema) return false;
    
    const mentionedTables = this.extractTableNames(query, schema);
    return mentionedTables.length > 1 || /\bjoin\b/i.test(query);
  }

  private hasFilters(query: string): boolean {
    return /\bwhere\b|\bfilter\b|\bhaving\b/i.test(query);
  }

  private hasAggregations(query: string): boolean {
    return /\bcount\b|\bsum\b|\bavg\b|\bmax\b|\bmin\b|\bgroup\s+by\b/i.test(query);
  }

  private hasSortingOrLimiting(query: string): boolean {
    return /\border\s+by\b|\blimit\b|\btop\b|\bfirst\b|\blast\b/i.test(query);
  }

  private extractTableNames(query: string, schema: DatabaseSchema): string[] {
    const queryLower = query.toLowerCase();
    const tableNames: string[] = [];

    schema.tables.forEach(table => {
      const tableName = table.name.toLowerCase();
      if (queryLower.includes(tableName)) {
        tableNames.push(table.name);
      }
    });

    return tableNames;
  }

  async executeSteps(steps: QueryStep[], request: LLMRequest): Promise<QueryStep[]> {
    const executedSteps: QueryStep[] = [];

    for (const step of steps) {
      try {
        // Check if dependencies are satisfied
        const dependenciesSatisfied = step.dependencies.every(depId => 
          executedSteps.some(execStep => execStep.id === depId)
        );

        if (!dependenciesSatisfied) {
          throw new Error(`Dependencies not satisfied for step: ${step.description}`);
        }

        // Generate SQL for this step
        const stepRequest = this.createStepRequest(step, executedSteps, request);
        const generatedSQL = await this.generateStepSQL(stepRequest);

        const executedStep: QueryStep = {
          ...step,
          sql: generatedSQL,
          confidence: this.calculateStepConfidence(step, generatedSQL)
        };

        executedSteps.push(executedStep);

      } catch (error) {
        // Handle step execution errors
        const errorStep: QueryStep = {
          ...step,
          sql: `-- Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          confidence: 0.1,
          reasoning: `${step.reasoning} (Failed: ${error instanceof Error ? error.message : 'Unknown error'})`
        };
        
        executedSteps.push(errorStep);
        break; // Stop execution on error
      }
    }

    return executedSteps;
  }

  private createStepRequest(step: QueryStep, previousSteps: QueryStep[], originalRequest: LLMRequest): any {
    const context = previousSteps.map(s => ({
      description: s.description,
      sql: s.sql,
      reasoning: s.reasoning
    }));

    return {
      ...originalRequest,
      stepContext: {
        currentStep: step,
        previousSteps: context,
        originalQuery: originalRequest.query
      }
    };
  }

  private async generateStepSQL(stepRequest: any): Promise<string> {
    // This would call the LLM provider with step-specific prompts
    // For now, return a placeholder
    return `-- SQL for step: ${stepRequest.stepContext.currentStep.description}`;
  }

  private calculateStepConfidence(step: QueryStep, sql: string): number {
    let confidence = step.confidence;

    // Reduce confidence if SQL contains obvious errors
    if (sql.includes('Error:') || sql.includes('--')) {
      confidence *= 0.5;
    }

    // Adjust based on complexity
    switch (step.complexity) {
      case 'simple':
        confidence *= 1.0;
        break;
      case 'moderate':
        confidence *= 0.9;
        break;
      case 'complex':
        confidence *= 0.8;
        break;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  combineSteps(steps: QueryStep[]): string {
    // For simple combination, return the last step's SQL
    // In a more sophisticated implementation, this would intelligently combine
    const lastStep = steps[steps.length - 1];
    if (lastStep && lastStep.sql && !lastStep.sql.includes('Error:')) {
      return lastStep.sql;
    }

    // Fallback: try to combine non-error steps
    const validSteps = steps.filter(step => 
      step.sql && !step.sql.includes('Error:') && !step.sql.startsWith('--')
    );

    if (validSteps.length === 0) {
      throw new Error('No valid SQL steps generated');
    }

    // Return the most complete step
    return validSteps[validSteps.length - 1].sql;
  }

  getStepDependencyTree(steps: QueryStep[]): Map<string, string[]> {
    const tree = new Map<string, string[]>();
    
    steps.forEach(step => {
      tree.set(step.id, step.dependencies);
    });

    return tree;
  }

  validateStepSequence(steps: QueryStep[]): boolean {
    const executedSteps = new Set<string>();

    for (const step of steps) {
      // Check if all dependencies have been executed
      for (const depId of step.dependencies) {
        if (!executedSteps.has(depId)) {
          return false;
        }
      }
      executedSteps.add(step.id);
    }

    return true;
  }
}