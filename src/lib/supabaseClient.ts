import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ojuckezdjdptldwjcbvr.supabase.co";
const supabaseAnonKey = "sb_publishable_dW3Ha55uzbQdZFelmD2p8g_v4KI8_9w";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: typeof window !== "undefined",
  },
});

export type Submission = {
  id: string;
  created_at: string;
  name: string;
  category: string;
  message: string;
  status: string;
};
