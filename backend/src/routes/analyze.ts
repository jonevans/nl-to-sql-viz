import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest } from '../utils/validation';
import Joi from 'joi';
import { llmRateLimiter } from '../middleware/rateLimiter';
import { LLMService } from '../services/llmService';

const router = express.Router();

// Schema for analyze request
const analyzeSchema = Joi.object({
  data: Joi.array().items(Joi.object()).required().min(1),
  columns: Joi.array().items(Joi.string()).required().min(1),
  rowCount: Joi.number().integer().min(1).optional(),
  executionTime: Joi.number().min(0).optional(),
  query: Joi.string().optional(),
  originalQuery: Joi.string().optional(), // Add original natural language query
  userId: Joi.string().optional()
});

// POST /api/analyze - Analyze query result data and suggest visualizations
router.post('/',
  llmRateLimiter,
  validateRequest(analyzeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { data, columns, rowCount, executionTime, query, originalQuery, userId } = req.body;

    // Generate visualization recommendations based on the data
    const analysis = await analyzeQueryResult({
      data,
      columns,
      rowCount: rowCount || data.length,
      executionTime: executionTime || 0,
      query: query || '',
      originalQuery: originalQuery || ''
    });

    res.json({
      ...analysis,
      timestamp: new Date().toISOString(),
      userId
    });
  })
);

async function analyzeQueryResult(queryResult: any): Promise<any> {
  const { data, columns, query, originalQuery } = queryResult;
  
  // Basic analysis of the data structure
  const analysis = {
    chartType: 'table', // default
    reasoning: 'Data displayed in table format',
    confidence: 0.8,
    configurations: {},
    insights: [] as string[],
    recommendations: [] as string[],
    summary: '' // Add text summary field
  };

  try {
    // Analyze column types and data patterns
    const columnTypes = analyzeColumnTypes(data, columns);
    const patterns = identifyDataPatterns(data, columns, columnTypes);
    
    // Determine best visualization type
    const visualization = suggestVisualization(patterns, columnTypes, data.length);
    
    analysis.chartType = visualization.type;
    analysis.reasoning = visualization.reasoning;
    analysis.confidence = visualization.confidence;
    analysis.configurations = visualization.configurations;
    
    // Generate insights about the data
    analysis.insights = generateInsights(data, columns, columnTypes, patterns);
    
    // Generate recommendations for further analysis
    analysis.recommendations = generateRecommendations(patterns, columnTypes);
    
    // Generate text summary if we have the original query
    if (originalQuery && originalQuery.trim()) {
      analysis.summary = await generateDataSummary(originalQuery, data, columns);
    }
    
  } catch (error) {
    console.error('Analysis failed:', error);
    // Return default table view on error
  }

  return analysis;
}

function analyzeColumnTypes(data: any[], columns: string[]): Record<string, string> {
  const types: Record<string, string> = {};
  
  for (const column of columns) {
    const sample = data[0]?.[column];
    
    if (typeof sample === 'number') {
      types[column] = Number.isInteger(sample) ? 'integer' : 'float';
    } else if (typeof sample === 'string') {
      // Check if it's a date
      if (!isNaN(Date.parse(sample))) {
        types[column] = 'date';
      } else {
        types[column] = 'string';
      }
    } else if (typeof sample === 'boolean') {
      types[column] = 'boolean';
    } else {
      types[column] = 'string';
    }
  }
  
  return types;
}

function identifyDataPatterns(data: any[], columns: string[], columnTypes: Record<string, string>): any {
  const patterns = {
    hasNumerical: false,
    hasCategorical: false,
    hasTimeSeries: false,
    rowCount: data.length,
    numericalColumns: [] as string[],
    categoricalColumns: [] as string[],
    timeColumns: [] as string[]
  };

  for (const column of columns) {
    const type = columnTypes[column];
    
    if (type === 'integer' || type === 'float') {
      patterns.hasNumerical = true;
      patterns.numericalColumns.push(column);
    } else if (type === 'date') {
      patterns.hasTimeSeries = true;
      patterns.timeColumns.push(column);
    } else {
      patterns.hasCategorical = true;
      patterns.categoricalColumns.push(column);
    }
  }

  return patterns;
}

function suggestVisualization(patterns: any, columnTypes: Record<string, string>, rowCount: number): any {
  // Time series data with numerical values
  if (patterns.hasTimeSeries && patterns.hasNumerical) {
    return {
      type: 'line',
      reasoning: 'Time series data detected - line chart shows trends over time',
      confidence: 0.9,
      configurations: {
        xAxis: patterns.timeColumns[0],
        yAxis: patterns.numericalColumns[0],
        showTrend: true
      }
    };
  }
  
  // Categorical data with numerical values (good for bar charts)
  if (patterns.hasCategorical && patterns.hasNumerical && rowCount <= 20) {
    return {
      type: 'bar',
      reasoning: 'Categorical data with numerical values - bar chart shows comparisons',
      confidence: 0.85,
      configurations: {
        xAxis: patterns.categoricalColumns[0],
        yAxis: patterns.numericalColumns[0],
        orientation: rowCount > 10 ? 'horizontal' : 'vertical'
      }
    };
  }
  
  // Single numerical column (good for histogram)
  if (patterns.numericalColumns.length === 1 && !patterns.hasCategorical && rowCount > 10) {
    return {
      type: 'area',
      reasoning: 'Single numerical column - area chart shows distribution',
      confidence: 0.7,
      configurations: {
        xAxis: 'index',
        yAxis: patterns.numericalColumns[0],
        fill: true
      }
    };
  }
  
  // Two numerical columns (good for scatter plot)
  if (patterns.numericalColumns.length >= 2) {
    return {
      type: 'scatter',
      reasoning: 'Multiple numerical columns - scatter plot shows correlations',
      confidence: 0.8,
      configurations: {
        xAxis: patterns.numericalColumns[0],
        yAxis: patterns.numericalColumns[1],
        showTrendline: true
      }
    };
  }
  
  // Default to table for complex or mixed data
  return {
    type: 'table',
    reasoning: 'Mixed or complex data structure - table view provides comprehensive display',
    confidence: 0.6,
    configurations: {
      sortable: true,
      filterable: true,
      paginated: rowCount > 50
    }
  };
}

function generateInsights(data: any[], columns: string[], columnTypes: Record<string, string>, patterns: any): string[] {
  const insights: string[] = [];
  
  insights.push(`Dataset contains ${data.length} rows and ${columns.length} columns`);
  
  if (patterns.hasNumerical) {
    insights.push(`Found ${patterns.numericalColumns.length} numerical column(s): ${patterns.numericalColumns.join(', ')}`);
  }
  
  if (patterns.hasCategorical) {
    insights.push(`Found ${patterns.categoricalColumns.length} categorical column(s): ${patterns.categoricalColumns.join(', ')}`);
  }
  
  if (patterns.hasTimeSeries) {
    insights.push(`Found time series data in: ${patterns.timeColumns.join(', ')}`);
  }
  
  // Calculate basic statistics for numerical columns
  for (const column of patterns.numericalColumns) {
    const values = data.map(row => row[column]).filter(val => val != null && !isNaN(val));
    if (values.length > 0) {
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      insights.push(`${column}: min=${min}, max=${max}, avg=${avg.toFixed(2)}`);
    }
  }
  
  return insights;
}

function generateRecommendations(patterns: any, columnTypes: Record<string, string>): string[] {
  const recommendations: string[] = [];
  
  if (patterns.hasTimeSeries && patterns.hasNumerical) {
    recommendations.push('Consider filtering by date range to focus on specific time periods');
    recommendations.push('Look for trends and seasonal patterns in the time series data');
  }
  
  if (patterns.hasCategorical && patterns.hasNumerical) {
    recommendations.push('Try grouping by categorical variables to compare segments');
    recommendations.push('Consider calculating aggregates (sum, average) for each category');
  }
  
  if (patterns.rowCount > 100) {
    recommendations.push('Consider adding filters or pagination for better performance');
    recommendations.push('Try aggregating data by time periods or categories to reduce noise');
  }
  
  if (patterns.numericalColumns.length > 1) {
    recommendations.push('Explore correlations between numerical variables');
    recommendations.push('Consider creating ratios or derived metrics from multiple columns');
  }
  
  return recommendations;
}

async function generateDataSummary(originalQuery: string, data: any[], columns: string[]): Promise<string> {
  try {
    // Get LLM service instance
    const llmService = LLMService.getInstance();
    
    // Prepare statistical insights about the data
    const stats = generateDataStatistics(data, columns);
    
    // Prepare a concise version of the data for the LLM (limit to first 10 rows to avoid token limits)
    const sampleData = data.slice(0, 10);
    const dataPreview = JSON.stringify(sampleData, null, 2);
    
    // Create an enhanced prompt for professional data analysis
    const prompt = `You are a senior data analyst providing insights for a hardware store business. The user asked: "${originalQuery}"

QUERY RESULTS:
- Total rows: ${data.length}
- Columns: ${columns.join(', ')}
- Sample data: ${dataPreview}

DATA STATISTICS:
${stats}

As a professional data analyst, provide a comprehensive analysis following this structure:

📊 KEY FINDINGS
Summarize the main results with specific numbers and what they reveal.

💡 BUSINESS INSIGHTS
Explain what this data means for business performance, trends, or operations. Consider:
- Performance vs. expectations
- Notable patterns or outliers
- Seasonal or trend implications
- Competitive positioning

⚠️ OBSERVATIONS & CONCERNS
Highlight any data quality issues, anomalies, or areas of concern that need attention.

🎯 RECOMMENDATIONS
Provide 2-3 specific, actionable recommendations based on this data:
- Immediate actions to take
- Process improvements
- Further investigation needed

🔍 FOLLOW-UP ANALYSIS
Suggest 1-2 follow-up questions or analyses that would provide deeper insights.

Keep each section concise but insightful. Use business language, not technical jargon. Focus on actionable insights that drive business decisions.`;

    // Generate summary using the LLM service
    const analysisResult = await llmService.analyzeData(data, originalQuery);
    
    return analysisResult.summary || 'Professional data analysis could not be generated at this time.';
    
  } catch (error) {
    console.error('Summary generation failed:', error);
    return `Analysis complete: Found ${data.length} result(s). Consider examining trends, comparing to benchmarks, and identifying actionable insights from this data.`;
  }
}

function generateDataStatistics(data: any[], columns: string[]): string {
  if (!data || data.length === 0) return 'No data available for analysis.';
  
  const stats: string[] = [];
  
  // Analyze each column
  columns.forEach(column => {
    const values = data.map(row => row[column]).filter(val => val != null);
    
    if (values.length === 0) return;
    
    // Check if column contains numbers
    const numericValues = values.filter(val => !isNaN(Number(val))).map(val => Number(val));
    
    if (numericValues.length > 0) {
      const sum = numericValues.reduce((a, b) => a + b, 0);
      const avg = sum / numericValues.length;
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      
      stats.push(`${column}: Range ${min}-${max}, Average ${avg.toFixed(2)}, Total ${sum.toFixed(2)}`);
    } else {
      // For text columns, show unique values count
      const uniqueValues = [...new Set(values)];
      stats.push(`${column}: ${uniqueValues.length} unique values${uniqueValues.length <= 5 ? ` (${uniqueValues.join(', ')})` : ''}`);
    }
  });
  
  return stats.join('\n');
}

export default router;