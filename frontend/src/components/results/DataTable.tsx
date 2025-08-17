'use client';

import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Search, 
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Eye,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { QueryResult } from '@/types';
import ExportService from '@/services/exportService';

interface DataTableProps {
  result: QueryResult;
  className?: string;
  maxHeight?: string;
  showPagination?: boolean;
  showSearch?: boolean;
  showExport?: boolean;
  onExport?: (format: 'csv' | 'json') => void;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  column: string;
  direction: SortDirection;
}

export const DataTable: React.FC<DataTableProps> = ({
  result,
  className,
  maxHeight = '400px',
  showPagination = true,
  showSearch = true,
  showExport = true,
  onExport
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: '', direction: null });
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = result.data;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply sorting
    if (sortConfig.column && sortConfig.direction) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.column];
        const bVal = b[sortConfig.column];
        
        if (aVal === bVal) return 0;
        
        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }
        
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [result.data, searchTerm, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = processedData.slice(startIndex, startIndex + pageSize);

  // Handle sorting
  const handleSort = (column: string) => {
    setSortConfig(prev => ({
      column,
      direction:
        prev.column === column
          ? prev.direction === 'asc'
            ? 'desc'
            : prev.direction === 'desc'
            ? null
            : 'asc'
          : 'asc'
    }));
  };

  // Handle row selection
  const handleRowSelect = (index: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRows(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === paginatedData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedData.map((_, index) => startIndex + index)));
    }
  };

  // Format cell value
  const formatCellValue = (value: any) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">null</span>;
    }
    if (typeof value === 'boolean') {
      return <span className={value ? 'text-green-600' : 'text-red-600'}>{String(value)}</span>;
    }
    if (typeof value === 'number') {
      return <span className="font-mono">{value.toLocaleString()}</span>;
    }
    if (typeof value === 'string' && value.length > 50) {
      return (
        <span className="truncate" title={value}>
          {value.substring(0, 50)}...
        </span>
      );
    }
    return String(value);
  };

  // Get sort icon
  const getSortIcon = (column: string) => {
    if (sortConfig.column !== column) {
      return <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="h-3 w-3 text-red-600" />;
    }
    if (sortConfig.direction === 'desc') {
      return <ArrowDown className="h-3 w-3 text-red-600" />;
    }
    return <ArrowUpDown className="h-3 w-3 opacity-50" />;
  };

  return (
    <div className={cn('card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Query Results</h3>
          <p className="text-sm text-gray-500">
            {processedData.length} of {result.rowCount} rows
            {searchTerm && ` (filtered from ${result.data.length})`}
            • Executed in {result.executionTime}ms
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          {showExport && (
            <div className="relative">
              <button
                onClick={() => ExportService.exportCSV(result)}
                className="btn-secondary text-sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </button>
            </div>
          )}
          
          {selectedRows.size > 0 && (
            <span className="text-sm text-gray-600">
              {selectedRows.size} selected
            </span>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      {showSearch && (
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search in results..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D7D32] focus:border-[#2D7D32]"
            />
          </div>
          
          <button className="btn-secondary text-sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </button>
        </div>
      )}

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight }}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === paginatedData.length && paginatedData.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                </th>
                {result.columns.map((column) => (
                  <th
                    key={column}
                    className="table-header group cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort(column)}
                  >
                    <div className="flex items-center space-x-1">
                      <span className="truncate">{column}</span>
                      {getSortIcon(column)}
                    </div>
                  </th>
                ))}
                <th className="table-header w-10">
                  <MoreHorizontal className="h-4 w-4" />
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedData.map((row, index) => {
                const globalIndex = startIndex + index;
                const isSelected = selectedRows.has(globalIndex);
                
                return (
                  <tr
                    key={globalIndex}
                    className={cn(
                      'hover:bg-gray-50 transition-colors duration-150',
                      isSelected && 'bg-red-50'
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleRowSelect(globalIndex)}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                    </td>
                    {result.columns.map((column) => (
                      <td key={column} className="table-cell">
                        {formatCellValue(row[column])}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {processedData.length === 0 && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {searchTerm ? 'No results found for your search' : 'No data to display'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {startIndex + 1}-{Math.min(startIndex + pageSize, processedData.length)} of{' '}
              {processedData.length}
            </span>
            
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (currentPage <= 4) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 3) {
                    pageNum = totalPages - 6 + i;
                  } else {
                    pageNum = currentPage - 3 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        'px-3 py-1 text-sm rounded transition-colors duration-150',
                        currentPage === pageNum
                          ? 'bg-red-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};