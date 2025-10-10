import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest } from '../utils/validation';
import Joi from 'joi';
import { llmRateLimiter } from '../middleware/rateLimiter';
import { LLMService } from '../services/llmService';

const router = express.Router();

// Schema for analyze request
const analyzeSchema = Joi.object({
  data: Joi.array().items(Joi.object()).optional(), // Make optional for analysis-only questions
  columns: Joi.array().items(Joi.string()).optional(), // Make optional for analysis-only questions
  rowCount: Joi.number().integer().min(0).optional(),
  executionTime: Joi.number().min(0).optional(),
  query: Joi.string().optional(),
  originalQuery: Joi.string().optional(), // Add original natural language query
  userId: Joi.string().optional(),
  conversationContext: Joi.array().items(Joi.object()).optional(), // For chat context
  responseStyle: Joi.string().valid('structured', 'conversational').optional(), // Response format
  questionType: Joi.string().valid('data_query', 'analysis_only').optional(), // New field for question type
  dataTruncated: Joi.boolean().optional(), // Flag to indicate if data was truncated
  fullRowCount: Joi.number().integer().min(0).optional(), // The actual total row count when data is truncated
  isSummarized: Joi.boolean().optional(), // Flag to indicate if data is summarized
  dataSummary: Joi.object().optional(), // Summarized dataset structure
  summaryDescription: Joi.string().optional() // Human-readable summary description
});

// POST /api/analyze - Analyze query result data and suggest visualizations
router.post('/',
  llmRateLimiter,
  validateRequest(analyzeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    console.log('[Analyze Endpoint] Received request:', {
      hasData: !!req.body.data,
      dataLength: req.body.data?.length,
      columnsLength: req.body.columns?.length,
      questionType: req.body.questionType,
      isSummarized: req.body.isSummarized,
      hasSummaryDescription: !!req.body.summaryDescription
    });

    const { data, columns, rowCount, executionTime, query, originalQuery, userId, conversationContext, responseStyle, questionType, dataTruncated, fullRowCount, isSummarized, dataSummary, summaryDescription } = req.body;

    // Handle analysis-only questions differently
    if (questionType === 'analysis_only') {
      // For analysis-only questions, skip data analysis and go straight to conversation response
      const summary = await generateConversationalResponse(originalQuery || '', conversationContext || [], responseStyle || 'conversational');
      
      res.json({
        summary,
        chartType: 'none',
        reasoning: 'Analysis-only question - no data visualization needed',
        confidence: 0.9,
        configurations: {},
        insights: [],
        recommendations: [],
        timestamp: new Date().toISOString(),
        userId,
        questionType: 'analysis_only'
      });
      return;
    }

    // For data queries, proceed with normal analysis
    const analysis = await analyzeQueryResult({
      data: data || [],
      columns: columns || [],
      rowCount: rowCount || (data ? data.length : 0),
      executionTime: executionTime || 0,
      query: query || '',
      originalQuery: originalQuery || '',
      conversationContext: conversationContext || [],
      responseStyle: responseStyle || 'structured',
      dataTruncated: dataTruncated || false,
      fullRowCount: fullRowCount,
      isSummarized: isSummarized || false,
      dataSummary: dataSummary,
      summaryDescription: summaryDescription
    });

    res.json({
      ...analysis,
      timestamp: new Date().toISOString(),
      userId,
      questionType: 'data_query'
    });
  })
);

async function analyzeQueryResult(queryResult: any): Promise<any> {
  const { data, columns, query, originalQuery, conversationContext, responseStyle, dataTruncated, fullRowCount, isSummarized, dataSummary, summaryDescription } = queryResult;

  console.log('[analyzeQueryResult] Starting analysis:', {
    dataLength: data?.length,
    columnsLength: columns?.length,
    isSummarized,
    hasSummaryDescription: !!summaryDescription
  });

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
      // Pass the full row count if data was truncated, otherwise use data length
      const actualRowCount = dataTruncated && fullRowCount ? fullRowCount : data.length;
      analysis.summary = await generateDataSummary(
        originalQuery,
        data,
        columns,
        conversationContext,
        responseStyle,
        actualRowCount,
        dataTruncated,
        isSummarized,
        dataSummary,
        summaryDescription
      );
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

async function generateDataSummary(
  originalQuery: string,
  data: any[],
  columns: string[],
  conversationContext?: any[],
  responseStyle: string = 'structured',
  actualRowCount?: number,
  dataTruncated?: boolean,
  isSummarized?: boolean,
  dataSummary?: any,
  summaryDescription?: string
): Promise<string> {
  try {
    console.log('[generateDataSummary] Called with:', {
      originalQuery,
      dataLength: data?.length,
      columnsLength: columns?.length,
      responseStyle,
      actualRowCount,
      dataTruncated,
      isSummarized,
      hasSummaryDescription: !!summaryDescription
    });

    // Get LLM service instance
    const llmService = LLMService.getInstance();

    // Prepare data for LLM - use summary if available
    let dataForLLM = '';
    const totalRows = actualRowCount || data.length;

    if (isSummarized && dataSummary && summaryDescription) {
      // Use the intelligent summary instead of raw data
      dataForLLM = summaryDescription;
      dataForLLM += `\n\nSample rows (${dataSummary.sampleRows?.length || 0} of ${totalRows}):\n`;
      dataForLLM += JSON.stringify(dataSummary.sampleRows, null, 2);
    } else if (data.length <= 10) {
      // Small dataset - send all rows
      dataForLLM = JSON.stringify(data, null, 2);
      if (dataTruncated) {
        dataForLLM += `\n[Note: Showing sample of ${data.length} rows from total of ${totalRows} rows]`;
      }
    } else {
      // Medium dataset - show sample + statistics
      const stats = generateDataStatistics(data, columns);
      dataForLLM = `First 5 rows: ${JSON.stringify(data.slice(0, 5), null, 2)}\n`;
      dataForLLM += `Total rows: ${totalRows}`;
      if (dataTruncated) {
        dataForLLM += ` (showing ${data.length} sample rows)`;
      }
      dataForLLM += `\n\nStatistics:\n${stats}`;
    }
    
    // Build conversation context if provided
    let contextString = '';
    if (conversationContext && conversationContext.length > 0) {
      contextString = '\n\nRecent Conversation:\n' + 
        conversationContext.slice(-4)
          .map(m => `${m.role}: ${m.content.substring(0, 100)}...`)
          .join('\n');
    }
    
    // Create prompt based on response style
    let prompt = '';
    
    if (responseStyle === 'conversational') {
      // Conversational style for chat interface
      prompt = `You are a data analyst for Colony Hardware. Provide clear, professional responses to data queries.

User's Question: "${originalQuery}"

Results (${totalRows} rows):
${dataForLLM}
${contextString}

Instructions:
1. Answer directly with the key data points
2. Format currency with $ and commas (e.g., $1,234,567.89)
3. Format large numbers with commas (e.g., 12,345)
4. Keep responses concise - 1-2 sentences for simple queries, 3-4 for complex ones
5. NO emojis, exclamation points, or casual language
6. NO filler phrases like "I've got", "right here", "impressive", "whopping"
7. Start with the answer, not pleasantries
8. If relevant, add ONE brief business insight at the end
9. Use professional language but keep it simple

Generate a professional response:`;
    } else {
      // Structured style for reports/dashboard
      prompt = `You are a senior data analyst providing insights for a hardware store business. The user asked: "${originalQuery}"

QUERY RESULTS:
- Total rows: ${totalRows}
- Columns: ${columns.join(', ')}

${dataForLLM}
${contextString}

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
    }

    // Call OpenAI directly here instead of using the broken analyzeData method
    const openai = llmService.openai;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { 
          role: 'system', 
          content: responseStyle === 'conversational' 
            ? 'You are a professional data analyst. Be clear and direct.'
            : 'You are a senior data analyst. Provide structured, professional analysis.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: responseStyle === 'conversational' ? 0.3 : 0.3,
      max_tokens: responseStyle === 'conversational' ? 200 : 500
    });
    
    const result = completion.choices[0]?.message?.content || 'Analysis could not be generated at this time.';
    console.log('[generateDataSummary] Success, response length:', result.length);
    return result;

  } catch (error: any) {
    console.error('[generateDataSummary] Failed with error:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    const totalRows = actualRowCount || data.length;
    return `Analysis complete: Found ${totalRows} result(s). Consider examining trends, comparing to benchmarks, and identifying actionable insights from this data.`;
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

async function generateConversationalResponse(
  question: string,
  conversationContext: any[],
  responseStyle: string = 'conversational'
): Promise<string> {
  try {
    const llmService = LLMService.getInstance();
    
    // Build context from recent conversation messages
    let contextString = '';
    if (conversationContext && conversationContext.length > 0) {
      const recentMessages = conversationContext.slice(-6); // Get more context for analysis
      contextString = 'Recent conversation:\n' + 
        recentMessages
          .map(m => {
            let content = `${m.role}: ${m.content}`;
            if (m.data) {
              // Handle both old format (array) and new format (object with sample)
              if (Array.isArray(m.data)) {
                content += `\n  [Data: ${m.data.length} rows shown]`;
              } else if (m.data.totalRows) {
                content += `\n  [Data: ${m.data.totalRows} rows shown, sample: ${JSON.stringify(m.data.sample)}]`;
              }
            }
            return content;
          })
          .join('\n');
    }
    
    const prompt = `You are a helpful data analyst for Colony Hardware. The user is asking a follow-up question about data they've already seen in this conversation.

User's Question: "${question}"

${contextString}

Instructions:
1. This is an analysis/insight question, NOT a request for new data
2. Base your response on the data and context from the conversation above
3. Provide thoughtful analysis, explanations, or insights about the data they've already seen
4. Be conversational and helpful - explain trends, patterns, or business implications
5. If asked "why" something happened, provide reasonable business explanations
6. If the context doesn't contain enough information to answer fully, acknowledge that and suggest what additional data might help
7. Keep responses concise but insightful (2-4 sentences)
8. Don't suggest running new queries - focus on analyzing what's already been shown

Provide a helpful, analytical response:`;

    const completion = await llmService.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful data analyst. Provide insightful analysis based on conversation context.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 250
    });
    
    const response = completion.choices[0]?.message?.content;
    if (!response || response.trim().length === 0) {
      return getIntelligentFallback(question, conversationContext);
    }
    
    return response;
    
  } catch (error) {
    console.error('Conversational response generation failed:', error);
    return getIntelligentFallback(question, conversationContext);
  }
}

function getIntelligentFallback(question: string, conversationContext: any[]): string {
  // Check if this looks like a creative/generative request
  const creativeTriggers = [
    'email', 'write', 'draft', 'create', 'generate', 'compose', 'letter', 'message',
    'sample', 'template', 'example', 'suggestion', 'recommend', 'proposal'
  ];
  
  const isCreativeRequest = creativeTriggers.some(trigger => 
    question.toLowerCase().includes(trigger)
  );
  
  if (isCreativeRequest) {
    // Look for recent data in conversation
    const hasRecentData = conversationContext && conversationContext.some(msg => 
      msg.role === 'assistant' && (
        (Array.isArray(msg.data) && msg.data.length > 0) || 
        (msg.data && msg.data.totalRows > 0)
      )
    );
    
    if (hasRecentData) {
      if (question.toLowerCase().includes('email')) {
        return `I understand you'd like help creating an email based on our recent data analysis, but I'm currently focused on data insights rather than content generation. However, you can use the customer data we just analyzed to craft a personalized message highlighting their purchase patterns and suggesting complementary products from our inventory.`;
      }
      return `I see you're looking for help creating content based on our data analysis. While I specialize in data insights rather than content generation, you can use the information we just discussed to create your own targeted messaging.`;
    }
  }
  
  // Check if this is asking for analysis/explanations
  const analysisTriggers = ['why', 'how', 'what does', 'explain', 'insight', 'trend', 'pattern', 'meaning'];
  const isAnalysisRequest = analysisTriggers.some(trigger => 
    question.toLowerCase().includes(trigger)
  );
  
  if (isAnalysisRequest) {
    return `I'd like to provide deeper analysis on that, but I'm having trouble processing the context right now. Could you rephrase your question or be more specific about what aspect you'd like me to analyze from our recent data?`;
  }
  
  // Generic fallback
  return `I understand your question, but I'm having trouble providing a detailed response right now. Could you try rephrasing or asking about specific data you'd like to see?`;
}

// Export the analyze function for internal use (bypasses HTTP/auth)
export { analyzeQueryResult, generateConversationalResponse };

export default router;