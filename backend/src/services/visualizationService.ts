import { createError } from '../middleware/errorHandler';

export interface VisualizationSuggestion {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'table';
  title: string;
  xAxis?: string;
  yAxis?: string;
  confidence: number;
  reasoning: string;
}

export interface VisualizationResponse {
  suggestions: VisualizationSuggestion[];
  recommended: VisualizationSuggestion;
  dataInsights: {
    rowCount: number;
    columnCount: number;
    numericalColumns: string[];
    categoricalColumns: string[];
    dateColumns: string[];
    nullPercentages: Record<string, number>;
  };
}

export class VisualizationService {
  private static instance: VisualizationService;

  static getInstance(): VisualizationService {
    if (!VisualizationService.instance) {
      VisualizationService.instance = new VisualizationService();
    }
    return VisualizationService.instance;
  }

  async analyzeAndSuggest(data: any[], columns: string[]): Promise<VisualizationResponse> {
    if (!data || data.length === 0) {
      throw createError(400, 'No data provided for visualization');
    }

    const insights = this.analyzeData(data, columns);
    const suggestions = this.generateSuggestions(insights, data, columns);
    const recommended = this.selectRecommended(suggestions);

    return {
      suggestions,
      recommended,
      dataInsights: insights
    };
  }

  private analyzeData(data: any[], columns: string[]) {
    const sampleRow = data[0];
    const numericalColumns: string[] = [];
    const categoricalColumns: string[] = [];
    const dateColumns: string[] = [];
    const nullPercentages: Record<string, number> = {};

    columns.forEach(column => {
      const values = data.map(row => row[column]);
      const nullCount = values.filter(v => v === null || v === undefined || v === '').length;
      nullPercentages[column] = (nullCount / data.length) * 100;

      const sampleValue = values.find(v => v !== null && v !== undefined && v !== '');
      
      if (sampleValue !== undefined) {
        if (this.isDate(sampleValue)) {
          dateColumns.push(column);
        } else if (this.isNumeric(sampleValue)) {
          numericalColumns.push(column);
        } else {
          categoricalColumns.push(column);
        }
      }
    });

    return {
      rowCount: data.length,
      columnCount: columns.length,
      numericalColumns,
      categoricalColumns,
      dateColumns,
      nullPercentages
    };
  }

  private generateSuggestions(insights: any, data: any[], columns: string[]): VisualizationSuggestion[] {
    const suggestions: VisualizationSuggestion[] = [];
    
    // Always suggest table view
    suggestions.push({
      type: 'table',
      title: 'Data Table',
      confidence: 0.9,
      reasoning: 'Table view provides comprehensive data overview'
    });

    // Single numerical column - histogram or bar chart
    if (insights.numericalColumns.length === 1 && insights.categoricalColumns.length === 0) {
      suggestions.push({
        type: 'bar',
        title: `${insights.numericalColumns[0]} Distribution`,
        yAxis: insights.numericalColumns[0],
        confidence: 0.8,
        reasoning: 'Single numerical column best displayed as distribution'
      });
    }

    // One categorical, one numerical - bar chart
    if (insights.categoricalColumns.length === 1 && insights.numericalColumns.length === 1) {
      suggestions.push({
        type: 'bar',
        title: `${insights.numericalColumns[0]} by ${insights.categoricalColumns[0]}`,
        xAxis: insights.categoricalColumns[0],
        yAxis: insights.numericalColumns[0],
        confidence: 0.95,
        reasoning: 'Categorical vs numerical data ideal for bar chart'
      });
    }

    // Multiple numerical columns - line chart or scatter
    if (insights.numericalColumns.length >= 2) {
      suggestions.push({
        type: 'scatter',
        title: `${insights.numericalColumns[0]} vs ${insights.numericalColumns[1]}`,
        xAxis: insights.numericalColumns[0],
        yAxis: insights.numericalColumns[1],
        confidence: 0.85,
        reasoning: 'Multiple numerical columns show correlation in scatter plot'
      });
    }

    // Time series data - line chart
    if (insights.dateColumns.length >= 1 && insights.numericalColumns.length >= 1) {
      suggestions.push({
        type: 'line',
        title: `${insights.numericalColumns[0]} over time`,
        xAxis: insights.dateColumns[0],
        yAxis: insights.numericalColumns[0],
        confidence: 0.9,
        reasoning: 'Time series data best displayed as line chart'
      });
    }

    // Categorical with small unique values - pie chart
    if (insights.categoricalColumns.length === 1 && insights.numericalColumns.length === 1) {
      const uniqueValues = new Set(data.map(row => row[insights.categoricalColumns[0]]));
      if (uniqueValues.size <= 10) {
        suggestions.push({
          type: 'pie',
          title: `${insights.numericalColumns[0]} breakdown by ${insights.categoricalColumns[0]}`,
          confidence: 0.75,
          reasoning: 'Small number of categories suitable for pie chart'
        });
      }
    }

    // Area chart for cumulative data
    if (insights.dateColumns.length >= 1 && insights.numericalColumns.length >= 1) {
      suggestions.push({
        type: 'area',
        title: `${insights.numericalColumns[0]} trend over time`,
        xAxis: insights.dateColumns[0],
        yAxis: insights.numericalColumns[0],
        confidence: 0.7,
        reasoning: 'Area chart shows trend and magnitude over time'
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  private selectRecommended(suggestions: VisualizationSuggestion[]): VisualizationSuggestion {
    return suggestions[0] || {
      type: 'table',
      title: 'Data Table',
      confidence: 0.5,
      reasoning: 'Default table view for data display'
    };
  }

  private isNumeric(value: any): boolean {
    return !isNaN(parseFloat(value)) && isFinite(value);
  }

  private isDate(value: any): boolean {
    if (typeof value === 'string') {
      // Check common date patterns
      const datePatterns = [
        /^\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
        /^\d{2}\/\d{2}\/\d{4}/, // MM/DD/YYYY
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/ // ISO format
      ];
      
      return datePatterns.some(pattern => pattern.test(value)) && !isNaN(Date.parse(value));
    }
    
    return value instanceof Date && !isNaN(value.getTime());
  }
}