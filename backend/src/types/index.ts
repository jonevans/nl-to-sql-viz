export interface QueryRequest {
  query: string;
  database?: string;
}

export interface QueryResponse {
  sql: string;
  data: any[];
  columns: string[];
  executionTime: number;
  rowCount: number;
}

export interface DatabaseConfig {
  type: 'mongodb';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  uri?: string;
}

export interface LLMRequest {
  query: string;
  provider?: string;
  model?: string;
  schema?: any;
}

export interface LLMResponse {
  sql: string;
  confidence: number;
  explanation?: string;
  executionTime?: number;
  provider?: string;
  model?: string;
}