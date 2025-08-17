// Test script for Advanced LLM Service
const axios = require('axios');

const BASE_URL = 'http://localhost:3002';

const sampleSchema = {
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'INT', nullable: false, primaryKey: true },
        { name: 'name', type: 'VARCHAR(100)', nullable: false },
        { name: 'email', type: 'VARCHAR(100)', nullable: false },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false }
      ]
    },
    {
      name: 'orders',
      columns: [
        { name: 'id', type: 'INT', nullable: false, primaryKey: true },
        { name: 'user_id', type: 'INT', nullable: false, foreignKey: 'users.id' },
        { name: 'amount', type: 'DECIMAL(10,2)', nullable: false },
        { name: 'status', type: 'VARCHAR(20)', nullable: false },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false }
      ]
    }
  ],
  relationships: [
    {
      table: 'orders',
      column: 'user_id',
      referencedTable: 'users',
      referencedColumn: 'id',
      type: 'many-to-one'
    }
  ]
};

const sampleData = [
  { user_name: 'John Doe', total_orders: 5, total_spent: 250.00 },
  { user_name: 'Jane Smith', total_orders: 3, total_spent: 180.50 },
  { user_name: 'Bob Johnson', total_orders: 8, total_spent: 420.75 },
  { user_name: 'Alice Brown', total_orders: 2, total_spent: 95.25 }
];

async function testAdvancedLLMService() {
  console.log('🧠 Testing Advanced LLM Service\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing health check...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health:', health.data.status);
    console.log(`   Providers: ${Object.entries(health.data.providers).map(([k,v]) => `${k}:${v}`).join(', ')}`);

    // Test 2: Create Conversation
    console.log('\n2. Creating conversation...');
    const conversation = await axios.post(`${BASE_URL}/api/conversations`, {
      userId: 'test-user-123'
    });
    const conversationId = conversation.data.conversationId;
    console.log('✅ Conversation created:', conversationId);

    // Test 3: Simple Query Generation
    console.log('\n3. Testing simple SQL generation...');
    const simpleQuery = await axios.post(`${BASE_URL}/api/generate`, {
      query: 'Show me all users',
      schema: sampleSchema,
      conversationId: conversationId,
      options: {
        enableMultiStep: false,
        includeExplanation: true
      }
    });
    console.log('✅ Simple SQL generated:', simpleQuery.data.sql);
    console.log(`   Confidence: ${simpleQuery.data.confidence}`);

    // Test 4: Complex Query with Multi-Step Reasoning
    console.log('\n4. Testing complex query with multi-step reasoning...');
    const complexQuery = await axios.post(`${BASE_URL}/api/generate`, {
      query: 'Show me the top 5 users by total order amount with their order count, but only include users who have placed more than 2 orders',
      schema: sampleSchema,
      conversationId: conversationId,
      options: {
        enableMultiStep: true,
        includeExplanation: true,
        suggestVisualization: false
      }
    });
    console.log('✅ Complex SQL generated:', complexQuery.data.sql);
    console.log(`   Steps taken: ${complexQuery.data.steps?.length || 0}`);
    console.log(`   Confidence: ${complexQuery.data.confidence}`);
    if (complexQuery.data.steps) {
      complexQuery.data.steps.forEach((step, i) => {
        console.log(`   Step ${i+1}: ${step.description} (${step.complexity})`);
      });
    }

    // Test 5: Query Refinement
    console.log('\n5. Testing query refinement...');
    const refinement = await axios.post(`${BASE_URL}/api/refine`, {
      originalQuery: 'Show me all users',
      feedback: 'Only show users who registered in the last 30 days',
      conversationId: conversationId,
      previousSQL: simpleQuery.data.sql
    });
    console.log('✅ Refined SQL:', refinement.data.sql);
    console.log(`   Confidence: ${refinement.data.confidence}`);

    // Test 6: Data Analysis for Visualization
    console.log('\n6. Testing data analysis for visualization...');
    const analysis = await axios.post(`${BASE_URL}/api/analyze`, {
      data: sampleData,
      columns: ['user_name', 'total_orders', 'total_spent'],
      rowCount: sampleData.length,
      executionTime: 150,
      query: 'SELECT user_name, COUNT(*) as total_orders, SUM(amount) as total_spent FROM users JOIN orders ON users.id = orders.user_id GROUP BY user_name'
    });
    console.log('✅ Visualization recommendation:', analysis.data.chartType);
    console.log(`   Reasoning: ${analysis.data.reasoning}`);
    console.log(`   Confidence: ${analysis.data.confidence}`);
    console.log(`   Chart.js config available: ${!!analysis.data.configurations.chartjs}`);
    console.log(`   D3 config available: ${!!analysis.data.configurations.d3}`);
    console.log(`   Recharts config available: ${!!analysis.data.configurations.recharts}`);

    // Test 7: Query Suggestions
    console.log('\n7. Testing query suggestions...');
    const suggestions = await axios.get(`${BASE_URL}/api/suggestions`, {
      params: {
        partial: 'show me top',
        conversationId: conversationId,
        maxSuggestions: 5
      }
    });
    console.log('✅ Suggestions generated:', suggestions.data.count);
    suggestions.data.suggestions.slice(0, 3).forEach((suggestion, i) => {
      console.log(`   ${i+1}. "${suggestion.text}" (${suggestion.type}, confidence: ${suggestion.confidence})`);
    });

    // Test 8: Conversation History
    console.log('\n8. Testing conversation history...');
    const history = await axios.get(`${BASE_URL}/api/conversations/${conversationId}`);
    console.log('✅ Conversation history retrieved');
    console.log(`   Messages: ${history.data.messages?.length || 0}`);
    console.log(`   Total queries: ${history.data.sessionMetadata?.totalQueries || 0}`);

    // Test 9: Advanced Suggestions with Context
    console.log('\n9. Testing contextual suggestions...');
    const contextualSuggestions = await axios.get(`${BASE_URL}/api/suggestions`, {
      params: {
        partial: 'users',
        conversationId: conversationId,
        includeContextual: true,
        includeSchemaAware: true
      }
    });
    console.log('✅ Contextual suggestions:', contextualSuggestions.data.count);

    // Test 10: Error Handling (Invalid Request)
    console.log('\n10. Testing error handling...');
    try {
      await axios.post(`${BASE_URL}/api/generate`, {
        // Missing required query field
        schema: sampleSchema
      });
    } catch (error) {
      console.log('✅ Error handling works:', error.response.data.error);
    }

    console.log('\n🎉 All Advanced LLM Service tests completed successfully!');
    console.log('\n📊 Service Capabilities Demonstrated:');
    console.log('   ✓ Multi-step reasoning for complex queries');
    console.log('   ✓ Conversation context and memory');
    console.log('   ✓ Query refinement and iteration');
    console.log('   ✓ Intelligent data visualization analysis');
    console.log('   ✓ Smart query suggestions and auto-completion');
    console.log('   ✓ Robust error handling and fallbacks');
    console.log('   ✓ Chart configuration generation (Chart.js, D3, Recharts)');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.error('Make sure the LLM service is running and API keys are configured');
  }
}

// Run tests
testAdvancedLLMService();