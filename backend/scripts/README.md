# POC Reset Script

This script resets the POC demo by clearing analytics and creating fresh user accounts.

## Setup

1. **Copy the example credentials file:**
   ```bash
   cp .env.poc-users.example .env.poc-users
   ```

2. **Edit `.env.poc-users` with real credentials** (this file is gitignored)

3. **Run the script:**
   ```bash
   npm run reset:poc
   ```

## What It Does

1. ✅ Clears all session logs (analytics reset)
2. ✅ Removes all existing users
3. ✅ Creates 2 admin users
4. ✅ Creates 8 regular users
5. ✅ Prints summary with credentials

## Security

- ⚠️ **NEVER commit `.env.poc-users`** - it contains real passwords
- ✅ The file is already in `.gitignore`
- ✅ Only `.env.poc-users.example` (with fake credentials) is committed
- ✅ Script loads credentials from environment variables

## For Production (MongoDB Atlas)

The script connects to whatever MongoDB is in your `.env`:

- **Local:** `MONGODB_URI=mongodb://localhost:27017/colony-hardware-viz`
- **Atlas:** `MONGODB_URI=mongodb+srv://...`

Just make sure your `.env` points to the right database before running.
