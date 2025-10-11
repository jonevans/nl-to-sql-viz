import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'user' | 'readonly';
  company?: string;
  isActive: boolean;
  lastLogin?: Date;
  pocTermsAccepted?: boolean;
  pocTermsAcceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true,
    select: false // Don't return password by default
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'user', 'readonly'],
    default: 'user'
  },
  company: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  pocTermsAccepted: {
    type: Boolean,
    default: false
  },
  pocTermsAcceptedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for quick lookups
UserSchema.index({ email: 1, isActive: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
