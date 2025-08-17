import OpenAI from 'openai';
import { createError } from '../middleware/errorHandler';

interface LLMRequest {
  query: string;
  schema?: any;
  provider?: string;
  model?: string;
  options?: {
    enableMultiStep?: boolean;
    includeExplanation?: boolean;
    suggestVisualization?: boolean;
  };
}

interface LLMResponse {
  sql: string;
  confidence: number;
  explanation?: string;
  provider: string;
  model: string;
  executionTime: number;
  conversationId?: string;
}

export class LLMService {
  private static instance: LLMService;
  private openai: OpenAI;

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  static getInstance(): LLMService {
    if (!LLMService.instance) {
      LLMService.instance = new LLMService();
    }
    return LLMService.instance;
  }

  async generateSQL(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      const systemPrompt = this.buildSystemPrompt(request.schema);
      const userPrompt = `Convert this natural language query to SQL: "${request.query}"`;

      console.log('🤖 Calling OpenAI API...');
      console.log('📊 Schema tables provided:', request.schema?.tables?.length || 0);
      if (request.schema?.tables) {
        console.log('📋 Tables:', request.schema.tables.map((t: any) => t.name).join(', '));
        // Log a sample table to verify column structure
        const orderItemsTable = request.schema.tables.find((t: any) => t.name === 'order_items');
        if (orderItemsTable) {
          console.log('📦 order_items columns:', orderItemsTable.columns.map((c: any) => c.name).join(', '));
        }
      }
      console.log('❓ User query:', request.query);
      
      // Log the actual prompt being sent
      console.log('📝 System prompt length:', systemPrompt.length, 'characters');
      console.log('📝 First 500 chars of system prompt:', systemPrompt.substring(0, 500));
      
      const completion = await this.openai.chat.completions.create({
        model: request.model || 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 500
      });

      const responseText = completion.choices[0]?.message?.content || '';
      console.log('📝 Full LLM response:', responseText);
      
      const sql = this.extractSQL(responseText);
      console.log('✅ Extracted SQL:', sql);

      return {
        sql,
        confidence: 0.85,
        explanation: request.options?.includeExplanation ? responseText : undefined,
        provider: request.provider || 'openai',
        model: request.model || 'gpt-3.5-turbo',
        executionTime: Date.now() - startTime
      };

    } catch (error: any) {
      console.error('❌ LLM generation failed:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      throw createError(500, `Failed to generate SQL: ${error.message}`);
    }
  }

  private buildSystemPrompt(schema?: any): string {
    let prompt = `You are a PostgreSQL SQL expert. Convert natural language queries to SQL.
Generate only SELECT statements. Return only the SQL query without explanations.
Use the exact table and column names from the schema below.
When searching text fields, consider using ILIKE for case-insensitive partial matching when appropriate.`;

    if (schema?.tables) {
      prompt += '\n\nDatabase Schema:\n';
      for (const table of schema.tables) {
        const tableName = table.name || table.table_name;
        prompt += `\nTable: ${tableName}`;
        if (table.description) {
          prompt += ` - ${table.description}`;
        }
        prompt += '\nColumns:\n';
        
        if (table.columns && table.columns.length > 0) {
          for (const col of table.columns) {
            const colName = col.name || col.column_name;
            const colType = col.type || col.data_type;
            prompt += `  - ${colName} (${colType})`;
            if (col.primaryKey) {
              prompt += ' [PK]';
            }
            if (col.foreignKey) {
              prompt += ` [FK -> ${col.foreignKey}]`;
            }
            if (col.description) {
              prompt += ` - ${col.description}`;
            }
            prompt += '\n';
          }
        }
      }
      
      // Add relationships if available
      if (schema.relationships && schema.relationships.length > 0) {
        prompt += '\nRelationships:\n';
        for (const rel of schema.relationships) {
          prompt += `- ${rel.table}.${rel.column} -> ${rel.referencedTable}.${rel.referencedColumn}\n`;
        }
      }
    }

    return prompt;
  }

  private extractSQL(response: string): string {
    // Remove markdown code blocks if present
    const sqlMatch = response.match(/```(?:sql)?\n?([\s\S]*?)\n?```/);
    if (sqlMatch) {
      return sqlMatch[1].trim();
    }

    // Remove any "SQL:" prefix
    const cleanResponse = response.replace(/^SQL:\s*/i, '').trim();
    
    // If it starts with SELECT, return the whole query (not just first line!)
    if (cleanResponse.toUpperCase().startsWith('SELECT')) {
      // Find the end of the SQL statement (usually a semicolon or end of string)
      const endIndex = cleanResponse.indexOf(';');
      if (endIndex > 0) {
        return cleanResponse.substring(0, endIndex).trim();
      }
      return cleanResponse.trim();
    }

    // Otherwise return as is
    return cleanResponse.trim();
  }

  async analyzeData(data: any[], query: string): Promise<any> {
    try {
      const prompt = `Analyze this query result and provide a brief summary:
Query: ${query}
Result count: ${data.length} rows
Sample data: ${JSON.stringify(data.slice(0, 3), null, 2)}

Provide a 2-3 sentence summary of the results.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a data analyst. Provide brief, insightful summaries.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 150
      });

      return {
        summary: completion.choices[0]?.message?.content || 'Analysis not available',
        chartType: this.suggestChartType(data),
        confidence: 0.8
      };
    } catch (error: any) {
      console.error('Data analysis failed:', error);
      return {
        summary: 'Unable to analyze data',
        chartType: 'table',
        confidence: 0.5
      };
    }
  }

  private suggestChartType(data: any[]): string {
    if (!data || data.length === 0) return 'table';
    
    const firstRow = data[0];
    const columns = Object.keys(firstRow);
    
    // Simple heuristics for chart type
    const hasDate = columns.some(col => col.toLowerCase().includes('date') || col.toLowerCase().includes('time'));
    const hasNumeric = columns.some(col => typeof firstRow[col] === 'number');
    
    if (hasDate && hasNumeric) return 'line';
    if (columns.length === 2 && hasNumeric) return 'bar';
    if (data.length < 10 && hasNumeric) return 'pie';
    
    return 'table';
  }
}