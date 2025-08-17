import axios from 'axios';
import { Query, QueryResult, Suggestion, Favorite, VisualizationRecommendation, DatabaseSchema } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// API Client Setup - Single client for all backend services
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Request interceptors for loading states
apiClient.interceptors.request.use((config) => {
  return config;
});

// Response interceptors for error handling
const handleApiError = (error: any) => {
  if (error.response?.data?.error) {
    throw new Error(error.response.data.error);
  }
  throw error;
};

apiClient.interceptors.response.use(
  (response) => response,
  handleApiError
);

// Backend API Services
export const backendApi = {
  // Query Management
  async executeSQL(sql: string, database?: string) {
    const response = await apiClient.post('/api/execute', {
      sql,
      database,
      userId: 'current-user' // TODO: Get from auth
    });
    return response.data;
  },

  async validateSQL(sql: string) {
    const response = await apiClient.post('/api/execute/validate', {
      sql
    });
    return response.data;
  },

  // Schema Management
  async getSchema(database?: string) {
    const response = await apiClient.get('/api/schema', {
      params: { database }
    });
    return response.data;
  },

  async searchSchema(query: string, database?: string) {
    const response = await apiClient.get('/api/schema/search', {
      params: { q: query, database }
    });
    return response.data;
  },

  // Favorites Management
  async getFavorites(userId?: string) {
    const response = await apiClient.get('/api/favorites', {
      params: { userId }
    });
    return response.data;
  },

  async createFavorite(favorite: Omit<Favorite, 'id' | 'createdAt' | 'updatedAt'>) {
    const response = await apiClient.post('/api/favorites', {
      ...favorite,
      userId: 'current-user' // TODO: Get from auth
    });
    return response.data;
  },

  async deleteFavorite(id: string) {
    const response = await apiClient.delete(`/api/favorites/${id}`);
    return response.data;
  },

  // Query History
  async getQueryHistory(userId?: string, page = 1, limit = 10) {
    const response = await apiClient.get('/api/query/history', {
      params: { userId, page, limit }
    });
    return response.data;
  },

  // Visualization
  async analyzeVisualization(data: any[], columns: string[]) {
    const response = await apiClient.post('/api/visualize', {
      data,
      columns
    });
    return response.data;
  }
};

// LLM Service APIs (now integrated into backend)
export const llmApi = {
  // SQL Generation - now handled by backend
  async generateSQL(query: string, options?: {
    schema?: DatabaseSchema;
    conversationId?: string;
    provider?: string;
    model?: string;
    enableMultiStep?: boolean;
    includeExplanation?: boolean;
    suggestVisualization?: boolean;
  }) {
    // Call backend's query endpoint directly
    const response = await apiClient.post('/api/query', {
      query,
      provider: options?.provider,
      model: options?.model,
      userId: 'current-user'
    });
    return response.data;
  },

  // Query Refinement - simplified for now
  async refineQuery(originalQuery: string, feedback: string, conversationId: string, previousSQL?: string) {
    // For now, just regenerate with modified query
    const response = await apiClient.post('/api/query', {
      query: `${originalQuery} (${feedback})`,
      userId: 'current-user'
    });
    return response.data;
  },

  // Data Analysis - now handled by backend
  async analyzeData(queryResult: QueryResult) {
    const response = await apiClient.post('/api/analyze', queryResult);
    return response.data;
  },

  // Suggestions - simplified for now
  async getSuggestions(partial: string, conversationId?: string, options?: {
    maxSuggestions?: number;
    includeTemplates?: boolean;
    includeSchemaAware?: boolean;
    includeContextual?: boolean;
  }) {
    // Return basic suggestions for now
    return {
      partial,
      suggestions: [],
      count: 0
    };
  },

  // Conversation Management - simplified for now
  async createConversation(userId?: string) {
    return { conversationId: Date.now().toString() };
  },

  async getConversation(conversationId: string) {
    return { conversationId, messages: [] };
  },

  async deleteConversation(conversationId: string) {
    return { message: 'Conversation deleted' };
  },

  // Health Check
  async healthCheck() {
    const response = await apiClient.get('/health');
    return response.data;
  }
};

// Combined API Service
export const apiService = {
  ...backendApi,
  ...llmApi,

  // High-level operations that combine multiple API calls
  async processNaturalLanguageQuery(
    query: string,
    options?: {
      executeSQL?: boolean;
      generateVisualization?: boolean;
      conversationId?: string;
    }
  ) {
    try {
      // Step 1: Generate SQL through backend (which will get schema internally)
      const sqlResponse = await llmApi.generateSQL(query);

      const result = {
        query: sqlResponse,
        execution: null as any,
        visualization: null as any
      };

      // Step 2: Execute SQL if requested
      if (options?.executeSQL && sqlResponse.sql) {
        try {
          result.execution = await backendApi.executeSQL(sqlResponse.sql);
        } catch (error) {
          console.warn('SQL execution failed:', error);
          result.execution = { error: 'Failed to execute SQL' };
        }
      }

      // Step 3: Generate visualization if requested and we have data
      if (options?.generateVisualization && result.execution?.data) {
        try {
          result.visualization = await llmApi.analyzeData({
            data: result.execution.data,
            columns: result.execution.columns,
            rowCount: result.execution.rowCount,
            executionTime: result.execution.executionTime,
            query: sqlResponse.sql
          });
        } catch (error) {
          console.warn('Visualization generation failed:', error);
        }
      }

      return result;
    } catch (error) {
      console.error('Error processing natural language query:', error);
      throw error;
    }
  },

  async saveQueryAsFavorite(query: Query, name: string, description?: string, tags?: string[]) {
    return await backendApi.createFavorite({
      name,
      description,
      naturalLanguage: query.naturalLanguage,
      sql: query.sql,
      tags: tags || [],
    });
  }
};

export default apiService;