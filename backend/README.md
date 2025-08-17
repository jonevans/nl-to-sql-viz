# Natural Language to SQL Backend API

A robust Express.js backend API that converts natural language queries to SQL, executes them, and provides data visualization suggestions.

## 🚀 Features

- **Natural Language Processing**: Convert human queries to SQL using OpenAI/Anthropic APIs
- **SQL Execution**: Safely execute SQL queries with validation and security checks
- **Data Visualization**: Analyze data and suggest appropriate chart types
- **Database Schema Management**: Manage and explore database schemas
- **Query Suggestions**: Real-time suggestions and auto-completion
- **Favorites System**: Save and organize frequently used queries
- **Security**: Rate limiting, input validation, error handling
- **MongoDB Integration**: Full MongoDB support with Mongoose

## 📋 API Endpoints

### 🔍 Query Generation
- `POST /api/query` - Convert natural language to SQL
- `GET /api/query/history` - Get query history
- `GET /api/query/:id` - Get specific query

### ⚡ SQL Execution  
- `POST /api/execute` - Execute SQL queries safely
- `POST /api/execute/validate` - Validate SQL without executing
- `GET /api/execute/connection` - Get database connection info

### 📊 Data Visualization
- `POST /api/visualize` - Analyze data and suggest visualizations
- `GET /api/visualize/types` - Get available chart types
- `POST /api/visualize/preview` - Generate chart preview

### 🗄️ Database Schema
- `GET /api/schema` - Get database schema
- `GET /api/schema/all` - Get all database schemas
- `GET /api/schema/search` - Search tables and columns
- `GET /api/schema/table` - Get specific table information
- `POST /api/schema/refresh` - Refresh schema from database

### 💡 Query Suggestions
- `GET /api/suggestions` - Get real-time query suggestions
- `GET /api/suggestions/popular` - Get popular queries
- `GET /api/suggestions/recent` - Get recent queries
- `GET /api/suggestions/templates` - Get query templates
- `GET /api/suggestions/context` - Get context-aware suggestions

### ⭐ Favorites Management
- `POST /api/favorites` - Create favorite query
- `GET /api/favorites` - Get all favorites (with filtering)
- `GET /api/favorites/:id` - Get specific favorite
- `PUT /api/favorites/:id` - Update favorite
- `DELETE /api/favorites/:id` - Delete favorite
- `POST /api/favorites/:id/duplicate` - Duplicate favorite
- `GET /api/favorites/meta/tags` - Get all tags

## 🛠️ Setup & Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment variables** (copy `.env.example` to `.env`):
   ```env
   NODE_ENV=development
   PORT=3001
   
   # MongoDB
   MONGODB_URI=mongodb://admin:password@localhost:27017/nlsql_db
   
   # LLM APIs
   OPENAI_API_KEY=your-openai-key
   ANTHROPIC_API_KEY=your-anthropic-key
   DEFAULT_LLM_PROVIDER=openai
   DEFAULT_MODEL=gpt-4
   
   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   ```

3. **Start the server**:
   ```bash
   # Development
   npm run dev
   
   # Production
   npm run build
   npm start
   ```

## 🧪 Testing

Run the API test suite:
```bash
node test-api.js
```

## 🔒 Security Features

- **Rate Limiting**: Different limits for different endpoint types
- **Input Validation**: Comprehensive validation with Joi schemas  
- **SQL Injection Protection**: Query validation and sanitization
- **Error Handling**: Structured error responses with logging
- **CORS & Helmet**: Security headers and cross-origin protection

## 📝 Rate Limits

- **General API**: 100 requests per 15 minutes
- **LLM Endpoints**: 20 requests per 15 minutes  
- **Read-only**: 200 requests per 15 minutes
- **Expensive Operations**: 10 requests per hour

## 🗃️ Database Models

### Query
- Natural language queries and generated SQL
- Execution metadata and confidence scores
- User association and timestamps

### Favorite
- Saved queries with names and descriptions
- Tagging system for organization
- User-specific collections

### DatabaseSchema
- Database structure information
- Table and column metadata
- Relationship mappings

## 🔌 LLM Integration

Supports multiple LLM providers:
- **OpenAI**: GPT-4, GPT-3.5-turbo
- **Anthropic**: Claude 3 Sonnet, Haiku
- **Local**: Custom local models (extensible)

## 📊 Data Visualization

Automatic chart type suggestions based on:
- Data types (numerical, categorical, dates)
- Data distribution and patterns
- Best practices for different visualizations

Supported chart types:
- Bar charts, Line charts, Pie charts
- Scatter plots, Area charts, Data tables

## 🏗️ Architecture

```
backend/
├── src/
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Express middleware
│   ├── models/          # MongoDB schemas
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic
│   ├── types/           # TypeScript interfaces
│   └── utils/           # Helper functions
├── config/             # Configuration files
└── __tests__/          # Test files
```

## 🚦 Health Check

Monitor API health:
```bash
GET /health
```

Returns server status and timestamp.