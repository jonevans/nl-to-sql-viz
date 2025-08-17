const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function testConnection() {
  try {
    console.log('Testing Colony Hardware database connection...');
    console.log('Database:', process.env.DB_NAME);
    console.log('User:', process.env.DB_USER);
    
    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Connected successfully!');
    
    // Test queries
    const productsCount = await client.query('SELECT COUNT(*) FROM products');
    console.log('Products:', productsCount.rows[0].count);
    
    const customersCount = await client.query('SELECT COUNT(*) FROM customers');
    console.log('Customers:', customersCount.rows[0].count);
    
    const ordersCount = await client.query('SELECT COUNT(*) FROM sales_orders');
    console.log('Sales Orders:', ordersCount.rows[0].count);
    
    // Test a sample query
    const sampleQuery = await client.query(`
      SELECT 
        p.product_category,
        COUNT(*) as product_count,
        SUM(so.ext_price) as total_sales
      FROM sales_orders so
      JOIN products p ON so.product_key = p.product_key
      WHERE so.order_date >= '2023-01-01'
      GROUP BY p.product_category
      ORDER BY total_sales DESC
      LIMIT 5
    `);
    
    console.log('\nTop 5 Product Categories by Sales:');
    sampleQuery.rows.forEach(row => {
      console.log(`- ${row.product_category}: $${parseFloat(row.total_sales).toFixed(2)}`);
    });
    
    client.release();
    await pool.end();
    console.log('\n✅ All tests passed! Colony Hardware database is ready.');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();