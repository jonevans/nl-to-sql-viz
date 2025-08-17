import OpenAI from 'openai';
import axios from 'axios';
import { LLMRequest, LLMResponse } from '../types';
import { createError } from '../middleware/errorHandler';

// OpenAI client will be initialized lazily in the service

export class LLMService {
  private static instance: LLMService;
  private openai: OpenAI | null = null;

  constructor() {
    // Initialize OpenAI client lazily
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      console.log('✅ OpenAI client initialized');
    } else {
      console.log('❌ No OpenAI API key found, using mock responses');
    }
  }

  static getInstance(): LLMService {
    if (!LLMService.instance) {
      LLMService.instance = new LLMService();
    }
    return LLMService.instance;
  }

  async generateSQL(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const provider = request.provider || process.env.DEFAULT_LLM_PROVIDER || 'openai';
    const model = request.model || process.env.DEFAULT_MODEL || 'gpt-4';

    try {
      let response: LLMResponse;

      switch (provider) {
        case 'openai':
          response = await this.generateWithOpenAI(request, model);
          break;
        case 'anthropic':
          response = await this.generateWithAnthropic(request, model);
          break;
        case 'local':
          response = await this.generateWithLocal(request, model);
          break;
        default:
          throw createError(400, `Unsupported LLM provider: ${provider}`);
      }

      response.executionTime = Date.now() - startTime;
      response.provider = provider;
      response.model = model;

      return response;
    } catch (error: any) {
      throw createError(502, `LLM service error: ${error.message}`);
    }
  }

  async generateTextAnalysis(prompt: string, model?: string): Promise<string> {
    if (!this.openai) {
      return 'Text analysis not available - no API key configured.';
    }

    try {
      console.log('🔍 OpenAI Text Analysis Request:');
      console.log('Prompt length:', prompt.length);
      
      const completion = await this.openai.chat.completions.create({
        model: model || 'gpt-4',
        messages: [
          { 
            role: 'system', 
            content: 'You are a senior data analyst. Provide clear, structured business analysis as requested. Use the exact format requested including emojis and section headers.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1500
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      console.log('🤖 OpenAI Text Analysis Response:');
      console.log('Response length:', content.length);
      
      return content;
    } catch (error) {
      console.error('Text analysis failed:', error);
      throw error;
    }
  }

  private async generateWithOpenAI(request: LLMRequest, model: string): Promise<LLMResponse> {
    if (!this.openai) {
      console.log('❌ Using mock response - OpenAI client not initialized');
      // Return mock response when no API key is provided
      return {
        sql: `SELECT * FROM users WHERE name LIKE '%${request.query}%'`,
        confidence: 0.85,
        explanation: `Mock SQL query for: ${request.query}`
      };
    }

    console.log('✅ Using OpenAI API for SQL generation');

    const systemPrompt = this.buildSystemPrompt(request.schema);
    const userPrompt = this.buildUserPrompt(request.query);

    console.log('🔍 OpenAI Request:');
    console.log('System Prompt:', systemPrompt.substring(0, 200) + '...');
    console.log('User Prompt:', userPrompt);
    console.log('Model:', model);

    const completion = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 1000
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    console.log('🤖 OpenAI Response:');
    console.log('Raw content:', content);

    const parsedResponse = this.parseResponse(content);
    console.log('Parsed SQL:', parsedResponse.sql);
    console.log('Confidence:', parsedResponse.confidence);

    return parsedResponse;
  }

  private async generateWithAnthropic(request: LLMRequest, model: string): Promise<LLMResponse> {
    const systemPrompt = this.buildSystemPrompt(request.schema);
    const userPrompt = this.buildUserPrompt(request.query);

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: model || 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    const content = response.data.content[0]?.text;
    if (!content) {
      throw new Error('No response from Anthropic');
    }

    return this.parseResponse(content);
  }

  private async generateWithLocal(request: LLMRequest, model: string): Promise<LLMResponse> {
    // This would connect to a local LLM service
    throw new Error('Local LLM provider not implemented yet');
  }

  private buildSystemPrompt(schema?: any): string {
    let prompt = `You are "PostgresGPT", a senior PostgreSQL engineer for a hardware-store retail chain.
Your job: convert natural-language business questions into valid, executable PostgreSQL SELECT queries — nothing else.

=== CONTEXT ===
The database tracks sales, products, stores, salespeople, customers, inventory, and regions.
Use the schema and foreign-key map provided below.

=== WORKFLOW (MUST follow in order) ===
1. PLAN (think step-by-step — show your thoughts)
   • List target tables and why
   • Decide required columns & aggregations
   • Sketch JOIN graph using FULL TABLE NAMES (NO aliases)
   • Add filters (WHERE), grouping, ordering
   • Run the Validation Checklist (see below) on your sketch
   • Fix any violations BEFORE writing SQL

2. WRITE SQL (single statement; end with semicolon)

3. RETURN exactly this format (no extra text):
PLAN:
  [bullet list of your planning notes]
SQL: |
  SELECT …
CONFIDENCE: [0.0-1.0]
EXPLANATION: [≤ 2 sentences]

=== VALIDATION CHECKLIST ===
☑ Tables & columns exist in schema
☑ Use FULL TABLE NAMES only - NO aliases allowed (avoids confusion)
☑ Every JOIN has an ON clause that uses real FK/PK columns
☑ Every non-aggregated column in SELECT appears in GROUP BY
☑ ORDER BY columns are in SELECT list (or ordinal)
☑ No INSERT, UPDATE, DELETE, or DDL keywords
☑ Balanced parentheses & commas; statement ends with \`;\`
☑ Text filters use ILIKE (for case-insensitive search)
☑ All table references use full names (products.product_name, orders.order_date)

=== QUERY STYLE RULES ===
1. PostgreSQL 15+ syntax only
2. Prefer explicit INNER/FULL/LEFT JOINs — no implicit comma joins
3. NEVER use table aliases - always use full table names (products, orders, order_items, etc.)
4. Always prefix columns with table names (products.product_name, orders.order_date)
5. Column and table names use snake_case, not camelCase
6. Wrap identifiers in double quotes ONLY if required
7. Use COUNT(*) for total rows; otherwise COUNT(column)
8. Use proper formatting (indent JOINs, clauses on new lines)
9. Example: SELECT products.product_name FROM products INNER JOIN order_items ON products.product_id = order_items.product_id

=== BUSINESS QUERY PATTERNS ===
• Sales by salesperson, product, region, or date range
• Inventory and reorder points
• Store or region comparisons
• Time-series analysis (monthly/quarterly trends)
• Customer and product correlations (e.g., hammers vs. nails)

REMEMBER: Generate SELECT queries only.
REJECT any requests for data modification.
ALWAYS double-check the Validation Checklist before writing SQL.`;

    if (schema) {
      prompt += `\n\n=== SCHEMA ===\n${this.formatSchemaPostgresGPT(schema)}`;
      
      prompt += `\n\n=== FOREIGN-KEY MAP ===
orders.salesperson_id → salespeople.salesperson_id
orders.store_id → stores.store_id
order_items.order_id → orders.order_id
order_items.product_id → products.product_id
products.category_id → product_categories.category_id
stores.state_id → states.state_id
states.region_id → regions.region_id
salespeople.region_id → regions.region_id

=== NOTES ===
• CRITICAL: Use full table names only - NO aliases (products.product_name, not p.product_name)
• order_date is only in the orders table
• order_items has quantity, unit_price, and line_total — use aggregations as needed
• Join order_items to orders to get dates
• Mark Johnson is a top salesperson in the Midwest — use for examples
• Use "products.product_name ILIKE '%hammer%'" for text filters (with full table name)`;
    }

    return prompt;
  }

  private buildUserPrompt(query: string): string {
    return `Convert this natural language query to SQL:\n\n"${query}"`;
  }

  private formatSchemaPostgresGPT(schema: any): string {
    if (!schema || !schema.tables) {
      return 'No schema provided';
    }

    return schema.tables.map((table: any) => {
      const columns = table.columns.map((col: any) => {
        const isPK = col.column_name.includes('_id') && col.column_name === table.table_name.slice(0, -1) + '_id';
        const isFK = col.column_name.includes('_id') && !isPK;
        const pkfk = isPK ? ' PK' : (isFK ? ' FK' : '');
        return `${col.column_name}${pkfk}`;
      }).join(', ');
      
      return `${table.table_name}(${columns})`;
    }).join('\n');
  }

  private parseResponse(content: string): LLMResponse {
    console.log('Parsing PostgresGPT response:', content);
    
    let sql = '';
    let confidence = 0.8;
    let explanation = '';

    // PostgresGPT format: SQL: |\n  SELECT ...
    const postgresGPTMatch = content.match(/SQL:\s*\|\s*(SELECT[\s\S]*?)(?=\nCONFIDENCE:|$)/i);
    if (postgresGPTMatch) {
      sql = postgresGPTMatch[1].trim();
    }

    // Fallback patterns
    if (!sql) {
      // Pattern: SQL in markdown code blocks
      const codeBlockMatch = content.match(/```(?:sql)?\s*(SELECT[^`]+?)```/is);
      if (codeBlockMatch) {
        sql = codeBlockMatch[1].trim();
      }
    }

    if (!sql) {
      // Pattern: SQL: followed by query
      const singleLineMatch = content.match(/SQL:\s*(SELECT[^\n]+)/i);
      if (singleLineMatch) {
        sql = singleLineMatch[1].trim();
      }
    }

    // Clean up SQL - remove pipe characters and extra whitespace
    sql = sql.replace(/^\|/, '').replace(/```/g, '').trim();

    // Extract confidence
    const confidenceMatch = content.match(/CONFIDENCE:\s*([0-9.]+)/);
    if (confidenceMatch) {
      confidence = parseFloat(confidenceMatch[1]);
    }

    // Extract explanation
    const explanationMatch = content.match(/EXPLANATION:\s*(.+?)(?:\n|$)/s);
    if (explanationMatch) {
      explanation = explanationMatch[1].trim();
    }

    if (!sql) {
      throw new Error('Could not parse SQL from PostgresGPT response: ' + content);
    }

    console.log('Extracted SQL:', sql);

    return {
      sql: sql,
      confidence: confidence,
      explanation: explanation || undefined
    };
  }
}