import mongoose, { Schema, Document } from 'mongoose';

export interface IColumn {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey?: boolean;
  foreignKey?: string;
  description?: string;
}

export interface ITable {
  name: string;
  columns: IColumn[];
  description?: string;
  relationships?: {
    table: string;
    column: string;
    referencedTable: string;
    referencedColumn: string;
  }[];
}

export interface IDatabaseSchema extends Document {
  databaseName: string;
  tables: ITable[];
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ColumnSchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  nullable: { type: Boolean, required: true },
  primaryKey: { type: Boolean, default: false },
  foreignKey: { type: String },
  description: { type: String }
}, { _id: false });

const RelationshipSchema = new Schema({
  table: { type: String, required: true },
  column: { type: String, required: true },
  referencedTable: { type: String, required: true },
  referencedColumn: { type: String, required: true }
}, { _id: false });

const TableSchema = new Schema({
  name: { type: String, required: true },
  columns: [ColumnSchema],
  description: { type: String },
  relationships: [RelationshipSchema]
}, { _id: false });

const DatabaseSchemaSchema = new Schema({
  databaseName: {
    type: String,
    required: true,
    unique: true
  },
  tables: [TableSchema],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

DatabaseSchemaSchema.index({ databaseName: 1 });

export default mongoose.model<IDatabaseSchema>('DatabaseSchema', DatabaseSchemaSchema);