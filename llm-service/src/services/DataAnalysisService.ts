import { VisualizationRecommendation, QueryResult } from '../types';

export interface DataInsights {
  rowCount: number;
  columnCount: number;
  dataTypes: Record<string, string>;
  statisticalSummary: Record<string, any>;
  categoricalColumns: string[];
  numericalColumns: string[];
  dateColumns: string[];
  uniqueValueCounts: Record<string, number>;
  nullPercentages: Record<string, number>;
  correlations?: Record<string, number>;
}

export class DataAnalysisService {
  private static instance: DataAnalysisService;

  static getInstance(): DataAnalysisService {
    if (!DataAnalysisService.instance) {
      DataAnalysisService.instance = new DataAnalysisService();
    }
    return DataAnalysisService.instance;
  }

  async analyzeData(queryResult: QueryResult): Promise<DataInsights> {
    const { data, columns } = queryResult;
    
    if (!data || data.length === 0) {
      throw new Error('No data available for analysis');
    }

    return {
      rowCount: data.length,
      columnCount: columns.length,
      dataTypes: this.inferDataTypes(data, columns),
      statisticalSummary: this.generateStatisticalSummary(data, columns),
      categoricalColumns: this.identifyCategoricalColumns(data, columns),
      numericalColumns: this.identifyNumericalColumns(data, columns),
      dateColumns: this.identifyDateColumns(data, columns),
      uniqueValueCounts: this.calculateUniqueValueCounts(data, columns),
      nullPercentages: this.calculateNullPercentages(data, columns),
      correlations: this.calculateCorrelations(data, columns)
    };
  }

  async recommendVisualization(insights: DataInsights, queryResult: QueryResult): Promise<VisualizationRecommendation> {
    const recommendations = this.generateVisualizationOptions(insights, queryResult);
    const best = this.selectBestVisualization(recommendations, insights);
    
    return {
      chartType: best.type,
      reasoning: best.reasoning,
      confidence: best.confidence,
      configurations: await this.generateChartConfigurations(best, queryResult, insights)
    };
  }

  private inferDataTypes(data: any[], columns: string[]): Record<string, string> {
    const types: Record<string, string> = {};
    
    columns.forEach(column => {
      const values = data.map(row => row[column]).filter(val => val !== null && val !== undefined);
      
      if (values.length === 0) {
        types[column] = 'unknown';
        return;
      }

      const sample = values[0];
      
      if (this.isDate(sample)) {
        types[column] = 'date';
      } else if (typeof sample === 'number' || this.isNumericString(sample)) {
        types[column] = 'number';
      } else if (typeof sample === 'boolean') {
        types[column] = 'boolean';
      } else {
        types[column] = 'string';
      }
    });

    return types;
  }

  private generateStatisticalSummary(data: any[], columns: string[]): Record<string, any> {
    const summary: Record<string, any> = {};
    
    columns.forEach(column => {
      const values = data.map(row => row[column]).filter(val => val !== null && val !== undefined);
      
      if (values.length === 0) {
        summary[column] = { count: 0 };
        return;
      }

      const columnSummary: any = {
        count: values.length,
        nullCount: data.length - values.length
      };

      if (this.isNumericColumn(values)) {
        const numbers = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
        columnSummary.min = Math.min(...numbers);
        columnSummary.max = Math.max(...numbers);
        columnSummary.mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
        columnSummary.median = this.calculateMedian(numbers);
        columnSummary.stdDev = this.calculateStandardDeviation(numbers);
      } else {
        const uniqueValues = new Set(values);
        columnSummary.uniqueCount = uniqueValues.size;
        columnSummary.mostCommon = this.findMostCommonValue(values);
      }

      summary[column] = columnSummary;
    });

    return summary;
  }

  private identifyCategoricalColumns(data: any[], columns: string[]): string[] {
    return columns.filter(column => {
      const values = data.map(row => row[column]).filter(val => val !== null && val !== undefined);
      const uniqueValues = new Set(values);
      
      // Consider categorical if:
      // 1. Less than 20% unique values or
      // 2. Less than 50 unique values total or
      // 3. All values are strings and less than 20 unique values
      const uniqueRatio = uniqueValues.size / values.length;
      const isString = values.every(val => typeof val === 'string');
      
      return (uniqueRatio < 0.2) || 
             (uniqueValues.size < 50) || 
             (isString && uniqueValues.size < 20);
    });
  }

  private identifyNumericalColumns(data: any[], columns: string[]): string[] {
    return columns.filter(column => {
      const values = data.map(row => row[column]).filter(val => val !== null && val !== undefined);
      return values.length > 0 && this.isNumericColumn(values);
    });
  }

  private identifyDateColumns(data: any[], columns: string[]): string[] {
    return columns.filter(column => {
      const values = data.map(row => row[column]).filter(val => val !== null && val !== undefined);
      if (values.length === 0) return false;
      
      // Check if at least 80% of values are valid dates
      const validDates = values.filter(val => this.isDate(val));
      return validDates.length / values.length >= 0.8;
    });
  }

  private calculateUniqueValueCounts(data: any[], columns: string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    
    columns.forEach(column => {
      const values = data.map(row => row[column]).filter(val => val !== null && val !== undefined);
      counts[column] = new Set(values).size;
    });

    return counts;
  }

  private calculateNullPercentages(data: any[], columns: string[]): Record<string, number> {
    const percentages: Record<string, number> = {};
    
    columns.forEach(column => {
      const nullCount = data.filter(row => row[column] === null || row[column] === undefined).length;
      percentages[column] = (nullCount / data.length) * 100;
    });

    return percentages;
  }

  private calculateCorrelations(data: any[], columns: string[]): Record<string, number> {
    const numericalCols = this.identifyNumericalColumns(data, columns);
    const correlations: Record<string, number> = {};

    for (let i = 0; i < numericalCols.length; i++) {
      for (let j = i + 1; j < numericalCols.length; j++) {
        const col1 = numericalCols[i];
        const col2 = numericalCols[j];
        
        const correlation = this.pearsonCorrelation(
          data.map(row => parseFloat(row[col1])).filter(n => !isNaN(n)),
          data.map(row => parseFloat(row[col2])).filter(n => !isNaN(n))
        );
        
        correlations[`${col1}_${col2}`] = correlation;
      }
    }

    return correlations;
  }

  private generateVisualizationOptions(insights: DataInsights, queryResult: QueryResult): Array<{
    type: string;
    reasoning: string;
    confidence: number;
    suitability: number;
  }> {
    const options: Array<{type: string; reasoning: string; confidence: number; suitability: number}> = [];
    
    // Table view - always applicable
    options.push({
      type: 'table',
      reasoning: 'Table provides comprehensive view of all data',
      confidence: 0.9,
      suitability: 1.0
    });

    // Bar chart - good for categorical vs numerical
    if (insights.categoricalColumns.length >= 1 && insights.numericalColumns.length >= 1) {
      options.push({
        type: 'bar',
        reasoning: 'Bar chart excellent for comparing categories against numerical values',
        confidence: 0.95,
        suitability: 0.9
      });
    }

    // Line chart - excellent for time series
    if (insights.dateColumns.length >= 1 && insights.numericalColumns.length >= 1) {
      options.push({
        type: 'line',
        reasoning: 'Line chart ideal for showing trends over time',
        confidence: 0.95,
        suitability: 0.95
      });
    }

    // Pie chart - good for categorical proportions
    if (insights.categoricalColumns.length === 1 && insights.numericalColumns.length === 1) {
      const categoricalCol = insights.categoricalColumns[0];
      const uniqueCount = insights.uniqueValueCounts[categoricalCol];
      
      if (uniqueCount <= 8) { // Don't suggest pie charts for too many categories
        options.push({
          type: 'pie',
          reasoning: 'Pie chart effective for showing proportional breakdown',
          confidence: 0.8,
          suitability: 0.7
        });
      }
    }

    // Scatter plot - great for correlation analysis
    if (insights.numericalColumns.length >= 2) {
      options.push({
        type: 'scatter',
        reasoning: 'Scatter plot reveals relationships between numerical variables',
        confidence: 0.85,
        suitability: 0.8
      });
    }

    // Area chart - good for cumulative data over time
    if (insights.dateColumns.length >= 1 && insights.numericalColumns.length >= 1) {
      options.push({
        type: 'area',
        reasoning: 'Area chart shows magnitude and trend over time',
        confidence: 0.8,
        suitability: 0.75
      });
    }

    // Heatmap - good for correlation matrices or dense data
    if (insights.numericalColumns.length >= 3 || 
        (insights.categoricalColumns.length >= 2 && insights.numericalColumns.length >= 1)) {
      options.push({
        type: 'heatmap',
        reasoning: 'Heatmap visualizes patterns in multi-dimensional data',
        confidence: 0.7,
        suitability: 0.6
      });
    }

    return options;
  }

  private selectBestVisualization(options: Array<{type: string; reasoning: string; confidence: number; suitability: number}>, insights: DataInsights): {
    type: string;
    reasoning: string;
    confidence: number;
  } {
    // Calculate composite score combining confidence and suitability
    const scored = options.map(option => ({
      ...option,
      score: option.confidence * 0.6 + option.suitability * 0.4
    }));

    // Sort by score and return the best
    scored.sort((a, b) => b.score - a.score);
    
    const best = scored[0];
    return {
      type: best.type,
      reasoning: best.reasoning,
      confidence: best.confidence
    };
  }

  private async generateChartConfigurations(
    recommendation: {type: string; reasoning: string; confidence: number},
    queryResult: QueryResult,
    insights: DataInsights
  ): Promise<{chartjs?: any; d3?: any; recharts?: any}> {
    const configurations: {chartjs?: any; d3?: any; recharts?: any} = {};

    // We'll implement chart configuration generators next
    // For now, return basic configurations
    
    configurations.chartjs = this.generateChartJSConfig(recommendation.type, queryResult, insights);
    configurations.recharts = this.generateRechartsConfig(recommendation.type, queryResult, insights);
    configurations.d3 = this.generateD3Config(recommendation.type, queryResult, insights);

    return configurations;
  }

  private generateChartJSConfig(chartType: string, queryResult: QueryResult, insights: DataInsights): any {
    const baseConfig = {
      type: chartType,
      data: {
        labels: [],
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    };

    switch (chartType) {
      case 'bar':
        return this.generateBarChartConfig(baseConfig, queryResult, insights);
      case 'line':
        return this.generateLineChartConfig(baseConfig, queryResult, insights);
      case 'pie':
        return this.generatePieChartConfig(baseConfig, queryResult, insights);
      default:
        return baseConfig;
    }
  }

  private generateRechartsConfig(chartType: string, queryResult: QueryResult, insights: DataInsights): any {
    // Basic Recharts configuration structure
    return {
      type: chartType,
      data: queryResult.data,
      dataKey: insights.numericalColumns[0] || queryResult.columns[0],
      nameKey: insights.categoricalColumns[0] || queryResult.columns[0]
    };
  }

  private generateD3Config(chartType: string, queryResult: QueryResult, insights: DataInsights): any {
    // Basic D3 configuration structure
    return {
      type: chartType,
      data: queryResult.data,
      dimensions: {
        width: 800,
        height: 400,
        margin: { top: 20, right: 30, bottom: 40, left: 40 }
      },
      scales: {
        x: insights.categoricalColumns[0] || queryResult.columns[0],
        y: insights.numericalColumns[0] || queryResult.columns[1]
      }
    };
  }

  private generateBarChartConfig(baseConfig: any, queryResult: QueryResult, insights: DataInsights): any {
    const categoricalCol = insights.categoricalColumns[0];
    const numericalCol = insights.numericalColumns[0];

    if (categoricalCol && numericalCol) {
      baseConfig.data.labels = [...new Set(queryResult.data.map(row => row[categoricalCol]))];
      baseConfig.data.datasets = [{
        label: numericalCol,
        data: baseConfig.data.labels.map(label => {
          const rows = queryResult.data.filter(row => row[categoricalCol] === label);
          return rows.reduce((sum, row) => sum + (row[numericalCol] || 0), 0);
        }),
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }];
    }

    return baseConfig;
  }

  private generateLineChartConfig(baseConfig: any, queryResult: QueryResult, insights: DataInsights): any {
    const dateCol = insights.dateColumns[0];
    const numericalCol = insights.numericalColumns[0];

    if (dateCol && numericalCol) {
      const sortedData = queryResult.data.sort((a, b) => new Date(a[dateCol]).getTime() - new Date(b[dateCol]).getTime());
      
      baseConfig.data.labels = sortedData.map(row => row[dateCol]);
      baseConfig.data.datasets = [{
        label: numericalCol,
        data: sortedData.map(row => row[numericalCol]),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1
      }];
    }

    return baseConfig;
  }

  private generatePieChartConfig(baseConfig: any, queryResult: QueryResult, insights: DataInsights): any {
    const categoricalCol = insights.categoricalColumns[0];
    const numericalCol = insights.numericalColumns[0];

    if (categoricalCol && numericalCol) {
      const aggregatedData = this.aggregateDataByCategory(queryResult.data, categoricalCol, numericalCol);
      
      baseConfig.type = 'pie';
      baseConfig.data.labels = Object.keys(aggregatedData);
      baseConfig.data.datasets = [{
        data: Object.values(aggregatedData),
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 205, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
          'rgba(255, 159, 64, 0.8)'
        ]
      }];
    }

    return baseConfig;
  }

  // Utility methods
  private isDate(value: any): boolean {
    if (value instanceof Date) return !isNaN(value.getTime());
    if (typeof value === 'string') {
      const date = new Date(value);
      return !isNaN(date.getTime()) && isNaN(Number(value));
    }
    return false;
  }

  private isNumericString(value: any): boolean {
    return typeof value === 'string' && !isNaN(parseFloat(value)) && isFinite(parseFloat(value));
  }

  private isNumericColumn(values: any[]): boolean {
    const numericValues = values.filter(val => 
      typeof val === 'number' || this.isNumericString(val)
    );
    return numericValues.length / values.length >= 0.8; // 80% numeric threshold
  }

  private calculateMedian(numbers: number[]): number {
    const sorted = numbers.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private calculateStandardDeviation(numbers: number[]): number {
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const variance = numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length;
    return Math.sqrt(variance);
  }

  private findMostCommonValue(values: any[]): any {
    const counts = values.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private aggregateDataByCategory(data: any[], categoryCol: string, valueCol: string): Record<string, number> {
    return data.reduce((acc, row) => {
      const category = row[categoryCol];
      const value = parseFloat(row[valueCol]) || 0;
      acc[category] = (acc[category] || 0) + value;
      return acc;
    }, {} as Record<string, number>);
  }
}