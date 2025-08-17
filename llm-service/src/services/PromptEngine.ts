import { LLMRequest, DatabaseSchema, ConversationContext, QueryStep } from '../types';

export class PromptEngine {
  private static instance: PromptEngine;

  static getInstance(): PromptEngine {
    if (!PromptEngine.instance) {
      PromptEngine.instance = new PromptEngine();
    }
    return PromptEngine.instance;
  }

  buildSystemPrompt(request: LLMRequest): string {
    const basePrompt = this.getBaseSystemPrompt();
    const schemaPrompt = request.schema ? this.buildSchemaPrompt(request.schema) : '';
    const contextPrompt = request.context ? this.buildContextPrompt(request.context) : '';
    
    return [basePrompt, schemaPrompt, contextPrompt].filter(Boolean).join('\n\n');
  }

  buildUserPrompt(request: LLMRequest): string {
    if (request.options?.enableMultiStep) {
      return this.buildMultiStepPrompt(request);
    }
    
    return this.buildSingleStepPrompt(request);
  }

  buildStepPrompt(step: QueryStep, context: any): string {
    return `
Current Step: ${step.description}

Step Context:
${step.reasoning}

Previous Steps Completed:
${context.previousSteps.map((s: any) => `- ${s.description}: ${s.sql}`).join('\n')}

Original User Query: "${context.originalQuery}"

Generate SQL for the current step only. Build upon the previous steps if they exist.

Response format:
SQL: [your sql for this specific step]
REASONING: [explain how this step contributes to the overall solution]
CONFIDENCE: [0.0-1.0]
`;
  }

  buildRefinementPrompt(originalQuery: string, feedback: string, previousSQL: string): string {
    return `
Original Query: "${originalQuery}"
Previous SQL Generated: 
${previousSQL}

User Feedback: "${feedback}"

Please refine the SQL query based on the user's feedback. Consider:
1. What specific changes are being requested
2. Whether the original interpretation was correct
3. How to improve the query while maintaining correctness

Response format:
SQL: [refined sql query]
CHANGES: [explain what was changed and why]
CONFIDENCE: [0.0-1.0]
`;
  }

  buildVisualizationPrompt(data: any[], columns: string[]): string {
    const dataPreview = this.generateDataPreview(data, columns);
    const dataAnalysis = this.analyzeDataCharacteristics(data, columns);

    return `
Analyze this dataset and recommend the best visualization approach:

Data Preview:
${dataPreview}

Data Characteristics:
${dataAnalysis}

Based on this data, suggest:
1. The most appropriate chart type
2. Which columns should be used for X and Y axes
3. Any data transformations needed
4. Alternative visualization options

Consider these chart types: bar, line, pie, scatter, area, heatmap, table

Response format:
CHART_TYPE: [recommended chart type]
X_AXIS: [column name for x-axis]
Y_AXIS: [column name for y-axis]
REASONING: [explain why this visualization is best]
ALTERNATIVES: [list 2-3 alternative chart types with brief reasoning]
CONFIDENCE: [0.0-1.0]
`;
  }

  buildSuggestionPrompt(partialQuery: string, schema?: DatabaseSchema, context?: ConversationContext): string {
    const schemaInfo = schema ? this.buildSchemaPrompt(schema, true) : '';
    const contextInfo = context ? this.buildContextSummary(context) : '';

    return `
User is typing: "${partialQuery}"

${schemaInfo}

${contextInfo}

Provide helpful query completions and suggestions. Consider:
1. What the user might be trying to accomplish
2. Common patterns based on the partial input
3. Available tables and columns
4. Previous queries in this session

Suggest 3-5 completions that are:
- Relevant to the partial input
- Use available schema elements
- Range from simple to more complex options

Response format for each suggestion:
TEXT: [complete query suggestion]
TYPE: [completion|refinement|alternative]
REASONING: [why this suggestion is relevant]
CONFIDENCE: [0.0-1.0]
`;
  }

  private getBaseSystemPrompt(): string {
    return `You are an expert SQL assistant that helps users convert natural language queries into accurate, efficient SQL statements.

Your capabilities:
- Generate SQL from natural language with high accuracy
- Break down complex queries into manageable steps
- Provide clear explanations for your reasoning
- Suggest appropriate data visualizations
- Refine queries based on user feedback

Guidelines:
1. Always prioritize correctness and security
2. Use proper SQL syntax and formatting
3. Avoid SQL injection vulnerabilities
4. Prefer explicit joins over implicit ones
5. Include helpful comments for complex logic
6. Consider performance implications
7. Validate against provided schema

Response format requirements:
- Always include confidence scores (0.0-1.0)
- Provide clear reasoning for decisions
- Use consistent formatting
- Handle edge cases gracefully`;
  }

  private buildSchemaPrompt(schema: DatabaseSchema, summary: boolean = false): string {
    if (summary) {
      const tableNames = schema.tables.map(t => t.name).join(', ');
      return `Available tables: ${tableNames}`;
    }

    let prompt = 'Database Schema:\n';
    
    schema.tables.forEach(table => {
      prompt += `\nTable: ${table.name}\n`;
      if (table.description) {
        prompt += `Description: ${table.description}\n`;
      }
      
      prompt += 'Columns:\n';
      table.columns.forEach(column => {
        let columnInfo = `  - ${column.name} (${column.type})`;
        if (!column.nullable) columnInfo += ' NOT NULL';
        if (column.primaryKey) columnInfo += ' PRIMARY KEY';
        if (column.foreignKey) columnInfo += ` REFERENCES ${column.foreignKey}`;
        if (column.description) columnInfo += ` - ${column.description}`;
        prompt += columnInfo + '\n';
      });

      if (table.sampleData && table.sampleData.length > 0) {
        prompt += 'Sample data:\n';
        const sample = table.sampleData.slice(0, 3);
        sample.forEach(row => {
          prompt += `  ${JSON.stringify(row)}\n`;
        });
      }
    });

    if (schema.relationships && schema.relationships.length > 0) {
      prompt += '\nRelationships:\n';
      schema.relationships.forEach(rel => {
        prompt += `  - ${rel.table}.${rel.column} → ${rel.referencedTable}.${rel.referencedColumn} (${rel.type})\n`;
      });
    }

    return prompt;
  }

  private buildContextPrompt(context: ConversationContext): string {
    let prompt = 'Conversation Context:\n';
    
    const recent = context.messages.slice(-5);
    if (recent.length > 0) {
      prompt += 'Recent messages:\n';
      recent.forEach(msg => {
        const truncated = msg.content.length > 100 
          ? msg.content.substring(0, 100) + '...'
          : msg.content;
        prompt += `  ${msg.role}: ${truncated}\n`;
      });
    }

    const metadata = context.sessionMetadata;
    prompt += `\nSession info: ${metadata.totalQueries} queries, `;
    
    if (metadata.commonTableAccess.length > 0) {
      prompt += `frequently accessed tables: ${metadata.commonTableAccess.slice(0, 3).join(', ')}`;
    }
    
    if (metadata.preferredChartTypes.length > 0) {
      prompt += `, preferred charts: ${metadata.preferredChartTypes.slice(0, 2).join(', ')}`;
    }

    return prompt;
  }

  private buildContextSummary(context: ConversationContext): string {
    const userQueries = context.messages
      .filter(msg => msg.role === 'user')
      .slice(-3)
      .map(msg => msg.content);

    return userQueries.length > 0 
      ? `Recent user queries:\n${userQueries.map(q => `- ${q}`).join('\n')}`
      : '';
  }

  private buildSingleStepPrompt(request: LLMRequest): string {
    let prompt = `Convert this natural language query to SQL:\n\n"${request.query}"\n\n`;
    
    if (request.options?.includeExplanation) {
      prompt += 'Include a detailed explanation of your approach.\n\n';
    }

    prompt += `Response format:
SQL: [your sql query]
REASONING: [explain your approach and decisions]
CONFIDENCE: [0.0-1.0]`;

    if (request.options?.suggestVisualization) {
      prompt += `
VISUALIZATION: [suggest appropriate chart type and reasoning]`;
    }

    return prompt;
  }

  private buildMultiStepPrompt(request: LLMRequest): string {
    return `
This query appears complex and should be broken down into steps.

Query: "${request.query}"

Please analyze this query and break it down into logical steps:

1. First, identify what makes this query complex
2. Break it into 3-5 manageable steps
3. For each step, explain the reasoning and dependencies
4. Provide the final combined SQL

Response format:
COMPLEXITY_ANALYSIS: [explain why this query is complex]
STEPS:
Step 1: [description] - [reasoning] - Dependencies: [none or step numbers]
Step 2: [description] - [reasoning] - Dependencies: [step numbers]
...
FINAL_SQL: [complete sql query]
CONFIDENCE: [0.0-1.0]
`;
  }

  private generateDataPreview(data: any[], columns: string[]): string {
    const preview = data.slice(0, 5);
    let result = `Columns: ${columns.join(', ')}\n`;
    result += `Rows shown: ${preview.length} of ${data.length}\n\n`;
    
    preview.forEach((row, index) => {
      result += `Row ${index + 1}: ${JSON.stringify(row)}\n`;
    });

    return result;
  }

  private analyzeDataCharacteristics(data: any[], columns: string[]): string {
    if (data.length === 0) return 'No data available';

    const sample = data[0];
    const analysis: string[] = [];

    analysis.push(`Total rows: ${data.length}`);
    analysis.push(`Total columns: ${columns.length}`);

    const numericalCols = columns.filter(col => typeof sample[col] === 'number');
    const textCols = columns.filter(col => typeof sample[col] === 'string');
    const dateCols = columns.filter(col => {
      const val = sample[col];
      return val && (val instanceof Date || (!isNaN(Date.parse(val)) && isNaN(Number(val))));
    });

    if (numericalCols.length > 0) {
      analysis.push(`Numerical columns: ${numericalCols.join(', ')}`);
    }
    if (textCols.length > 0) {
      analysis.push(`Text columns: ${textCols.join(', ')}`);
    }
    if (dateCols.length > 0) {
      analysis.push(`Date columns: ${dateCols.join(', ')}`);
    }

    // Analyze unique values for categorical detection
    columns.forEach(col => {
      const uniqueValues = new Set(data.map(row => row[col]));
      if (uniqueValues.size <= 10 && uniqueValues.size < data.length * 0.5) {
        analysis.push(`${col} appears categorical (${uniqueValues.size} unique values)`);
      }
    });

    return analysis.join('\n');
  }
}