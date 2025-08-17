'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Loader2, 
  Lightbulb, 
  ArrowRight, 
  Sparkles,
  MessageSquare,
  Database
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/utils/cn';
import { Suggestion } from '@/types';
import { apiService } from '@/services/api';
import { toast } from 'react-hot-toast';

interface QueryInputProps {
  onSubmit?: (query: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const QueryInput: React.FC<QueryInputProps> = ({
  onSubmit,
  placeholder = "Ask a question about your data...",
  disabled = false,
  className
}) => {
  const {
    currentQuery,
    setCurrentQuery,
    suggestions,
    setSuggestions,
    showSuggestions,
    setShowSuggestions,
    isProcessing,
    conversationId
  } = useAppStore();

  const [localQuery, setLocalQuery] = useState('');
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [localQuery]);

  // Fetch suggestions with debouncing
  useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (localQuery.trim().length > 2) {
      const timer = setTimeout(async () => {
        try {
          const response = await apiService.getSuggestions(
            localQuery.trim(),
            conversationId || undefined,
            {
              maxSuggestions: 8,
              includeTemplates: true,
              includeSchemaAware: true,
              includeContextual: true
            }
          );
          setSuggestions(response.suggestions || []);
          setShowSuggestions(true);
        } catch (error) {
          console.warn('Failed to fetch suggestions:', error);
          setSuggestions([]);
        }
      }, 300);
      
      setDebounceTimer(timer);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [localQuery]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setLocalQuery(value);
    setCurrentQuery(value);
    setSelectedSuggestionIndex(-1);
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localQuery.trim() || isProcessing || disabled) return;

    setShowSuggestions(false);
    onSubmit?.(localQuery.trim());
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: Suggestion) => {
    setLocalQuery(suggestion.text);
    setCurrentQuery(suggestion.text);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle Enter key for submission
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      if (showSuggestions && suggestions.length > 0 && selectedSuggestionIndex >= 0) {
        // Select highlighted suggestion
        handleSuggestionSelect(suggestions[selectedSuggestionIndex]);
      } else {
        // Submit the query
        if (localQuery.trim() && !isProcessing && !disabled) {
          setShowSuggestions(false);
          onSubmit?.(localQuery.trim());
        }
      }
      return;
    }

    // Handle suggestion navigation
    if (showSuggestions && suggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedSuggestionIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedSuggestionIndex(prev => 
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'Escape':
          setShowSuggestions(false);
          setSelectedSuggestionIndex(-1);
          break;
      }
    }
  };

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getSuggestionIcon = (type: Suggestion['type']) => {
    switch (type) {
      case 'completion':
        return <ArrowRight className="h-3 w-3 text-blue-500" />;
      case 'refinement':
        return <Sparkles className="h-3 w-3 text-purple-500" />;
      case 'alternative':
        return <Lightbulb className="h-3 w-3 text-yellow-500" />;
      case 'followup':
        return <MessageSquare className="h-3 w-3 text-green-500" />;
      default:
        return <Database className="h-3 w-3 text-gray-500" />;
    }
  };

  return (
    <div className={cn('relative', className)}>
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Header */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-lg">
              <Database className="h-4 w-4 text-[#2D7D32]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Ask Your Data a Question
              </h3>
              <p className="text-sm text-gray-500">
                Type your question in natural language and get SQL results
              </p>
            </div>
          </div>

          {/* Input Area */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={localQuery}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isProcessing}
              rows={3}
              className={cn(
                'w-full px-4 py-3 text-base border border-gray-300 rounded-lg resize-none',
                'focus:ring-2 focus:ring-[#2D7D32] focus:border-[#2D7D32] transition-colors duration-200',
                'placeholder-gray-400 disabled:bg-gray-50 disabled:text-gray-500',
                'min-h-[80px] max-h-[200px]'
              )}
            />
            
            {/* Submit Button */}
            <button
              type="submit"
              disabled={!localQuery.trim() || isProcessing || disabled}
              className={cn(
                'absolute bottom-3 right-3 p-2 rounded-lg transition-all duration-200',
                'bg-[#2D7D32] hover:bg-[#236627] text-white',
                'disabled:bg-gray-300 disabled:cursor-not-allowed',
                'focus:ring-2 focus:ring-[#2D7D32] focus:ring-offset-2'
              )}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span>Press Enter to submit</span>
              <span>•</span>
              <span>Shift + Enter for new line</span>
            </div>
            <div className="flex items-center space-x-2">
              {suggestions.length > 0 && (
                <span className="text-xs text-gray-500">
                  {suggestions.length} suggestions
                </span>
              )}
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-gray-500">AI Ready</span>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-elegant-lg z-50 max-h-80 overflow-y-auto custom-scrollbar"
        >
          <div className="p-2">
            <div className="flex items-center space-x-2 px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-100">
              <Lightbulb className="h-3 w-3" />
              <span>Suggestions</span>
            </div>
            <div className="mt-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionSelect(suggestion)}
                  className={cn(
                    'w-full flex items-start space-x-3 px-3 py-2 text-left rounded-lg transition-colors duration-150',
                    'hover:bg-gray-50',
                    selectedSuggestionIndex === index && 'bg-green-50 border border-green-200'
                  )}
                >
                  <div className="flex-shrink-0 mt-1">
                    {getSuggestionIcon(suggestion.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">
                      {suggestion.text}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-gray-500 capitalize">
                        {suggestion.type}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">
                        {Math.round(suggestion.confidence * 100)}% confidence
                      </span>
                    </div>
                    {suggestion.reasoning && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                        {suggestion.reasoning}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};