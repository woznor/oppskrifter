import { createClient } from 'npm:@supabase/supabase-js@2'
import { createHandler } from './handler.js'

const db = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  {
    auth: { persistSession: false, autoRefreshToken: false }
  }
)
Deno.serve(
  createHandler({
    db,
    password: Deno.env.get('SITE_PASSWORD'),
    secret: Deno.env.get('SESSION_SECRET'),
    origins: (Deno.env.get('ALLOWED_ORIGINS') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  })
)
