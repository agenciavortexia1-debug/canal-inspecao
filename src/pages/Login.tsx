import React, { useState } from "react";
import { User, Lock } from "lucide-react";
import { supabase } from "../lib/supabase";

interface LoginProps {
  externalError?: string | null;
  onRepairProfile?: () => void;
  isRepairing?: boolean;
}

export const Login: React.FC<LoginProps> = ({ 
  externalError, 
  onRepairProfile,
  isRepairing 
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Use external error if provided
  const displayError = error || externalError;
  const isMissingProfile = externalError?.includes("Perfil não encontrado");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.message === "Failed to fetch") {
        setError("Erro de conexão com o Supabase. Verifique sua internet.");
      } else {
        setError(err.message || "Erro ao realizar login");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4 relative">
      <img 
        src="https://lh3.googleusercontent.com/d/1sNzDKhdh2zH8d8DoyqIjx8l5LzBEXN5g" 
        alt="Logo" 
        className="absolute top-6 left-6 h-28 w-auto object-contain"
        referrerPolicy="no-referrer"
      />
      <div className="bg-surface border border-border p-6 sm:p-10 w-full max-w-[380px] shadow-sm">
        <div className="mb-8">
          <h1 className="text-base font-bold text-text leading-tight">
            Canal de Inspeção
          </h1>
          <p className="text-[11px] text-muted font-mono uppercase tracking-[0.06em]">
            Sistema de Treinamento
          </p>
        </div>

        <h2 className="text-lg font-semibold mb-1.5">Acesso ao Sistema</h2>
        <p className="text-[13px] text-muted mb-7">
          Insira suas credenciais para continuar
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-text uppercase tracking-wider">
              E-mail <span className="text-accent">*</span>
            </label>
            <div className="relative">
              <input
                type="email"
                className="w-full p-2.5 pl-10 border border-border2 bg-surface font-sans text-sm outline-none focus:border-accent transition-colors"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-text uppercase tracking-wider">
              Senha <span className="text-accent">*</span>
            </label>
            <div className="relative">
              <input
                type="password"
                className="w-full p-2.5 pl-10 border border-border2 bg-surface font-sans text-sm outline-none focus:border-accent transition-colors"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            </div>
          </div>

          {displayError && (
            <div className="bg-danger-light border border-red-300 p-2.5 text-[12px] text-danger space-y-2">
              <p>{displayError}</p>
              {isMissingProfile && onRepairProfile && (
                <button
                  type="button"
                  onClick={onRepairProfile}
                  disabled={isRepairing}
                  className="w-full py-1.5 bg-danger text-white font-bold uppercase tracking-wider hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isRepairing ? "Corrigindo..." : "Corrigir Perfil Agora"}
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-dark text-white py-2.5 text-[13px] font-medium transition-colors disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
};
