# Middha Ventures Investment CRM

A secure, production-ready Customer Relationship Management (CRM) platform built for **Middha Ventures** to streamline startup deal flow, application management, document storage, and internal investment operations.

---

## Overview

The CRM consists of two primary components:

### Public Startup Application Portal
Entrepreneurs can submit startup applications through a secure public form, including company information, founder details, financial metrics, supporting documents, and pitch materials.

### Internal Admin Portal
Authorized investment team members can:

- Review startup applications
- Search and filter companies
- View uploaded documents
- Update startup information
- Track investment pipeline
- Manage administrators
- Export startup data
- Access audit logs
- Manage platform settings

---

# Features

## Startup Management

- Startup database
- Founder information
- Industry categorization
- Funding history
- Revenue tracking
- Company stage tracking
- Custom notes
- Search & filtering

---

## Document Management

- Secure PDF storage
- Pitch deck uploads
- Business plan uploads
- Supporting document management
- Download access for authorized admins

---

## Administration

- Secure email/password authentication
- Role-based administrator access
- Administrator management
- Change password functionality
- Session protection

---

## Security

Designed with production security best practices:

- Supabase Authentication
- Row Level Security (RLS)
- Protected admin routes
- Secure server-side operations
- Service Role Key isolated to server-side usage
- Environment variable protection
- Audit logging
- Authentication middleware
- Input validation

---

# Technology Stack

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS

## Backend

- Supabase

### Services Used

- Authentication
- PostgreSQL Database
- Row Level Security (RLS)
- Storage
- Edge Functions (if applicable)

---

# Project Structure

```
src/
├── components/
├── pages/
├── hooks/
├── services/
├── contexts/
├── utils/
├── lib/
└── types/
```

---

# Environment Variables

Create a `.env` file using `.env.example`.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

> **Important**
>
> Never commit your `.env` file or Service Role Key to Git.

---

# Local Development

## Prerequisites

- Node.js 20+
- npm

Install dependencies

```bash
npm install
```

Start the development server

```bash
npm run dev
```

Build for production

```bash
npm run build
```

Preview production build

```bash
npm run preview
```

---

# First-Time Deployment

After deploying the project, no administrator exists by default.

## Step 1 — Create an Authentication User

Open your Supabase Dashboard

Authentication

→ Users

→ Add User

Create a new user with:

- Email
- Strong Password

Copy the generated User UUID.

---

## Step 2 — Register the First Administrator

Open:

Supabase Dashboard

→ SQL Editor

Run:

```sql
INSERT INTO public.admins (id, email)
VALUES (
    'USER_UUID',
    'ADMIN_EMAIL'
);
```

Replace:

- `USER_UUID`
- `ADMIN_EMAIL`

with the values created above.

---

## Step 3 — Sign In

You can now log in to the CRM using the credentials created in Step 1.

---

# Administrator Management

Once the first administrator has been created, all future administrators should be added through:

```
Settings
    → Administrators
```

There is no need to manually insert records into the database after the initial bootstrap.

---

# Security Notes

This application assumes:

- Row Level Security is enabled.
- Admin authorization is verified against the `public.admins` table.
- Service Role Key is never exposed to the client.
- Sensitive operations execute only on the server.

Before deploying, ensure:

- Environment variables are configured.
- Storage policies are verified.
- Authentication settings are configured.
- Database migrations have been executed.
- RLS policies are active.

---

# Deployment Checklist

- Configure environment variables
- Run database migrations
- Create first administrator
- Verify authentication
- Test document uploads
- Verify storage permissions
- Confirm RLS policies
- Test administrator access
- Verify audit logging

---

# License

This project is proprietary software developed for **Middha Ventures**.

Unauthorized distribution, reproduction, or commercial use is prohibited.