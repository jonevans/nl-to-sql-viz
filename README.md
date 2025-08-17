# Natural Language to SQL Visualization App

A full-stack application that converts natural language queries into SQL and visualizes the results.

## Architecture

- **Frontend**: React/Next.js application for user interface
- **Backend**: Node.js/Express API server
- **Database**: Integration layer for various database connections
- **LLM Service**: Natural language processing and SQL generation
- **Visualization**: Reusable chart and graph component library

## Getting Started

Each service can be run independently during development:

```bash
# Frontend
cd frontend && npm run dev

# Backend
cd backend && npm run dev

# LLM Service
cd llm-service && npm run dev
```

## Project Structure

```
nl-to-sql-viz/
├── frontend/          # React/Next.js frontend
├── backend/           # Node.js/Express API
├── database/          # Database integration layer
├── llm-service/       # LLM integration service
├── visualization-lib/ # Reusable visualization components
└── docs/             # Documentation
```