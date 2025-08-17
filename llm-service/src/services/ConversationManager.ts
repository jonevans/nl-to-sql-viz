import { ConversationContext, ConversationMessage } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class ConversationManager {
  private static instance: ConversationManager;
  private conversations: Map<string, ConversationContext> = new Map();
  private readonly MAX_CONTEXT_LENGTH = 50; // Maximum messages to keep in context
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  static getInstance(): ConversationManager {
    if (!ConversationManager.instance) {
      ConversationManager.instance = new ConversationManager();
    }
    return ConversationManager.instance;
  }

  createConversation(userId?: string): ConversationContext {
    const conversationId = uuidv4();
    const conversation: ConversationContext = {
      id: conversationId,
      userId,
      messages: [],
      sessionMetadata: {
        startTime: new Date(),
        lastActivity: new Date(),
        totalQueries: 0,
        preferredChartTypes: [],
        commonTableAccess: []
      }
    };

    this.conversations.set(conversationId, conversation);
    this.scheduleCleanup(conversationId);
    
    return conversation;
  }

  getConversation(conversationId: string): ConversationContext | null {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return null;
    }

    // Check if session has expired
    const now = new Date();
    const lastActivity = conversation.sessionMetadata.lastActivity;
    if (now.getTime() - lastActivity.getTime() > this.SESSION_TIMEOUT) {
      this.conversations.delete(conversationId);
      return null;
    }

    return conversation;
  }

  addMessage(conversationId: string, message: Omit<ConversationMessage, 'id' | 'timestamp'>): ConversationMessage {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found or expired`);
    }

    const fullMessage: ConversationMessage = {
      id: uuidv4(),
      timestamp: new Date(),
      ...message
    };

    conversation.messages.push(fullMessage);
    conversation.sessionMetadata.lastActivity = new Date();

    // Trim messages if exceeding max length
    if (conversation.messages.length > this.MAX_CONTEXT_LENGTH) {
      conversation.messages = conversation.messages.slice(-this.MAX_CONTEXT_LENGTH);
    }

    return fullMessage;
  }

  updateSessionMetadata(conversationId: string, updates: Partial<ConversationContext['sessionMetadata']>): void {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      return;
    }

    Object.assign(conversation.sessionMetadata, updates);
  }

  getRecentQueries(conversationId: string, limit: number = 5): ConversationMessage[] {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      return [];
    }

    return conversation.messages
      .filter(msg => msg.role === 'user')
      .slice(-limit);
  }

  getContextSummary(conversationId: string): string {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      return '';
    }

    const recentMessages = conversation.messages.slice(-10);
    const queryCount = conversation.sessionMetadata.totalQueries;
    const commonTables = conversation.sessionMetadata.commonTableAccess;
    const preferredCharts = conversation.sessionMetadata.preferredChartTypes;

    let summary = `Session Context:\n`;
    summary += `- Total queries in session: ${queryCount}\n`;
    
    if (commonTables.length > 0) {
      summary += `- Frequently accessed tables: ${commonTables.join(', ')}\n`;
    }
    
    if (preferredCharts.length > 0) {
      summary += `- Preferred chart types: ${preferredCharts.join(', ')}\n`;
    }
    
    if (recentMessages.length > 0) {
      summary += `\nRecent conversation:\n`;
      recentMessages.forEach(msg => {
        const truncated = msg.content.length > 100 
          ? msg.content.substring(0, 100) + '...' 
          : msg.content;
        summary += `- ${msg.role}: ${truncated}\n`;
      });
    }

    return summary;
  }

  analyzeUserPatterns(conversationId: string): {
    queryComplexity: 'simple' | 'moderate' | 'complex';
    preferredVisualization: string[];
    commonKeywords: string[];
    tableUsageFrequency: Record<string, number>;
  } {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      return {
        queryComplexity: 'simple',
        preferredVisualization: [],
        commonKeywords: [],
        tableUsageFrequency: {}
      };
    }

    const userMessages = conversation.messages.filter(msg => msg.role === 'user');
    const assistantMessages = conversation.messages.filter(msg => msg.role === 'assistant');

    // Analyze query complexity
    const hasComplexKeywords = userMessages.some(msg => 
      /join|group by|having|subquery|window|over|partition/i.test(msg.content)
    );
    const avgLength = userMessages.reduce((sum, msg) => sum + msg.content.length, 0) / userMessages.length;
    
    let queryComplexity: 'simple' | 'moderate' | 'complex' = 'simple';
    if (hasComplexKeywords || avgLength > 100) {
      queryComplexity = 'complex';
    } else if (avgLength > 50) {
      queryComplexity = 'moderate';
    }

    // Extract chart preferences
    const chartTypes = assistantMessages
      .map(msg => msg.metadata?.chartSuggested)
      .filter(Boolean) as string[];
    
    const preferredVisualization = [...new Set(chartTypes)];

    // Extract common keywords
    const allText = userMessages.map(msg => msg.content).join(' ').toLowerCase();
    const words = allText.match(/\b\w+\b/g) || [];
    const wordCounts = words.reduce((acc, word) => {
      if (word.length > 3) { // Filter out short words
        acc[word] = (acc[word] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const commonKeywords = Object.entries(wordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);

    return {
      queryComplexity,
      preferredVisualization,
      commonKeywords,
      tableUsageFrequency: conversation.sessionMetadata.commonTableAccess.reduce((acc, table) => {
        acc[table] = (acc[table] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  exportConversation(conversationId: string): ConversationContext | null {
    return this.getConversation(conversationId);
  }

  deleteConversation(conversationId: string): boolean {
    return this.conversations.delete(conversationId);
  }

  private scheduleCleanup(conversationId: string): void {
    setTimeout(() => {
      const conversation = this.conversations.get(conversationId);
      if (conversation) {
        const now = new Date();
        const lastActivity = conversation.sessionMetadata.lastActivity;
        if (now.getTime() - lastActivity.getTime() > this.SESSION_TIMEOUT) {
          this.conversations.delete(conversationId);
        }
      }
    }, this.SESSION_TIMEOUT + 5000); // Add 5 second buffer
  }

  // Persistence methods (for production, you'd use Redis or database)
  async saveConversationToStorage(conversationId: string): Promise<void> {
    // Implementation would save to Redis/Database
    // For now, keeping in memory
  }

  async loadConversationFromStorage(conversationId: string): Promise<ConversationContext | null> {
    // Implementation would load from Redis/Database
    // For now, return from memory
    return this.getConversation(conversationId);
  }

  getActiveConversationCount(): number {
    return this.conversations.size;
  }

  getConversationStats(): {
    totalConversations: number;
    averageMessagesPerConversation: number;
    totalMessages: number;
  } {
    const conversations = Array.from(this.conversations.values());
    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
    
    return {
      totalConversations: conversations.length,
      averageMessagesPerConversation: conversations.length > 0 ? totalMessages / conversations.length : 0,
      totalMessages
    };
  }
}