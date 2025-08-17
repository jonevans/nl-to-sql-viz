import OpenAI from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { 
  LLMRequest, 
  LLMResponse, 
  ConversationContext, 
  QueryResult,
  VisualizationRecommendation 
} from '../types';
import { ConversationManager } from './ConversationManager';
import { MultiStepReasoningEngine } from './MultiStepReasoning';
import { PromptEngine } from './PromptEngine';
import { DataAnalysisService } from './DataAnalysisService';
import { ChartConfigGenerator } from './ChartConfigGenerator';
import { QuerySuggestionEngine } from './QuerySuggestionEngine';
import { ErrorHandler } from './ErrorHandler';
import { v4 as uuidv4 } from 'uuid';

export class AdvancedLLMService {
  private static instance: AdvancedLLMService;
  private openai: OpenAI;
  private anthropic: Anthropic;
  private conversationManager: ConversationManager;
  private multiStepEngine: MultiStepReasoningEngine;
  private promptEngine: PromptEngine;
  private dataAnalysisService: DataAnalysisService;
  private chartConfigGenerator: ChartConfigGenerator;
  private suggestionEngine: QuerySuggestionEngine;
  private errorHandler: ErrorHandler;

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });

    this.conversationManager = ConversationManager.getInstance();
    this.multiStepEngine = MultiStepReasoningEngine.getInstance();
    this.promptEngine = PromptEngine.getInstance();
    this.dataAnalysisService = DataAnalysisService.getInstance();
    this.chartConfigGenerator = ChartConfigGenerator.getInstance();
    this.suggestionEngine = QuerySuggestionEngine.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
  }

  static getInstance(): AdvancedLLMService {
    if (!AdvancedLLMService.instance) {
      AdvancedLLMService.instance = new AdvancedLLMService();
    }
    return AdvancedLLMService.instance;
  }

  async processQuery(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    let conversationContext: ConversationContext;

    try {
      // Get or create conversation context
      if (request.conversationId) {
        conversationContext = this.conversationManager.getConversation(request.conversationId) ||
                            this.conversationManager.createConversation();
      } else {
        conversationContext = this.conversationManager.createConversation();
      }

      // Add user message to conversation
      this.conversationManager.addMessage(conversationContext.id, {
        role: 'user',
        content: request.query
      });

      // Update context with current schema
      if (request.schema) {
        conversationContext.currentSchema = request.schema;
      }

      // Process the query with error handling
      const response = await this.errorHandler.executeWithRetry(
        () => this.executeQuery(request, conversationContext),
        {
          phase: 'generation',
          conversationId: conversationContext.id,
          originalQuery: request.query
        }
      );

      // Add assistant response to conversation
      this.conversationManager.addMessage(conversationContext.id, {
        role: 'assistant',
        content: response.sql,
        metadata: {
          queryGenerated: response.sql,
          confidence: response.confidence,
          processingTime: Date.now() - startTime,
          chartSuggested: response.visualization?.chartType
        }
      });

      // Update session metadata
      this.conversationManager.updateSessionMetadata(conversationContext.id, {
        totalQueries: conversationContext.sessionMetadata.totalQueries + 1,
        lastActivity: new Date()
      });

      response.conversationId = conversationContext.id;
      response.executionTime = Date.now() - startTime;

      return response;

    } catch (error) {
      const errorDetails = await this.errorHandler.handleError(error, {
        phase: 'generation',
        conversationId: request.conversationId,
        originalQuery: request.query
      });

      // Create fallback response
      const fallbackResponse = this.errorHandler.createFallbackResponse(request, errorDetails);
      
      return {
        sql: fallbackResponse.sql || '-- Error generating SQL',
        confidence: 0.1,
        explanation: fallbackResponse.explanation || errorDetails.message,
        provider: request.provider || 'fallback',
        model: request.model || 'fallback',
        executionTime: Date.now() - startTime,
        conversationId: request.conversationId || uuidv4(),
        suggestions: fallbackResponse.suggestions || []
      };
    }
  }

  private async executeQuery(request: LLMRequest, context: ConversationContext): Promise<LLMResponse> {
    const options = {
      enableMultiStep: true,
      includeExplanation: true,
      suggestVisualization: true,
      ...request.options
    };

    // Step 1: Multi-step reasoning if enabled
    let steps;
    if (options.enableMultiStep) {
      steps = await this.multiStepEngine.decompose(request);
      if (steps.length > 1) {
        steps = await this.multiStepEngine.executeSteps(steps, request);
      }
    }

    // Step 2: Generate SQL
    const sqlResult = await this.generateSQL(request, context, steps);

    // Step 3: Generate suggestions
    const suggestions = await this.suggestionEngine.generateSuggestions(
      request.query,
      request.schema,
      context,
      { maxSuggestions: 5 }
    );

    // Step 4: Prepare response
    const response: LLMResponse = {
      sql: sqlResult.sql,
      confidence: sqlResult.confidence,
      explanation: sqlResult.explanation,
      provider: sqlResult.provider,
      model: sqlResult.model,
      executionTime: 0, // Will be set by caller
      conversationId: context.id,
      steps: steps,
      suggestions: suggestions
    };

    return response;
  }

  private async generateSQL(
    request: LLMRequest, 
    context: ConversationContext, 
    steps?: any[]
  ): Promise<{
    sql: string;
    confidence: number;
    explanation: string;
    provider: string;
    model: string;
  }> {
    const provider = request.provider || process.env.DEFAULT_LLM_PROVIDER || 'openai';
    const model = request.model || process.env.DEFAULT_MODEL || 'gpt-4';

    // Build prompts
    const systemPrompt = this.promptEngine.buildSystemPrompt({
      ...request,
      context: context
    });
    
    const userPrompt = this.promptEngine.buildUserPrompt(request);

    try {
      let result;
      
      switch (provider) {
        case 'openai':
          result = await this.generateWithOpenAI(systemPrompt, userPrompt, model);
          break;
        case 'anthropic':
          result = await this.generateWithAnthropic(systemPrompt, userPrompt, model);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      return {
        ...result,
        provider,
        model
      };

    } catch (error) {
      // Try fallback provider
      const fallbackProvider = provider === 'openai' ? 'anthropic' : 'openai';
      
      if (this.shouldTryFallback(error)) {
        try {
          console.log(`Trying fallback provider: ${fallbackProvider}`);
          
          let result;
          if (fallbackProvider === 'openai') {
            result = await this.generateWithOpenAI(systemPrompt, userPrompt, 'gpt-3.5-turbo');
          } else {
            result = await this.generateWithAnthropic(systemPrompt, userPrompt, 'claude-3-haiku-20240307');
          }

          return {
            ...result,
            provider: fallbackProvider,
            model: fallbackProvider === 'openai' ? 'gpt-3.5-turbo' : 'claude-3-haiku-20240307'
          };

        } catch (fallbackError) {
          console.error('Fallback provider also failed:', fallbackError);
          throw error; // Throw original error
        }
      }

      throw error;
    }
  }

  private async generateWithOpenAI(systemPrompt: string, userPrompt: string, model: string): Promise<{
    sql: string;
    confidence: number;
    explanation: string;
  }> {
    const completion = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 2000
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    return this.parseGeneratedResponse(content);
  }

  private async generateWithAnthropic(systemPrompt: string, userPrompt: string, model: string): Promise<{
    sql: string;
    confidence: number;
    explanation: string;
  }> {
    const message = await this.anthropic.messages.create({
      model: model || 'claude-3-sonnet-20240229',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic');
    }

    return this.parseGeneratedResponse(content.text);
  }

  private parseGeneratedResponse(content: string): {
    sql: string;
    confidence: number;
    explanation: string;
  } {
    // Extract SQL
    const sqlMatch = content.match(/SQL:\s*(.+?)(?:\n(?:REASONING|CONFIDENCE|EXPLANATION|$))/s);
    if (!sqlMatch) {
      throw new Error('Could not extract SQL from LLM response');
    }

    // Extract confidence
    const confidenceMatch = content.match(/CONFIDENCE:\s*([0-9.]+)/);
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.8;

    // Extract explanation
    const explanationMatch = content.match(/(?:REASONING|EXPLANATION):\s*(.+?)(?:\n(?:CONFIDENCE|$))/s);
    const explanation = explanationMatch ? explanationMatch[1].trim() : 'SQL query generated successfully';

    return {
      sql: sqlMatch[1].trim(),
      confidence: Math.max(0.1, Math.min(1.0, confidence)),
      explanation
    };
  }

  async refineQuery(
    originalQuery: string,
    feedback: string,
    conversationId: string,
    previousSQL?: string
  ): Promise<LLMResponse> {
    try {
      const context = this.conversationManager.getConversation(conversationId);
      if (!context) {
        throw new Error('Conversation not found');
      }

      // Add feedback to conversation
      this.conversationManager.addMessage(conversationId, {
        role: 'user',
        content: `Feedback: ${feedback}`
      });

      // Generate refinement prompt
      const refinementPrompt = this.promptEngine.buildRefinementPrompt(
        originalQuery,
        feedback,
        previousSQL || ''
      );

      // Use primary provider to refine
      const provider = process.env.DEFAULT_LLM_PROVIDER || 'openai';
      const model = process.env.DEFAULT_MODEL || 'gpt-4';

      let result;
      if (provider === 'openai') {
        result = await this.generateWithOpenAI(
          'You are an expert SQL assistant. Refine the SQL query based on user feedback.',
          refinementPrompt,
          model
        );
      } else {
        result = await this.generateWithAnthropic(
          'You are an expert SQL assistant. Refine the SQL query based on user feedback.',
          refinementPrompt,
          model
        );
      }

      // Add refined response to conversation
      this.conversationManager.addMessage(conversationId, {
        role: 'assistant',
        content: result.sql,
        metadata: {
          queryGenerated: result.sql,
          confidence: result.confidence
        }
      });

      return {
        sql: result.sql,
        confidence: result.confidence,
        explanation: result.explanation,
        provider,
        model,
        executionTime: 0,
        conversationId
      };

    } catch (error) {
      const errorDetails = await this.errorHandler.handleError(error, {
        phase: 'generation',
        conversationId,
        originalQuery
      });

      throw new Error(`Query refinement failed: ${errorDetails.message}`);
    }
  }

  async analyzeDataForVisualization(queryResult: QueryResult): Promise<VisualizationRecommendation> {
    try {
      const insights = await this.dataAnalysisService.analyzeData(queryResult);
      const recommendation = await this.dataAnalysisService.recommendVisualization(insights, queryResult);
      
      // Generate chart configurations
      const configurations = this.chartConfigGenerator.generateConfigurations(
        recommendation.chartType,
        queryResult,
        insights
      );

      return {
        ...recommendation,
        configurations
      };

    } catch (error) {
      const errorDetails = await this.errorHandler.handleError(error, {
        phase: 'visualization'
      });

      // Return fallback visualization
      return this.errorHandler.createFallbackResponse({ data: queryResult.data }, errorDetails);
    }
  }

  async getSuggestions(
    partialInput: string,
    conversationId?: string,
    options?: any
  ): Promise<any[]> {
    try {
      const context = conversationId ? this.conversationManager.getConversation(conversationId) : undefined;
      const schema = context?.currentSchema;

      return await this.suggestionEngine.generateSuggestions(
        partialInput,
        schema,
        context,
        options
      );

    } catch (error) {
      console.error('Error generating suggestions:', error);
      return []; // Return empty suggestions on error
    }
  }

  private shouldTryFallback(error: any): boolean {
    // Try fallback for recoverable errors
    return error.response?.status >= 500 || // Server errors
           error.code === 'ECONNREFUSED' ||   // Connection errors
           error.message?.includes('timeout'); // Timeout errors
  }

  // Conversation management methods
  createConversation(userId?: string): string {
    const context = this.conversationManager.createConversation(userId);
    return context.id;
  }

  getConversationHistory(conversationId: string): any {
    return this.conversationManager.exportConversation(conversationId);
  }

  deleteConversation(conversationId: string): boolean {
    return this.conversationManager.deleteConversation(conversationId);
  }

  // Health check method
  async healthCheck(): Promise<{
    status: string;
    providers: Record<string, boolean>;
    activeConversations: number;
    uptime: number;
  }> {
    const startTime = Date.now();
    const providers: Record<string, boolean> = {};

    // Test OpenAI
    try {
      await this.openai.models.list();
      providers.openai = true;
    } catch {
      providers.openai = false;
    }

    // Test Anthropic
    try {
      if (process.env.ANTHROPIC_API_KEY) {
        // Simple test - this would need actual implementation
        providers.anthropic = true;
      } else {
        providers.anthropic = false;
      }
    } catch {
      providers.anthropic = false;
    }

    return {
      status: Object.values(providers).some(Boolean) ? 'healthy' : 'degraded',
      providers,
      activeConversations: this.conversationManager.getActiveConversationCount(),
      uptime: Date.now() - startTime
    };
  }
}