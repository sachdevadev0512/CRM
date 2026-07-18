<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b4e2b4fb-8ad0-4465-968a-f153187d6f1b

## Environment Configuration

To run this application, configure the following environment variables in your `.env` or `.env.local` file:

- `VITE_SUPABASE_URL`: Your Supabase Project URL (e.g. `https://your-project.supabase.co`)
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key (public)
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (secure/server-only secret)

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Configure the environment variables in a `.env` file (copied from `.env.example`).
3. Run the app in development mode:
   `npm run dev`

---

## Manual Bootstrap Procedure for First Administrator

On a fresh deployment, no default administrator exists in the `public.admins` database table. Follow this manual process to register the first admin:

1. **Create the user in Supabase Auth**:
   In your Supabase project dashboard, navigate to the **Authentication** page and click **Add User** > **Create User**.
   Enter an email address and a strong password, then save the user. Copy the generated User ID (UUID).

2. **Register the user as an Administrator**:
   Go to the **SQL Editor** in the Supabase dashboard and run the following insert statement to register that user in the `public.admins` table (replacing `USER_UUID` with the actual User ID you copied, and `ADMIN_EMAIL` with the email you registered):

   ```sql
   INSERT INTO public.admins (id, email)
   VALUES ('USER_UUID', 'ADMIN_EMAIL');
   ```

Once this is done, you can sign in to the Admin CRM using these credentials. Subsequent administrators can be created securely from the CRM's interface under **Settings** > **Administrators**.
