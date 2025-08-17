import pool from './postgresService';

export class ColonySchemaService {
  static async getSchemaContext(): Promise<string> {
    try {
      const schemaQuery = `
        SELECT 
          t.table_name,
          t.table_type,
          obj_description(c.oid, 'pg_class') as table_comment
        FROM information_schema.tables t
        JOIN pg_class c ON c.relname = t.table_name
        WHERE t.table_schema = 'public'
        ORDER BY t.table_name;
      `;

      const columnsQuery = `
        SELECT 
          c.table_name,
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          c.character_maximum_length
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
        ORDER BY c.table_name, c.ordinal_position;
      `;

      const [tablesResult, columnsResult] = await Promise.all([
        pool.query(schemaQuery),
        pool.query(columnsQuery)
      ]);

      // Build schema context for Colony Hardware
      let context = `Colony Hardware Database Schema:\n\n`;
      
      // Add specific context about the tables
      context += `Tables Overview:
- products: Contains 68,830 hardware products with categories like "CLEANING EQUIPMENT & SUPPLIES", "FASTENERS", etc.
  Columns: product_key (PK), source_system_key, product_id, product_description, product_category, product_profile
  
- customers: Contains 14,804 customers across different states, primarily in Michigan
  Columns: customer_key (PK), source_system_key, customer_name, city, state, cust_pricing_class, cust_trade_class, restoration_refinery_cust
  
- sales_orders: Contains 1,795,100 sales transactions from 2023
  Columns: id, customer_key (FK), product_key (FK), source_system_key, order_date, order_number, order_line_number, unit_price, quantity_ordered, ext_price, ext_cost

Key Relationships:
- sales_orders.customer_key references customers.customer_key
- sales_orders.product_key references products.product_key

Important Notes:
- Order dates are from 2023
- Product categories include hardware, tools, cleaning supplies, fasteners, etc.
- Customers are primarily located in Michigan and surrounding states
- Use ILIKE for case-insensitive text searches
- Some product_key and customer_key values may be -1 (indicating missing/unknown)
`;

      // Add column details
      const tableColumns: Record<string, any[]> = {};
      columnsResult.rows.forEach((col: any) => {
        if (!tableColumns[col.table_name]) {
          tableColumns[col.table_name] = [];
        }
        tableColumns[col.table_name].push(col);
      });

      context += `\nDetailed Column Information:\n`;
      for (const [tableName, columns] of Object.entries(tableColumns)) {
        context += `\n${tableName}:\n`;
        columns.forEach((col: any) => {
          context += `  - ${col.column_name}: ${col.data_type}`;
          if (col.character_maximum_length) {
            context += `(${col.character_maximum_length})`;
          }
          if (col.is_nullable === 'NO') {
            context += ' NOT NULL';
          }
          context += '\n';
        });
      }

      return context;
    } catch (error) {
      console.error('Error getting Colony Hardware schema context:', error);
      return 'Colony Hardware database with products, customers, and sales_orders tables.';
    }
  }

  static async getSampleQueries(): Promise<string[]> {
    return [
      'Show me the top 10 selling products',
      'What are total sales by product category?',
      'List customers in Michigan with highest order volumes',
      'Show monthly sales trends for 2023',
      'What are the most popular products in the CLEANING EQUIPMENT & SUPPLIES category?',
      'Show sales by state',
      'What is the average order value by customer?',
      'Which products have never been sold?',
      'Show the distribution of order sizes',
      'What are the top revenue-generating customers?'
    ];
  }
}