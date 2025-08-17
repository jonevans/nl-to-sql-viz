export interface ConversationContext {
  id: string;
  userId?: string;
  messages: ConversationMessage[];
  currentSchema?: DatabaseSchema;
  lastQuery?: QueryResult;
  sessionMetadata: {
    startTime: Date;
    lastActivity: Date;
    totalQueries: number;
    preferredChartTypes: string[];
    commonTableAccess: string[];
  };
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    queryGenerated?: string;
    dataReturned?: boolean;
    chartSuggested?: string;
    confidence?: number;
    processingTime?: number;
  };
}

export interface LLMRequest {
  query: string;
  conversationId?: string;
  schema?: DatabaseSchema;
  provider?: 'openai' | 'anthropic' | 'local';
  model?: string;
  context?: ConversationContext;
  options?: {
    enableMultiStep?: boolean;
    maxSteps?: number;
    includeExplanation?: boolean;
    suggestVisualization?: boolean;
  };
}

export interface LLMResponse {
  sql: string;
  confidence: number;
  explanation?: string;
  provider: string;
  model: string;
  executionTime: number;
  conversationId: string;
  steps?: QueryStep[];
  suggestions?: QuerySuggestion[];
  visualization?: VisualizationRecommendation;
}

export interface QueryStep {
  id: string;
  description: string;
  sql: string;
  reasoning: string;
  dependencies: string[];
  confidence: number;
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface QuerySuggestion {
  text: string;
  type: 'completion' | 'refinement' | 'alternative' | 'followup';
  confidence: number;
  reasoning: string;
}

export interface VisualizationRecommendation {
  chartType: string;
  reasoning: string;
  confidence: number;
  configurations: {
    chartjs?: any;
    d3?: any;
    recharts?: any;
  };
}

export interface DatabaseSchema {
  tables: Table[];
  relationships?: Relationship[];
}

export interface Table {
  name: string;
  columns: Column[];
  description?: string;
  sampleData?: any[];
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey?: boolean;
  foreignKey?: string;
  description?: string;
  sampleValues?: any[];
}

export interface Relationship {
  table: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

export interface QueryResult {
  data: any[];
  columns: string[];
  rowCount: number;
  executionTime: number;
  query: string;
}

export interface ErrorContext {
  phase: 'parsing' | 'generation' | 'execution' | 'visualization';
  provider?: string;
  model?: string;
  conversationId?: string;
  originalQuery?: string;
  attemptCount?: number;
}