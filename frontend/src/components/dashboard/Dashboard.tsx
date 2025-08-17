'use client';

import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  RefreshCw, 
  Settings, 
  TrendingUp,
  Database,
  Sparkles,
  Clock,
  BarChart3
} from 'lucide-react';
import { QueryInput } from '@/components/query/QueryInput';
import { DataTable } from '@/components/results/DataTable';
import { VisualizationCard } from '@/components/results/VisualizationCard';
import { DataSummary } from '@/components/results/DataSummary';
import { ProgressIndicator, StatusBadge, MultiStepProgress } from '@/components/ui/ProgressIndicator';
import { ConversationInterface } from '@/components/conversation/ConversationInterface';
import { useAppStore } from '@/store/appStore';
import { apiService } from '@/services/api';
import { cn } from '@/utils/cn';
import { toast } from 'react-hot-toast';
import ExportService from '@/services/exportService';

export const Dashboard: React.FC = () => {
  const {
    currentQuery,
    queryResult,
    setQueryResult,
    visualizationRecommendations,
    setVisualizationRecommendations,
    isProcessing,
    setIsProcessing,
    progressSteps,
    setProgressSteps,
    currentStepIndex,
    setCurrentStepIndex,
    conversations,
    conversationId,
    setConversationId,
    addConversation,
    processingStatus,
    setProcessingStatus,
    queryHistory,
    addQueryToHistory
  } = useAppStore();

  const [showConversation, setShowConversation] = useState(false);
  const [activeTab, setActiveTab] = useState<'results' | 'visualization'>('results');
  const [dataSummary, setDataSummary] = useState<string>('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string>('');

  // Handle query submission
  const handleQuerySubmit = async (query: string) => {
    try {
      setIsProcessing(true);
      setProcessingStatus('processing');
      setActiveTab('results');
      
      // Reset summary state
      setDataSummary('');
      setSummaryError('');
      setSummaryLoading(false);
      
      // Add query to history
      addQueryToHistory({
        id: Date.now().toString(),
        query,
        timestamp: new Date(),
        results: null,
        executionTime: 0,
        status: 'processing'
      });

      // If we have a conversation, use it, otherwise create new one
      let currentConversationId = conversationId;
      if (!currentConversationId) {
        // For now, just generate a conversation ID
        currentConversationId = Date.now().toString();
        const newConversation = {
          id: currentConversationId,
          name: `Query: ${query.slice(0, 50)}...`,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          totalQueries: 0,
          preferredChartTypes: [],
          commonTableAccess: []
        };
        setConversationId(currentConversationId);
        addConversation(newConversation);
      }

      // Process the query
      const result = await apiService.processNaturalLanguageQuery(query, { 
        conversationId: currentConversationId,
        executeSQL: true,
        generateVisualization: true 
      });
      
      // Use real API result
      if (result.execution && result.execution.data) {
        const queryResult = {
          data: result.execution.data,
          columns: result.execution.columns || Object.keys(result.execution.data[0] || {}),
          rowCount: result.execution.rowCount || result.execution.data.length,
          executionTime: result.execution.executionTime || 0,
          query: result.query.sql || query
        };
        
        setQueryResult(queryResult);
        
        // Set visualization recommendations if available
        if (result.visualization) {
          setVisualizationRecommendations([{
            chartType: result.visualization.chartType || 'table',
            reasoning: result.visualization.reasoning || 'Default table view',
            confidence: result.visualization.confidence || 0.8,
            configurations: result.visualization.configurations || {}
          }]);
          
          // Set data summary if available
          if (result.visualization.summary) {
            setDataSummary(result.visualization.summary);
          }
        }
        
        // Generate data summary if we have execution results
        if (result.execution && result.execution.data && result.execution.data.length > 0) {
          setSummaryLoading(true);
          try {
            const summaryResult = await apiService.analyzeData({
              data: result.execution.data,
              columns: result.execution.columns,
              rowCount: result.execution.rowCount,
              executionTime: result.execution.executionTime,
              query: result.query.sql,
              originalQuery: query // Pass the original natural language query
            });
            
            if (summaryResult.summary) {
              setDataSummary(summaryResult.summary);
            }
          } catch (summaryError) {
            console.error('Summary generation failed:', summaryError);
            setSummaryError('Unable to generate data summary');
          } finally {
            setSummaryLoading(false);
          }
        }
      } else {
        // Fallback if execution failed but we have SQL
        if (result.query && result.query.sql) {
          toast.error(`Generated SQL but execution failed: ${result.query.sql}`);
        } else {
          throw new Error('Failed to process query');
        }
      }
      setProgressSteps([]);
      setCurrentStepIndex(0);
      setProcessingStatus('completed');
      
      // Success - query completed
      toast.success('Query completed successfully!');
      
    } catch (error) {
      console.error('Query processing failed:', error);
      setProcessingStatus('error');
      toast.error('Failed to process query. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle export
  const handleExport = async (format: 'png' | 'svg' | 'csv' | 'json') => {
    if (!queryResult) return;
    
    try {
      switch (format) {
        case 'csv':
          await ExportService.exportCSV(queryResult);
          break;
        case 'json':
          await ExportService.exportJSON(queryResult);
          break;
        default:
          toast.success(`Exporting as ${format.toUpperCase()}...`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(`Failed to export as ${format.toUpperCase()}`);
    }
  };

  // Get current visualization
  const currentVisualization = visualizationRecommendations[0];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img 
              src="/colony_logo.png" 
              alt="Colony Hardware" 
              className="h-10 w-auto"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Sales Advisor
              </h1>
              <p className="text-sm text-gray-600">
                Ask questions, get sales insights instantly
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">J. Strummer</p>
            <p className="text-xs text-gray-500">Senior Sales Rep</p>
          </div>
        </div>
      </div>

      {/* Query Input Section */}
      <QueryInput
        onSubmit={handleQuerySubmit}
        placeholder="Ask a question about your data..."
        disabled={isProcessing}
      />


      {/* Data Summary */}
      <DataSummary 
        summary={dataSummary}
        isLoading={summaryLoading}
        error={summaryError}
      />

      {/* Processing Status */}
      {isProcessing && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-lg">
                <Database className="h-4 w-4 text-[#2D7D32]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Processing Query
                </h3>
                <p className="text-sm text-gray-500">
                  Analyzing your question and generating results...
                </p>
              </div>
            </div>
            <StatusBadge status={processingStatus} />
          </div>
          
          <ProgressIndicator
            progress={currentStepIndex > 0 ? (currentStepIndex / progressSteps.length) * 100 : 25}
            status={processingStatus}
            showPercentage={true}
          />
          
          {progressSteps.length > 0 && (
            <div className="mt-4">
              <MultiStepProgress
                steps={progressSteps}
                currentStepIndex={currentStepIndex}
              />
            </div>
          )}
        </div>
      )}

      {/* Results Section */}
      {queryResult && (
        <div className="space-y-6">
          {/* Tab Navigation */}
          <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('results')}
              className={cn(
                'flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200',
                activeTab === 'results'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Database className="h-4 w-4" />
              <span>Query Results</span>
            </button>
            
            <button
              onClick={() => setActiveTab('visualization')}
              className={cn(
                'flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200',
                activeTab === 'visualization'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Visualization</span>
            </button>
          </div>

          {/* Content Area */}
          {activeTab === 'results' ? (
            <DataTable
              result={queryResult}
              onExport={handleExport}
              maxHeight="600px"
            />
          ) : (
            currentVisualization && (
              <VisualizationCard
                recommendation={currentVisualization}
                data={queryResult}
                onExport={handleExport}
              />
            )
          )}
        </div>
      )}

      {/* Conversation Interface */}
      {showConversation && (
        <div className="fixed inset-y-0 right-0 z-50 w-80 lg:w-96">
          <ConversationInterface 
            onClose={() => setShowConversation(false)}
            conversationId={conversationId}
          />
        </div>
      )}

      {/* Empty State */}
      {!queryResult && !isProcessing && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Database className="h-8 w-8 text-[#2D7D32]" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Colony Hardware Data Analytics
            </h3>
            <p className="text-gray-600 mb-6">
              Start by asking a question about your data in natural language. 
              Our AI will convert it to SQL and provide interactive visualizations.
            </p>
            <div className="flex flex-col space-y-2 text-sm text-gray-500">
              <p>Example questions:</p>
              <ul className="space-y-1">
                <li>• "Show me top selling products in Michigan"</li>
                <li>• "What are the sales trends for cleaning supplies?"</li>
                <li>• "Which customers have the highest order volumes?"</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};