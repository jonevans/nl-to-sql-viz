// Simple API test script
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testAPI() {
  console.log('🚀 Testing Natural Language to SQL API\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check:', health.data);

    // Test schema endpoint
    console.log('\n2. Testing schema endpoint...');
    const schema = await axios.get(`${BASE_URL}/api/schema`);
    console.log('✅ Schema loaded:', schema.data.database, `(${schema.data.tableCount} tables)`);

    // Test query endpoint
    console.log('\n3. Testing query endpoint...');
    const queryResponse = await axios.post(`${BASE_URL}/api/query`, {
      query: 'Show me all users',
      userId: 'test-user'
    });
    console.log('✅ Query generated:', queryResponse.data.sql);

    // Test execute endpoint
    console.log('\n4. Testing execute endpoint...');
    const executeResponse = await axios.post(`${BASE_URL}/api/execute`, {
      sql: 'SELECT * FROM users LIMIT 5',
      userId: 'test-user'
    });
    console.log('✅ Query executed:', `${executeResponse.data.rowCount} rows returned`);

    // Test visualize endpoint
    console.log('\n5. Testing visualize endpoint...');
    const visualizeResponse = await axios.post(`${BASE_URL}/api/visualize`, {
      data: executeResponse.data.data,
      columns: executeResponse.data.columns
    });
    console.log('✅ Visualization suggested:', visualizeResponse.data.recommended.type);

    // Test suggestions endpoint
    console.log('\n6. Testing suggestions endpoint...');
    const suggestionsResponse = await axios.get(`${BASE_URL}/api/suggestions?partial=show me`);
    console.log('✅ Suggestions returned:', suggestionsResponse.data.count);

    // Test favorites endpoint
    console.log('\n7. Testing favorites endpoint...');
    const favoritesResponse = await axios.post(`${BASE_URL}/api/favorites`, {
      name: 'Test Favorite',
      naturalLanguage: 'Show me all users',
      sql: 'SELECT * FROM users',
      tags: ['users', 'basic'],
      userId: 'test-user'
    });
    console.log('✅ Favorite created:', favoritesResponse.data.name);

    console.log('\n🎉 All API endpoints working correctly!');

  } catch (error) {
    console.error('❌ API test failed:', error.response?.data || error.message);
  }
}

// Run tests
testAPI();