import OpenAI from 'openai';
import { createError } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';
import config, { isColonyHardwareDB } from '../config';

const logger = createLogger('LLMService');

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
  public openai: OpenAI; // Made public so ConversationService can use it

  private constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey
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

      logger.info('Calling OpenAI API', {
        schemaTablesCount: request.schema?.tables?.length || 0,
        userQuery: request.query,
        promptLength: systemPrompt.length
      });

      if (request.schema?.tables) {
        logger.debug('Schema tables', {
          tables: request.schema.tables.map((t: any) => t.name)
        });
      }
      
      const completion = await this.openai.chat.completions.create({
        model: request.model || config.openai.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: config.openai.temperature,
        max_tokens: config.openai.maxTokens
      });

      const responseText = completion.choices[0]?.message?.content || '';
      const sql = this.extractSQL(responseText);

      logger.info('SQL generated successfully', {
        responseLength: responseText.length,
        sqlLength: sql.length
      });
      logger.debug('Generated SQL', { sql });

      return {
        sql,
        confidence: 0.85,
        explanation: request.options?.includeExplanation ? responseText : undefined,
        provider: request.provider || 'openai',
        model: request.model || 'gpt-3.5-turbo',
        executionTime: Date.now() - startTime
      };

    } catch (error: any) {
      logger.error('LLM generation failed', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        userQuery: request.query
      });
      // Return generic error to user, log details
      throw createError(500, 'Failed to generate SQL. Please try rephrasing your question.');
    }
  }

  private buildSystemPrompt(schema?: any): string {
    // Check if we're using Colony Hardware database
    const isColonyHardware = isColonyHardwareDB();
    
    let prompt = `You are a PostgreSQL SQL expert. Your ONLY job is to convert natural language queries to SQL.

CRITICAL RULES:
1. Return ONLY the SQL query - no explanations, no text, no markdown
2. Generate only SELECT statements
3. Never include any text before or after the SQL
4. If you cannot generate valid SQL, return: SELECT 'Unable to generate SQL for this query' as error
5. Use the exact table and column names from the schema below
6. When searching text fields, use ILIKE for case-insensitive partial matching`;

    if (isColonyHardware) {
      prompt += `

Colony Hardware Database Schema:

Tables:
1. products (68,830 hardware products)
   - product_key (INTEGER, PRIMARY KEY)
   - source_system_key (INTEGER)
   - product_id (VARCHAR)
   - product_description (TEXT)
   - product_category (VARCHAR) - Categories like "CLEANING EQUIPMENT & SUPPLIES", "FASTENERS", etc.
   - product_profile (VARCHAR)

2. customers (14,804 customers)
   - customer_key (INTEGER, PRIMARY KEY)
   - source_system_key (INTEGER)
   - customer_name (VARCHAR)
   - city (VARCHAR)
   - state (VARCHAR) - State codes like 'MI' for Michigan, 'OH' for Ohio, etc. NOT full state names
   - cust_pricing_class (VARCHAR)
   - cust_trade_class (VARCHAR)
   - restoration_refinery_cust (CHAR)

3. sales_orders (1,795,100 sales from 2023)
   - id (SERIAL, PRIMARY KEY)
   - customer_key (INTEGER) - References customers.customer_key
   - product_key (INTEGER) - References products.product_key
   - source_system_key (INTEGER)
   - order_date (DATE) - Orders from 2023
   - order_number (VARCHAR)
   - order_line_number (INTEGER)
   - unit_price (DECIMAL)
   - quantity_ordered (DECIMAL)
   - ext_price (DECIMAL)
   - ext_cost (DECIMAL)

Key Relationships:
- sales_orders.customer_key -> customers.customer_key
- sales_orders.product_key -> products.product_key

Important Notes:
- States are stored as 2-letter codes (e.g., 'MI' NOT 'Michigan', 'OH' NOT 'Ohio')
- When users ask about "Michigan", use state = 'MI' or state = 'Mi'
- Use ILIKE for case-insensitive text searches on product descriptions
- Some keys may be -1 indicating missing/unknown data
- Order dates are from 2023

Query Intent Guidelines:
- "Show me sales" or "List sales" or "Get sales" = Return DETAIL ROWS (product_description, order_date, ext_price, quantity, etc.)
- "How many sales" or "Total sales" or "Sum of sales" = Use COUNT(*) or SUM()
- "Show me" / "List" / "Display" / "Get" = User wants to SEE the records, return columns
- When asking about a specific customer's purchases, return individual order details unless explicitly asking for totals
- Default to showing detail unless question explicitly asks for aggregates (count, total, sum, average)`;
    } else if (schema?.tables) {
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
    
    // If it starts with SELECT, return the whole query
    if (cleanResponse.toUpperCase().startsWith('SELECT')) {
      // Find the end of the SQL statement (usually a semicolon or end of string)
      const endIndex = cleanResponse.indexOf(';');
      if (endIndex > 0) {
        return cleanResponse.substring(0, endIndex).trim();
      }
      return cleanResponse.trim();
    }

    // Check if the response contains explanatory text instead of SQL
    if (cleanResponse.toLowerCase().includes('yes') || 
        cleanResponse.toLowerCase().includes('no') ||
        cleanResponse.toLowerCase().includes('those are') ||
        cleanResponse.toLowerCase().includes('here') ||
        cleanResponse.length > 500) {
      logger.warn('LLM returned explanation instead of SQL', {
        responsePreview: cleanResponse.substring(0, 100)
      });
      // Generic error message for user
      throw new Error('Unable to generate SQL for this query. Please try rephrasing your question.');
    }

    // Otherwise return as is (might be an error or edge case)
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
        model: config.openai.fallbackModel,
        messages: [
          { role: 'system', content: 'You are a data analyst. Provide brief, insightful summaries.' },
          { role: 'user', content: prompt }
        ],
        temperature: config.openai.analysisTemperature,
        max_tokens: 150
      });

      return {
        summary: completion.choices[0]?.message?.content || 'Analysis not available',
        chartType: this.suggestChartType(data),
        confidence: 0.8
      };
    } catch (error: any) {
      logger.error('Data analysis failed', { error: error.message });
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

  async classifyQuestion(question: string, conversationContext?: any[]): Promise<{
    needsData: boolean;
    reasoning: string;
    confidence: number;
  }> {
    try {
      // Build context about recent conversation
      let contextInfo = '';
      if (conversationContext && conversationContext.length > 0) {
        const recentMessages = conversationContext.slice(-4);
        const hasRecentData = recentMessages.some(msg => msg.data && msg.data.length > 0);
        
        if (hasRecentData) {
          contextInfo = `\n\nContext: The user recently received data from previous queries in this conversation.`;
        }
      }

      const prompt = `Analyze this user question and determine if it requires querying a database for NEW data, or if it's asking for analysis/insights about existing data.

Question: "${question}"${contextInfo}

Classify as:
- "NEEDS_DATA" if the question asks for specific information from a database (sales figures, customer lists, product data, etc.)
- "ANALYSIS_ONLY" if the question asks for explanation, insights, interpretation, or analysis of data that was likely already shown

Examples:
- "Show me sales by month" → NEEDS_DATA
- "What are the top customers?" → NEEDS_DATA  
- "Why is March so high?" → ANALYSIS_ONLY
- "What does this trend mean?" → ANALYSIS_ONLY
- "Explain these results" → ANALYSIS_ONLY
- "What insights can you give me?" → ANALYSIS_ONLY

Respond with ONLY: NEEDS_DATA or ANALYSIS_ONLY`;

      const completion = await this.openai.chat.completions.create({
        model: config.openai.fallbackModel,
        messages: [
          { role: 'system', content: 'You are a query classifier. Respond with only NEEDS_DATA or ANALYSIS_ONLY.' },
          { role: 'user', content: prompt }
        ],
        temperature: config.openai.temperature,
        max_tokens: 20
      });

      const response = completion.choices[0]?.message?.content?.trim() || '';
      const needsData = response.includes('NEEDS_DATA');

      return {
        needsData,
        reasoning: response,
        confidence: needsData ? 0.9 : 0.85
      };

    } catch (error: any) {
      logger.error('Question classification failed', { error: error.message });
      // Default to needs data if classification fails
      return {
        needsData: true,
        reasoning: 'Classification failed, defaulting to data query',
        confidence: 0.5
      };
    }
  }
}