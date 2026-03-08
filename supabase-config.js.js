const SUPABASE_URL = "https://kwwqwgkltufgocdhhnfj.supabase.co";
const SUPABASE_KEY = "sb_publishable_4t4U5NTy7wEu19PafpiRGA_dK_bm2e-";

window.supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);