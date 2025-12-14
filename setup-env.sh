#!/bin/bash

# Setup script for Kelly Homes environment variables

echo "Setting up Kelly Homes environment..."

# Check if .env already exists
if [ -f .env ]; then
    echo ".env file already exists. Backing up to .env.backup"
    cp .env .env.backup
fi

# Generate NextAuth secret
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Create .env file
cat > .env << EOF
# Database
# For local PostgreSQL, use:
# DATABASE_URL="postgresql://username:password@localhost:5432/kellyhomes?schema=public"
# 
# For cloud databases (recommended for development):
# - Supabase: https://supabase.com (free tier available)
# - Neon: https://neon.tech (free tier available)
# - Railway: https://railway.app (free tier available)
# - Render: https://render.com (free tier available)
#
# Example for Supabase:
# DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
#
# Example for Neon:
# DATABASE_URL="postgresql://[user]:[password]@[neon-hostname]/[dbname]?sslmode=require"
DATABASE_URL="postgresql://user:password@localhost:5432/kellyhomes?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"

# Cloudinary (optional - can use local storage for MVP)
# Sign up at https://cloudinary.com for free account
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""

# Stripe (mock/test mode)
# Get test keys from https://dashboard.stripe.com/test/apikeys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
EOF

echo "✅ .env file created successfully!"
echo ""
echo "⚠️  IMPORTANT: Update DATABASE_URL with your PostgreSQL connection string"
echo ""
echo "Options for PostgreSQL:"
echo "1. Local PostgreSQL:"
echo "   - Install: brew install postgresql@14 (macOS)"
echo "   - Start: brew services start postgresql@14"
echo "   - Create DB: createdb kellyhomes"
echo "   - Update DATABASE_URL in .env"
echo ""
echo "2. Cloud Database (Recommended):"
echo "   - Supabase: https://supabase.com (free tier)"
echo "   - Neon: https://neon.tech (free tier)"
echo "   - Copy connection string to DATABASE_URL in .env"
echo ""

