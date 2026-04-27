import { createClient } from '@supabase/supabase-js';

// A chave "anon" do Supabase é pública por design — ela fica visível no
// navegador de todos os usuários. A segurança real é feita pelas políticas
// RLS no banco. Troque os valores abaixo pelos do SEU projeto Supabase.
// (Painel Supabase → Settings → API)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "COLE_AQUI_SUA_URL";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "COLE_AQUI_SUA_CHAVE_ANON";

export const supabaseConfigured =
  supabaseUrl !== "COLE_AQUI_SUA_URL" && supabaseAnonKey !== "COLE_AQUI_SUA_CHAVE_ANON";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
