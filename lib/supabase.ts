import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let instance: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key||url.includes('SEU-PROJETO')||key.includes('SUBSTITUA')) return null;
 if(!instance) instance=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true}});
 return instance;
}
