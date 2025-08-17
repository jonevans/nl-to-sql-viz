# Advanced LLM Service

A sophisticated LLM-powered service that converts natural language to SQL, provides multi-step reasoning, maintains conversation context, and generates intelligent visualizations.

## 🌟 Key Features

### 1. **Natural Language to SQL Generation**
- Support for OpenAI GPT-4 and Anthropic Claude
- Context-aware SQL generation
- Multi-provider fallback system
- Confidence scoring and explanations

### 2. **Multi-Step Reasoning Engine**
- Automatically decomposes complex queries into manageable steps
- Dependency tracking between query steps
- Step-by-step execution with validation
- Complexity analysis (simple/moderate/complex)

### 3. **Conversation Memory & Context**
- Persistent conversation sessions
- Context-aware query refinement
- User pattern analysis
- Session metadata tracking
- 30-minute session timeout with cleanup

### 4. **Intelligent Data Analysis**
- Automatic data type inference
- Statistical analysis (mean, median, correlations)
- Categorical vs numerical column detection
- Data quality assessment

### 5. **Smart Visualization Recommendations**
- AI-powered chart type suggestions
- Data-driven visualization logic
- Chart configurations for Chart.js, D3, and Recharts
- Confidence-based recommendations

### 6. **Advanced Query Suggestions**
- Real-time auto-completion
- Schema-aware suggestions
- Template-based patterns
- Context-driven recommendations
- Fuzzy matching and similarity scoring

### 7. **Robust Error Handling**
- Circuit breaker pattern for reliability
- Automatic retry with exponential backoff
- Fallback response generation
- Provider health monitoring
- Detailed error categorization

## 🏗️ Architecture

```
AdvancedLLMService (Main Orchestrator)
├── ConversationManager (Session Management)
├── MultiStepReasoningEngine (Query Decomposition)
├── PromptEngine (Template Management)
├── DataAnalysisService (Data Intelligence)
├── ChartConfigGenerator (Visualization Configs)
├── QuerySuggestionEngine (Smart Suggestions)
└── ErrorHandler (Fault Tolerance)
```

## 🚀 API Endpoints

### Core Generation
- `POST /api/generate` - Convert natural language to SQL
- `POST /api/refine` - Refine queries based on feedback
- `POST /api/analyze` - Analyze data for visualization

### Intelligence Features
- `GET /api/suggestions` - Get query suggestions
- `GET /health` - Service health check

### Conversation Management
- `POST /api/conversations` - Create new conversation
- `GET /api/conversations/:id` - Get conversation history
- `DELETE /api/conversations/:id` - Delete conversation

## 📝 Usage Examples

### Basic SQL Generation
```javascript
const response = await fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "Show me the top 10 customers by revenue",
    schema: { tables: [...] },
    options: {
      enableMultiStep: true,
      includeExplanation: true,
      suggestVisualization: true
    }
  })
});

const result = await response.json();
// Returns: { sql, confidence, explanation, steps, suggestions, visualization }
```

### Query Refinement
```javascript
const refined = await fetch('/api/refine', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    originalQuery: "Show me sales data",
    feedback: "Only include data from last month",
    conversationId: "conv-123",
    previousSQL: "SELECT * FROM sales"
  })
});
```

### Data Visualization Analysis
```javascript
const analysis = await fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: [{ date: '2024-01', revenue: 1000 }, ...],
    columns: ['date', 'revenue']
  })
});

const viz = await analysis.json();
// Returns chart configurations for Chart.js, D3, and Recharts
```

### Smart Suggestions
```javascript
const suggestions = await fetch('/api/suggestions?partial=show me top&conversationId=conv-123');
const results = await suggestions.json();
// Returns contextual query completions and alternatives
```

## 🔧 Configuration

### Environment Variables
```env
# LLM Providers
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
DEFAULT_LLM_PROVIDER=openai
DEFAULT_MODEL=gpt-4

# Service Configuration
PORT=3002
NODE_ENV=production
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Provider Configuration
- **OpenAI**: GPT-4, GPT-3.5-turbo
- **Anthropic**: Claude 3 Sonnet, Claude 3 Haiku
- **Fallback**: Automatic provider switching on failures

## 🧠 Intelligent Features

### Multi-Step Reasoning
The service automatically identifies complex queries and breaks them down:

1. **Complexity Analysis**: Detects joins, subqueries, aggregations
2. **Step Decomposition**: Creates logical sequence of operations
3. **Dependency Tracking**: Ensures proper execution order
4. **Progressive Execution**: Builds complex queries incrementally

### Conversation Context
Maintains rich conversation state:

- **Message History**: Full conversation timeline
- **User Patterns**: Preferred tables, chart types, query complexity
- **Session Metadata**: Usage statistics and preferences
- **Context Injection**: Uses history to improve responses

### Smart Suggestions
Multiple suggestion engines working together:

- **Auto-completion**: Common patterns and phrase completion
- **Template Matching**: Pre-built query templates
- **Schema-aware**: Table and column specific suggestions
- **Contextual**: Based on conversation history and patterns

## 🔒 Security & Reliability

### Error Handling
- **Circuit Breaker**: Prevents cascade failures
- **Retry Logic**: Exponential backoff with jitter
- **Fallback Responses**: Graceful degradation
- **Error Classification**: Recoverable vs non-recoverable

### Rate Limiting
- General API: 100 requests/15 minutes
- LLM Endpoints: 20 requests/15 minutes
- Health Checks: Unlimited

### Input Validation
- Request schema validation
- SQL injection prevention
- Input sanitization
- Size limits on payloads

## 📊 Monitoring

### Health Metrics
- Provider availability (OpenAI, Anthropic)
- Active conversation count
- Response times
- Error rates by category

### Performance Tracking
- LLM response times
- Multi-step execution times
- Cache hit rates
- Memory usage

## 🚀 Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Set Environment Variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

4. **Test the Service**:
   ```bash
   curl http://localhost:3002/health
   ```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- --grep "MultiStepReasoning"
```

## 📈 Advanced Usage

### Custom Prompt Engineering
The service supports custom prompt templates for different query types:

```javascript
// Custom complexity analysis
const steps = await multiStepEngine.decompose({
  query: "Complex analytical query...",
  options: { maxSteps: 5, complexity: 'complex' }
});
```

### Visualization Customization
Generate specific chart configurations:

```javascript
const chartConfig = chartGenerator.generateConfigurations(
  'bar', // Chart type
  queryResult,
  dataInsights
);
// Returns Chart.js, D3, and Recharts configurations
```

### Error Recovery
Implement custom error handling:

```javascript
const result = await errorHandler.executeWithRetry(
  () => llmService.processQuery(request),
  { phase: 'generation', conversationId: 'conv-123' },
  (error) => error.statusCode < 500 // Custom retry condition
);
```

This LLM service provides enterprise-grade natural language to SQL conversion with advanced reasoning, context awareness, and intelligent visualizations.