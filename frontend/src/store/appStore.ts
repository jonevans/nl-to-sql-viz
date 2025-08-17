import { create } from 'zustand';
import { Query, Conversation, Favorite, QueryResult, VisualizationRecommendation, Suggestion, QueryStep, QueryHistory, Message } from '@/types';

interface AppState {
  // Query Management
  currentQuery: string;
  queries: Query[];
  activeQuery: Query | null;
  queryResult: QueryResult | null;
  visualizationRecommendations: VisualizationRecommendation[];
  suggestions: Suggestion[];
  isProcessing: boolean;
  
  // Processing State
  progressSteps: QueryStep[];
  currentStepIndex: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'error';
  
  // Conversation Management
  conversations: Conversation[];
  currentConversation: Conversation | null;
  conversationId: string | null;
  
  // Query History
  queryHistory: QueryHistory[];
  
  // Favorites Management
  favorites: Favorite[];
  
  // UI State
  sidebarOpen: boolean;
  activeTab: 'all' | 'processing' | 'completed' | 'favorites';
  showSuggestions: boolean;
  
  // Actions
  setCurrentQuery: (query: string) => void;
  addQuery: (query: Query) => void;
  updateQuery: (id: string, updates: Partial<Query>) => void;
  setActiveQuery: (query: Query | null) => void;
  setQueryResult: (result: QueryResult | null) => void;
  setVisualizationRecommendations: (recommendations: VisualizationRecommendation[]) => void;
  setSuggestions: (suggestions: Suggestion[]) => void;
  setIsProcessing: (processing: boolean) => void;
  
  // Processing Actions
  setProgressSteps: (steps: QueryStep[]) => void;
  setCurrentStepIndex: (index: number) => void;
  setProcessingStatus: (status: 'pending' | 'processing' | 'completed' | 'error') => void;
  
  // Conversation Actions
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  setCurrentConversation: (conversation: Conversation | null) => void;
  setConversationId: (id: string | null) => void;
  addMessageToConversation: (conversationId: string, message: Message) => void;
  
  // Query History Actions
  setQueryHistory: (history: QueryHistory[]) => void;
  addQueryToHistory: (query: QueryHistory) => void;
  
  // Favorites Actions
  setFavorites: (favorites: Favorite[]) => void;
  addFavorite: (favorite: Favorite) => void;
  removeFavorite: (id: string) => void;
  
  // UI Actions
  setSidebarOpen: (open: boolean) => void;
  setActiveTab: (tab: 'all' | 'processing' | 'completed' | 'favorites') => void;
  setShowSuggestions: (show: boolean) => void;
  
  // Complex Actions
  clearCurrentSession: () => void;
  getFilteredQueries: () => Query[];
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial State
  currentQuery: '',
  queries: [],
  activeQuery: null,
  queryResult: null,
  visualizationRecommendations: [],
  suggestions: [],
  isProcessing: false,
  
  // Processing State
  progressSteps: [],
  currentStepIndex: 0,
  processingStatus: 'pending',
  
  // Conversation State
  conversations: [],
  currentConversation: null,
  conversationId: null,
  
  // Query History
  queryHistory: [],
  
  favorites: [],
  
  sidebarOpen: false,
  activeTab: 'all',
  showSuggestions: false,
  
  // Basic Actions
  setCurrentQuery: (query: string) => set({ currentQuery: query }),
  
  addQuery: (query: Query) => set((state) => ({
    queries: [query, ...state.queries]
  })),
  
  updateQuery: (id: string, updates: Partial<Query>) => set((state) => ({
    queries: state.queries.map(q => 
      q.id === id ? { ...q, ...updates } : q
    ),
    activeQuery: state.activeQuery?.id === id 
      ? { ...state.activeQuery, ...updates } 
      : state.activeQuery
  })),
  
  setActiveQuery: (query: Query | null) => set({ activeQuery: query }),
  setQueryResult: (result: QueryResult | null) => set({ queryResult: result }),
  setVisualizationRecommendations: (recommendations: VisualizationRecommendation[]) => set({ visualizationRecommendations: recommendations }),
  setSuggestions: (suggestions: Suggestion[]) => set({ suggestions }),
  setIsProcessing: (processing: boolean) => set({ isProcessing: processing }),
  
  // Processing Actions
  setProgressSteps: (steps: QueryStep[]) => set({ progressSteps: steps }),
  setCurrentStepIndex: (index: number) => set({ currentStepIndex: index }),
  setProcessingStatus: (status: 'pending' | 'processing' | 'completed' | 'error') => set({ processingStatus: status }),
  
  // Conversation Actions
  setConversations: (conversations: Conversation[]) => set({ conversations }),
  addConversation: (conversation: Conversation) => set((state) => ({
    conversations: [conversation, ...state.conversations]
  })),
  setCurrentConversation: (conversation: Conversation | null) => set({ currentConversation: conversation }),
  setConversationId: (id: string | null) => set({ conversationId: id }),
  addMessageToConversation: (conversationId: string, message: Message) => set((state) => ({
    conversations: state.conversations.map(conv =>
      conv.id === conversationId
        ? { ...conv, messages: [...conv.messages, message] }
        : conv
    )
  })),
  
  // Query History Actions
  setQueryHistory: (history: QueryHistory[]) => set({ queryHistory: history }),
  addQueryToHistory: (query: QueryHistory) => set((state) => ({
    queryHistory: [query, ...state.queryHistory.slice(0, 99)] // Keep last 100
  })),
  
  // Favorites Actions
  setFavorites: (favorites: Favorite[]) => set({ favorites }),
  addFavorite: (favorite: Favorite) => set((state) => ({
    favorites: [favorite, ...state.favorites]
  })),
  removeFavorite: (id: string) => set((state) => ({
    favorites: state.favorites.filter(f => f.id !== id)
  })),
  
  // UI Actions
  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
  setActiveTab: (tab: 'all' | 'processing' | 'completed' | 'favorites') => set({ activeTab: tab }),
  setShowSuggestions: (show: boolean) => set({ showSuggestions: show }),
  
  // Complex Actions
  clearCurrentSession: () => set({
    currentQuery: '',
    activeQuery: null,
    queryResult: null,
    visualizationRecommendations: [],
    suggestions: [],
    isProcessing: false,
    progressSteps: [],
    currentStepIndex: 0,
    processingStatus: 'pending',
    currentConversation: null,
    conversationId: null
  }),
  
  getFilteredQueries: () => {
    const { queries, activeTab } = get();
    
    switch (activeTab) {
      case 'processing':
        return queries.filter(q => q.status === 'processing' || q.status === 'pending');
      case 'completed':
        return queries.filter(q => q.status === 'completed');
      case 'favorites':
        return queries.filter(q => 
          get().favorites.some(f => f.naturalLanguage === q.naturalLanguage)
        );
      default:
        return queries;
    }
  }
}));