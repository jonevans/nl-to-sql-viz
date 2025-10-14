'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface Summary {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  successRate: string;
  totalRowsReturned: number;
  avgExecutionTime: string;
  uniqueUsers: number;
  uniqueConversations: number;
}

export default function AdminStats() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [viewingEndpoint, setViewingEndpoint] = useState<string | null>(null);
  const [endpointData, setEndpointData] = useState<any>(null);
  const [endpointLoading, setEndpointLoading] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateRange.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange.endDate) params.append('endDate', dateRange.endDate);

      const response = await api.get(`/api/analytics/summary?${params.toString()}`);
      setSummary(response.data);
    } catch (error: any) {
      console.error('Failed to fetch summary:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const exportData = async (format: 'json' | 'csv') => {
    try {
      const params = new URLSearchParams();
      params.append('format', format);
      if (dateRange.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange.endDate) params.append('endDate', dateRange.endDate);

      const response = await api.get(`/api/analytics/export?${params.toString()}`, {
        responseType: format === 'csv' ? 'blob' : 'json'
      });

      if (format === 'csv') {
        // Download CSV
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-logs-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success('CSV exported successfully');
      } else {
        // Download JSON
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-logs-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success('JSON exported successfully');
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export data');
    }
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

  const applyDateFilter = () => {
    fetchSummary();
  };

  const viewEndpoint = async (endpoint: string) => {
    setViewingEndpoint(endpoint);
    setEndpointLoading(true);
    setEndpointData(null);

    try {
      const params = new URLSearchParams();
      if (dateRange.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange.endDate) params.append('endDate', dateRange.endDate);

      const response = await api.get(`${endpoint}?${params.toString()}`);
      setEndpointData(response.data);
    } catch (error: any) {
      console.error('Failed to fetch endpoint data:', error);
      toast.error('Failed to load endpoint data');
      setEndpointData({ error: error.message || 'Failed to fetch data' });
    } finally {
      setEndpointLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-2">POC Session Logs & Usage Statistics</p>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Date Range Filter</h2>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => handleDateChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2D7D32]"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => handleDateChange('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2D7D32]"
              />
            </div>
            <button
              onClick={applyDateFilter}
              className="px-6 py-2 bg-[#2D7D32] text-white rounded-md hover:bg-[#1B5E20] transition-colors"
            >
              Apply Filter
            </button>
            <button
              onClick={() => {
                setDateRange({ startDate: '', endDate: '' });
                setTimeout(fetchSummary, 100);
              }}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2D7D32]"></div>
          </div>
        ) : summary ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">Total Queries</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{summary.totalQueries}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">Success Rate</div>
              <div className="text-3xl font-bold text-green-600 mt-2">{summary.successRate}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">Unique Users</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{summary.uniqueUsers}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">Avg Execution</div>
              <div className="text-3xl font-bold text-blue-600 mt-2">{summary.avgExecutionTime}</div>
            </div>
          </div>
        ) : null}

        {/* API Endpoints */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Analytics API Endpoints</h2>
          <div className="space-y-4">
            {[
              {
                title: 'Usage Summary',
                endpoint: '/api/analytics/summary',
                description: 'Overall statistics including total queries, success rate, and unique users'
              },
              {
                title: 'Top Queries',
                endpoint: '/api/analytics/top-queries',
                description: 'Most frequently asked questions with execution times and success rates'
              },
              {
                title: 'Daily Usage',
                endpoint: '/api/analytics/daily-usage',
                description: 'Day-by-day breakdown of query volume and performance'
              },
              {
                title: 'User Activity',
                endpoint: '/api/analytics/user-activity',
                description: 'Per-user statistics showing engagement and success rates'
              },
              {
                title: 'All Sessions',
                endpoint: '/api/analytics/sessions',
                description: 'Complete session logs with filtering and pagination'
              }
            ].map((item) => (
              <div key={item.endpoint} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{item.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                    <code className="text-xs text-[#2D7D32] bg-green-50 px-2 py-1 rounded mt-2 inline-block">
                      GET {item.endpoint}
                    </code>
                  </div>
                  <button
                    onClick={() => viewEndpoint(item.endpoint)}
                    className="px-4 py-2 text-sm bg-[#2D7D32] text-white rounded hover:bg-[#1B5E20] transition-colors whitespace-nowrap"
                  >
                    View Data
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Endpoint Data Modal */}
        {viewingEndpoint && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="bg-[#2D7D32] text-white p-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">API Response: {viewingEndpoint}</h3>
                <button
                  onClick={() => setViewingEndpoint(null)}
                  className="text-white hover:bg-[#1B5E20] rounded p-1"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 overflow-auto flex-1">
                {endpointLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2D7D32]"></div>
                  </div>
                ) : endpointData ? (
                  <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-xs">
                    {JSON.stringify(endpointData, null, 2)}
                  </pre>
                ) : (
                  <p className="text-gray-500">No data available</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reset POC Terms Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Reset POC Terms</h2>
          <p className="text-gray-600 mb-4">
            Reset POC terms acceptance for a specific user (they'll see the terms modal again on next login)
          </p>
          <div className="flex gap-4 items-end">
            <div className="flex-1 max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User Email Address
              </label>
              <input
                type="email"
                id="resetEmail"
                placeholder="user@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2D7D32]"
              />
            </div>
            <button
              onClick={async () => {
                const emailInput = document.getElementById('resetEmail') as HTMLInputElement;
                const email = emailInput?.value.trim();

                if (!email) {
                  toast.error('Please enter an email address');
                  return;
                }

                if (!email.includes('@')) {
                  toast.error('Please enter a valid email address');
                  return;
                }

                try {
                  await api.get(`/api/auth/admin/reset-poc-terms/${encodeURIComponent(email)}`);
                  toast.success(`POC terms reset for ${email}`);
                  emailInput.value = '';
                } catch (error: any) {
                  console.error('Failed to reset POC terms:', error);
                  toast.error(error.response?.data?.error || 'Failed to reset POC terms');
                }
              }}
              className="px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors whitespace-nowrap"
            >
              Reset Terms
            </button>
          </div>
        </div>

        {/* Export Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Export Data</h2>
          <p className="text-gray-600 mb-4">
            Download all session logs for analysis in Excel or other tools
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => exportData('csv')}
              className="px-6 py-2 bg-[#2D7D32] text-white rounded-md hover:bg-[#1B5E20] transition-colors"
            >
              Export as CSV
            </button>
            <button
              onClick={() => exportData('json')}
              className="px-6 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 transition-colors"
            >
              Export as JSON
            </button>
          </div>
        </div>

        {/* Documentation Link */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="h-5 w-5 text-blue-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-blue-900">Complete API Documentation</h3>
              <p className="text-sm text-blue-700 mt-1">
                For detailed API documentation including query parameters and response formats, see{' '}
                <code className="bg-blue-100 px-1 py-0.5 rounded">ANALYTICS.md</code> in the project root.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
