import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://flfticpczvyeasnahmnz.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsZnRpY3BjenZ5ZWFzbmFobW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MzQzNjEsImV4cCI6MjA4NjQxMDM2MX0.5_bOPSczkUeCni4H1_utgtIhf2YjK74d6n9vHRRp3fY";

console.log("Supabase URL initialized:", supabaseUrl ? "OK" : "MISSING");

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
