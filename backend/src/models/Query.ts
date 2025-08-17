import mongoose, { Schema, Document } from 'mongoose';

export interface IQuery extends Document {
  naturalLanguage: string;
  sql: string;
  executionTime: number;
  confidence: number;
  provider: string;
  llmModel: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const QuerySchema = new Schema({
  naturalLanguage: {
    type: String,
    required: true,
    trim: true
  },
  sql: {
    type: String,
    required: true
  },
  executionTime: {
    type: Number,
    required: true
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  provider: {
    type: String,
    required: true,
    enum: ['openai', 'anthropic', 'local']
  },
  llmModel: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

QuerySchema.index({ userId: 1, createdAt: -1 });
QuerySchema.index({ naturalLanguage: 'text' });

export default mongoose.model<IQuery>('Query', QuerySchema);