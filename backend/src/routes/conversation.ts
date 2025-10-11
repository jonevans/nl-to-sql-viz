import { Router, Request, Response } from 'express';
import { ConversationService } from '../services/conversationService';
import { SessionLog } from '../models/SessionLog';
import { createLogger } from '../utils/logger';

const logger = createLogger('ConversationRoutes');

const router = Router();
const conversationService = ConversationService.getInstance();

// Create new conversation
router.post('/new', async (req: Request, res: Response) => {
  try {
    const conversationId = conversationService.createConversation();
    res.json({ 
      conversationId,
      message: 'New conversation started' 
    });
  } catch (error: any) {
    logger.error('Error creating conversation', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to create conversation',
      message: error.message 
    });
  }
});

// Send message in conversation
router.post('/:conversationId/message', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ 
        error: 'Message is required' 
      });
    }

    logger.info('Processing message', {
      conversationId,
      messagePreview: message.substring(0, 50)
    });

    const result = await conversationService.processMessage(conversationId, message);

    // Log session for analytics (fire and forget - don't block response)
    if (req.user) {
      SessionLog.create({
        userId: req.user.userId,
        userEmail: req.user.email,
        userName: req.user.email, // We'll need to get actual name from user record
        conversationId,
        userQuery: message,
        generatedSQL: result.sql || 'N/A',
        sqlExecutionTime: result.metadata?.executionTime || 0,
        rowCount: result.metadata?.rowCount || 0,
        wasSuccessful: !result.metadata?.error,
        errorMessage: result.metadata?.error,
        naturalLanguageResponse: result.response,
        responseType: result.metadata?.error ? 'error' : (result.data ? 'data' : 'analysis'),
        wasFollowUp: result.metadata?.isFollowUp || false,
        previousContext: result.metadata?.previousQuery,
        timestamp: new Date(),
        sessionDate: new Date(new Date().setHours(0, 0, 0, 0)), // Date only for grouping
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }).catch(err => {
        logger.error('Failed to log session', { error: err.message });
      });
    }

    res.json({
      conversationId,
      response: result.response,
      sql: result.sql,
      data: result.data,
      metadata: result.metadata
    });

  } catch (error: any) {
    logger.error('Error processing message', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to process message',
      message: error.message 
    });
  }
});

// Get conversation history
router.get('/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const conversation = conversationService.getConversation(conversationId);

    if (!conversation) {
      return res.status(404).json({ 
        error: 'Conversation not found' 
      });
    }

    res.json(conversation);

  } catch (error: any) {
    logger.error('Error fetching conversation', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to fetch conversation',
      message: error.message 
    });
  }
});

// Clear conversation
router.delete('/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    conversationService.clearConversation(conversationId);

    res.json({
      message: 'Conversation cleared'
    });

  } catch (error: any) {
    logger.error('Error clearing conversation', { error: error.message });
    res.status(500).json({
      error: 'Failed to clear conversation',
      message: error.message
    });
  }
});

// Get conversation cache statistics (admin/monitoring endpoint)
router.get('/stats/cache', async (req: Request, res: Response) => {
  try {
    const stats = conversationService.getStatistics();

    res.json({
      ...stats,
      message: 'Conversation cache statistics'
    });

  } catch (error: any) {
    logger.error('Error fetching conversation stats', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

export default router;