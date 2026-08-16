import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  document.body.innerHTML =
    '<p style="padding:2rem;font-family:sans-serif">Missing VITE_SUPABASE_URL / ' +
    'VITE_SUPABASE_ANON_KEY — set them in the build environment and redeploy.</p>'
  throw new Error('Supabase environment variables are not set')
}

export const supabase = createClient(url, key)
