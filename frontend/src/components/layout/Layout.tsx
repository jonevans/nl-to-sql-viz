'use client';

import React, { useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/utils/cn';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { sidebarOpen, setSidebarOpen } = useAppStore();

  // Handle escape key to close sidebar on mobile
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [sidebarOpen, setSidebarOpen]);

  // Handle click outside to close sidebar on mobile
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const sidebar = document.getElementById('sidebar');
      const target = e.target as Node;
      
      if (
        sidebarOpen && 
        sidebar && 
        !sidebar.contains(target) &&
        window.innerWidth < 1024 // Only on mobile
      ) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sidebarOpen, setSidebarOpen]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Desktop Sidebar - Always visible on lg+ */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar - Only when open */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-y-0 left-0 z-50">
          <Sidebar />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header />

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};