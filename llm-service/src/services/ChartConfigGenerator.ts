import { QueryResult } from '../types';
import { DataInsights } from './DataAnalysisService';

export interface ChartConfiguration {
  chartjs: any;
  recharts: any;
  d3: any;
}

export class ChartConfigGenerator {
  private static instance: ChartConfigGenerator;

  static getInstance(): ChartConfigGenerator {
    if (!ChartConfigGenerator.instance) {
      ChartConfigGenerator.instance = new ChartConfigGenerator();
    }
    return ChartConfigGenerator.instance;
  }

  generateConfigurations(
    chartType: string,
    queryResult: QueryResult,
    insights: DataInsights
  ): ChartConfiguration {
    return {
      chartjs: this.generateChartJS(chartType, queryResult, insights),
      recharts: this.generateRecharts(chartType, queryResult, insights),
      d3: this.generateD3(chartType, queryResult, insights)
    };
  }

  // Chart.js Configurations
  private generateChartJS(chartType: string, queryResult: QueryResult, insights: DataInsights): any {
    const baseConfig = {
      type: chartType,
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' as const },
          title: { display: true, text: `${chartType.charAt(0).toUpperCase()}${chartType.slice(1)} Chart` }
        }
      }
    };

    switch (chartType) {
      case 'bar':
        return this.generateChartJSBar(baseConfig, queryResult, insights);
      case 'line':
        return this.generateChartJSLine(baseConfig, queryResult, insights);
      case 'pie':
        return this.generateChartJSPie(baseConfig, queryResult, insights);
      case 'scatter':
        return this.generateChartJSScatter(baseConfig, queryResult, insights);
      case 'area':
        return this.generateChartJSArea(baseConfig, queryResult, insights);
      default:
        return baseConfig;
    }
  }

  private generateChartJSBar(config: any, queryResult: QueryResult, insights: DataInsights): any {
    const categoricalCol = insights.categoricalColumns[0];
    const numericalCol = insights.numericalColumns[0];

    if (!categoricalCol || !numericalCol) {
      // Fallback: use first two columns
      config.data.labels = queryResult.data.map((_, index) => `Row ${index + 1}`);
      config.data.datasets = [{
        label: queryResult.columns[0],
        data: queryResult.data.map(row => Object.values(row)[0]),
        backgroundColor: 'rgba(54, 162, 235, 0.8)'
      }];
      return config;
    }

    const categories = [...new Set(queryResult.data.map(row => row[categoricalCol]))];
    const aggregatedData = this.aggregateByCategory(queryResult.data, categoricalCol, numericalCol);

    config.data.labels = categories;
    config.data.datasets = [{
      label: numericalCol,
      data: categories.map(cat => aggregatedData[cat] || 0),
      backgroundColor: this.generateColors(categories.length, 0.8),
      borderColor: this.generateColors(categories.length, 1.0),
      borderWidth: 1
    }];

    config.options.scales = {
      y: { beginAtZero: true, title: { display: true, text: numericalCol } },
      x: { title: { display: true, text: categoricalCol } }
    };

    return config;
  }

  private generateChartJSLine(config: any, queryResult: QueryResult, insights: DataInsights): any {
    const dateCol = insights.dateColumns[0];
    const numericalCol = insights.numericalColumns[0];

    if (!dateCol || !numericalCol) {
      // Use index as x-axis
      config.data.labels = queryResult.data.map((_, index) => index + 1);
      config.data.datasets = [{
        label: queryResult.columns[0],
        data: queryResult.data.map(row => Object.values(row)[0]),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1
      }];
      return config;
    }

    const sortedData = queryResult.data
      .filter(row => row[dateCol] && row[numericalCol] !== null)
      .sort((a, b) => new Date(a[dateCol]).getTime() - new Date(b[dateCol]).getTime());

    config.data.labels = sortedData.map(row => this.formatDate(row[dateCol]));
    config.data.datasets = [{
      label: numericalCol,
      data: sortedData.map(row => row[numericalCol]),
      borderColor: 'rgba(75, 192, 192, 1)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      tension: 0.1,
      fill: false
    }];

    config.options.scales = {
      y: { title: { display: true, text: numericalCol } },
      x: { title: { display: true, text: dateCol } }
    };

    return config;
  }

  private generateChartJSPie(config: any, queryResult: QueryResult, insights: DataInsights): any {
    const categoricalCol = insights.categoricalColumns[0];
    const numericalCol = insights.numericalColumns[0];

    if (!categoricalCol || !numericalCol) {
      // Use first column values as labels, second as data
      const labels = queryResult.data.map(row => Object.values(row)[0]);
      const data = queryResult.data.map(row => Object.values(row)[1] || 1);
      
      config.data.labels = labels;
      config.data.datasets = [{
        data: data,
        backgroundColor: this.generateColors(labels.length, 0.8)
      }];
      return config;
    }

    const aggregatedData = this.aggregateByCategory(queryResult.data, categoricalCol, numericalCol);
    const labels = Object.keys(aggregatedData);

    config.type = 'pie';
    config.data.labels = labels;
    config.data.datasets = [{
      data: Object.values(aggregatedData),
      backgroundColor: this.generateColors(labels.length, 0.8),
      borderWidth: 1
    }];

    return config;
  }

  private generateChartJSScatter(config: any, queryResult: QueryResult, insights: DataInsights): any {
    const xCol = insights.numericalColumns[0];
    const yCol = insights.numericalColumns[1];

    if (!xCol || !yCol) {
      return config;
    }

    config.type = 'scatter';
    config.data.datasets = [{
      label: `${yCol} vs ${xCol}`,
      data: queryResult.data
        .filter(row => row[xCol] !== null && row[yCol] !== null)
        .map(row => ({ x: row[xCol], y: row[yCol] })),
      backgroundColor: 'rgba(255, 99, 132, 0.6)'
    }];

    config.options.scales = {
      x: { title: { display: true, text: xCol } },
      y: { title: { display: true, text: yCol } }
    };

    return config;
  }

  private generateChartJSArea(config: any, queryResult: QueryResult, insights: DataInsights): any {
    const lineConfig = this.generateChartJSLine(config, queryResult, insights);
    lineConfig.data.datasets[0].fill = true;
    lineConfig.data.datasets[0].backgroundColor = 'rgba(75, 192, 192, 0.3)';
    return lineConfig;
  }

  // Recharts Configurations
  private generateRecharts(chartType: string, queryResult: QueryResult, insights: DataInsights): any {
    const baseConfig = {
      type: chartType,
      data: queryResult.data,
      width: 800,
      height: 400,
      margin: { top: 20, right: 30, bottom: 20, left: 20 }
    };

    switch (chartType) {
      case 'bar':
        return this.generateRechartsBar(baseConfig, queryResult, insights);
      case 'line':
        return this.generateRechartsLine(baseConfig, queryResult, insights);
      case 'pie':
        return this.generateRechartsPie(baseConfig, queryResult, insights);
      case 'scatter':
        return this.generateRechartsScatter(baseConfig, queryResult, insights);
      case 'area':
        return this.generateRechartsArea(baseConfig, queryResult, insights);
      default:
        return baseConfig;
    }
  }

  private generateRechartsBar(config: any, queryResult: QueryResult, insights: DataInsights): any {
    const categoricalCol = insights.categoricalColumns[0];
    const numericalCol = insights.numericalColumns[0];

    return {
      ...config,
      xDataKey: categoricalCol || queryResult.columns[0],
      yDataKey: numericalCol || queryResult.columns[1],
      bars: [{
        dataKey: numericalCol || queryResult.columns[1],
        fill: '#8884d8',
        name: numericalCol || queryResult.columns[1]
      }]
    };
  }

  private generateRechartsLine(config: any, queryResult: QueryResult, insights: DataInsights): any {
    const dateCol = insights.dateColumns[0];
    const numericalCol = insights.numericalColumns[0];

    return {
      ...config,
      xDataKey: dateCol || queryResult.columns[0],
      lines: [{
        dataKey: numericalCol || queryResult.columns[1],
        stroke: '#8884d8',
        strokeWidth: 2,
        dot: false,
        name: numericalCol || queryResult.columns[1]
      }]
    };
  }

  private generateRechartsPie(config: any, queryResult: QueryResult, insights: DataInsights): any {
    const categoricalCol = insights.categoricalColumns[0];
    const numericalCol = insights.numericalColumns[0];

    return {
      ...config,
      dataKey: numericalCol || queryResult.columns[1],
      nameKey: categoricalCol || queryResult.columns[0],
      colors: ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00']
    };
  }

  private generateRechartsScatter(config: any, queryResult: QueryResult, insights: DataInsights): any {
    const xCol = insights.numericalColumns[0];
    const yCol = insights.numericalColumns[1];

    return {
      ...config,
      xDataKey: xCol || queryResult.columns[0],
      yDataKey: yCol || queryResult.columns[1],
      fill: '#8884d8'
    };
  }

  private generateRechartsArea(config: any, queryResult: QueryResult, insights: DataInsights): any {
    const lineConfig = this.generateRechartsLine(config, queryResult, insights);
    return {
      ...lineConfig,
      areas: [{
        dataKey: lineConfig.lines[0].dataKey,
        stroke: '#8884d8',
        fill: '#8884d8',
        fillOpacity: 0.3
      }]
    };
  }

  // D3 Configurations
  private generateD3(chartType: string, queryResult: QueryResult, insights: DataInsights): any {
    const baseConfig = {
      type: chartType,
      data: queryResult.data,
      dimensions: {
        width: 800,
        height: 400,
        margin: { top: 20, right: 30, bottom: 40, left: 40 }
      }
    };

    switch (chartType) {
      case 'bar':
        return this.generateD3Bar(baseConfig, queryResult, insights);
      case 'line':
        return this.generateD3Line(baseConfig, queryResult, insights);
      case 'pie':
        return this.generateD3Pie(baseConfig, queryResult, insights);
      case 'scatter':
        return this.generateD3Scatter(baseConfig, queryResult, insights);
      case 'area':
        return this.generateD3Area(baseConfig, queryResult, insights);
      default:
        return baseConfig;
    }
  }

  private generateD3Bar(config: any, queryResult: QueryResult, insights: DataInsights): any {
    const categoricalCol = insights.categoricalColumns[0];
    const numericalCol = insights.numericalColumns[0];

    return {
      ...config,
      scales: {
        x: {
          type: 'scaleBand',
          domain: categoricalCol || queryResult.columns[0],
          range: [0, config.dimensions.width - config.dimensions.margin.left - config.dimensions.margin.right],
          padding: 0.1
        },
        y: {
          type: 'scaleLinear',
          domain: numericalCol || queryResult.columns[1],
          range: [config.dimensions.height - config.dimensions.margin.top - config.dimensions.margin.bottom, 0]
        }
      },
      axes: {
        x: { orient: 'bottom', label: categoricalCol || queryResult.columns[0] },
        y: { orient: 'left', label: numericalCol || queryResult.columns[1] }
      },
      marks: {
        type: 'rect',
        fill: '#69b3a2',
        stroke: '#000',
        strokeWidth: 1
      }
    };
  }

  private generateD3Line(config: any, queryResult: QueryResult, insights: DataInsights): any {
    const dateCol = insights.dateColumns[0];
    const numericalCol = insights.numericalColumns[0];

    return {
      ...config,
      scales: {
        x: {
          type: 'scaleTime',
          domain: dateCol || queryResult.columns[0],
          range: [0, config.dimensions.width - config.dimensions.margin.left - config.dimensions.margin.right]
        },
        y: {
          type: 'scaleLinear',
          domain: numericalCol || queryResult.columns[1],
          range: [config.dimensions.height - config.dimensions.margin.top - config.dimensions.margin.bottom, 0]
        }
      },
      axes: {
        x: { orient: 'bottom', label: dateCol || queryResult.columns[0] },
        y: { orient: 'left', label: numericalCol || queryResult.columns[1] }
      },
      marks: {
        type: 'line',
        stroke: '#69b3a2',
        strokeWidth: 2,
        fill: 'none'
      }
    };
  }

  private generateD3Pie(config: any, queryResult: QueryResult, insights: DataInsights): any {
    const categoricalCol = insights.categoricalColumns[0];
    const numericalCol = insights.numericalColumns[0];

    return {
      ...config,
      centerX: config.dimensions.width / 2,
      centerY: config.dimensions.height / 2,
      radius: Math.min(config.dimensions.width, config.dimensions.height) / 3,
      valueKey: numericalCol || queryResult.columns[1],
      labelKey: categoricalCol || queryResult.columns[0],
      colors: ['#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b']
    };
  }

  private generateD3Scatter(config: any, queryResult: QueryResult, insights: DataInsights): any {
    const xCol = insights.numericalColumns[0];
    const yCol = insights.numericalColumns[1];

    return {
      ...config,
      scales: {
        x: {
          type: 'scaleLinear',
          domain: xCol || queryResult.columns[0],
          range: [0, config.dimensions.width - config.dimensions.margin.left - config.dimensions.margin.right]
        },
        y: {
          type: 'scaleLinear',
          domain: yCol || queryResult.columns[1],
          range: [config.dimensions.height - config.dimensions.margin.top - config.dimensions.margin.bottom, 0]
        }
      },
      axes: {
        x: { orient: 'bottom', label: xCol || queryResult.columns[0] },
        y: { orient: 'left', label: yCol || queryResult.columns[1] }
      },
      marks: {
        type: 'circle',
        fill: '#69b3a2',
        radius: 4,
        stroke: '#000',
        strokeWidth: 1
      }
    };
  }

  private generateD3Area(config: any, queryResult: QueryResult, insights: DataInsights): any {
    const lineConfig = this.generateD3Line(config, queryResult, insights);
    return {
      ...lineConfig,
      marks: {
        type: 'area',
        fill: '#69b3a2',
        fillOpacity: 0.7,
        stroke: '#69b3a2',
        strokeWidth: 2
      }
    };
  }

  // Utility methods
  private aggregateByCategory(data: any[], categoryCol: string, valueCol: string): Record<string, number> {
    return data.reduce((acc, row) => {
      const category = row[categoryCol];
      const value = parseFloat(row[valueCol]) || 0;
      acc[category] = (acc[category] || 0) + value;
      return acc;
    }, {} as Record<string, number>);
  }

  private generateColors(count: number, alpha: number): string[] {
    const baseColors = [
      `rgba(255, 99, 132, ${alpha})`,   // Red
      `rgba(54, 162, 235, ${alpha})`,   // Blue
      `rgba(255, 205, 86, ${alpha})`,   // Yellow
      `rgba(75, 192, 192, ${alpha})`,   // Green
      `rgba(153, 102, 255, ${alpha})`,  // Purple
      `rgba(255, 159, 64, ${alpha})`,   // Orange
      `rgba(199, 199, 199, ${alpha})`,  // Grey
      `rgba(83, 102, 255, ${alpha})`,   // Indigo
    ];

    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
      colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
  }

  private formatDate(dateValue: any): string {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return String(dateValue);
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}