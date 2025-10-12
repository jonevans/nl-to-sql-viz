import { LLMService } from './llmService';
import { postgresService } from './postgresService';
import { createLogger } from '../utils/logger';
import { summarizeDataset, formatSummaryForLLM, DatasetSummary } from '../utils/dataSummarizer';
import { analyzeQueryResult, generateConversationalResponse } from '../routes/analyze';
import config from '../config';

const logger = createLogger('ConversationService');

interface ConversationContext {
  id: string;
  messages: ConversationMessage[];
  lastSQL?: string;
  activeFilters?: Record<string, any>;
  lastTable?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  data?: any[];
  timestamp: Date;
  metadata?: {
    rowCount?: number;
    executionTime?: number;
    filters?: Record<string, any>;
    error?: boolean;
  };
}

export class ConversationService {
  private static instance: ConversationService;
  private conversations: Map<string, ConversationContext> = new Map();
  private llmService: LLMService;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Configuration from centralized config
  private readonly MAX_CONVERSATIONS = config.conversation.maxConversations;
  private readonly CONVERSATION_TTL_MS = config.conversation.ttlMs;
  private readonly MAX_MESSAGES_PER_CONVERSATION = config.conversation.maxMessagesPerConversation;
  private readonly CLEANUP_INTERVAL_MS = config.conversation.cleanupIntervalMs;

  private constructor() {
    this.llmService = LLMService.getInstance();
    this.startCleanupTask();
  }

  static getInstance(): ConversationService {
    if (!ConversationService.instance) {
      ConversationService.instance = new ConversationService();
    }
    return ConversationService.instance;
  }

  /**
   * Start periodic cleanup of expired conversations
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredConversations();
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Clean up expired conversations based on TTL
   */
  private cleanupExpiredConversations(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, conversation] of this.conversations.entries()) {
      const age = now - conversation.updatedAt.getTime();

      if (age > this.CONVERSATION_TTL_MS) {
        this.conversations.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[ConversationService] Cleaned up ${cleanedCount} expired conversations. Active: ${this.conversations.size}`);
    }

    // If still over limit, remove oldest conversations
    this.enforceMaxConversations();
  }

  /**
   * Enforce maximum conversation limit by removing oldest ones
   */
  private enforceMaxConversations(): void {
    if (this.conversations.size <= this.MAX_CONVERSATIONS) {
      return;
    }

    // Sort conversations by updatedAt and remove oldest
    const sortedConversations = Array.from(this.conversations.entries())
      .sort((a, b) => a[1].updatedAt.getTime() - b[1].updatedAt.getTime());

    const toRemove = this.conversations.size - this.MAX_CONVERSATIONS;

    for (let i = 0; i < toRemove; i++) {
      this.conversations.delete(sortedConversations[i][0]);
    }

    logger.info('Enforced conversation limit', {
      removedCount: toRemove,
      activeConversations: this.conversations.size
    });
  }

  /**
   * Truncate conversation messages if it exceeds max length
   */
  private truncateConversationIfNeeded(conversation: ConversationContext): void {
    if (conversation.messages.length > this.MAX_MESSAGES_PER_CONVERSATION) {
      // Keep the most recent messages and remove old ones
      const excessCount = conversation.messages.length - this.MAX_MESSAGES_PER_CONVERSATION;
      conversation.messages = conversation.messages.slice(excessCount);
      logger.info('Truncated conversation', {
        conversationId: conversation.id,
        removedMessages: excessCount
      });
    }
  }

  /**
   * Get statistics about conversation cache
   */
  public getStatistics(): {
    totalConversations: number;
    oldestConversation: Date | null;
    newestConversation: Date | null;
    averageMessages: number;
  } {
    if (this.conversations.size === 0) {
      return {
        totalConversations: 0,
        oldestConversation: null,
        newestConversation: null,
        averageMessages: 0
      };
    }

    const conversations = Array.from(this.conversations.values());
    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);

    return {
      totalConversations: this.conversations.size,
      oldestConversation: new Date(Math.min(...conversations.map(c => c.updatedAt.getTime()))),
      newestConversation: new Date(Math.max(...conversations.map(c => c.updatedAt.getTime()))),
      averageMessages: totalMessages / this.conversations.size
    };
  }

  /**
   * Shutdown cleanup task (useful for testing)
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  createConversation(): string {
    // Enforce max conversations before creating new one
    this.enforceMaxConversations();

    const id = Date.now().toString();
    this.conversations.set(id, {
      id,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return id;
  }

  async processMessage(conversationId: string, userMessage: string): Promise<{
    response: string;
    sql: string;
    data?: any[];
    metadata?: any;
  }> {
    // Check for reset/start over commands
    const resetCommands = ['start over', 'reset', 'clear', 'new session', 'restart', 'begin again', 'fresh start'];
    const normalizedMessage = userMessage.toLowerCase().trim();
    
    if (resetCommands.some(cmd => normalizedMessage === cmd || normalizedMessage === `/${cmd}`)) {
      // Clear the current conversation and create a new one
      if (this.conversations.has(conversationId)) {
        this.conversations.delete(conversationId);
      }
      
      const newConversationId = this.createConversation();
      
      return {
        response: "I've started a fresh conversation for you. What would you like to know about your Colony Hardware data?",
        sql: '',
        data: [],
        metadata: { 
          action: 'reset',
          newConversationId,
          message: 'Conversation has been reset'
        }
      };
    }
    
    // Get or create conversation
    let conversation = this.conversations.get(conversationId);
    if (!conversation) {
      conversationId = this.createConversation();
      conversation = this.conversations.get(conversationId)!;
    }

    // Add user message
    const userMsg: ConversationMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    conversation.messages.push(userMsg);

    try {
      // First, classify the question to determine if it needs data or just analysis
      const classification = await this.llmService.classifyQuestion(userMessage, conversation.messages);

      logger.info('Question classified', {
        type: classification.needsData ? 'NEEDS_DATA' : 'ANALYSIS_ONLY',
        confidence: classification.confidence
      });

      let llmResponse: any = { sql: '' };
      let data: any[] = [];
      let executionTime = 0;
      let rowCount = 0;

      if (classification.needsData) {
        // Build context for LLM
        const context = this.buildContextForLLM(conversation, userMessage);
        
        // Generate SQL with context
        llmResponse = await this.llmService.generateSQL({
          query: context.query,
          schema: context.schema,
          model: 'gpt-4-turbo-preview',
          options: {
            includeExplanation: true
          }
        });

        // Execute SQL if generated
        if (llmResponse.sql) {
          const result = await postgresService.executeQuery(llmResponse.sql);
          data = result.data;
          executionTime = result.executionTime;
          rowCount = result.rowCount;
        }
      } else {
        // For analysis-only questions, we'll skip SQL generation and use existing context
        logger.debug('Skipping SQL generation for analysis-only question');
      }

      // Use the analyze endpoint to generate a natural response
      // Prepare conversation context with truncated data to avoid payload size issues
      const truncatedContext = conversation.messages.slice(-config.conversation.contextWindow).map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        sql: msg.sql,
        timestamp: msg.timestamp,
        metadata: msg.metadata,
        // Truncate data to prevent large payloads - just include sample and count
        data: msg.data ? {
          sample: msg.data.slice(0, config.conversation.dataPreviewLimit),
          totalRows: msg.data.length,
          columns: msg.data.length > 0 ? Object.keys(msg.data[0]) : []
        } : undefined
      }));

      const analysisPayload: any = {
        originalQuery: userMessage,
        conversationContext: truncatedContext,
        responseStyle: 'conversational',
        questionType: classification.needsData ? 'data_query' : 'analysis_only'
      };

      if (classification.needsData) {
        // Check if this is a COUNT/aggregate query (typically returns 1-10 rows)
        const isAggregateQuery = llmResponse.sql && (
          llmResponse.sql.toUpperCase().includes('COUNT(') ||
          llmResponse.sql.toUpperCase().includes('SUM(') ||
          llmResponse.sql.toUpperCase().includes('AVG(') ||
          llmResponse.sql.toUpperCase().includes('MAX(') ||
          llmResponse.sql.toUpperCase().includes('MIN(') ||
          llmResponse.sql.toUpperCase().includes('GROUP BY')
        );

        // Determine if we should summarize the dataset
        const shouldSummarize = data.length > config.query.summarizationThreshold && !isAggregateQuery;

        if (shouldSummarize) {
          // Large dataset - use intelligent summarization
          logger.info('Applying dataset summarization', {
            originalRows: data.length,
            threshold: config.query.summarizationThreshold
          });

          const summary = summarizeDataset(data, {
            maxSampleRows: config.query.maxSampleRows,
            topCategoricalValues: config.query.topCategoricalValues,
            alwaysSummarize: true
          });

          // Send summarized data instead of raw data
          analysisPayload.dataSummary = summary;
          analysisPayload.data = summary.sampleRows; // Include sample rows for reference
          analysisPayload.isSummarized = true;
          analysisPayload.summaryDescription = formatSummaryForLLM(summary);
        } else {
          // Small dataset or aggregate - send all data
          analysisPayload.data = data;
          analysisPayload.isSummarized = false;
        }

        analysisPayload.columns = data.length > 0 ? Object.keys(data[0]) : [];
        analysisPayload.rowCount = rowCount;
        analysisPayload.executionTime = executionTime;
        analysisPayload.query = llmResponse.sql;
      } else {
        // For analysis-only, the LLM should work with conversation context
        analysisPayload.data = [];
        analysisPayload.columns = [];
        analysisPayload.rowCount = 0;
        analysisPayload.executionTime = 0;
        analysisPayload.query = '';
      }

      let nlResponse: string;

      try {
        // Call analyze function directly instead of via HTTP (bypasses auth issues)
        if (analysisPayload.questionType === 'analysis_only') {
          // For analysis-only questions
          nlResponse = await generateConversationalResponse(
            analysisPayload.originalQuery || '',
            analysisPayload.conversationContext || [],
            analysisPayload.responseStyle || 'conversational'
          );
        } else {
          // For data queries
          const analysisResult = await analyzeQueryResult({
            data: analysisPayload.data || [],
            columns: analysisPayload.columns || [],
            rowCount: analysisPayload.rowCount || 0,
            executionTime: analysisPayload.executionTime || 0,
            query: analysisPayload.query || '',
            originalQuery: analysisPayload.originalQuery || '',
            conversationContext: analysisPayload.conversationContext || [],
            responseStyle: analysisPayload.responseStyle || 'conversational',
            dataTruncated: analysisPayload.dataTruncated || false,
            fullRowCount: analysisPayload.fullRowCount,
            isSummarized: analysisPayload.isSummarized || false,
            dataSummary: analysisPayload.dataSummary,
            summaryDescription: analysisPayload.summaryDescription
          });

          nlResponse = analysisResult.summary || this.getFallbackResponse(userMessage, data, rowCount, analysisPayload.dataSummary);
        }
      } catch (analysisError: any) {
        logger.error('Analysis processing failed', {
          error: analysisError.message,
          stack: analysisError.stack
        });

        // Always provide a helpful fallback response
        if (classification.needsData && data.length > 0) {
          nlResponse = this.getFallbackResponse(userMessage, data, rowCount, analysisPayload.dataSummary);
        } else {
          // For analysis-only questions, provide a contextual fallback
          nlResponse = this.getAnalysisFallbackResponse(userMessage, conversation.messages.slice(-4));
        }
      }

      // Add assistant message
      const assistantMsg: ConversationMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: nlResponse,
        sql: llmResponse.sql,
        data: data,
        timestamp: new Date(),
        metadata: {
          rowCount,
          executionTime,
          filters: this.extractFilters(llmResponse.sql)
        }
      };
      conversation.messages.push(assistantMsg);

      // Update conversation context
      conversation.lastSQL = llmResponse.sql;
      conversation.activeFilters = this.extractFilters(llmResponse.sql);
      conversation.lastTable = this.extractTable(llmResponse.sql);
      conversation.updatedAt = new Date();

      // Truncate conversation if it's getting too long
      this.truncateConversationIfNeeded(conversation);

      return {
        response: nlResponse,
        sql: llmResponse.sql,
        data,
        metadata: assistantMsg.metadata
      };

    } catch (error: any) {
      logger.error('Conversation processing error', {
        error: error.message,
        stack: error.stack,
        conversationId,
        userMessage: userMessage.substring(0, 100)
      });

      // Ensure we always respond, even on complete failure
      // TEMP: Always show error details for debugging
      const fallbackResponse = `I'm experiencing some technical difficulties. Error: ${error.message}`;

      // Add error message to conversation
      const errorMsg: ConversationMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: fallbackResponse,
        timestamp: new Date(),
        metadata: {
          rowCount: 0,
          executionTime: 0,
          error: true
        }
      };
      conversation.messages.push(errorMsg);
      conversation.updatedAt = new Date();

      return {
        response: fallbackResponse,
        sql: '',
        data: [],
        metadata: { error: true, message: error.message, stack: error.stack }
      };
    }
  }

  private buildContextForLLM(conversation: ConversationContext, currentQuery: string): {
    query: string;
    schema: any;
  } {
    // Get recent relevant messages for context
    const recentMessages = conversation.messages.slice(-config.conversation.contextWindow);
    
    let contextPrompt = currentQuery;
    
    if (conversation.lastSQL && recentMessages.length > 0) {
      // Build a cleaner context that focuses on the SQL pattern
      const lastUserMessage = recentMessages.filter(m => m.role === 'user').pop();

      // Check if current query seems like it's related to previous context
      const followUpKeywords = ['those', 'them', 'these', 'that', 'it', 'which ones', 'same', 'also', 'the ones', 'just the', 'only the'];
      const isLikelyFollowUp = followUpKeywords.some(keyword => currentQuery.toLowerCase().includes(keyword));

      // Also check if this is adding a temporal filter to existing results
      const temporalKeywords = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      const hasTemporalFilter = temporalKeywords.some(month => currentQuery.toLowerCase().includes(month));
      const isShortQuery = currentQuery.trim().split(' ').length <= 6; // Short queries like "show me just the ones from January" are likely follow-ups

      // If it's a short query with temporal filter and we have existing filters, treat as follow-up
      const isTemporalFollowUp = hasTemporalFilter && isShortQuery && conversation.activeFilters && Object.keys(conversation.activeFilters).length > 0;

      if (isLikelyFollowUp || isTemporalFollowUp) {
        // This looks like a follow-up question - provide context
        const filterList = Object.entries(conversation.activeFilters || {})
          .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
          .join(', ');

        contextPrompt = `Convert this natural language query to SQL.

Context from previous query:
- Previous question: "${lastUserMessage?.content || ''}"
- Previous SQL used: ${conversation.lastSQL}
- Active filters from previous query: ${filterList || 'none'}

Current question: "${currentQuery}"

CRITICAL INSTRUCTIONS FOR FOLLOW-UP QUERIES:
1. This is a FOLLOW-UP question referencing previous results
2. MAINTAIN ALL FILTERS from previous query in your WHERE clause
3. Required filters to include: ${filterList || 'none'}
4. IMPORTANT - Query Type Detection:
   - "Show me", "List", "Display", "Get" = Return ROWS of data (SELECT columns FROM...)
   - "What is", "How many", "Total", "Average", "Sum" = Return aggregate (SELECT COUNT/AVG/SUM...)
   - Previous query was ${conversation.lastSQL?.includes('AVG(') || conversation.lastSQL?.includes('COUNT(') || conversation.lastSQL?.includes('SUM(') ? 'an aggregate' : 'returning rows'}
   - If user says "show me the ones from January", they want ROWS, not AVG() - change query type!
5. Examples:
   - Previous: "What is the average?" Current: "Show me the ones from January"
     → Change from AVG() to SELECT with WHERE state = 'MI' AND EXTRACT(MONTH FROM order_date) = 1
   - Previous: "Show me Michigan sales" Current: "What's the average for those?"
     → Change from SELECT to AVG() with WHERE state = 'MI'
6. For month filters, use: EXTRACT(MONTH FROM order_date) = <month_number> (January=1, February=2, etc.)
7. For state filters, use 2-letter codes: 'MI' for Michigan, 'OH' for Ohio, etc.
8. Combine ALL filters with AND in the WHERE clause
9. If asking "which products?" or "which ones?", JOIN with products table to show product_description instead of product_key`;
      } else {
        // Standalone query - don't carry over filters
        contextPrompt = currentQuery;
      }
    }

    return {
      query: contextPrompt,
      schema: null // Will use the hardcoded Colony schema in llmService
    };
  }


  private getFallbackResponse(query: string, data: any[], rowCount: number, summary?: any): string {
    if (!data || data.length === 0) {
      return "I couldn't find any data matching your query. Try rephrasing or checking your filters.";
    }

    if (rowCount === 1) {
      const entries = Object.entries(data[0]);

      // Check if this is an aggregate query result (single numeric value)
      if (entries.length === 1 && typeof entries[0][1] === 'number') {
        const [key, value] = entries[0];
        const numValue = value as number;

        logger.debug('Processing single aggregate result', {
          columnName: key,
          value: numValue,
          query
        });

        // Determine if this looks like money based on column name or context
        // Check both the column name AND the query text for money-related terms
        const isMoneyColumn = /price|cost|sales|revenue|total|amount|ext_price|ext_cost|value/i.test(key) ||
                             /sales|revenue|price|cost|value|total|amount/i.test(query);
        const isCountColumn = /count/i.test(key);

        // Extract entity from the query for better context
        let entityContext = '';
        const productMatch = query.match(/product(?:descr)?\s+(\S+)/i);
        const customerMatch = query.match(/customer\s+(\S+)/i);

        if (productMatch) {
          entityContext = `Product ${productMatch[1]} `;
        } else if (customerMatch) {
          entityContext = `Customer ${customerMatch[1]} `;
        }

        // Handle follow-up questions that reference "those"
        const isFollowUp = /those|that|them|it/i.test(query);
        if (isFollowUp && !entityContext) {
          entityContext = 'Those ';
        }

        // Format the response based on type
        if (isMoneyColumn) {
          const formatted = numValue.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });

          // Determine what type of total this is
          const metricType = key.toLowerCase().includes('cost') ? 'cost totaled' :
                           key.toLowerCase().includes('price') ? 'sales totaled' :
                           'totaled';

          return `${entityContext}${metricType} ${formatted}`;
        } else if (isCountColumn) {
          return `${entityContext}count is ${numValue.toLocaleString()}`;
        } else {
          const formatted = numValue.toLocaleString();
          return `${entityContext}${key.replace(/_/g, ' ')}: ${formatted}`;
        }
      }

      // Multiple columns in single row - format as before
      const formatted = entries
        .map(([key, value]) => {
          if (typeof value === 'number') {
            // Check if money column
            const isMoneyColumn = /price|cost|sales|revenue|total|amount/i.test(key);
            if (isMoneyColumn) {
              return `${key}: ${value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`;
            }
            return `${key}: ${value.toLocaleString()}`;
          }
          return `${key}: ${value}`;
        })
        .join(', ');
      return `Found 1 result: ${formatted}`;
    }

    // If we have summary data, use it to provide context
    if (summary && summary.categoricalSummaries) {
      const insights: string[] = [];

      // Get top categorical insights
      for (const [columnName, columnData] of Object.entries(summary.categoricalSummaries) as any[]) {
        if (columnData.topValues && columnData.topValues.length > 0) {
          const topItems = columnData.topValues.slice(0, 3).map((v: any) => v.value).join(', ');
          insights.push(`top ${columnName.replace(/_/g, ' ')}: ${topItems}`);
        }
      }

      // Get numeric insights
      if (summary.numericSummaries) {
        for (const [columnName, stats] of Object.entries(summary.numericSummaries) as any[]) {
          if (stats.sum) {
            const formattedSum = stats.sum.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
            insights.push(`total ${columnName.replace(/_/g, ' ')}: ${formattedSum}`);
            break; // Just show one total
          }
        }
      }

      if (insights.length > 0) {
        return `Found ${rowCount.toLocaleString()} results (${insights.join(', ')}). The data is available in the table below.`;
      }
    }

    return `Found ${rowCount.toLocaleString()} results. The data is available in the table below.`;
  }

  private getAnalysisFallbackResponse(query: string, recentMessages: ConversationMessage[]): string {
    // Check if this looks like a creative/generative request
    const creativeTriggers = [
      'email', 'write', 'draft', 'create', 'generate', 'compose', 'letter', 'message',
      'sample', 'template', 'example', 'suggestion', 'recommend', 'proposal'
    ];
    
    const isCreativeRequest = creativeTriggers.some(trigger => 
      query.toLowerCase().includes(trigger)
    );
    
    if (isCreativeRequest) {
      // Look for recent data context
      const recentDataMessage = recentMessages
        .reverse()
        .find(msg => msg.role === 'assistant' && msg.data && msg.data.length > 0);
      
      if (recentDataMessage) {
        return `I understand you'd like me to help create content based on our recent data analysis, but I'm currently focused on data insights rather than content generation. However, I can tell you that we just analyzed ${recentDataMessage.metadata?.rowCount || 'some'} records. You might want to use that information to craft your own ${query.toLowerCase().includes('email') ? 'email' : 'message'} highlighting those key findings.`;
      }
    }
    
    // Check if this is asking about trends or explanations
    const analysisTriggers = ['why', 'how', 'what does', 'explain', 'insight', 'trend', 'pattern', 'meaning'];
    const isAnalysisRequest = analysisTriggers.some(trigger => 
      query.toLowerCase().includes(trigger)
    );
    
    if (isAnalysisRequest) {
      return `I'd like to provide deeper analysis on that, but I'm having trouble processing the context right now. Could you rephrase your question or be more specific about what aspect you'd like me to analyze from our recent data?`;
    }
    
    // Generic fallback
    return `I understand your question, but I'm having trouble providing a detailed response right now. Could you try rephrasing or asking about specific data you'd like to see?`;
  }

  private extractFilters(sql: string): Record<string, any> {
    const filters: Record<string, any> = {};

    // Extract state filter
    const stateMatch = sql.match(/state\s*(?:=|ILIKE)\s*'([^']+)'/i);
    if (stateMatch) filters.state = stateMatch[1];

    // Extract city filter
    const cityMatch = sql.match(/city\s*(?:=|ILIKE)\s*'([^']+)'/i);
    if (cityMatch) filters.city = cityMatch[1];

    // Extract date filters (BETWEEN)
    const dateMatch = sql.match(/order_date\s+BETWEEN\s+'([^']+)'\s+AND\s+'([^']+)'/i);
    if (dateMatch) {
      filters.startDate = dateMatch[1];
      filters.endDate = dateMatch[2];
    }

    // Extract month filter
    const monthMatch = sql.match(/EXTRACT\s*\(\s*MONTH\s+FROM\s+order_date\s*\)\s*=\s*(\d+)/i);
    if (monthMatch) filters.month = parseInt(monthMatch[1]);

    // Extract year filter
    const yearMatch = sql.match(/EXTRACT\s*\(\s*YEAR\s+FROM\s+order_date\s*\)\s*=\s*(\d+)/i);
    if (yearMatch) filters.year = parseInt(yearMatch[1]);

    // Extract product category
    const categoryMatch = sql.match(/product_category\s*(?:=|ILIKE)\s*'([^']+)'/i);
    if (categoryMatch) filters.category = categoryMatch[1];

    // Extract product_id filter
    const productIdMatch = sql.match(/product_id\s*(?:=|ILIKE)\s*'([^']+)'/i);
    if (productIdMatch) filters.product_id = productIdMatch[1];

    // Extract product_description filter (for ILIKE searches)
    const productDescMatch = sql.match(/product_description\s*ILIKE\s*'%([^']+)%'/i);
    if (productDescMatch) filters.product_description = productDescMatch[1];

    // Extract customer_key filter
    const customerKeyMatch = sql.match(/customer_key\s*=\s*(\d+)/i);
    if (customerKeyMatch) filters.customer_key = parseInt(customerKeyMatch[1]);

    logger.debug('Extracted filters from SQL', { sql: sql.substring(0, 200), filters });

    return filters;
  }

  private extractTable(sql: string): string {
    const match = sql.match(/FROM\s+(\w+)/i);
    return match ? match[1] : '';
  }

  private extractMonth(query: string): string | null {
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 
                   'july', 'august', 'september', 'october', 'november', 'december'];
    const lowerQuery = query.toLowerCase();
    
    for (const month of months) {
      if (lowerQuery.includes(month)) {
        return month.charAt(0).toUpperCase() + month.slice(1);
      }
    }
    return null;
  }

  getConversation(id: string): ConversationContext | undefined {
    return this.conversations.get(id);
  }

  clearConversation(id: string): void {
    this.conversations.delete(id);
  }
}