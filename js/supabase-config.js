const SUPABASE_URL = "https://gksiyscqysrdhyzmwfen.supabase.co";
const SUPABASE_KEY = "sb_publishable_lucWMhtuCtocA-ud7dnFBQ_ewoGauJL";

window.supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

