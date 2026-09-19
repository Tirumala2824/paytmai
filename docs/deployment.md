# HavenDex Deployment Guide

This guide covers deploying HavenDex to production (e.g. Vercel + Supabase PostgreSQL).

---

## 1. Prerequisites

- **Node.js**: v20.x or higher
- **Package Manager**: `npm`
- **Database**: Supabase PostgreSQL instance
- **AI Keys (Optional in Demo Mode)**: Google Gemini, Sarvam AI, Cognee, Paytm

---

## 2. Environment Variables Checklist

Configure the following variables in your deployment dashboard (e.g. Vercel Project Settings):

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# Database Connection (Supabase PostgreSQL via Prisma)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"

# Application URL
NEXT_APP_URL="https://your-domain.vercel.app"

# AI Configuration (Optional in Demo Mode)
GEMINI_API_KEY="your-gemini-api-key"
SARVAM_API_KEY="your-sarvam-api-key"
COGNEE_API_KEY="your-cognee-api-key"

# Paytm Configuration (Optional in Demo Mode)
PAYTM_MID="your-paytm-mid"
PAYTM_MERCHANT_KEY="your-paytm-key"
PAYTM_WEBSITE="DEFAULT"

# Demo Mode (Set to true for deterministic hackathon demonstration)
DEMO_MODE="true"
```

---

## 3. Database Migration & Seed

Run migrations and seed the production database:

```bash
# Generate Prisma Client
npx prisma generate

# Apply migrations to Supabase PostgreSQL
npx prisma db push

# Seed initial properties, users, and historical memory records
npm run seed
```

---

## 4. Supabase OAuth Configuration

1. In the **Supabase Dashboard** > **Authentication** > **URL Configuration**:
   - **Site URL**: `https://your-domain.vercel.app`
   - **Redirect URLs**:
     - `https://your-domain.vercel.app/auth/callback`
     - `http://localhost:3000/auth/callback` (for local development)
2. In **Authentication** > **Providers**:
   - Enable **Google** and enter your Google Cloud OAuth Client ID and Secret.

---

## 5. Production Build Verification

Verify that the application compiles without errors:

```bash
npm run build
```
