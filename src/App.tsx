import React, { useState, useEffect } from "react";
import { Topbar } from "./components/Topbar";
import { Sidebar } from "./components/Sidebar";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { NewTraining } from "./pages/NewTraining";
import { Certificates } from "./pages/Certificates";
import { Users } from "./pages/Users";
import { supabase, supabaseConfigured } from "./lib/supabase";
import { Shield, Loader2 } from "lucide-react";
import { Toaster } from "sonner";

import { OngoingTrainings } from "./pages/OngoingTrainings";

function ConfigError() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb", fontFamily: "Inter, sans-serif", padding: "1rem" }}>
      <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderTop: "4px solid #ef4444", padding: "2rem", maxWidth: "500px", width: "100%" }}>
        <h1 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#111827", marginBottom: "1rem" }}>
          Configuração incompleta
        </h1>
        <p style={{ color: "#374151", fontSize: "0.875rem", lineHeight: 1.7, marginBottom: "1rem" }}>
          As variáveis de ambiente do Supabase não estão configuradas. Para corrigir:
        </p>
        <ol style={{ color: "#374151", fontSize: "0.875rem", lineHeight: 1.7, paddingLeft: "1.25rem", marginBottom: "1rem" }}>
          <li>Acesse o painel do <strong>Vercel</strong> → seu projeto → <strong>Settings → Environment Variables</strong></li>
          <li>Adicione <code style={{ background: "#f3f4f6", padding: "0 4px", borderRadius: "3px" }}>VITE_SUPABASE_URL</code></li>
          <li>Adicione <code style={{ background: "#f3f4f6", padding: "0 4px", borderRadius: "3px" }}>VITE_SUPABASE_ANON_KEY</code></li>
          <li>Vá em <strong>Deployments → Redeploy</strong></li>
        </ol>
        <p style={{ fontSize: "0.75rem", color: "#6b7280" }}>
          Os valores estão em: Painel Supabase → Settings → API
        </p>
      </div>
    </div>
  );
}

export default function App() {
  if (!supabaseConfigured) return <ConfigError />;
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState<{ id: string; email: string } | null>(null);
  const [devicePending, setDevicePending] = useState(false);
  const [activePage, setActivePage] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const getDeviceId = () => {
    let id = localStorage.getItem("device_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("device_id", id);
    }
    return id;
  };

  const repairProfile = async () => {
    if (!needsProfile) return;
    setLoading(true);
    try {
      const deviceId = getDeviceId();
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: needsProfile.id,
          nome_completo: needsProfile.email.split('@')[0],
          cpf: '00000000000',
          cargo: 'Administrador (Auto-gerado)',
          perfil: 'admin',
          ativo: true,
          device_id: deviceId,
          device_approved: true // Auto-approve first admin
        });

      if (error) {
        if (error.message.includes("row-level security")) {
          throw new Error("Erro de permissão: as políticas de segurança do banco precisam ser configuradas. Contate o administrador.");
        }
        throw new Error("Não foi possível criar o perfil. Contate o administrador.");
      }

      setAuthError(null);
      setNeedsProfile(null);
      fetchProfile(needsProfile.id);
    } catch (err: any) {
      console.error("Error repairing profile:", err);
      setAuthError(err.message || "Erro ao criar perfil. Tente novamente ou contate o suporte.");
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleGlobalError = (event: PromiseRejectionEvent) => {
      if (event.reason?.message === "Failed to fetch") {
        console.error("Global Failed to fetch detected:", event.reason);
        setAuthError("Erro de conexão com o servidor. Verifique sua internet.");
      }
    };

    window.addEventListener("unhandledrejection", handleGlobalError);

    // Check active session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session) {
          fetchProfile(session.user.id);
        } else {
          setLoading(false);
        }
      })
      .catch(err => {
        console.error("Supabase getSession error:", err);
        setAuthError("Erro ao verificar sessão: " + (err.message || "Erro desconhecido"));
        setLoading(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setAuthError(null);
        fetchProfile(session.user.id);

        // Subscribe to real-time profile changes
        const profileSubscription = supabase
          .channel(`profile-changes-${session.user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${session.user.id}`
            },
            (payload) => {
              console.log('Real-time profile update:', payload.new);
              const data = payload.new;
              const currentDeviceId = getDeviceId();
              
              // Check if device was revoked or changed
              if (data.device_id !== currentDeviceId || !data.device_approved) {
                setDevicePending(true);
                setUser(null);
              } else {
                // Device approved or restored
                setDevicePending(false);
                setUser({
                  id: data.id,
                  name: data.nome_completo,
                  role: data.perfil
                });
              }
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(profileSubscription);
        };
      } else {
        setUser(null);
        setDevicePending(false);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("unhandledrejection", handleGlobalError);
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    console.log("Fetching profile for userId:", userId);
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error("Profile fetch error details:", error);
        
        if (authUser) {
          setNeedsProfile({ id: authUser.id, email: authUser.email || "" });

          if (error.code === "PGRST116") {
            throw new Error("Perfil de usuário não encontrado. Clique em 'Reparar Perfil' para corrigir.");
          }

          if (error.message?.includes("infinite recursion")) {
            throw new Error("Erro de configuração no banco de dados. Use o botão abaixo para tentar corrigir.");
          }
        }
        throw new Error("Erro ao carregar perfil. Tente novamente.");
      }

      if (data) {
        const currentDeviceId = getDeviceId();
        
        // Device Approval Logic
        // If device is not registered yet
        if (!data.device_id) {
          console.log("Registering first device for user:", userId);
          const isFirstAdmin = data.perfil === 'admin';
          
          const { error: updateError } = await supabase.from('profiles').update({ 
            device_id: currentDeviceId, 
            device_approved: isFirstAdmin // Auto-approve first admin's first device
          }).eq('id', userId);
          
          if (updateError) {
            console.error("Error registering first device:", updateError);
          }

          if (!isFirstAdmin) {
            setDevicePending(true);
            setLoading(false);
            return;
          }
          
          // If admin, continue to set user
          data.device_id = currentDeviceId;
          data.device_approved = true;
        } 
        // If device changed
        else if (data.device_id !== currentDeviceId) {
          console.log("New device detected for user:", userId, "Old:", data.device_id, "New:", currentDeviceId);
          
          // Update the device_id in the database so the admin can see it in the management screen
          // We set device_approved to false for security, requiring re-approval for the new device
          const { error: updateError } = await supabase.from('profiles').update({ 
            device_id: currentDeviceId, 
            device_approved: false 
          }).eq('id', userId);
          
          if (updateError) {
            console.error("Error updating to new device ID:", updateError);
          }
          
          setDevicePending(true);
          setLoading(false);
          return;
        } 
        // If same device but not approved
        else if (!data.device_approved) {
          console.log("Device pending approval:", currentDeviceId);
          setDevicePending(true);
          setLoading(false);
          return;
        }

        setUser({
          id: data.id,
          name: data.nome_completo,
          role: data.perfil
        });
        setDevicePending(false);
        if (data.perfil === "cliente") {
          setActivePage("comprovantes");
        }
      }
    } catch (err: any) {
      console.error("Error fetching profile:", err);
      setAuthError(err.message || "Erro ao carregar perfil");
      
      const isRecoverable = err.message?.includes("Perfil não encontrado") || 
                           err.message?.includes("Recursão") || 
                           err.message?.includes("security policy");

      if (!isRecoverable) {
        await supabase.auth.signOut();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setDevicePending(false);
    setActivePage("dashboard");
  };

  // Auto-logout after 30 minutes of inactivity
  useEffect(() => {
    if (!user) return;

    const TIMEOUT_MS = 30 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        handleLogout();
      }, TIMEOUT_MS);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        <Toaster 
          position="top-right" 
          richColors 
          closeButton
          toastOptions={{
            style: {
              borderRadius: '6px',
              border: '1px solid #E5E7EB',
              fontFamily: 'Inter, sans-serif',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              fontSize: '13px',
              fontWeight: '500',
            },
          }}
        />
      </div>
    );
  }

  if (devicePending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4 sm:p-6 font-sans">
        <div className="bg-surface border-2 border-accent p-5 sm:p-7 max-w-sm w-full shadow-2xl relative overflow-hidden">
          {/* Security Pattern Background */}
          <div className="absolute top-0 left-0 w-full h-1 bg-accent opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-accent opacity-50"></div>
          
          <div className="space-y-5">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center border border-accent/20">
                <Shield className="text-accent" size={28} />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-black text-accent tracking-tighter uppercase italic">
                  Acesso Negado
                </h2>
                <div className="h-px w-16 bg-accent/30 mx-auto"></div>
                <p className="text-[13px] font-bold text-text uppercase tracking-tight mt-2.5">
                  Dispositivo não autorizado a acessar o sistema
                </p>
              </div>
            </div>

            <div className="bg-surface2 border border-border2 p-3.5 space-y-3 relative">
              <div className="flex justify-between items-center border-b border-border2 pb-1.5 mb-1">
                <span className="text-[8px] font-mono font-bold text-hint uppercase tracking-widest">Protocolo de Segurança</span>
                <span className="text-[8px] font-mono font-bold text-accent uppercase tracking-widest animate-pulse">Bloqueado</span>
              </div>
              
              <div className="space-y-2">
                <div>
                  <div className="text-[7.5px] uppercase font-bold text-hint tracking-widest mb-1">Identificador do Terminal (UUID)</div>
                  <div className="font-mono text-[10px] break-all text-text bg-white p-1.5 border border-border select-all">
                    {getDeviceId()}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                  <div>
                    <div className="text-[7.5px] uppercase font-bold text-hint tracking-widest mb-1">Status de Rede</div>
                    <div className="text-[9px] font-mono text-success font-bold">CONECTADO</div>
                  </div>
                  <div>
                    <div className="text-[7.5px] uppercase font-bold text-hint tracking-widest mb-1">Autorização</div>
                    <div className="text-[9px] font-mono text-accent font-bold">PENDENTE</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="p-3 bg-accent/5 border-l-4 border-accent text-[10px] text-text leading-relaxed">
                <strong>Aviso de Segurança:</strong> Este terminal não possui as credenciais de hardware necessárias para este nível de acesso. O administrador do sistema foi notificado desta tentativa de conexão.
              </div>
              
              <p className="text-[9px] text-muted text-center italic">
                Para solicitar autorização, informe o UUID acima ao Departamento de TI.
              </p>
            </div>

            <button 
              onClick={handleLogout}
              className="w-full py-2 bg-text hover:bg-black text-white text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 group"
            >
              <span>Encerrar Sessão de Segurança</span>
            </button>
          </div>
        </div>
        <Toaster 
          position="top-right" 
          richColors 
          closeButton
          toastOptions={{
            style: {
              borderRadius: '6px',
              border: '1px solid #E5E7EB',
              fontFamily: 'Inter, sans-serif',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              fontSize: '13px',
              fontWeight: '500',
            },
          }}
        />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Login 
          externalError={authError} 
          onRepairProfile={repairProfile}
          isRepairing={loading}
        />
        <Toaster 
          position="top-right" 
          richColors 
          closeButton
          toastOptions={{
            style: {
              borderRadius: '6px',
              border: '1px solid #E5E7EB',
              fontFamily: 'Inter, sans-serif',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              fontSize: '13px',
              fontWeight: '500',
            },
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen h-screen flex flex-col bg-bg overflow-hidden">
      <Topbar 
        userName={user.name} 
        role={user.role} 
        onLogout={handleLogout} 
        onToggleSidebar={() => {
          if (window.innerWidth < 768) {
            setMobileSidebarOpen(!mobileSidebarOpen);
          } else {
            setSidebarCollapsed(!sidebarCollapsed);
          }
        }}
        sidebarCollapsed={sidebarCollapsed}
        mobileSidebarOpen={mobileSidebarOpen}
      />
      <div className="flex flex-1 relative overflow-hidden">
        <Sidebar
          role={user.role}
          activePage={activePage}
          onNavigate={(page) => {
            setActivePage(page);
            setMobileSidebarOpen(false);
          }}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
        <main className="flex-1 p-4 md:p-8 overflow-auto transition-all duration-300 w-full bg-bg">
          <div className="max-w-7xl mx-auto">
            {activePage === "dashboard" && (
              <Dashboard 
                onNewTraining={() => setActivePage("novoTreinamento")} 
                onViewTraining={(status) => setActivePage(status === 'em_andamento' ? 'avaliacoes' : 'comprovantes')}
              />
            )}
            {activePage === "novoTreinamento" && <NewTraining onComplete={() => setActivePage("comprovantes")} />}
            {activePage === "comprovantes" && <Certificates />}
            {activePage === "usuarios" && user && <Users currentUser={user} />}
            {activePage === "avaliacoes" && <OngoingTrainings />}
          </div>
        </main>
      </div>
      <Toaster 
        position="top-right" 
        richColors 
        closeButton
        toastOptions={{
          style: {
            borderRadius: '6px',
            border: '1px solid #E5E7EB',
            fontFamily: 'Inter, sans-serif',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            fontSize: '13px',
            fontWeight: '500',
          },
        }}
      />
    </div>
  );
}
