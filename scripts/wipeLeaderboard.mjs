import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const serviceRole = process.env.SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_SERVICE_ROLE

if (!url || !(anonKey || serviceRole)) {
  console.error('Missing SUPABASE URL/KEY envs. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_URL/SUPABASE_ANON_KEY).')
  process.exit(1)
}

// Prefer service role to bypass RLS for admin wipe; falls back to anon if provided only
const supabase = createClient(url, serviceRole || anonKey)

const run = async () => {
  try {
    const { error, data } = await supabase
      .from('leaderboard')
      .delete()
      .neq('username', '')
      .select('id')
    if (error) throw error
    console.log(`Leaderboard wiped. Deleted ${Array.isArray(data) ? data.length : 0} rows.`)
  } catch (e) {
    console.error('Failed to wipe leaderboard:', e.message)
    process.exit(1)
  }
}

run()
