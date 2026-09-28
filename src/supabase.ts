import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://blttlxjevcbxwhdvgmnz.supabase.co",
  "sb_publishable_Iz4P3jl5U-XRXZNh-Gvr1Q_FXrt0ydE",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
