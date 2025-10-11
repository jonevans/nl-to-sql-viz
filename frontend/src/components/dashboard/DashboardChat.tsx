'use client';

import React, { useState } from 'react';
import { ChatInterface } from '@/components/chat/ChatInterface';
import AdminStats from '@/components/admin/AdminStats';
import { useAuth } from '@/context/AuthContext';

export const DashboardChat: React.FC = () => {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const isAdmin = user?.role === 'admin';

  const handleStatsClick = () => {
    setShowStats(true);
    setShowDropdown(false);
  };

  const handleBackToChat = () => {
    setShowStats(false);
  };

  if (showStats) {
    return (
      <div>
        <div className="max-w-7xl mx-auto mb-4">
          <button
            onClick={handleBackToChat}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Chat
          </button>
        </div>
        <AdminStats />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="mb-6">
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
          <div className="text-right flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="text-right hover:bg-gray-50 rounded-md p-2 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-500">{user?.company || 'Colony Hardware'}</p>
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                  {isAdmin && (
                    <button
                      onClick={handleStatsClick}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      📊 Analytics Stats
                    </button>
                  )}
                  <button
                    onClick={() => {
                      logout();
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chat Interface */}
      <ChatInterface />
    </div>
  );
};