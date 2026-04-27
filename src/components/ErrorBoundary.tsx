import React from "react";

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      const isConfigError =
        this.state.message.includes("VITE_SUPABASE") ||
        this.state.message.includes("variáveis de ambiente");

      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f9fafb",
            fontFamily: "Inter, sans-serif",
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderTop: "4px solid #ef4444",
              padding: "2rem",
              maxWidth: "480px",
              width: "100%",
            }}
          >
            <h1
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "#111827",
                marginBottom: "0.5rem",
              }}
            >
              {isConfigError ? "Configuração incompleta" : "Erro ao iniciar aplicação"}
            </h1>

            {isConfigError ? (
              <div style={{ color: "#374151", fontSize: "0.875rem", lineHeight: 1.6 }}>
                <p style={{ marginBottom: "1rem" }}>
                  As variáveis de ambiente do Supabase não estão configuradas neste
                  ambiente. Para corrigir:
                </p>
                <ol style={{ paddingLeft: "1.25rem", marginBottom: "1rem" }}>
                  <li style={{ marginBottom: "0.5rem" }}>
                    Acesse o painel do <strong>Vercel</strong> → seu projeto →{" "}
                    <strong>Settings → Environment Variables</strong>
                  </li>
                  <li style={{ marginBottom: "0.5rem" }}>
                    Adicione <code style={{ background: "#f3f4f6", padding: "0 4px" }}>VITE_SUPABASE_URL</code> com a URL do seu projeto Supabase
                  </li>
                  <li style={{ marginBottom: "0.5rem" }}>
                    Adicione <code style={{ background: "#f3f4f6", padding: "0 4px" }}>VITE_SUPABASE_ANON_KEY</code> com a chave anon do Supabase
                  </li>
                  <li>Faça um novo deploy (Deployments → Redeploy)</li>
                </ol>
                <p style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  As credenciais estão em: Painel Supabase → Settings → API
                </p>
              </div>
            ) : (
              <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                Ocorreu um erro inesperado. Tente recarregar a página. Se o problema
                persistir, contate o suporte.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
