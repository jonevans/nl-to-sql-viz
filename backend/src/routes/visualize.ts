import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest } from '../utils/validation';
import { visualizeSchema } from '../utils/validation';
import { readOnlyRateLimiter } from '../middleware/rateLimiter';
import { LLMService } from '../services/llmService';

const router = express.Router();

// POST /api/visualize - Analyze data and suggest visualizations (via LLM service)
router.post('/',
  readOnlyRateLimiter,
  validateRequest(visualizeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { data, columns, chartType, userId } = req.body;

    // Forward to LLM service for analysis
    const llmService = LLMService.getInstance();
    
    try {
      // Use LLM service's analyze endpoint
      const analysisResponse = await llmService.analyzeData(data, 
        `Analyze this data with columns: ${columns.join(', ')}`
      );
      
      // Parse the response and format it for the frontend
      const analysis = {
        chartType: chartType || analysisResponse.chartType || 'table',
        reasoning: analysisResponse.summary || 'Data analysis complete',
        confidence: analysisResponse.confidence || 0.8,
        configurations: {
          chartjs: { responsive: true },
          recharts: { width: 600, height: 400 }
        },
        suggestions: [
          {
            type: 'table',
            reasoning: 'Default safe option for all data',
            confidence: 0.6
          }
        ]
      };

      res.json({
        ...analysis,
        timestamp: new Date().toISOString(),
        userId: userId || null
      });
    } catch (error: any) {
      console.error('Visualization analysis failed:', error);
      
      // Fallback to simple analysis
      res.json({
        chartType: 'table',
        reasoning: 'Analysis service unavailable, defaulting to table view',
        confidence: 0.3,
        configurations: {
          chartjs: { responsive: true },
          recharts: { width: 600, height: 400 }
        },
        suggestions: [
          {
            type: 'table',
            reasoning: 'Safe fallback option',
            confidence: 0.5
          }
        ],
        timestamp: new Date().toISOString(),
        userId: userId || null
      });
    }
  })
);

// GET /api/visualize/types - Get available chart types
router.get('/types',
  asyncHandler(async (req: Request, res: Response) => {
    const chartTypes = [
      {
        type: 'bar',
        name: 'Bar Chart',
        description: 'Compare values across categories',
        bestFor: ['categorical vs numerical', 'comparisons'],
        requiredColumns: { categorical: 1, numerical: 1 }
      },
      {
        type: 'line',
        name: 'Line Chart',
        description: 'Show trends over time',
        bestFor: ['time series', 'trends'],
        requiredColumns: { date: 1, numerical: 1 }
      },
      {
        type: 'pie',
        name: 'Pie Chart',
        description: 'Show proportions of a whole',
        bestFor: ['proportions', 'small categories'],
        requiredColumns: { categorical: 1, numerical: 1 }
      },
      {
        type: 'scatter',
        name: 'Scatter Plot',
        description: 'Show correlation between two variables',
        bestFor: ['correlation', 'relationships'],
        requiredColumns: { numerical: 2 }
      },
      {
        type: 'area',
        name: 'Area Chart',
        description: 'Show cumulative data over time',
        bestFor: ['cumulative trends', 'magnitude over time'],
        requiredColumns: { date: 1, numerical: 1 }
      },
      {
        type: 'table',
        name: 'Data Table',
        description: 'Display raw data in tabular format',
        bestFor: ['detailed view', 'all data types'],
        requiredColumns: {}
      }
    ];

    res.json({ chartTypes });
  })
);

// POST /api/visualize/preview - Generate preview configuration
router.post('/preview',
  validateRequest(visualizeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { data, columns, chartType } = req.body;

    if (!chartType) {
      return res.status(400).json({ error: 'Chart type is required for preview' });
    }

    // Generate preview configuration (simplified since we removed the old service)
    const previewConfig = {
      type: chartType,
      title: `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`,
      xAxis: columns[0] || 'x',
      yAxis: columns[1] || 'y',
      data: data.slice(0, 100), // Limit preview data
      config: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`
          },
          legend: {
            display: chartType === 'pie' || chartType === 'line'
          }
        }
      }
    };

    res.json({
      preview: previewConfig,
      reasoning: `Generating ${chartType} chart preview`,
      confidence: 0.8
    });
  })
);

export default router;