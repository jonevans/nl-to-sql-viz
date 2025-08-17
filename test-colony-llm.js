const OpenAI = require('openai');
require('dotenv').config({ path: './backend/.env' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testLLMQuery() {
  try {
    console.log('Testing LLM SQL generation for Colony Hardware...\n');
    
    const testQuery = "Show me the top 5 customers by total sales in Michigan";
    
    const systemPrompt = `You are a PostgreSQL SQL expert. Convert natural language queries to SQL.
Generate only SELECT statements. Return only the SQL query without explanations.

Colony Hardware Database Schema:

Tables:
1. products (68,830 hardware products)
   - product_key (INTEGER, PRIMARY KEY)
   - product_id (VARCHAR)
   - product_description (TEXT)
   - product_category (VARCHAR)
   - product_profile (VARCHAR)

2. customers (14,804 customers)
   - customer_key (INTEGER, PRIMARY KEY)
   - customer_name (VARCHAR)
   - city (VARCHAR)
   - state (VARCHAR) - State codes like 'MI' for Michigan
   - cust_pricing_class (VARCHAR)
   - cust_trade_class (VARCHAR)

3. sales_orders (1,795,100 sales from 2023)
   - customer_key (INTEGER) - References customers.customer_key
   - product_key (INTEGER) - References products.product_key
   - order_date (DATE)
   - order_number (VARCHAR)
   - unit_price (DECIMAL)
   - quantity_ordered (DECIMAL)
   - ext_price (DECIMAL)
   - ext_cost (DECIMAL)`;

    console.log('Query:', testQuery);
    console.log('Generating SQL...\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Convert this natural language query to SQL: "${testQuery}"` }
      ],
      temperature: 0.1,
      max_tokens: 500
    });

    let generatedSQL = completion.choices[0]?.message?.content;
    console.log('Generated SQL:');
    console.log(generatedSQL);
    
    // Extract SQL from markdown if present
    const sqlMatch = generatedSQL.match(/```(?:sql)?\n?([\s\S]*?)\n?```/);
    if (sqlMatch) {
      generatedSQL = sqlMatch[1].trim();
    }
    
    // Now test the SQL
    const { Pool } = require('pg');
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    });
    
    console.log('\nExecuting SQL...\n');
    const result = await pool.query(generatedSQL);
    
    console.log('Results:');
    result.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.customer_name}: $${parseFloat(row.total_sales).toFixed(2)}`);
    });
    
    await pool.end();
    console.log('\n✅ LLM integration test passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testLLMQuery();