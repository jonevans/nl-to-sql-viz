import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest } from '../utils/validation';
import { visualizeSchema } from '../utils/validation';
import { readOnlyRateLimiter } from '../middleware/rateLimiter';
import { VisualizationService } from '../services/visualizationService';

const router = express.Router();
const visualizationService = VisualizationService.getInstance();

// POST /api/visualize - Analyze data and suggest visualizations
router.post('/',
  readOnlyRateLimiter,
  validateRequest(visualizeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { data, columns, chartType, userId } = req.body;

    // Analyze data and generate suggestions
    const analysis = await visualizationService.analyzeAndSuggest(data, columns);

    // If specific chart type requested, prioritize it
    if (chartType) {
      const specificSuggestion = analysis.suggestions.find(s => s.type === chartType);
      if (specificSuggestion) {
        analysis.recommended = specificSuggestion;
      }
    }

    res.json({
      ...analysis,
      timestamp: new Date().toISOString(),
      userId: userId || null
    });
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

    // Generate specific configuration for the requested chart type
    const analysis = await visualizationService.analyzeAndSuggest(data, columns);
    const suggestion = analysis.suggestions.find(s => s.type === chartType);

    if (!suggestion) {
      return res.status(400).json({ 
        error: `Chart type '${chartType}' not suitable for this data` 
      });
    }

    // Generate preview configuration
    const previewConfig = {
      type: suggestion.type,
      title: suggestion.title,
      xAxis: suggestion.xAxis,
      yAxis: suggestion.yAxis,
      data: data.slice(0, 100), // Limit preview data
      config: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: suggestion.title
          },
          legend: {
            display: suggestion.type === 'pie' || suggestion.type === 'line'
          }
        }
      }
    };

    res.json({
      preview: previewConfig,
      reasoning: suggestion.reasoning,
      confidence: suggestion.confidence
    });
  })
);

export default router;