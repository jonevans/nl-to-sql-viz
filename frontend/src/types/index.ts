export interface Query {
  id: string;
  naturalLanguage: string;
  sql: string;
  status: 'processing' | 'completed' | 'error' | 'pending';
  confidence: number;
  executionTime?: number;
  rowCount?: number;
  createdAt: Date;
  updatedAt: Date;
  steps?: QueryStep[];
  explanation?: string;
  provider?: string;
  model?: string;
}

export interface QueryStep {
  id: string;
  description: string;
  sql: string;
  reasoning: string;
  dependencies: string[];
  confidence: number;
  complexity: 'simple' | 'moderate' | 'complex';
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export interface QueryResult {
  data: any[];
  columns: string[];
  rowCount: number;
  executionTime: number;
  query: string;
  originalQuery?: string;
}

export interface Conversation {
  id: string;
  name?: string;
  userId?: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  totalQueries: number;
  preferredChartTypes: string[];
  commonTableAccess: string[];
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

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  queryRefinements?: string[];
  isError?: boolean;
  metadata?: {
    queryGenerated?: string;
    dataReturned?: boolean;
    chartSuggested?: string;
    confidence?: number;
    processingTime?: number;
  };
}

export interface Suggestion {
  text: string;
  type: 'completion' | 'refinement' | 'alternative' | 'followup';
  confidence: number;
  reasoning: string;
}

export interface Favorite {
  id: string;
  name: string;
  description?: string;
  naturalLanguage: string;
  sql: string;
  tags: string[];
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
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

export interface PerformanceMetric {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'stable';
  comparison?: string;
}

export interface ActivityItem {
  id: string;
  type: 'query' | 'favorite' | 'export' | 'refinement';
  description: string;
  timestamp: Date;
  status: 'success' | 'error' | 'pending';
  metadata?: any;
}

export interface ExportOptions {
  format: 'png' | 'pdf' | 'csv';
  includeChart?: boolean;
  includeSQL?: boolean;
  includeMetadata?: boolean;
}

export interface QueryHistory {
  id: string;
  query: string;
  timestamp: Date;
  results: QueryResult | null;
  executionTime: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
}