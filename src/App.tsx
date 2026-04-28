import React, { useState, useEffect } from "react";
import { Topbar } from "./components/Topbar";
import { Sidebar } from "./components/Sidebar";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { NewTraining } from "./pages/NewTraining";
import { Certificates } from "./pages/Certificates";
import { Users } from "./pages/Users";
import { supabase } from "./lib/supabase";
import { Toaster } from "sonner";

import { OngoingTrainings } from "./pages/OngoingTrainings";

export default function App() {
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState<{ id: string; email: string } | null>(null);
  const [activePage, setActivePage] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const repairProfile = async () => {
    if (!needsProfile) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: needsProfile.id,
          nome_completo: needsProfile.email.split('@')[0],
          cpf: '00000000000',
          cargo: 'Administrador (Auto-gerado)',
          perfil: 'admin',
          ativo: true,
        });

      if (error) {
        if (error.message.includes("row-level security")) {
          throw new Error("Erro de Permissão (RLS): Você precisa configurar as políticas de segurança no Supabase para permitir a criação de perfis. Execute o SQL de configuração no painel do Supabase.");
        }
        throw error;
      }
      
      setAuthError(null);
      setNeedsProfile(null);
      fetchProfile(needsProfile.id);
    } catch (err: any) {
      console.error("Error repairing profile:", err);
      setAuthError("Erro ao criar perfil: " + err.message);
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
              setUser({
                id: data.id,
                name: data.nome_completo,
                role: data.perfil
              });
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(profileSubscription);
        };
      } else {
        setUser(null);
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
            throw new Error(`Perfil não encontrado para o usuário ${authUser.email}. O usuário existe no Auth mas não na tabela 'profiles'.`);
          }
          
          if (error.message?.includes("infinite recursion")) {
            throw new Error(`Erro de Recursão (RLS): O banco de dados está em loop. Use o botão abaixo para tentar recriar seu perfil ou aplique o SQL de correção.`);
          }
        }
        throw error;
      }

      if (data) {
        setUser({
          id: data.id,
          name: data.nome_completo,
          role: data.perfil
        });
        if (data.perfil === "cliente") {
          setActivePage("comprovantes");
        }
      }
    } catch (err: any) {
      console.error("Error fetching profile:", err);
      setAuthError(err.message || "Erro ao carregar perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setActivePage("dashboard");
  };

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
