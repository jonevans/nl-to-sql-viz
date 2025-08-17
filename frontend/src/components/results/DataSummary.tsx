import React from 'react';
import { BarChart3, Loader2, AlertCircle, TrendingUp, Lightbulb, Target, Search } from 'lucide-react';
import { cn } from '@/utils/cn';

interface DataSummaryProps {
  summary?: string;
  isLoading?: boolean;
  error?: string;
  className?: string;
}

export const DataSummary: React.FC<DataSummaryProps> = ({
  summary,
  isLoading = false,
  error,
  className
}) => {
  // Don't render anything if there's no content and not loading
  if (!summary && !isLoading && !error) {
    return null;
  }

  // Parse structured summary into sections
  const parseSummary = (text: string) => {
    const sections = [
      { emoji: '📊', title: 'KEY FINDINGS', icon: BarChart3 },
      { emoji: '💡', title: 'BUSINESS INSIGHTS', icon: TrendingUp },
      { emoji: '⚠️', title: 'OBSERVATIONS & CONCERNS', icon: AlertCircle },
      { emoji: '🎯', title: 'RECOMMENDATIONS', icon: Target },
      { emoji: '🔍', title: 'FOLLOW-UP ANALYSIS', icon: Search }
    ];

    const parsedSections: Array<{title: string, content: string, icon: any, emoji: string}> = [];
    
    sections.forEach(section => {
      // Look for section in text using either emoji or title
      const emojiRegex = new RegExp(`${section.emoji}\\s*${section.title}([\\s\\S]*?)(?=${sections.find(s => s !== section)?.emoji}|$)`, 'i');
      const titleRegex = new RegExp(`${section.title}([\\s\\S]*?)(?=${sections.find(s => s !== section)?.title}|$)`, 'i');
      
      let match = text.match(emojiRegex) || text.match(titleRegex);
      
      if (match && match[1]) {
        const content = match[1].trim();
        if (content && content.length > 10) { // Only include substantial content
          parsedSections.push({
            title: section.title,
            content: content,
            icon: section.icon,
            emoji: section.emoji
          });
        }
      }
    });

    return parsedSections;
  };

  const sections = summary ? parseSummary(summary) : [];

  return (
    <div className={cn('card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200', className)}>
      <div className="flex items-start space-x-3 mb-4">
        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg flex-shrink-0">
          {isLoading ? (
            <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
          ) : error ? (
            <AlertCircle className="h-4 w-4 text-red-600" />
          ) : (
            <BarChart3 className="h-4 w-4 text-blue-600" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-blue-900">
            {isLoading ? 'Analyzing Data...' : error ? 'Analysis Error' : 'Data Analysis & Insights'}
          </h3>
          <p className="text-sm text-blue-600">
            {isLoading ? 'Our AI analyst is examining your data...' : error ? 'Unable to generate analysis' : 'Professional insights and recommendations'}
          </p>
        </div>
      </div>
      
      {isLoading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-blue-200 rounded w-3/4"></div>
          <div className="h-4 bg-blue-200 rounded w-1/2"></div>
          <div className="h-4 bg-blue-200 rounded w-5/6"></div>
        </div>
      ) : error ? (
        <div className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      ) : sections.length > 0 ? (
        <div className="space-y-4">
          {sections.map((section, index) => (
            <div key={index} className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-lg">{section.emoji}</span>
                <h4 className="font-semibold text-gray-900 text-sm">{section.title}</h4>
              </div>
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {section.content}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-blue-800 leading-relaxed whitespace-pre-line">
          {summary}
        </div>
      )}
    </div>
  );
};

export default DataSummary;