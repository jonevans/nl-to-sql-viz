'use client';

import React from 'react';
import { 
  Search, 
  Clock, 
  Star, 
  Database, 
  BarChart3, 
  Settings,
  Plus,
  Filter,
  TrendingUp
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/utils/cn';
import { Query, Favorite } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface SidebarProps {
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const { 
    sidebarOpen, 
    setSidebarOpen,
    activeTab, 
    setActiveTab,
    queries,
    favorites,
    getFilteredQueries
  } = useAppStore();

  const filteredQueries = getFilteredQueries();

  if (!sidebarOpen) {
    return null;
  }

  const navigationItems = [
    {
      id: 'all' as const,
      label: 'All Queries',
      icon: Database,
      count: queries.length,
      color: 'text-gray-600'
    },
    {
      id: 'processing' as const,
      label: 'In Progress',
      icon: TrendingUp,
      count: queries.filter(q => q.status === 'processing' || q.status === 'pending').length,
      color: 'text-yellow-600'
    },
    {
      id: 'completed' as const,
      label: 'Completed',
      icon: BarChart3,
      count: queries.filter(q => q.status === 'completed').length,
      color: 'text-green-600'
    },
    {
      id: 'favorites' as const,
      label: 'Favorites',
      icon: Star,
      count: favorites.length,
      color: 'text-red-600'
    }
  ];

  return (
    <aside className={cn(
      'w-80 bg-white border-r border-gray-200 flex flex-col h-full',
      className
    )}>
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Query History</h2>
          <button className="btn-ghost p-1">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search queries..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="p-4 border-b border-gray-200">
        <div className="space-y-1">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200',
                activeTab === item.id
                  ? 'bg-red-50 text-red-700 border-r-2 border-red-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              )}
            >
              <div className="flex items-center space-x-3">
                <item.icon className={cn('h-4 w-4', item.color)} />
                <span>{item.label}</span>
              </div>
              {item.count > 0 && (
                <span className={cn(
                  'px-2 py-1 text-xs rounded-full',
                  activeTab === item.id
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-600'
                )}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Query List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4">
          <div className="space-y-3">
            {filteredQueries.length === 0 ? (
              <div className="text-center py-8">
                <Database className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  {activeTab === 'favorites' ? 'No favorites yet' : 'No queries yet'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {activeTab === 'favorites' 
                    ? 'Star queries to save them here' 
                    : 'Start by asking a question'}
                </p>
              </div>
            ) : (
              filteredQueries.map((query) => (
                <QueryItem key={query.id} query={query} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Performance Summary */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-600 space-y-2">
          <div className="flex justify-between">
            <span>Total Queries:</span>
            <span className="font-medium">{queries.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Success Rate:</span>
            <span className="font-medium text-green-600">
              {queries.length > 0 
                ? `${Math.round((queries.filter(q => q.status === 'completed').length / queries.length) * 100)}%`
                : '0%'
              }
            </span>
          </div>
          <div className="flex justify-between">
            <span>Avg. Confidence:</span>
            <span className="font-medium">
              {queries.length > 0
                ? `${Math.round(queries.reduce((sum, q) => sum + q.confidence, 0) / queries.length * 100)}%`
                : '0%'
              }
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

interface QueryItemProps {
  query: Query;
}

const QueryItem: React.FC<QueryItemProps> = ({ query }) => {
  const { setActiveQuery } = useAppStore();

  const getStatusColor = (status: Query['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  return (
    <div
      onClick={() => setActiveQuery(query)}
      className="card card-hover cursor-pointer p-3 space-y-2"
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-900 flex-1">
          {truncateText(query.naturalLanguage, 60)}
        </p>
        <span className={cn('status-badge text-xs ml-2', getStatusColor(query.status))}>
          {query.status}
        </span>
      </div>
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-1">
          <Clock className="h-3 w-3" />
          <span>{formatDistanceToNow(query.createdAt, { addSuffix: true })}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="metric-badge text-xs">
            {Math.round(query.confidence * 100)}%
          </span>
          {query.rowCount && (
            <span className="text-gray-400">
              {query.rowCount} rows
            </span>
          )}
        </div>
      </div>

      {query.executionTime && (
        <div className="text-xs text-gray-400">
          Executed in {query.executionTime}ms
        </div>
      )}
    </div>
  );
};