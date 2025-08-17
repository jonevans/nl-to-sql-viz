'use client';

import { Dashboard } from '@/components/dashboard/Dashboard';
import { Toaster } from 'react-hot-toast';

export default function Home() {
  return (
    <>
      <div className="min-h-screen bg-gray-50 p-6">
        <Dashboard />
      </div>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'text-sm',
          duration: 4000,
          style: {
            background: '#fff',
            color: '#374151',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e5e7eb',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </>
  );
}