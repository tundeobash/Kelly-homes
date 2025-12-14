# Database Setup Guide

## Quick Setup Options

### Option 1: Cloud Database (Recommended - Easiest)

#### Using Supabase (Free Tier)
1. Go to https://supabase.com and sign up
2. Create a new project
3. Go to Settings → Database
4. Copy the connection string (URI format)
5. Update `DATABASE_URL` in your `.env` file

#### Using Neon (Free Tier)
1. Go to https://neon.tech and sign up
2. Create a new project
3. Copy the connection string
4. Update `DATABASE_URL` in your `.env` file

#### Using Railway (Free Tier)
1. Go to https://railway.app and sign up
2. Create a new PostgreSQL database
3. Copy the connection string
4. Update `DATABASE_URL` in your `.env` file

### Option 2: Local PostgreSQL

#### macOS (using Homebrew)
```bash
# Install PostgreSQL
brew install postgresql@14

# Start PostgreSQL service
brew services start postgresql@14

# Create database
createdb kellyhomes

# Update .env file with:
# DATABASE_URL="postgresql://$(whoami)@localhost:5432/kellyhomes?schema=public"
```

#### macOS (using Postgres.app)
1. Download from https://postgresapp.com
2. Install and start the app
3. Click "Initialize" to create a new server
4. Create database: `createdb kellyhomes`
5. Update `.env` with connection string

#### Linux (Ubuntu/Debian)
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database
sudo -u postgres createdb kellyhomes
sudo -u postgres createuser -s $(whoami)

# Update .env file with:
# DATABASE_URL="postgresql://$(whoami)@localhost:5432/kellyhomes?schema=public"
```

#### Windows
1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Install PostgreSQL (remember the password you set)
3. Open pgAdmin or Command Prompt
4. Create database: `createdb kellyhomes`
5. Update `.env` with connection string:
   ```
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/kellyhomes?schema=public"
   ```

## Setup Steps

1. **Create .env file:**
   ```bash
   chmod +x setup-env.sh
   ./setup-env.sh
   ```

2. **Update DATABASE_URL in .env** with your PostgreSQL connection string

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Push database schema:**
   ```bash
   npx prisma db push
   ```

5. **Seed the database:**
   ```bash
   npm run db:seed
   ```

6. **Start development server:**
   ```bash
   npm run dev
   ```

## Connection String Format

```
postgresql://[username]:[password]@[host]:[port]/[database]?schema=public
```

Examples:
- Local: `postgresql://user:password@localhost:5432/kellyhomes?schema=public`
- Supabase: `postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres`
- Neon: `postgresql://[user]:[password]@[host]/[db]?sslmode=require`

## Troubleshooting

### Connection refused
- Make sure PostgreSQL is running
- Check if the port (default 5432) is correct
- Verify username and password

### Database doesn't exist
- Create it: `createdb kellyhomes`
- Or use an existing database name in the connection string

### Permission denied
- Make sure the user has permissions to create tables
- For local PostgreSQL, you may need to create a user first

