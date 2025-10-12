# Deployment Guide: Colony Hardware Sales Advisor

Complete step-by-step guide to deploy the application to production using Render and MongoDB Atlas.

## Architecture Overview

- **Frontend**: Next.js app on Render
- **Backend**: Node.js/Express API on Render
- **PostgreSQL**: Render PostgreSQL (Colony Hardware data)
- **MongoDB**: MongoDB Atlas (auth, conversations, analytics)

---

## Prerequisites

- GitHub account (code must be pushed to GitHub for Render)
- Render account (free): https://render.com
- MongoDB Atlas account (free): https://www.mongodb.com/cloud/atlas/register

---

## Part 1: MongoDB Atlas Setup (15 minutes)

### Step 1.1: Create MongoDB Atlas Cluster

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up or log in
3. Click **"Build a Database"**
4. Select **"M0 Free"** tier
5. Choose a cloud provider: **AWS**
6. Choose region: **us-east-1** (or closest to you)
7. Cluster Name: `colony-hardware-cluster`
8. Click **"Create"**
9. Wait 3-5 minutes for cluster to provision

### Step 1.2: Create Database User

1. Security → Database Access → **"Add New Database User"**
2. Authentication Method: **Password**
3. Username: `colony_admin`
4. Password: Click **"Autogenerate Secure Password"** → **COPY THIS PASSWORD**
5. Database User Privileges: **"Read and write to any database"**
6. Click **"Add User"**

### Step 1.3: Allow Network Access

1. Security → Network Access → **"Add IP Address"**
2. Click **"Allow Access from Anywhere"** (for POC; use specific IPs in production)
3. IP Address will be: `0.0.0.0/0`
4. Click **"Confirm"**

### Step 1.4: Get Connection String

1. Click **"Database"** in left sidebar
2. Click **"Connect"** button on your cluster
3. Choose **"Connect your application"**
4. Driver: **Node.js**, Version: **5.5 or later**
5. Copy the connection string - it looks like:
   ```
   mongodb+srv://colony_admin:<password>@colony-hardware-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. **IMPORTANT**: Replace `<password>` with the password you copied in Step 1.2
7. **Save this connection string** - you'll need it later

**Example final connection string:**
```
mongodb+srv://colony_admin:Abc123XyZ456@colony-hardware-cluster.abc12.mongodb.net/?retryWrites=true&w=majority
```

---

## Part 2: Export Local PostgreSQL Database (10 minutes)

### Step 2.1: Create Database Dump

1. Open Terminal
2. Navigate to your project:
   ```bash
   cd "/Users/jevans/Colony Data/nl-to-sql-viz"
   ```

3. Create a dump of your database:
   ```bash
   pg_dump -U jevans -d colony_hardware_db -F c -f colony_hardware_db.dump
   ```

4. Verify the dump was created:
   ```bash
   ls -lh colony_hardware_db.dump
   ```
   Should show ~100-200 MB file

### Step 2.2: Alternative - SQL Format (if above fails)

If the custom format doesn't work, use plain SQL:
```bash
pg_dump -U jevans -d colony_hardware_db -f colony_hardware_db.sql
```

**Save this file** - you'll upload it to Render in Part 3.

---

## Part 3: Render PostgreSQL Setup (15 minutes)

### Step 3.1: Create PostgreSQL Database

1. Go to https://dashboard.render.com
2. Sign up or log in (can use GitHub to sign in)
3. Click **"New +"** → **"PostgreSQL"**
4. Settings:
   - Name: `colony-hardware-db`
   - Database: `colony_hardware_db`
   - User: `colony_admin`
   - Region: **Ohio (US East)** (or closest to you)
   - PostgreSQL Version: **16**
   - Plan: **Free** (90 days free, then $7/mo)
5. Click **"Create Database"**
6. Wait 2-3 minutes for database to provision

### Step 3.2: Get Connection Details

After database is created, you'll see connection info:

1. **External Database URL** (for importing data):
   ```
   postgresql://colony_admin:xxxx@dpg-xxxxx-a.ohio-postgres.render.com/colony_hardware_db
   ```
   **COPY THIS** - you'll need it for importing data

2. **Internal Database URL** (for backend service):
   ```
   postgresql://colony_admin:xxxx@dpg-xxxxx/colony_hardware_db
   ```
   **COPY THIS TOO** - you'll use it in backend environment variables

3. **PSQL Command** (for direct access):
   ```
   PGPASSWORD=xxxx psql -h dpg-xxxxx-a.ohio-postgres.render.com -U colony_admin colony_hardware_db
   ```
   **COPY THIS** - you'll use it to restore your data

### Step 3.3: Import Your Data to Render

**Option A: Using pg_restore (if you created .dump file)**

1. In Terminal, run:
   ```bash
   pg_restore -h dpg-xxxxx-a.ohio-postgres.render.com \
     -U colony_admin \
     -d colony_hardware_db \
     --no-owner \
     --no-acl \
     colony_hardware_db.dump
   ```

2. When prompted for password, enter the password from Render dashboard

**Option B: Using psql (if you created .sql file)**

1. In Terminal, run:
   ```bash
   psql -h dpg-xxxxx-a.ohio-postgres.render.com \
     -U colony_admin \
     -d colony_hardware_db \
     -f colony_hardware_db.sql
   ```

2. When prompted for password, enter the password from Render dashboard

**This will take 5-10 minutes** to upload 1.79M rows.

### Step 3.4: Verify Data Import

1. Connect to the database using the PSQL Command from Render:
   ```bash
   PGPASSWORD=xxxx psql -h dpg-xxxxx-a.ohio-postgres.render.com -U colony_admin colony_hardware_db
   ```

2. Run verification queries:
   ```sql
   SELECT COUNT(*) FROM products;       -- Should show ~68,830
   SELECT COUNT(*) FROM customers;      -- Should show ~14,804
   SELECT COUNT(*) FROM sales_orders;   -- Should show ~1,795,100
   \q
   ```

---

## Part 4: Prepare Code for Deployment (10 minutes)

### Step 4.1: Update Backend Environment Variables

Your backend needs environment variables. Create a note with these values (you'll paste them into Render):

```
# Server
NODE_ENV=production
PORT=8000

# PostgreSQL (use INTERNAL URL from Render)
DATABASE_URL=postgresql://colony_admin:xxxx@dpg-xxxxx/colony_hardware_db

# MongoDB Atlas (from Part 1)
MONGODB_URI=mongodb+srv://colony_admin:Abc123XyZ456@colony-hardware-cluster.abc12.mongodb.net/?retryWrites=true&w=majority

# OpenAI
OPENAI_API_KEY=your-openai-api-key-here

# JWT Authentication
JWT_SECRET=generate-a-random-string-here-at-least-32-characters-long
JWT_EXPIRES_IN=7d

# Auth Settings
AUTH_ENABLED=true
```

**Generate JWT Secret:**
```bash
openssl rand -base64 32
```
Copy the output and use it as JWT_SECRET.

### Step 4.2: Update Frontend Environment Variables

Create another note for frontend variables:

```
NEXT_PUBLIC_API_URL=https://colony-hardware-backend.onrender.com
```

**Note**: You'll get the actual backend URL after creating the backend service in Part 5.

### Step 4.3: Add Build Scripts (if missing)

1. Check `backend/package.json` has these scripts:
   ```json
   "scripts": {
     "dev": "nodemon src/index.ts",
     "build": "tsc",
     "start": "node dist/index.js"
   }
   ```

2. Check `frontend/package.json` has these scripts:
   ```json
   "scripts": {
     "dev": "next dev",
     "build": "next build",
     "start": "next start"
   }
   ```

### Step 4.4: Commit and Push to GitHub

1. Make sure all changes are committed:
   ```bash
   cd "/Users/jevans/Colony Data/nl-to-sql-viz"
   git add -A
   git status
   ```

2. If there are changes, commit them:
   ```bash
   git commit -m "chore: Prepare for production deployment"
   ```

3. Push to GitHub:
   ```bash
   git push origin colony-hardware-conversational
   ```

4. **IMPORTANT**: Make sure your repository is either:
   - Public, OR
   - You've connected your GitHub account to Render with repo access

---

## Part 5: Deploy Backend to Render (15 minutes)

### Step 5.1: Create Backend Web Service

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect to your GitHub repository:
   - Click **"Connect GitHub"** (if not already connected)
   - Find your repository: `nl-to-sql-viz`
   - Click **"Connect"**

### Step 5.2: Configure Backend Service

**Settings:**
- Name: `colony-hardware-backend`
- Region: **Ohio (US East)** (same as database)
- Branch: `colony-hardware-conversational`
- Root Directory: `backend`
- Runtime: **Node**
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Plan: **Free**

### Step 5.3: Add Environment Variables

Click **"Advanced"** → **"Add Environment Variable"**

Add each variable from Step 4.1:

| Key | Value |
|-----|-------|
| NODE_ENV | production |
| PORT | 8000 |
| DATABASE_URL | (Internal PostgreSQL URL from Part 3) |
| MONGODB_URI | (MongoDB connection string from Part 1) |
| OPENAI_API_KEY | (Your OpenAI API key) |
| JWT_SECRET | (Generated random string) |
| JWT_EXPIRES_IN | 7d |
| AUTH_ENABLED | true |

### Step 5.4: Deploy Backend

1. Click **"Create Web Service"**
2. Render will:
   - Clone your repo
   - Install dependencies
   - Build TypeScript
   - Start the server
3. **Wait 5-10 minutes** for deployment
4. Watch the logs - look for:
   ```
   Connected to MongoDB
   PostgresService initializing
   Server running on port 8000 in production mode
   ```

### Step 5.5: Get Backend URL

1. After deployment succeeds, you'll see your backend URL:
   ```
   https://colony-hardware-backend.onrender.com
   ```
2. **COPY THIS URL** - you need it for the frontend

### Step 5.6: Test Backend Health

1. Open in browser:
   ```
   https://colony-hardware-backend.onrender.com/health
   ```
2. Should see:
   ```json
   {"status":"OK","timestamp":"2025-10-11T..."}
   ```

---

## Part 6: Deploy Frontend to Render (15 minutes)

### Step 6.1: Create Frontend Web Service

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Select your repository: `nl-to-sql-viz`

### Step 6.2: Configure Frontend Service

**Settings:**
- Name: `colony-hardware-frontend`
- Region: **Ohio (US East)** (same as backend)
- Branch: `colony-hardware-conversational`
- Root Directory: `frontend`
- Runtime: **Node**
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Plan: **Free**

### Step 6.3: Add Environment Variables

Click **"Advanced"** → **"Add Environment Variable"**

| Key | Value |
|-----|-------|
| NEXT_PUBLIC_API_URL | https://colony-hardware-backend.onrender.com |

(Use the backend URL from Step 5.5)

### Step 6.4: Deploy Frontend

1. Click **"Create Web Service"**
2. **Wait 5-10 minutes** for deployment
3. Watch the logs - look for:
   ```
   ✓ Compiled successfully
   ✓ Ready in XXXms
   ```

### Step 6.5: Get Frontend URL

After deployment, your frontend URL will be:
```
https://colony-hardware-frontend.onrender.com
```

---

## Part 7: Initial Setup & Testing (10 minutes)

### Step 7.1: Create Admin User

You need to create the first admin user. You have two options:

**Option A: Use Backend API Directly**

1. Use curl or Postman to register:
   ```bash
   curl -X POST https://colony-hardware-backend.onrender.com/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@colonyhardware.com",
       "password": "SecurePassword123!",
       "name": "Admin User",
       "company": "Colony Hardware",
       "role": "admin"
     }'
   ```

**Option B: Manually Update MongoDB Atlas**

1. Go to MongoDB Atlas dashboard
2. Click **"Browse Collections"** on your cluster
3. Find database: `colony_hardware_db` (or whatever MongoDB creates)
4. Find collection: `users`
5. Find your user document
6. Click **"Edit"**
7. Change `"role": "user"` to `"role": "admin"`
8. Click **"Update"**

### Step 7.2: Test Login

1. Open your frontend URL:
   ```
   https://colony-hardware-frontend.onrender.com
   ```

2. You should see the login page

3. Click **"Register"** (if you didn't create admin user yet)
   - Email: `admin@colonyhardware.com`
   - Password: (create a strong password)
   - Name: `Admin User`
   - Company: `Colony Hardware`

4. After registration, accept POC Terms

5. You should see the Sales Advisor chat interface

### Step 7.3: Test Queries

Try these test queries:

1. **"Show me sales from Michigan"**
   - Should return data with Michigan sales

2. **"What are our top selling products?"**
   - Should return product list with sales data

3. **"How many orders did we have in January 2023?"**
   - Should return count of orders

4. **Follow-up**: "What's the total dollar value?"
   - Should maintain context and calculate total

### Step 7.4: Test Admin Analytics

1. Click on your name in the upper right
2. Should see dropdown with **"📊 Analytics Stats"** (admin only)
3. Click **"Analytics Stats"**
4. Should see dashboard with summary cards
5. Try clicking **"View Data"** on any endpoint
6. Try **"Export as CSV"**

---

## Part 8: Configure Custom Domain (Optional)

If you want to use a custom domain like `sales.colonyhardware.com`:

### Step 8.1: Add Custom Domain in Render

1. Go to your frontend service in Render
2. Click **"Settings"** → **"Custom Domain"**
3. Add your domain: `sales.colonyhardware.com`
4. Render will show you DNS records to add

### Step 8.2: Update DNS

1. Go to your domain registrar (GoDaddy, Cloudflare, etc.)
2. Add CNAME record:
   - Name: `sales`
   - Value: `colony-hardware-frontend.onrender.com`
   - TTL: Auto or 3600

3. Wait 5-30 minutes for DNS propagation

### Step 8.3: Update Environment Variables

1. Update frontend environment variable:
   - Key: `NEXT_PUBLIC_API_URL`
   - Keep as: `https://colony-hardware-backend.onrender.com`
   - (Backend URL stays the same)

2. Render will auto-redeploy

---

## Part 9: Monitoring & Maintenance

### Free Tier Limitations

**Render Free Tier:**
- ⚠️ **Services spin down after 15 minutes of inactivity**
- First request after spin-down takes 30-60 seconds to wake up
- PostgreSQL free tier lasts 90 days, then $7/month
- Frontend and backend stay free (with spin-down)

**MongoDB Atlas Free Tier:**
- ✅ Free forever
- 512 MB storage (plenty for auth + logs)
- No spin-down issues

### Monitoring Logs

**View Backend Logs:**
1. Render Dashboard → `colony-hardware-backend` → **"Logs"**
2. Look for errors, slow queries, authentication issues

**View Frontend Logs:**
1. Render Dashboard → `colony-hardware-frontend` → **"Logs"**
2. Look for build errors, runtime issues

**View MongoDB Logs:**
1. MongoDB Atlas → **"Metrics"**
2. Monitor connections, queries, storage

### Health Checks

Set up a health check monitor (optional):

1. Use a service like **UptimeRobot** (free): https://uptimerobot.com
2. Monitor URL: `https://colony-hardware-backend.onrender.com/health`
3. Check interval: 5 minutes
4. Get email alerts if backend goes down

### Backup Strategy

**PostgreSQL Backups:**
- Render automatically backs up daily (even on free tier)
- Manual backup: Use Render dashboard → Database → **"Backups"**

**MongoDB Backups:**
- Atlas free tier has point-in-time restore (limited)
- Manual backup: Use `mongodump` if needed

---

## Troubleshooting

### Backend Won't Start

**Check logs for:**
- `MongoDB connection failed` → Check MONGODB_URI
- `PostgreSQL connection failed` → Check DATABASE_URL
- `OpenAI API error` → Check OPENAI_API_KEY
- `Port already in use` → Change PORT to 8000 or 10000

### Frontend Can't Connect to Backend

**Check:**
1. Backend is deployed and healthy: `/health` endpoint
2. `NEXT_PUBLIC_API_URL` is correct in frontend env vars
3. CORS is enabled (already configured in backend)
4. Try full URL in browser: `https://backend-url.onrender.com/health`

### Authentication Issues

**Check:**
1. JWT_SECRET is set in backend
2. MongoDB is connected (users collection exists)
3. Check browser console for errors
4. Try registering a new user

### Slow First Load

**This is normal** on Render free tier:
- Services spin down after 15 minutes idle
- First request takes 30-60 seconds to wake up
- Subsequent requests are fast

**Workaround**: Use UptimeRobot to ping every 14 minutes (keeps service awake)

### Database Connection Errors

**PostgreSQL:**
- Verify DATABASE_URL is the **Internal** URL (for backend on Render)
- Check connection from your computer using **External** URL
- Ensure IP allowlist includes Render IPs (should be automatic)

**MongoDB:**
- Verify IP allowlist is `0.0.0.0/0` (or add Render IPs)
- Check username/password in connection string
- Verify `retryWrites=true&w=majority` is in connection string

---

## Environment Variables Reference

### Backend (.env on Render)

```bash
NODE_ENV=production
PORT=8000

# PostgreSQL (Internal URL from Render)
DATABASE_URL=postgresql://colony_admin:PASSWORD@dpg-xxxxx/colony_hardware_db

# MongoDB Atlas
MONGODB_URI=mongodb+srv://colony_admin:PASSWORD@colony-hardware-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority

# OpenAI
OPENAI_API_KEY=sk-...

# JWT
JWT_SECRET=random-32-character-string
JWT_EXPIRES_IN=7d

# Auth
AUTH_ENABLED=true
```

### Frontend (.env on Render)

```bash
NEXT_PUBLIC_API_URL=https://colony-hardware-backend.onrender.com
```

---

## Security Checklist

Before going live:

- [ ] Change all default passwords
- [ ] Use strong JWT_SECRET (32+ random characters)
- [ ] Verify AUTH_ENABLED=true in production
- [ ] MongoDB Atlas IP whitelist configured
- [ ] PostgreSQL connection uses SSL (automatic on Render)
- [ ] OpenAI API key is valid and has usage limits
- [ ] Environment variables are set in Render (not in code)
- [ ] .env files are in .gitignore (never commit secrets)

---

## Cost Summary

**Total Cost for POC (until Nov 15, 2025):**

| Service | Cost | Notes |
|---------|------|-------|
| MongoDB Atlas | **FREE** | M0 tier, free forever |
| Render Frontend | **FREE** | With spin-down after 15 min idle |
| Render Backend | **FREE** | With spin-down after 15 min idle |
| Render PostgreSQL | **FREE → $7/mo** | 90 days free, then $7/mo |
| **Total Monthly** | **$0-7** | After 90-day PostgreSQL trial |

---

## Next Steps

After successful deployment:

1. ✅ Share the frontend URL with Colony Hardware users
2. ✅ Monitor analytics dashboard for usage
3. ✅ Collect feedback during POC period
4. ✅ Export analytics data before Nov 15, 2025
5. ✅ Generate ROI report using session logs

---

## Support

**Render Issues:**
- Documentation: https://render.com/docs
- Support: help@render.com

**MongoDB Atlas Issues:**
- Documentation: https://www.mongodb.com/docs/atlas/
- Support: https://support.mongodb.com

**Application Issues:**
- Check logs in Render dashboard
- Review error messages in browser console
- Contact your Impact Networking representative

---

**Deployment Date**: ___________
**Deployed By**: ___________
**Frontend URL**: ___________
**Backend URL**: ___________

---

*Good luck with your deployment! 🚀*
