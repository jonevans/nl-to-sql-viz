'use client';

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  AreaChart,
  Area
} from 'recharts';
import { 
  BarChart3, 
  LineChart as LineChartIcon, 
  PieChart as PieChartIcon,
  Download,
  Maximize2,
  Settings,
  RefreshCw,
  TrendingUp,
  Lightbulb
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { VisualizationRecommendation, QueryResult } from '@/types';
import ExportService from '@/services/exportService';

interface VisualizationCardProps {
  recommendation: VisualizationRecommendation;
  data: QueryResult;
  className?: string;
  onExport?: (format: 'png' | 'svg') => void;
}

const chartTypeIcons = {
  bar: BarChart3,
  line: LineChartIcon,
  pie: PieChartIcon,
  scatter: TrendingUp,
  area: TrendingUp
};

const chartColors = [
  '#DC2626', // Red (primary)
  '#EA580C', // Orange
  '#D97706', // Amber
  '#65A30D', // Lime
  '#059669', // Emerald
  '#0891B2', // Cyan
  '#2563EB', // Blue
  '#7C3AED', // Violet
  '#C026D3', // Fuchsia
  '#DB2777'  // Pink
];

export const VisualizationCard: React.FC<VisualizationCardProps> = ({
  recommendation,
  data,
  className,
  onExport
}) => {
  const [selectedChartType, setSelectedChartType] = useState(recommendation.chartType);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartRef = React.useRef<HTMLDivElement>(null);

  // Prepare data for different chart types
  const prepareChartData = () => {
    if (!data.data || data.data.length === 0) return [];

    // For most charts, we'll use the data as-is
    // In a real implementation, you'd analyze the data structure more carefully
    return data.data;
  };

  const chartData = prepareChartData();

  // Calculate the maximum value across all numeric columns for proper Y-axis scaling
  const getMaxValue = () => {
    if (!chartData.length) return 100; // Default fallback
    
    const numericColumns = data.columns.slice(1); // Exclude first column (usually categories)
    let maxValue = 0;
    
    chartData.forEach(row => {
      numericColumns.forEach(column => {
        // Handle both string and numeric values
        let value = row[column];
        if (typeof value === 'string') {
          value = parseFloat(value);
        }
        value = Number(value);
        
        if (!isNaN(value) && isFinite(value) && value > maxValue) {
          maxValue = value;
        }
      });
    });
    
    // Add 20% padding to the max value for better visualization
    const paddedMax = Math.ceil(maxValue * 1.2);
    return paddedMax > 0 ? paddedMax : 100; // Ensure we have a reasonable default
  };

  const maxValue = getMaxValue();
  
  // Debug logging to help troubleshoot Y-axis scaling
  React.useEffect(() => {
    if (chartData.length > 0) {
      console.log('Chart Data:', chartData);
      console.log('Data Columns:', data.columns);
      console.log('Calculated Max Value:', maxValue);
    }
  }, [chartData, maxValue]);

  // Get suggested chart types based on data
  const getSuggestedChartTypes = () => {
    const types = ['bar', 'line', 'pie', 'scatter', 'area'];
    return types.filter(type => type !== selectedChartType);
  };

  // Render the appropriate chart
  const renderChart = () => {
    if (!chartData.length) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No data available for visualization</p>
          </div>
        </div>
      );
    }

    const chartProps = {
      data: chartData,
      margin: { top: 20, right: 30, left: 20, bottom: 5 }
    };

    switch (selectedChartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis 
                dataKey={data.columns[0]} 
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
                domain={[0, maxValue]}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
              {data.columns.slice(1).map((column, index) => (
                <Bar 
                  key={column}
                  dataKey={column} 
                  fill={chartColors[index % chartColors.length]}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis 
                dataKey={data.columns[0]} 
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
                domain={[0, maxValue]}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
              {data.columns.slice(1).map((column, index) => (
                <Line 
                  key={column}
                  type="monotone" 
                  dataKey={column} 
                  stroke={chartColors[index % chartColors.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'pie':
        const pieData = chartData.map((item, index) => ({
          name: item[data.columns[0]],
          value: item[data.columns[1]],
          fill: chartColors[index % chartColors.length]
        }));

        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis 
                dataKey={data.columns[0]} 
                type="number"
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
              />
              <YAxis 
                dataKey={data.columns[1]}
                type="number"
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
              />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Scatter 
                name="Data Points" 
                data={chartData} 
                fill={chartColors[0]}
              />
            </ScatterChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis 
                dataKey={data.columns[0]} 
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
                domain={[0, maxValue]}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
              {data.columns.slice(1).map((column, index) => (
                <Area 
                  key={column}
                  type="monotone" 
                  dataKey={column} 
                  stackId="1"
                  stroke={chartColors[index % chartColors.length]}
                  fill={chartColors[index % chartColors.length]}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      default:
        // Fallback to bar chart
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis 
                dataKey={data.columns[0]} 
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
                domain={[0, maxValue]}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
              {data.columns.slice(1).map((column, index) => (
                <Bar 
                  key={column}
                  dataKey={column} 
                  fill={`hsl(${(index * 60) % 360}, 70%, 50%)`}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className={cn('card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 bg-red-100 rounded-lg">
            {React.createElement(chartTypeIcons[selectedChartType as keyof typeof chartTypeIcons] || BarChart3, {
              className: "h-4 w-4 text-red-600"
            })}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 capitalize">
              {selectedChartType} Chart
            </h3>
            <p className="text-sm text-gray-500">
              AI Recommended • {Math.round(recommendation.confidence * 100)}% confidence
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => ExportService.exportChartPNG(chartRef.current)}
            className="btn-ghost p-2"
            title="Export chart as PNG"
          >
            <Download className="h-4 w-4" />
          </button>
          
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="btn-ghost p-2"
            title="Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          
          <button className="btn-ghost p-2" title="Chart settings">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* AI Recommendation Info */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-2">
          <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-blue-900 font-medium">AI Recommendation</p>
            <p className="text-sm text-blue-700 mt-1">{recommendation.reasoning}</p>
          </div>
        </div>
      </div>

      {/* Chart Type Selector */}
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-sm font-medium text-gray-700">Chart Type:</span>
        <div className="flex items-center space-x-1">
          {['bar', 'line', 'pie', 'scatter', 'area'].map((type) => {
            const IconComponent = chartTypeIcons[type as keyof typeof chartTypeIcons] || BarChart3;
            return (
              <button
                key={type}
                onClick={() => setSelectedChartType(type)}
                className={cn(
                  'flex items-center space-x-1 px-3 py-1.5 text-sm rounded-lg transition-colors duration-200',
                  selectedChartType === type
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <IconComponent className="h-3 w-3" />
                <span className="capitalize">{type}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div ref={chartRef} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        {renderChart()}
      </div>

      {/* Chart Insights */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900">{data.rowCount}</p>
          <p className="text-sm text-gray-500">Data Points</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900">{data.columns.length}</p>
          <p className="text-sm text-gray-500">Columns</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900">{data.executionTime}ms</p>
          <p className="text-sm text-gray-500">Query Time</p>
        </div>
      </div>

      {/* Alternative Chart Suggestions */}
      {getSuggestedChartTypes().length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-2">Try these alternatives:</p>
          <div className="flex flex-wrap gap-2">
            {getSuggestedChartTypes().slice(0, 3).map((type) => {
              const IconComponent = chartTypeIcons[type as keyof typeof chartTypeIcons] || BarChart3;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedChartType(type)}
                  className="flex items-center space-x-1 px-2 py-1 text-xs bg-white border border-gray-200 rounded text-gray-600 hover:bg-gray-50 transition-colors duration-200"
                >
                  <IconComponent className="h-3 w-3" />
                  <span className="capitalize">{type}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};