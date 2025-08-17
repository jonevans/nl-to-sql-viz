import mongoose, { Schema, Document } from 'mongoose';

export interface IFavorite extends Document {
  name: string;
  description?: string;
  naturalLanguage: string;
  sql: string;
  userId?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const FavoriteSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  naturalLanguage: {
    type: String,
    required: true,
    trim: true
  },
  sql: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: false
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

FavoriteSchema.index({ userId: 1, name: 1 });
FavoriteSchema.index({ tags: 1 });
FavoriteSchema.index({ naturalLanguage: 'text', name: 'text', description: 'text' });

export default mongoose.model<IFavorite>('Favorite', FavoriteSchema);