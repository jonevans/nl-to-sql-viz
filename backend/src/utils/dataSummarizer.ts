/**
 * Data Summarization Utility
 * Intelligently summarizes large datasets to reduce LLM context window usage
 * while preserving meaningful insights for analysis
 */

import { createLogger } from './logger';

const logger = createLogger('DataSummarizer');

export interface DatasetSummary {
  totalRows: number;
  columns: string[];
  columnTypes: Record<string, 'numeric' | 'text' | 'date' | 'boolean' | 'unknown'>;

  // Statistical summaries for numeric columns
  numericSummaries?: Record<string, {
    min: number;
    max: number;
    avg: number;
    sum: number;
    median?: number;
  }>;

  // Frequency summaries for categorical/text columns
  categoricalSummaries?: Record<string, {
    topValues: Array<{ value: string; count: number; percentage: number }>;
    uniqueCount: number;
    nullCount: number;
  }>;

  // Date range summaries
  dateSummaries?: Record<string, {
    earliest: string;
    latest: string;
    range: string;
  }>;

  // Sample rows for context
  sampleRows: any[];

  // Metadata
  summarizationApplied: boolean;
  originalRowCount: number;
}

/**
 * Determine if a column contains numeric values
 */
function isNumericColumn(data: any[], columnName: string): boolean {
  // Check first 10 non-null values
  const samples = data
    .map(row => row[columnName])
    .filter(val => val !== null && val !== undefined)
    .slice(0, 10);

  if (samples.length === 0) return false;

  // All samples should be numbers
  return samples.every(val => typeof val === 'number' && !isNaN(val));
}

/**
 * Determine if a column contains date values
 */
function isDateColumn(data: any[], columnName: string): boolean {
  const samples = data
    .map(row => row[columnName])
    .filter(val => val !== null && val !== undefined)
    .slice(0, 10);

  if (samples.length === 0) return false;

  // Check if values are Date objects or ISO date strings
  return samples.every(val => {
    if (val instanceof Date) return true;
    if (typeof val === 'string') {
      const date = new Date(val);
      return !isNaN(date.getTime());
    }
    return false;
  });
}

/**
 * Infer column types from data
 */
function inferColumnTypes(data: any[], columns: string[]): Record<string, 'numeric' | 'text' | 'date' | 'boolean' | 'unknown'> {
  const types: Record<string, any> = {};

  for (const column of columns) {
    if (isNumericColumn(data, column)) {
      types[column] = 'numeric';
    } else if (isDateColumn(data, column)) {
      types[column] = 'date';
    } else {
      // Check if boolean (true/false values)
      const samples = data
        .map(row => row[column])
        .filter(val => val !== null && val !== undefined)
        .slice(0, 10);

      if (samples.length > 0 && samples.every(val => typeof val === 'boolean')) {
        types[column] = 'boolean';
      } else {
        types[column] = 'text';
      }
    }
  }

  return types;
}

/**
 * Calculate numeric statistics for a column
 */
function calculateNumericSummary(data: any[], columnName: string): {
  min: number;
  max: number;
  avg: number;
  sum: number;
  median?: number;
} {
  const values = data
    .map(row => row[columnName])
    .filter(val => val !== null && val !== undefined && typeof val === 'number');

  if (values.length === 0) {
    return { min: 0, max: 0, avg: 0, sum: 0 };
  }

  const sum = values.reduce((acc, val) => acc + val, 0);
  const avg = sum / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Calculate median for additional insight
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  return { min, max, avg, sum, median };
}

/**
 * Calculate categorical/text statistics for a column
 */
function calculateCategoricalSummary(
  data: any[],
  columnName: string,
  topN: number = 10
): {
  topValues: Array<{ value: string; count: number; percentage: number }>;
  uniqueCount: number;
  nullCount: number;
} {
  const valueCounts: Record<string, number> = {};
  let nullCount = 0;

  data.forEach(row => {
    const value = row[columnName];
    if (value === null || value === undefined) {
      nullCount++;
    } else {
      const stringValue = String(value);
      valueCounts[stringValue] = (valueCounts[stringValue] || 0) + 1;
    }
  });

  const totalNonNull = data.length - nullCount;

  // Sort by frequency and get top N
  const topValues = Object.entries(valueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([value, count]) => ({
      value,
      count,
      percentage: Math.round((count / totalNonNull) * 100 * 10) / 10 // Round to 1 decimal
    }));

  return {
    topValues,
    uniqueCount: Object.keys(valueCounts).length,
    nullCount
  };
}

/**
 * Calculate date range summary for a column
 */
function calculateDateSummary(data: any[], columnName: string): {
  earliest: string;
  latest: string;
  range: string;
} {
  const dates = data
    .map(row => row[columnName])
    .filter(val => val !== null && val !== undefined)
    .map(val => new Date(val))
    .filter(date => !isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) {
    return { earliest: 'N/A', latest: 'N/A', range: 'N/A' };
  }

  const earliest = dates[0].toISOString().split('T')[0];
  const latest = dates[dates.length - 1].toISOString().split('T')[0];

  // Calculate range in days
  const rangeDays = Math.round((dates[dates.length - 1].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24));
  const range = `${rangeDays} days`;

  return { earliest, latest, range };
}

/**
 * Main summarization function
 * Intelligently summarizes datasets to reduce size while preserving insights
 */
export function summarizeDataset(
  data: any[],
  options: {
    maxSampleRows?: number;
    topCategoricalValues?: number;
    alwaysSummarize?: boolean;
  } = {}
): DatasetSummary {
  const {
    maxSampleRows = 5,
    topCategoricalValues = 10,
    alwaysSummarize = false
  } = options;

  // If dataset is empty, return early
  if (!data || data.length === 0) {
    return {
      totalRows: 0,
      columns: [],
      columnTypes: {},
      sampleRows: [],
      summarizationApplied: false,
      originalRowCount: 0
    };
  }

  const totalRows = data.length;
  const columns = Object.keys(data[0] || {});

  logger.info('Summarizing dataset', {
    totalRows,
    columns: columns.length,
    alwaysSummarize
  });

  // Infer column types
  const columnTypes = inferColumnTypes(data, columns);

  // Initialize summary object
  const summary: DatasetSummary = {
    totalRows,
    columns,
    columnTypes,
    sampleRows: [],
    summarizationApplied: alwaysSummarize || totalRows > maxSampleRows,
    originalRowCount: totalRows
  };

  // Generate summaries for each column type
  const numericColumns = columns.filter(col => columnTypes[col] === 'numeric');
  const textColumns = columns.filter(col => columnTypes[col] === 'text');
  const dateColumns = columns.filter(col => columnTypes[col] === 'date');

  // Numeric summaries
  if (numericColumns.length > 0) {
    summary.numericSummaries = {};
    for (const column of numericColumns) {
      summary.numericSummaries[column] = calculateNumericSummary(data, column);
    }
  }

  // Categorical summaries
  if (textColumns.length > 0) {
    summary.categoricalSummaries = {};
    for (const column of textColumns) {
      summary.categoricalSummaries[column] = calculateCategoricalSummary(
        data,
        column,
        topCategoricalValues
      );
    }
  }

  // Date summaries
  if (dateColumns.length > 0) {
    summary.dateSummaries = {};
    for (const column of dateColumns) {
      summary.dateSummaries[column] = calculateDateSummary(data, column);
    }
  }

  // Sample rows: Take first few, last few, and potentially some from middle
  const sampleIndices = new Set<number>();

  // First rows
  for (let i = 0; i < Math.min(Math.ceil(maxSampleRows / 2), totalRows); i++) {
    sampleIndices.add(i);
  }

  // Last rows
  for (let i = Math.max(0, totalRows - Math.floor(maxSampleRows / 2)); i < totalRows; i++) {
    sampleIndices.add(i);
  }

  // If we have room, add some middle rows
  if (sampleIndices.size < maxSampleRows && totalRows > maxSampleRows) {
    const middleIndex = Math.floor(totalRows / 2);
    sampleIndices.add(middleIndex);
  }

  summary.sampleRows = Array.from(sampleIndices)
    .sort((a, b) => a - b)
    .slice(0, maxSampleRows)
    .map(i => data[i]);

  logger.info('Dataset summarized', {
    originalRows: totalRows,
    sampleRows: summary.sampleRows.length,
    numericColumns: numericColumns.length,
    categoricalColumns: textColumns.length,
    dateColumns: dateColumns.length
  });

  return summary;
}

/**
 * Format summary for LLM consumption
 * Converts summary object into a human-readable text description
 */
export function formatSummaryForLLM(summary: DatasetSummary): string {
  if (summary.totalRows === 0) {
    return 'No data available.';
  }

  let description = `Dataset contains ${summary.totalRows.toLocaleString()} rows with ${summary.columns.length} columns.\n\n`;

  // Numeric summaries
  if (summary.numericSummaries && Object.keys(summary.numericSummaries).length > 0) {
    description += 'Numeric columns:\n';
    for (const [column, stats] of Object.entries(summary.numericSummaries)) {
      description += `- ${column}: min=${stats.min.toLocaleString()}, max=${stats.max.toLocaleString()}, avg=${stats.avg.toFixed(2)}, sum=${stats.sum.toLocaleString()}\n`;
    }
    description += '\n';
  }

  // Categorical summaries
  if (summary.categoricalSummaries && Object.keys(summary.categoricalSummaries).length > 0) {
    description += 'Categorical columns:\n';
    for (const [column, stats] of Object.entries(summary.categoricalSummaries)) {
      description += `- ${column}: ${stats.uniqueCount} unique values. Top values: ${stats.topValues.slice(0, 5).map(v => `${v.value} (${v.count})`).join(', ')}\n`;
    }
    description += '\n';
  }

  // Date summaries
  if (summary.dateSummaries && Object.keys(summary.dateSummaries).length > 0) {
    description += 'Date columns:\n';
    for (const [column, stats] of Object.entries(summary.dateSummaries)) {
      description += `- ${column}: ${stats.earliest} to ${stats.latest} (${stats.range})\n`;
    }
    description += '\n';
  }

  return description;
}
