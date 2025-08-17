'use client';

import React from 'react';
import { Check, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { QueryStep } from '@/types';

interface ProgressIndicatorProps {
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  className?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
  status,
  className,
  showPercentage = true,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-600';
      case 'processing':
        return 'bg-red-600';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-300';
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {showPercentage && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            {status === 'completed' ? 'Completed' : 
             status === 'processing' ? 'Processing...' : 
             status === 'error' ? 'Error' : 'Pending'}
          </span>
          <span className="font-medium text-gray-900">
            {Math.round(progress)}%
          </span>
        </div>
      )}
      
      <div className={cn('progress-bar', sizeClasses[size])}>
        <div
          className={cn('progress-fill', getStatusColor())}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
};

interface StatusBadgeProps {
  status: 'pending' | 'processing' | 'completed' | 'error';
  className?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className,
  size = 'md'
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          icon: Check,
          className: 'status-completed',
          label: 'Completed'
        };
      case 'processing':
        return {
          icon: Loader2,
          className: 'status-processing',
          label: 'Processing',
          animate: true
        };
      case 'error':
        return {
          icon: AlertCircle,
          className: 'status-error',
          label: 'Error'
        };
      default:
        return {
          icon: Clock,
          className: 'bg-gray-100 text-gray-800',
          label: 'Pending'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <span className={cn('status-badge', config.className, className)}>
      <Icon className={cn(iconSize, config.animate && 'animate-spin')} />
      <span className="ml-1">{config.label}</span>
    </span>
  );
};

interface MultiStepProgressProps {
  steps: QueryStep[];
  currentStepIndex?: number;
  className?: string;
}

export const MultiStepProgress: React.FC<MultiStepProgressProps> = ({
  steps,
  currentStepIndex = -1,
  className
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900">Query Processing Steps</h4>
        <span className="text-xs text-gray-500">
          {Math.max(0, currentStepIndex)} of {steps.length} completed
        </span>
      </div>
      
      <div className="space-y-3">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isPending = index > currentStepIndex;
          
          let stepStatus: 'pending' | 'processing' | 'completed' | 'error' = 'pending';
          if (step.status === 'error') stepStatus = 'error';
          else if (isCompleted) stepStatus = 'completed';
          else if (isCurrent) stepStatus = 'processing';

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-start space-x-3 p-3 rounded-lg border transition-colors duration-200',
                isCompleted && 'bg-green-50 border-green-200',
                isCurrent && 'bg-red-50 border-red-200',
                isPending && 'bg-gray-50 border-gray-200',
                step.status === 'error' && 'bg-red-50 border-red-300'
              )}
            >
              {/* Step Icon */}
              <div className={cn(
                'flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium',
                isCompleted && 'bg-green-600 text-white',
                isCurrent && 'bg-red-600 text-white',
                isPending && 'bg-gray-300 text-gray-600',
                step.status === 'error' && 'bg-red-500 text-white'
              )}>
                {step.status === 'error' ? (
                  <AlertCircle className="h-3 w-3" />
                ) : isCompleted ? (
                  <Check className="h-3 w-3" />
                ) : isCurrent ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  index + 1
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h5 className="text-sm font-medium text-gray-900">
                    {step.description}
                  </h5>
                  <span className={cn(
                    'px-2 py-1 text-xs rounded-full',
                    step.complexity === 'simple' && 'bg-green-100 text-green-800',
                    step.complexity === 'moderate' && 'bg-yellow-100 text-yellow-800',
                    step.complexity === 'complex' && 'bg-red-100 text-red-800'
                  )}>
                    {step.complexity}
                  </span>
                </div>
                
                <p className="text-xs text-gray-600 mt-1">
                  {step.reasoning}
                </p>
                
                {step.sql && (
                  <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono text-gray-800">
                    {step.sql}
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500">
                    Confidence: {Math.round(step.confidence * 100)}%
                  </span>
                  {step.dependencies.length > 0 && (
                    <span className="text-xs text-gray-500">
                      Depends on: {step.dependencies.join(', ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};