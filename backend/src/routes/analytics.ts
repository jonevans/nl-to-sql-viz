import { Router, Request, Response } from 'express';
import { SessionLog } from '../models/SessionLog';
import { authorize } from '../middleware/authMiddleware';
import { createLogger } from '../utils/logger';

const logger = createLogger('AnalyticsRoutes');
const router = Router();

// GET /api/analytics/sessions - Get all session logs with filtering
router.get('/sessions', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const {
      startDate,
      endDate,
      userId,
      userEmail,
      wasSuccessful,
      limit = '100',
      skip = '0'
    } = req.query;

    const query: any = {};

    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate) query.timestamp.$lte = new Date(endDate as string);
    }

    // User filters
    if (userId) query.userId = userId;
    if (userEmail) query.userEmail = new RegExp(userEmail as string, 'i');

    // Success filter
    if (wasSuccessful !== undefined) {
      query.wasSuccessful = wasSuccessful === 'true';
    }

    const sessions = await SessionLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit as string))
      .skip(parseInt(skip as string))
      .select('-__v');

    const total = await SessionLog.countDocuments(query);

    res.json({
      sessions,
      pagination: {
        total,
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
        hasMore: total > parseInt(skip as string) + parseInt(limit as string)
      }
    });
  } catch (error: any) {
    logger.error('Error fetching sessions', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /api/analytics/summary - Get usage summary statistics
router.get('/summary', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const matchStage: any = {};
    if (startDate || endDate) {
      matchStage.timestamp = {};
      if (startDate) matchStage.timestamp.$gte = new Date(startDate as string);
      if (endDate) matchStage.timestamp.$lte = new Date(endDate as string);
    }

    const pipeline = [
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      {
        $group: {
          _id: null,
          totalQueries: { $sum: 1 },
          successfulQueries: {
            $sum: { $cond: ['$wasSuccessful', 1, 0] }
          },
          failedQueries: {
            $sum: { $cond: ['$wasSuccessful', 0, 1] }
          },
          totalRows: { $sum: '$rowCount' },
          avgExecutionTime: { $avg: '$sqlExecutionTime' },
          uniqueUsers: { $addToSet: '$userId' },
          uniqueConversations: { $addToSet: '$conversationId' }
        }
      }
    ];

    const result = await SessionLog.aggregate(pipeline);
    const stats = result[0] || {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      totalRows: 0,
      avgExecutionTime: 0,
      uniqueUsers: [],
      uniqueConversations: []
    };

    res.json({
      totalQueries: stats.totalQueries,
      successfulQueries: stats.successfulQueries,
      failedQueries: stats.failedQueries,
      successRate: stats.totalQueries > 0
        ? ((stats.successfulQueries / stats.totalQueries) * 100).toFixed(2) + '%'
        : '0%',
      totalRowsReturned: stats.totalRows,
      avgExecutionTime: Math.round(stats.avgExecutionTime) + 'ms',
      uniqueUsers: stats.uniqueUsers.length,
      uniqueConversations: stats.uniqueConversations.length
    });
  } catch (error: any) {
    logger.error('Error generating summary', { error: error.message });
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// GET /api/analytics/top-queries - Get most common queries
router.get('/top-queries', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { limit = '10' } = req.query;

    const pipeline = [
      {
        $group: {
          _id: '$userQuery',
          count: { $sum: 1 },
          avgExecutionTime: { $avg: '$sqlExecutionTime' },
          successRate: {
            $avg: { $cond: ['$wasSuccessful', 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit as string) }
    ];

    const topQueries = await SessionLog.aggregate(pipeline);

    res.json({
      topQueries: topQueries.map(q => ({
        query: q._id,
        count: q.count,
        avgExecutionTime: Math.round(q.avgExecutionTime) + 'ms',
        successRate: (q.successRate * 100).toFixed(1) + '%'
      }))
    });
  } catch (error: any) {
    logger.error('Error fetching top queries', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch top queries' });
  }
});

// GET /api/analytics/daily-usage - Get usage by day
router.get('/daily-usage', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, limit = '30' } = req.query;

    const matchStage: any = {};
    if (startDate || endDate) {
      matchStage.sessionDate = {};
      if (startDate) matchStage.sessionDate.$gte = new Date(startDate as string);
      if (endDate) matchStage.sessionDate.$lte = new Date(endDate as string);
    }

    const pipeline = [
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      {
        $group: {
          _id: '$sessionDate',
          totalQueries: { $sum: 1 },
          successfulQueries: {
            $sum: { $cond: ['$wasSuccessful', 1, 0] }
          },
          uniqueUsers: { $addToSet: '$userId' },
          avgExecutionTime: { $avg: '$sqlExecutionTime' }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: parseInt(limit as string) }
    ];

    const dailyStats = await SessionLog.aggregate(pipeline);

    res.json({
      dailyUsage: dailyStats.map(day => ({
        date: day._id,
        totalQueries: day.totalQueries,
        successfulQueries: day.successfulQueries,
        uniqueUsers: day.uniqueUsers.length,
        avgExecutionTime: Math.round(day.avgExecutionTime) + 'ms'
      }))
    });
  } catch (error: any) {
    logger.error('Error fetching daily usage', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch daily usage' });
  }
});

// GET /api/analytics/user-activity - Get per-user activity
router.get('/user-activity', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { limit = '20' } = req.query;

    const pipeline = [
      {
        $group: {
          _id: {
            userId: '$userId',
            userEmail: '$userEmail',
            userName: '$userName'
          },
          totalQueries: { $sum: 1 },
          successfulQueries: {
            $sum: { $cond: ['$wasSuccessful', 1, 0] }
          },
          avgExecutionTime: { $avg: '$sqlExecutionTime' },
          lastActivity: { $max: '$timestamp' }
        }
      },
      { $sort: { totalQueries: -1 } },
      { $limit: parseInt(limit as string) }
    ];

    const userActivity = await SessionLog.aggregate(pipeline);

    res.json({
      userActivity: userActivity.map(user => ({
        userId: user._id.userId,
        userEmail: user._id.userEmail,
        userName: user._id.userName,
        totalQueries: user.totalQueries,
        successfulQueries: user.successfulQueries,
        successRate: ((user.successfulQueries / user.totalQueries) * 100).toFixed(1) + '%',
        avgExecutionTime: Math.round(user.avgExecutionTime) + 'ms',
        lastActivity: user.lastActivity
      }))
    });
  } catch (error: any) {
    logger.error('Error fetching user activity', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

// GET /api/analytics/export - Export all logs as JSON or CSV
router.get('/export', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { format = 'json', startDate, endDate } = req.query;

    const query: any = {};
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate) query.timestamp.$lte = new Date(endDate as string);
    }

    const sessions = await SessionLog.find(query)
      .sort({ timestamp: -1 })
      .select('-__v')
      .lean();

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Timestamp', 'User Email', 'User Name', 'Query', 'Generated SQL',
        'Execution Time (ms)', 'Row Count', 'Success', 'Response Type', 'Error'
      ];

      const rows = sessions.map(s => [
        s.timestamp.toISOString(),
        s.userEmail,
        s.userName,
        s.userQuery.replace(/"/g, '""'), // Escape quotes
        s.generatedSQL.replace(/"/g, '""'),
        s.sqlExecutionTime,
        s.rowCount,
        s.wasSuccessful,
        s.responseType,
        s.errorMessage || ''
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="session-logs-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } else {
      // JSON export
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="session-logs-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(sessions);
    }
  } catch (error: any) {
    logger.error('Error exporting sessions', { error: error.message });
    res.status(500).json({ error: 'Failed to export sessions' });
  }
});

export default router;
