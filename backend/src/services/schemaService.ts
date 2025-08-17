import DatabaseSchema, { IDatabaseSchema, ITable } from '../models/DatabaseSchema';
import { createError } from '../middleware/errorHandler';

export class SchemaService {
  private static instance: SchemaService;

  static getInstance(): SchemaService {
    if (!SchemaService.instance) {
      SchemaService.instance = new SchemaService();
    }
    return SchemaService.instance;
  }

  async getSchema(databaseName: string = 'default'): Promise<IDatabaseSchema | null> {
    try {
      const schema = await DatabaseSchema.findOne({ databaseName });
      return schema;
    } catch (error: any) {
      throw createError(500, `Error retrieving schema: ${error.message}`);
    }
  }

  async createOrUpdateSchema(databaseName: string, tables: ITable[]): Promise<IDatabaseSchema> {
    try {
      const schema = await DatabaseSchema.findOneAndUpdate(
        { databaseName },
        { 
          databaseName, 
          tables, 
          lastUpdated: new Date() 
        },
        { upsert: true, new: true }
      );
      
      return schema;
    } catch (error: any) {
      throw createError(500, `Error updating schema: ${error.message}`);
    }
  }

  async getAllSchemas(): Promise<IDatabaseSchema[]> {
    try {
      const schemas = await DatabaseSchema.find({}).sort({ databaseName: 1 });
      return schemas;
    } catch (error: any) {
      throw createError(500, `Error retrieving schemas: ${error.message}`);
    }
  }

  async deleteSchema(databaseName: string): Promise<boolean> {
    try {
      const result = await DatabaseSchema.deleteOne({ databaseName });
      return result.deletedCount > 0;
    } catch (error: any) {
      throw createError(500, `Error deleting schema: ${error.message}`);
    }
  }

  async searchTables(query: string, databaseName?: string): Promise<ITable[]> {
    try {
      const filter: any = {};
      if (databaseName) {
        filter.databaseName = databaseName;
      }

      const schemas = await DatabaseSchema.find(filter);
      const allTables: ITable[] = [];

      schemas.forEach(schema => {
        schema.tables.forEach(table => {
          const matchesName = table.name.toLowerCase().includes(query.toLowerCase());
          const matchesDescription = table.description?.toLowerCase().includes(query.toLowerCase());
          const matchesColumn = table.columns.some(col => 
            col.name.toLowerCase().includes(query.toLowerCase())
          );

          if (matchesName || matchesDescription || matchesColumn) {
            allTables.push(table);
          }
        });
      });

      return allTables;
    } catch (error: any) {
      throw createError(500, `Error searching tables: ${error.message}`);
    }
  }

  async getTableInfo(tableName: string, databaseName: string = 'default'): Promise<ITable | null> {
    try {
      const schema = await DatabaseSchema.findOne({ databaseName });
      if (!schema) {
        return null;
      }

      const table = schema.tables.find(t => t.name === tableName);
      return table || null;
    } catch (error: any) {
      throw createError(500, `Error retrieving table info: ${error.message}`);
    }
  }

  generateMockSchema(): ITable[] {
    return [
      {
        name: 'users',
        description: 'User account information',
        columns: [
          { name: 'id', type: 'INT', nullable: false, primaryKey: true },
          { name: 'username', type: 'VARCHAR(50)', nullable: false },
          { name: 'email', type: 'VARCHAR(100)', nullable: false },
          { name: 'first_name', type: 'VARCHAR(50)', nullable: true },
          { name: 'last_name', type: 'VARCHAR(50)', nullable: true },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false },
          { name: 'updated_at', type: 'TIMESTAMP', nullable: false }
        ],
        relationships: [
          {
            table: 'orders',
            column: 'user_id',
            referencedTable: 'users',
            referencedColumn: 'id'
          }
        ]
      },
      {
        name: 'products',
        description: 'Product catalog',
        columns: [
          { name: 'id', type: 'INT', nullable: false, primaryKey: true },
          { name: 'name', type: 'VARCHAR(100)', nullable: false },
          { name: 'description', type: 'TEXT', nullable: true },
          { name: 'price', type: 'DECIMAL(10,2)', nullable: false },
          { name: 'category', type: 'VARCHAR(50)', nullable: true },
          { name: 'stock_quantity', type: 'INT', nullable: false },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false },
          { name: 'updated_at', type: 'TIMESTAMP', nullable: false }
        ]
      },
      {
        name: 'orders',
        description: 'Customer orders',
        columns: [
          { name: 'id', type: 'INT', nullable: false, primaryKey: true },
          { name: 'user_id', type: 'INT', nullable: false, foreignKey: 'users.id' },
          { name: 'total_amount', type: 'DECIMAL(10,2)', nullable: false },
          { name: 'status', type: 'VARCHAR(20)', nullable: false },
          { name: 'order_date', type: 'TIMESTAMP', nullable: false },
          { name: 'shipping_address', type: 'TEXT', nullable: true },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false },
          { name: 'updated_at', type: 'TIMESTAMP', nullable: false }
        ],
        relationships: [
          {
            table: 'users',
            column: 'id',
            referencedTable: 'orders',
            referencedColumn: 'user_id'
          }
        ]
      },
      {
        name: 'order_items',
        description: 'Items within each order',
        columns: [
          { name: 'id', type: 'INT', nullable: false, primaryKey: true },
          { name: 'order_id', type: 'INT', nullable: false, foreignKey: 'orders.id' },
          { name: 'product_id', type: 'INT', nullable: false, foreignKey: 'products.id' },
          { name: 'quantity', type: 'INT', nullable: false },
          { name: 'unit_price', type: 'DECIMAL(10,2)', nullable: false },
          { name: 'total_price', type: 'DECIMAL(10,2)', nullable: false }
        ]
      }
    ];
  }
}