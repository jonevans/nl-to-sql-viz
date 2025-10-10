'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Database, Download, Eye, EyeOff, User } from 'lucide-react';
import { DataTable } from '../results/DataTable';
import { cn } from '@/utils/cn';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  data?: any[];
  timestamp: Date;
  metadata?: {
    rowCount?: number;
    executionTime?: number;
  };
}

interface ChatInterfaceProps {
  className?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ className }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const [showSplitView, setShowSplitView] = useState(false);
  const [splitViewData, setSplitViewData] = useState<{
    data: any[];
    columns: string[];
    sql: string;
    metadata?: any;
  } | null>(null);
  const [splitViewHeight, setSplitViewHeight] = useState(350); // Fixed height in pixels
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive (only if user hasn't scrolled up)
  useEffect(() => {
    if (autoScroll) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages, autoScroll]);


  // Initialize conversation
  useEffect(() => {
    initConversation();
  }, []);

  const initConversation = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:8000/api/conversation/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      const data = await response.json();
      setConversationId(data.conversationId);
    } catch (error) {
      console.error('Failed to initialize conversation:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !conversationId || isLoading) return;

    const userInput = input; // Store input before clearing
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userInput,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:8000/api/conversation/${conversationId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ message: userInput })
      });

      const data = await response.json();

      // Check if this is a reset action
      if (data.metadata?.action === 'reset') {
        // Clear messages and update conversation ID
        setMessages([]);
        if (data.metadata.newConversationId) {
          setConversationId(data.metadata.newConversationId);
        }
        
        // Add welcome message
        const welcomeMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          metadata: data.metadata
        };
        setMessages([welcomeMessage]);
      } else {
        // Normal message handling
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          sql: data.sql,
          data: data.data,
          timestamp: new Date(),
          metadata: data.metadata
        };

        setMessages(prev => [...prev, assistantMessage]);
        
        // Auto-show split view for large datasets (>20 rows)
        if (data.data && data.data.length > 20) {
          setSplitViewData({
            data: data.data,
            columns: Object.keys(data.data[0]),
            sql: data.sql || '',
            metadata: data.metadata
          });
          setShowSplitView(true);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDataExpansion = (messageId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const exportData = (data: any[], format: 'csv' | 'json') => {
    if (format === 'csv') {
      const headers = Object.keys(data[0]);
      const csv = [
        headers.join(','),
        ...data.map(row => headers.map(h => row[h]).join(','))
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `colony-data-${Date.now()}.csv`;
      a.click();
    } else {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `colony-data-${Date.now()}.json`;
      a.click();
    }
  };

  return (
    <div className={cn('flex flex-col h-[calc(100vh-200px)]', className)}>
      {/* Chat container */}
      <div className="flex flex-col bg-white h-full">
        {/* Messages Area */}
        <div 
          ref={messagesContainerRef}
          className={cn(
            "overflow-y-auto p-6 space-y-4",
            showSplitView ? "flex-shrink-0" : "flex-1"
          )}
          style={showSplitView ? { height: `calc(100% - ${splitViewHeight}px - 73px)` } : undefined}
        >
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Database className="h-8 w-8 text-[#2D7D32]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Welcome to Sales Advisor
              </h3>
              <p className="text-gray-600 mb-6">
                Ask me anything about your Colony Hardware data
              </p>
              <div className="text-left max-w-md mx-auto space-y-2">
                <p className="text-sm text-gray-500">Try asking:</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• How many products did we sell in June in Michigan?</li>
                  <li>• What are our top selling categories?</li>
                  <li>• Show me sales trends for power tools</li>
                  <li>• Which customers have the highest order volumes?</li>
                </ul>
                <p className="text-xs text-gray-400 mt-4">
                  💡 Tip: Type "start over" or "reset" anytime to begin a fresh conversation
                </p>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div className={cn(
                'max-w-[80%] rounded-lg p-4 shadow-sm',
                message.role === 'user' 
                  ? 'bg-[#2D7D32] text-white' 
                  : 'bg-white border border-gray-100'
              )}>
                {/* Message Header */}
                <div className="flex items-center space-x-2 mb-2">
                  {message.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <div className="flex items-center justify-center w-4 h-4 bg-[#2D7D32] rounded-full">
                      <span className="text-white text-xs font-bold">A</span>
                    </div>
                  )}
                  <span className="text-xs opacity-75">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* Message Content */}
                <div className="whitespace-pre-wrap">{message.content}</div>

                {/* Large dataset indicator */}
                {message.role === 'assistant' && message.data && message.data.length > 20 && (
                  <div className="mt-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Database className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {message.metadata?.rowCount || message.data.length} rows displayed in data view below
                        </span>
                      </div>
                      {!showSplitView && (
                        <button
                          onClick={() => {
                            setSplitViewData({
                              data: message.data!,
                              columns: Object.keys(message.data![0]),
                              sql: message.sql || '',
                              metadata: message.metadata
                            });
                            setShowSplitView(true);
                          }}
                          className="text-xs text-[#2D7D32] hover:underline"
                        >
                          Show Data View
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Data Preview for Assistant Messages - Only for small datasets */}
                {message.role === 'assistant' && message.data && message.data.length > 0 && message.data.length <= 20 && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-xs",
                        message.role === 'user' ? "text-white opacity-75" : "text-gray-500"
                      )}>
                        {message.metadata?.rowCount} results • {message.metadata?.executionTime}ms
                      </span>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => toggleDataExpansion(message.id)}
                          className="text-xs flex items-center space-x-1 hover:opacity-80"
                        >
                          {expandedMessages.has(message.id) ? (
                            <>
                              <EyeOff className="h-3 w-3" />
                              <span>Hide Data</span>
                            </>
                          ) : (
                            <>
                              <Eye className="h-3 w-3" />
                              <span>View Data</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => exportData(message.data!, 'csv')}
                          className="text-xs flex items-center space-x-1 hover:opacity-80"
                        >
                          <Download className="h-3 w-3" />
                          <span>CSV</span>
                        </button>
                      </div>
                    </div>

                    {/* Expandable Data Table */}
                    {expandedMessages.has(message.id) && (
                      <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden bg-white max-h-[300px] overflow-y-auto">
                        <DataTable
                          result={{
                            data: message.data.slice(0, 100), // Limit to 100 rows for performance
                            columns: Object.keys(message.data[0]),
                            rowCount: message.metadata?.rowCount || message.data.length,
                            executionTime: message.metadata?.executionTime || 0,
                            query: message.sql || ''
                          }}
                          maxHeight="280px"
                          showSearch={false}
                          showExport={false}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* SQL Preview */}
                {message.role === 'assistant' && message.sql && (
                  <details className="mt-3">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">View SQL Query</summary>
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 font-mono overflow-x-auto">
                      <pre className="whitespace-pre-wrap">{message.sql}</pre>
                    </div>
                  </details>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg p-4 shadow-sm bg-white border border-gray-100">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center justify-center w-4 h-4 bg-[#2D7D32] rounded-full">
                    <span className="text-white text-xs font-bold">A</span>
                  </div>
                  <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                  <span className="text-sm text-gray-500">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Data View - Inline between messages and input */}
        {showSplitView && splitViewData && (
          <div 
            className="border-t border-gray-200 bg-white"
            style={{ height: `${splitViewHeight}px` }}
          >
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="px-4 py-2 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-gray-700">
                    Data View: {splitViewData.metadata?.rowCount || splitViewData.data.length} rows
                  </span>
                  <span className="text-xs text-gray-500">
                    {splitViewData.metadata?.executionTime}ms
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => exportData(splitViewData.data, 'csv')}
                    className="text-xs px-3 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded flex items-center space-x-1"
                  >
                    <Download className="h-3 w-3" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={() => setShowSplitView(false)}
                    className="text-xs px-3 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded"
                  >
                    ✕ Close
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="flex-1 overflow-auto">
                <DataTable
                  result={{
                    data: splitViewData.data,
                    columns: splitViewData.columns,
                    rowCount: splitViewData.metadata?.rowCount || splitViewData.data.length,
                    executionTime: splitViewData.metadata?.executionTime || 0,
                    query: splitViewData.sql
                  }}
                  maxHeight="100%"
                  showSearch={true}
                  showExport={false}
                />
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-gray-100 p-4 bg-white flex-shrink-0">
          <div className="flex space-x-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask a question about your data..."
              className="flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D7D32] focus:border-[#2D7D32] focus:bg-white"
              rows={1}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className={cn(
                'px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors',
                'bg-[#2D7D32] text-white hover:bg-[#236627]',
                'disabled:bg-gray-300 disabled:cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};