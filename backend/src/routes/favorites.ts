import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest, validateQuery } from '../utils/validation';
import { favoriteSchema, updateFavoriteSchema, paginationSchema } from '../utils/validation';
import { readOnlyRateLimiter } from '../middleware/rateLimiter';
import Favorite from '../models/Favorite';
import Joi from 'joi';

const router = express.Router();

const favoriteQuerySchema = Joi.object({
  userId: Joi.string().optional(),
  tags: Joi.string().optional(),
  search: Joi.string().optional(),
  ...paginationSchema.describe().children
});

// POST /api/favorites - Create a new favorite query
router.post('/',
  validateRequest(favoriteSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, description, naturalLanguage, sql, tags, userId } = req.body;

    // Check if favorite with same name already exists for user
    const existingFavorite = await Favorite.findOne({ 
      name, 
      userId: userId || null 
    });

    if (existingFavorite) {
      return res.status(409).json({ 
        error: 'Favorite with this name already exists' 
      });
    }

    const favorite = new Favorite({
      name,
      description,
      naturalLanguage,
      sql,
      tags: tags || [],
      userId
    });

    await favorite.save();

    res.status(201).json({
      id: favorite._id,
      name: favorite.name,
      description: favorite.description,
      naturalLanguage: favorite.naturalLanguage,
      sql: favorite.sql,
      tags: favorite.tags,
      userId: favorite.userId,
      createdAt: favorite.createdAt,
      updatedAt: favorite.updatedAt
    });
  })
);

// GET /api/favorites - Get all favorites with filtering and pagination
router.get('/',
  readOnlyRateLimiter,
  validateQuery(favoriteQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { 
      userId, 
      tags, 
      search, 
      page = 1, 
      limit = 10, 
      sort = 'createdAt', 
      order = 'desc' 
    } = req.query;

    // Build filter
    const filter: any = {};
    if (userId) {
      filter.userId = userId;
    }
    if (tags) {
      filter.tags = { $in: (tags as string).split(',') };
    }
    if (search) {
      filter.$text = { $search: search };
    }

    // Build sort
    const sortObj: any = {};
    sortObj[sort as string] = order === 'asc' ? 1 : -1;

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Execute query
    const favorites = await Favorite.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit))
      .select('-__v');

    const total = await Favorite.countDocuments(filter);

    res.json({
      favorites,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      },
      filters: {
        userId,
        tags,
        search
      }
    });
  })
);

// GET /api/favorites/:id - Get specific favorite
router.get('/:id',
  readOnlyRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const favorite = await Favorite.findById(req.params.id).select('-__v');
    
    if (!favorite) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    res.json(favorite);
  })
);

// PUT /api/favorites/:id - Update favorite
router.put('/:id',
  validateRequest(updateFavoriteSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, description, naturalLanguage, sql, tags, userId } = req.body;
    
    const favorite = await Favorite.findById(req.params.id);
    
    if (!favorite) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    // Check if name conflicts with another favorite (if name is being changed)
    if (name && name !== favorite.name) {
      const existingFavorite = await Favorite.findOne({ 
        name, 
        userId: userId || favorite.userId,
        _id: { $ne: req.params.id }
      });

      if (existingFavorite) {
        return res.status(409).json({ 
          error: 'Favorite with this name already exists' 
        });
      }
    }

    // Update fields
    if (name !== undefined) favorite.name = name;
    if (description !== undefined) favorite.description = description;
    if (naturalLanguage !== undefined) favorite.naturalLanguage = naturalLanguage;
    if (sql !== undefined) favorite.sql = sql;
    if (tags !== undefined) favorite.tags = tags;
    if (userId !== undefined) favorite.userId = userId;

    await favorite.save();

    res.json({
      id: favorite._id,
      name: favorite.name,
      description: favorite.description,
      naturalLanguage: favorite.naturalLanguage,
      sql: favorite.sql,
      tags: favorite.tags,
      userId: favorite.userId,
      createdAt: favorite.createdAt,
      updatedAt: favorite.updatedAt
    });
  })
);

// DELETE /api/favorites/:id - Delete favorite
router.delete('/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const favorite = await Favorite.findById(req.params.id);
    
    if (!favorite) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    await Favorite.findByIdAndDelete(req.params.id);

    res.json({ 
      message: 'Favorite deleted successfully',
      id: req.params.id
    });
  })
);

// GET /api/favorites/tags - Get all unique tags
router.get('/meta/tags',
  readOnlyRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.query;
    
    const filter = userId ? { userId } : {};
    
    const tags = await Favorite.aggregate([
      { $match: filter },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, tag: '$_id', count: 1 } }
    ]);

    res.json({
      tags,
      count: tags.length
    });
  })
);

// POST /api/favorites/:id/duplicate - Duplicate a favorite
router.post('/:id/duplicate',
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.body;
    
    const originalFavorite = await Favorite.findById(req.params.id);
    
    if (!originalFavorite) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    const duplicateName = name || `${originalFavorite.name} (Copy)`;
    
    // Check if duplicate name already exists
    const existingFavorite = await Favorite.findOne({ 
      name: duplicateName, 
      userId: originalFavorite.userId 
    });

    if (existingFavorite) {
      return res.status(409).json({ 
        error: 'Favorite with this name already exists' 
      });
    }

    const duplicate = new Favorite({
      name: duplicateName,
      description: originalFavorite.description,
      naturalLanguage: originalFavorite.naturalLanguage,
      sql: originalFavorite.sql,
      tags: [...originalFavorite.tags],
      userId: originalFavorite.userId
    });

    await duplicate.save();

    res.status(201).json({
      id: duplicate._id,
      name: duplicate.name,
      description: duplicate.description,
      naturalLanguage: duplicate.naturalLanguage,
      sql: duplicate.sql,
      tags: duplicate.tags,
      userId: duplicate.userId,
      createdAt: duplicate.createdAt,
      updatedAt: duplicate.updatedAt
    });
  })
);

export default router;