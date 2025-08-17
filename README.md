# Natural Language to SQL Visualization App

A full-stack application that converts natural language queries into SQL and visualizes the results.

## Architecture

- **Frontend**: React/Next.js application for user interface
- **Backend**: Node.js/Express API server with integrated OpenAI for SQL generation
- **Database**: PostgreSQL for data storage, MongoDB for query history
- **Visualization**: Reusable chart and graph component library

## Getting Started

See [SETUP.md](SETUP.md) for environment configuration.

```bash
# Install dependencies
npm install

# Run both frontend and backend
npm run dev

# Or run services individually:
cd frontend && npm run dev  # Frontend on http://localhost:3000
cd backend && npm run dev   # Backend on http://localhost:8000
```

## Project Structure

```
nl-to-sql-viz/
├── frontend/          # React/Next.js frontend
├── backend/           # Node.js/Express API with OpenAI integration
├── database/          # Database integration layer
├── visualization-lib/ # Reusable visualization components
└── docs/             # Documentation
```