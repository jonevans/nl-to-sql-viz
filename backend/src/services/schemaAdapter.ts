interface PostgresSchemaColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

interface PostgresSchemaTable {
  table_name: string;
  columns: PostgresSchemaColumn[];
}

interface PostgresSchema {
  tables: PostgresSchemaTable[];
}

interface LLMSchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey?: boolean;
  foreignKey?: string;
  description?: string;
}

interface LLMSchemaTable {
  name: string;
  columns: LLMSchemaColumn[];
  description?: string;
}

interface LLMSchema {
  tables: LLMSchemaTable[];
  relationships?: any[];
}

export class SchemaAdapter {
  static convertPostgresToLLMFormat(postgresSchema: PostgresSchema): LLMSchema {
    console.log('🔄 Converting PostgreSQL schema to LLM format');
    console.log('📥 Input tables:', postgresSchema.tables.map(t => t.table_name));
    
    const llmSchema: LLMSchema = {
      tables: postgresSchema.tables.map(table => ({
        name: table.table_name,
        description: this.generateTableDescription(table.table_name),
        columns: table.columns.map(column => ({
          name: column.column_name,
          type: this.convertDataType(column.data_type),
          nullable: column.is_nullable === 'YES',
          primaryKey: this.isPrimaryKey(column.column_name, table.table_name),
          foreignKey: this.getForeignKeyReference(column.column_name, table.table_name),
          description: this.generateColumnDescription(column.column_name, table.table_name)
        }))
      })),
      relationships: this.generateKnownRelationships()
    };

    console.log('📤 Output tables:', llmSchema.tables.map(t => t.name));
    console.log('📋 Sample table:', llmSchema.tables[0]?.name, 'with columns:', llmSchema.tables[0]?.columns.map(c => c.name));
    
    return llmSchema;
  }

  private static convertDataType(postgresType: string): string {
    // Convert PostgreSQL types to simplified types
    const typeMap: { [key: string]: string } = {
      'integer': 'INT',
      'bigint': 'BIGINT',
      'smallint': 'SMALLINT',
      'numeric': 'DECIMAL',
      'decimal': 'DECIMAL',
      'real': 'FLOAT',
      'double precision': 'DOUBLE',
      'character varying': 'VARCHAR',
      'varchar': 'VARCHAR',
      'character': 'CHAR',
      'char': 'CHAR',
      'text': 'TEXT',
      'boolean': 'BOOLEAN',
      'date': 'DATE',
      'timestamp without time zone': 'TIMESTAMP',
      'timestamp with time zone': 'TIMESTAMPTZ',
      'time without time zone': 'TIME',
      'time with time zone': 'TIMETZ'
    };

    // Handle types with length specifiers
    for (const [pgType, llmType] of Object.entries(typeMap)) {
      if (postgresType.startsWith(pgType)) {
        return llmType;
      }
    }

    // Default to uppercase version of the original type
    return postgresType.toUpperCase();
  }

  private static isPrimaryKey(columnName: string, tableName: string): boolean {
    // Common primary key patterns
    const pkPatterns = [
      `${tableName.slice(0, -1)}_id`, // e.g., orders -> order_id
      'id',
      `${tableName}_id`
    ];
    
    return pkPatterns.includes(columnName);
  }

  private static getForeignKeyReference(columnName: string, tableName: string): string | undefined {
    // Known foreign key relationships for hardware store schema
    const fkMap: { [key: string]: string } = {
      'salesperson_id': 'salespeople.salesperson_id',
      'store_id': 'stores.store_id',
      'order_id': 'orders.order_id',
      'product_id': 'products.product_id',
      'category_id': 'product_categories.category_id',
      'state_id': 'states.state_id',
      'region_id': 'regions.region_id'
    };

    return fkMap[columnName];
  }

  private static generateTableDescription(tableName: string): string {
    const descriptions: { [key: string]: string } = {
      'orders': 'Customer orders placed by stores',
      'order_items': 'Line items within each order',
      'products': 'Hardware products catalog',
      'product_categories': 'Product category definitions',
      'stores': 'Retail store locations (B2B customers)',
      'salespeople': 'Sales representatives',
      'regions': 'Sales territories',
      'states': 'Geographic states',
      'inventory': 'Product inventory levels'
    };

    return descriptions[tableName] || `${tableName} table`;
  }

  private static generateColumnDescription(columnName: string, tableName: string): string {
    // Generate helpful descriptions for common columns
    const commonDescriptions: { [key: string]: string } = {
      'created_at': 'Record creation timestamp',
      'updated_at': 'Last modification timestamp',
      'order_date': 'Date when order was placed',
      'ship_date': 'Date when order was shipped',
      'total_amount': 'Total order value',
      'unit_price': 'Price per unit',
      'line_total': 'Total for this line item',
      'quantity': 'Number of items',
      'product_name': 'Name of the product',
      'store_name': 'Name of the store',
      'contact_name': 'Primary contact person',
      'phone': 'Contact phone number',
      'email': 'Contact email address',
      'status': 'Current status'
    };

    return commonDescriptions[columnName];
  }

  private static generateKnownRelationships(): any[] {
    // Return known relationships for the hardware store schema
    return [
      {
        table: 'orders',
        column: 'salesperson_id',
        referencedTable: 'salespeople',
        referencedColumn: 'salesperson_id',
        type: 'many-to-one'
      },
      {
        table: 'orders',
        column: 'store_id',
        referencedTable: 'stores',
        referencedColumn: 'store_id',
        type: 'many-to-one'
      },
      {
        table: 'order_items',
        column: 'order_id',
        referencedTable: 'orders',
        referencedColumn: 'order_id',
        type: 'many-to-one'
      },
      {
        table: 'order_items',
        column: 'product_id',
        referencedTable: 'products',
        referencedColumn: 'product_id',
        type: 'many-to-one'
      },
      {
        table: 'products',
        column: 'category_id',
        referencedTable: 'product_categories',
        referencedColumn: 'category_id',
        type: 'many-to-one'
      },
      {
        table: 'stores',
        column: 'state_id',
        referencedTable: 'states',
        referencedColumn: 'state_id',
        type: 'many-to-one'
      },
      {
        table: 'states',
        column: 'region_id',
        referencedTable: 'regions',
        referencedColumn: 'region_id',
        type: 'many-to-one'
      },
      {
        table: 'salespeople',
        column: 'region_id',
        referencedTable: 'regions',
        referencedColumn: 'region_id',
        type: 'many-to-one'
      },
      {
        table: 'inventory',
        column: 'product_id',
        referencedTable: 'products',
        referencedColumn: 'product_id',
        type: 'many-to-one'
      }
    ];
  }
}