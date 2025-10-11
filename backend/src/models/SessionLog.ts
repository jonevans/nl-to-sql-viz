import mongoose, { Document, Schema } from 'mongoose';

export interface ISessionLog extends Document {
  userId: string;
  userEmail: string;
  userName: string;
  conversationId: string;

  // Query details
  userQuery: string;
  generatedSQL: string;
  sqlExecutionTime: number; // milliseconds

  // Results
  rowCount: number;
  wasSuccessful: boolean;
  errorMessage?: string;

  // Response
  naturalLanguageResponse: string;
  responseType: 'data' | 'analysis' | 'error';

  // Context
  wasFollowUp: boolean;
  previousContext?: string;

  // Metadata
  timestamp: Date;
  sessionDate: Date; // Date only for easier querying
  ipAddress?: string;
  userAgent?: string;
}

const SessionLogSchema = new Schema<ISessionLog>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  userEmail: {
    type: String,
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true
  },
  conversationId: {
    type: String,
    required: true,
    index: true
  },

  // Query details
  userQuery: {
    type: String,
    required: true
  },
  generatedSQL: {
    type: String,
    required: true
  },
  sqlExecutionTime: {
    type: Number,
    required: true
  },

  // Results
  rowCount: {
    type: Number,
    required: true
  },
  wasSuccessful: {
    type: Boolean,
    required: true,
    index: true
  },
  errorMessage: {
    type: String
  },

  // Response
  naturalLanguageResponse: {
    type: String,
    required: true
  },
  responseType: {
    type: String,
    enum: ['data', 'analysis', 'error'],
    required: true
  },

  // Context
  wasFollowUp: {
    type: Boolean,
    default: false
  },
  previousContext: {
    type: String
  },

  // Metadata
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  sessionDate: {
    type: Date,
    required: true,
    index: true
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  }
});

// Compound indexes for common queries
SessionLogSchema.index({ userId: 1, timestamp: -1 });
SessionLogSchema.index({ sessionDate: -1 });
SessionLogSchema.index({ wasSuccessful: 1, timestamp: -1 });

export const SessionLog = mongoose.model<ISessionLog>('SessionLog', SessionLogSchema);
