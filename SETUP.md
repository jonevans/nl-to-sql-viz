# Environment Setup Guide

## Required Environment Variables

### Backend Service (`/backend/.env`)

Create a `.env` file in the `backend` directory with the following variables:

```bash
# OpenAI Configuration (REQUIRED)
# Get your API key from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_API_KEY_HERE

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hardware_store_db
DB_USER=jevans  # Or your PostgreSQL username
# DB_PASSWORD=  # Add if your PostgreSQL requires a password

# MongoDB (for query history)
MONGODB_URI=mongodb://localhost:27017/nl-to-sql-viz

# Server Configuration
PORT=8000
NODE_ENV=development
```

### Frontend Service (`/frontend/.env.local`)

Create a `.env.local` file in the `frontend` directory:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Security Notes

⚠️ **IMPORTANT**: 
- Never commit `.env` files to version control
- Keep your API keys secret
- Rotate keys if they are ever exposed
- Use different keys for development and production

## Quick Start

1. Copy the example environment file:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Edit `.env` and add your actual OpenAI API key

3. Ensure PostgreSQL is running with your database:
   ```bash
   psql -U jevans -d hardware_store_db -c "\dt"
   ```

4. Start the backend:
   ```bash
   cd backend
   npm run dev
   ```

5. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

## Troubleshooting

### "role 'postgres' does not exist"
- Update `DB_USER` in `.env` to match your PostgreSQL user (e.g., `jevans`)

### "OPENAI_API_KEY is not defined"
- Ensure you've added your OpenAI API key to `backend/.env`
- Restart the backend service after adding the key

### Query returns no results
- Check that your database has data
- Verify the LLM is using GPT-4 for better query understanding