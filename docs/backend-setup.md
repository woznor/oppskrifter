# Supabase setup

Project: `ebaszlyqrneorhjlrxav` (`https://ebaszlyqrneorhjlrxav.supabase.co`). The frontend stays on GitHub Pages. Recipes live in Postgres; uploaded images live in a private Storage bucket. One shared password grants read, create, edit, delete and upload access.

## Configure and deploy

1. In Supabase's SQL Editor, run `supabase/migrations/202610070001_recipes.sql` once. It creates tables, the private `recipe-images` bucket and service-only import/rate-limit functions. Ordinary anonymous and authenticated users cannot read or write the recipe tables.
2. Run `npm run recipes:seed`, then run the generated `supabase/seed.sql` in the SQL Editor. Original IDs are preserved; repeated imports leave existing recipes unchanged. `data/meals.json` is an import backup, not live application data.
3. Create an ignored `.env.backend.local` file with these values:

   ```dotenv
   SITE_PASSWORD=your-shared-password
   SESSION_SECRET=a-random-secret-of-at-least-32-characters
   ALLOWED_ORIGINS=https://woznor.github.io,http://localhost:3000,http://127.0.0.1:3000
   ```

   Generate a session secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Do not prefix backend secrets with `VITE_` and do not commit them.

4. Deploy using the CLI:

   ```sh
   npm exec --yes --package=supabase -- supabase login
   npm exec --yes --package=supabase -- supabase secrets set --project-ref ebaszlyqrneorhjlrxav --env-file .env.backend.local
   npm exec --yes --package=supabase -- supabase functions deploy recipes-api --project-ref ebaszlyqrneorhjlrxav
   ```

   The function uses its own signed session checks, so platform JWT verification is disabled in `supabase/config.toml`. Every recipe operation still requires the password-issued session. Supabase provides the function's service-role key automatically; it is never shipped to the browser.

5. Frontend configuration: copy `.env.example` to `.env.local` for local development. For GitHub Pages, set repository **Settings → Secrets and variables → Actions → Variables**:

   ```text
   VITE_RECIPE_API_URL=https://ebaszlyqrneorhjlrxav.supabase.co/functions/v1/recipes-api
   ```

   Deploy the backend and import the data before pushing the frontend migration. The Pages workflow refuses to build without the API URL. The old deployed frontend stays online until a successful deployment replaces it.

## Existing images

The import preserves external URLs. To copy accessible images into Supabase Storage, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in an ignored local env file and run:

```sh
node --env-file=.env.import.local scripts/import-recipes.mjs --images
```

The script skips images already stored, checks JPEG/PNG/WebP signatures and a 6 MB limit, and retains external URLs when downloads fail. The editor can upload or replace photos directly. Never put the service-role key in a frontend environment variable or GitHub repository.

## Access and behavior

- The shared password exists only in backend secrets. The frontend stores a signed, 30-day session in localStorage. Previous frontend-only access flags are ignored.
- Changing `SITE_PASSWORD` or `SESSION_SECRET` invalidates existing sessions. Logout removes the browser's token; it does not revoke copies held elsewhere.
- Login attempts are limited to 15 per 15 minutes per hashed forwarded IP. Check the Supabase deployment's proxy/IP behavior when testing from multiple networks.
- Image links are signed for 24 hours; reload the recipe list to refresh them. External URLs retained during migration remain external/public.
- Updates and deletes use version checks to prevent silently overwriting another person's changes. A conflict requires reloading and reapplying the edit.
- Replacing/deleting recipes removes owned images. A storage cleanup error is logged and may leave an orphaned image; the database change remains successful.
- Shopping lists, favorites and weekly plans stay local to each browser. Deleted recipes disappear from the weekly plan's available dishes; shopping-list snapshots remain as previously added.
- The import backup and historical Git commits remain public. Moving to the backend cannot make already-published data secret.

## Verification

```sh
npm test
npm run build
```

After deployment, verify wrong-password rejection, session restore/logout, recipe creation/edit/deletion, upload/replacement/removal, and persistence after a page reload. Check that unauthenticated direct database/storage requests are denied. Use test recipes for destructive checks, never the imported originals.
