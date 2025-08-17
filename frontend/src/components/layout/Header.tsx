'use client';

import React from 'react';
import { Menu, X, Database, Bell, Settings, User } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/utils/cn';

interface HeaderProps {
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({ className }) => {
  const { sidebarOpen, setSidebarOpen } = useAppStore();
  
  return (
    <header className={cn(
      'bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm',
      className
    )}>
      {/* Left Section */}
      <div className="flex items-center space-x-4">
        {/* Mobile menu button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 lg:hidden"
        >
          {sidebarOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>

        {/* Desktop sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden lg:flex p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Logo and App Name */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 bg-red-600 rounded-lg">
            <Database className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              NL to SQL
            </h1>
            <p className="text-xs text-gray-500 hidden sm:block">
              Natural Language Query Interface
            </p>
          </div>
        </div>
      </div>

      {/* Center Section - Search/Status */}
      <div className="hidden md:flex items-center space-x-4">
        <div className="text-sm text-gray-600">
          Ready to process queries
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-gray-500">Connected</span>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-2">
        {/* Performance Badge */}
        <div className="hidden sm:flex metric-badge">
          <span className="text-xs font-medium">Top 25%</span>
        </div>

        {/* Notifications */}
        <button className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* Settings */}
        <button className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
          <Settings className="h-5 w-5" />
        </button>

        {/* User Profile */}
        <div className="flex items-center space-x-3 pl-2 border-l border-gray-200">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-gray-900">Welcome back!</p>
            <p className="text-xs text-gray-500">Data Analyst</p>
          </div>
          <button className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
            <User className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>
    </header>
  );
};