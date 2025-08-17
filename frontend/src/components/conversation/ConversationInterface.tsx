'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Bot, 
  User, 
  Sparkles,
  MessageCircle,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { apiService } from '@/services/api';
import { cn } from '@/utils/cn';
import { toast } from 'react-hot-toast';
import { Message } from '@/types';

interface ConversationInterfaceProps {
  onClose: () => void;
  conversationId: string | null;
}

export const ConversationInterface: React.FC<ConversationInterfaceProps> = ({
  onClose,
  conversationId
}) => {
  const {
    conversations,
    currentConversation,
    setCurrentConversation,
    addMessageToConversation,
    isProcessing,
    setIsProcessing
  } = useAppStore();

  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get current conversation
  const conversation = conversations.find(c => c.id === conversationId);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  }, [inputMessage]);

  // Handle message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isProcessing || !conversationId) return;

    const message = inputMessage.trim();
    setInputMessage('');
    setIsProcessing(true);
    setIsTyping(true);

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    addMessageToConversation(conversationId, userMessage);

    try {
      // Get AI response - using processNaturalLanguageQuery as placeholder
      const response = await apiService.processNaturalLanguageQuery(message, { conversationId });
      
      // Add AI response
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I processed your query and generated SQL.',
        timestamp: new Date(),
        suggestions: [], // Would come from API response
        queryRefinements: [] // Would come from API response
      };

      addMessageToConversation(conversationId, aiMessage);

    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message. Please try again.');
      
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your message. Please try again.',
        timestamp: new Date(),
        isError: true
      };

      addMessageToConversation(conversationId, errorMessage);
    } finally {
      setIsProcessing(false);
      setIsTyping(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Copy message content
  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Message copied to clipboard');
  };

  // Handle message feedback
  const handleFeedback = (messageId: string, type: 'positive' | 'negative') => {
    // This would typically update the message with feedback
    toast.success(`Feedback submitted: ${type}`);
  };

  // Apply query refinement
  const applyQueryRefinement = (refinement: string) => {
    // This would typically update the main query input
    toast.success('Query refinement applied');
  };

  return (
    <div className="h-full bg-white shadow-elegant-xl border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-red-50 to-red-100">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 bg-red-100 rounded-lg">
            <Bot className="h-4 w-4 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              AI Assistant
            </h3>
            <p className="text-sm text-gray-500">
              Refine your queries and get insights
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {conversation?.messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <MessageCircle className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm">
              Start a conversation to refine your queries and get better insights
            </p>
          </div>
        ) : (
          conversation?.messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex space-x-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center w-8 h-8 bg-red-100 rounded-lg">
                    <Bot className="h-4 w-4 text-red-600" />
                  </div>
                </div>
              )}
              
              <div className={cn(
                'flex-1 max-w-xs lg:max-w-sm',
                message.role === 'user' ? 'order-2' : 'order-1'
              )}>
                <div className={cn(
                  'px-4 py-2 rounded-lg',
                  message.role === 'user' 
                    ? 'bg-red-600 text-white' 
                    : message.isError
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-gray-100 text-gray-900'
                )}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                
                {/* Message Actions */}
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-xs text-gray-500">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                  
                  {message.role === 'assistant' && !message.isError && (
                    <>
                      <button
                        onClick={() => copyMessage(message.content)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleFeedback(message.id, 'positive')}
                        className="text-xs text-gray-400 hover:text-green-600"
                      >
                        <ThumbsUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleFeedback(message.id, 'negative')}
                        className="text-xs text-gray-400 hover:text-red-600"
                      >
                        <ThumbsDown className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>

                {/* Query Refinements */}
                {message.queryRefinements && message.queryRefinements.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-gray-700">
                      Suggested refinements:
                    </p>
                    {message.queryRefinements.map((refinement, index) => (
                      <button
                        key={index}
                        onClick={() => applyQueryRefinement(refinement)}
                        className="block w-full text-left px-3 py-2 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 transition-colors duration-200"
                      >
                        {refinement}
                      </button>
                    ))}
                  </div>
                )}

                {/* Suggestions */}
                {message.suggestions && message.suggestions.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-gray-700">
                      You might also ask:
                    </p>
                    {message.suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => setInputMessage(suggestion)}
                        className="block w-full text-left px-3 py-2 text-xs bg-gray-50 hover:bg-gray-100 text-gray-700 rounded border border-gray-200 transition-colors duration-200"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {message.role === 'user' && (
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-lg">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex space-x-3 justify-start">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center w-8 h-8 bg-red-100 rounded-lg">
                <Bot className="h-4 w-4 text-red-600" />
              </div>
            </div>
            <div className="flex-1 max-w-xs lg:max-w-sm">
              <div className="px-4 py-2 rounded-lg bg-gray-100 text-gray-900">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-300"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask for help refining your query..."
              disabled={isProcessing}
              rows={1}
              className="w-full px-4 py-3 pr-12 text-sm border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100 disabled:text-gray-500 min-h-[44px] max-h-[120px]"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isProcessing}
              className="absolute bottom-2 right-2 p-2 text-red-600 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Press Enter to send, Shift+Enter for new line</span>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>AI Online</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};