import React, { useState, useEffect } from "react";
import { UserPlus, Shield, Loader2, FileText, X, ExternalLink, Eye } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { cn, maskCPF, unmaskCPF } from "../lib/utils";
import { supabase } from "../lib/supabase";

interface Profile {
  id: string;
  nome_completo: string;
  cpf: string;
  cargo: string;
  perfil: string;
  ativo: boolean;
  device_id?: string | null;
  device_approved?: boolean;
  experiencia?: string;
  certificacoes?: { name: string; url: string }[];
}

interface UsersProps {
  currentUser: { id: string; name: string; role: string };
}

export const Users: React.FC<UsersProps> = ({ currentUser }) => {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [activeTab, setActiveTab] = useState<"users" | "devices">("users");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<string | null>(null);

  // Form state
  const [perfil, setPerfil] = useState("");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [cargo, setCargo] = useState("");
  const [experiencia, setExperiencia] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [certs, setCerts] = useState<{ name: string; file: File | null }[]>([]);

  // Form persistence
  useEffect(() => {
    const savedForm = localStorage.getItem("user_registration_form");
    if (savedForm) {
      try {
        const parsed = JSON.parse(savedForm);
        setPerfil(parsed.perfil || "");
        setNome(parsed.nome || "");
        setCpf(parsed.cpf || "");
        setCargo(parsed.cargo || "");
        setExperiencia(parsed.experiencia || "");
        setEmail(parsed.email || "");
        if (parsed.perfil || parsed.nome || parsed.email) {
          setShowForm(true);
        }
      } catch (e) {
        console.error("Error loading saved form:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (showForm) {
      const formData = { perfil, nome, cpf, cargo, experiencia, email };
      localStorage.setItem("user_registration_form", JSON.stringify(formData));
    }
  }, [perfil, nome, cpf, cargo, experiencia, email, showForm]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('nome_completo');
      
      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      console.error("Error fetching users:", err);
      if (err.message === "Failed to fetch") {
        toast.error("Erro de conexão com o Supabase. Verifique sua internet.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDevice = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ device_approved: true })
        .eq('id', userId);
      
      if (error) throw error;
      toast.success("Dispositivo aprovado com sucesso!");
      fetchUsers();
    } catch (err: any) {
      toast.error("Erro ao aprovar dispositivo: " + err.message);
    }
  };

  const handleBlockDevice = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ device_approved: false })
        .eq('id', userId);
      
      if (error) throw error;
      toast.success("Dispositivo bloqueado com sucesso!");
      fetchUsers();
    } catch (err: any) {
      toast.error("Erro ao bloquear dispositivo: " + err.message);
    }
  };

  const handleRemoveDevice = async (userId: string) => {
    setUserToRemove(userId);
    setConfirmModalOpen(true);
  };

  const executeRemoveDevice = async () => {
    if (!userToRemove) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          device_id: null,
          device_approved: false 
        })
        .eq('id', userToRemove);
      
      if (error) throw error;
      toast.success("Dispositivo removido com sucesso!");
      fetchUsers();
    } catch (err: any) {
      toast.error("Erro ao remover dispositivo: " + err.message);
    } finally {
      setUserToRemove(null);
    }
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(maskCPF(e.target.value));
  };

  const handleAddCert = () => {
    setCerts([...certs, { name: "", file: null }]);
  };

  const handleRemoveCert = (index: number) => {
    setCerts(certs.filter((_, i) => i !== index));
  };

  const handleCertFileChange = (index: number, file: File | null) => {
    const newCerts = [...certs];
    newCerts[index].file = file;
    if (file && !newCerts[index].name) {
      newCerts[index].name = file.name.replace(/\.[^/.]+$/, "");
    }
    setCerts(newCerts);
  };

  const handleCertNameChange = (index: number, name: string) => {
    const newCerts = [...certs];
    newCerts[index].name = name;
    setCerts(newCerts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perfil || !nome || !cpf || !cargo || !email || !senha) {
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create Auth User (This might sign out the admin if not using service role, 
      // but for this prototype we'll assume it works or the user uses the SQL provided)
      // Note: In a real app, you'd use a Supabase Edge Function to create users without signing out.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: nome,
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Upload Certifications
        const uploadedCerts = [];
        for (const cert of certs) {
          if (cert.file) {
            const fileExt = cert.file.name.split('.').pop();
            const fileName = `${authData.user.id}/${Math.random()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
              .from('certificacoes')
              .upload(fileName, cert.file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
              .from('certificacoes')
              .getPublicUrl(fileName);

            uploadedCerts.push({ name: cert.name, url: publicUrl });
          }
        }

        // 3. Update Profile (Profile is usually created by a trigger, but we'll upsert to be sure)
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: authData.user.id,
            nome_completo: nome,
            cpf: unmaskCPF(cpf),
            cargo,
            perfil,
            experiencia,
            certificacoes: uploadedCerts,
            ativo: true
          });

        if (profileError) throw profileError;

        toast.success("Usuário cadastrado com sucesso!");
        localStorage.removeItem("user_registration_form");
        setShowForm(false);
        fetchUsers();
        // Reset form
        setPerfil("");
        setNome("");
        setCpf("");
        setCargo("");
        setExperiencia("");
        setEmail("");
        setSenha("");
        setCerts([]);
      }
    } catch (err: any) {
      console.error("Error creating user:", err);
      if (err.message?.includes("rate limit exceeded")) {
        toast.error("Limite de tentativas excedido. Por favor, aguarde alguns minutos.");
      } else {
        toast.error("Erro ao cadastrar usuário: " + err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text">Gestão de Sistema</h2>
          <p className="text-[13px] text-muted mt-1">
            Administração de usuários e dispositivos autorizados
          </p>
        </div>
        <div className="flex flex-col xs:flex-row gap-3">
          <div className="flex bg-surface2 border border-border2 p-1 w-fit">
            <button
              onClick={() => setActiveTab("users")}
              className={cn(
                "px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                activeTab === "users" ? "bg-surface text-accent shadow-sm" : "text-hint hover:text-text"
              )}
            >
              Usuários
            </button>
            <button
              onClick={() => setActiveTab("devices")}
              className={cn(
                "px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                activeTab === "devices" ? "bg-surface text-accent shadow-sm" : "text-hint hover:text-text"
              )}
            >
              Dispositivos
            </button>
          </div>
          {activeTab === "users" && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-accent hover:bg-accent-dark text-white text-[13px] font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <UserPlus size={16} /> {showForm ? "Fechar" : "Novo Usuário"}
            </button>
          )}
        </div>
      </div>

      {activeTab === "users" ? (
        <>
          {showForm && (
            <div className="bg-surface border border-border shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="px-5 py-3.5 border-b border-border">
            <span className="text-[13px] font-semibold text-text">Novo Usuário</span>
          </div>
          <form onSubmit={handleSubmit} className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium uppercase tracking-wider">Perfil *</label>
                <select
                  className="w-full p-2.5 border border-border2 focus:border-accent outline-none bg-surface text-sm"
                  value={perfil}
                  onChange={(e) => setPerfil(e.target.value)}
                  required
                >
                  <option value="">Selecione...</option>
                  <option value="treinador">Treinador</option>
                  <option value="cliente">Cliente / ANAC / GRU / Líder</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium uppercase tracking-wider">Nome Completo *</label>
                <input 
                  className="w-full p-2.5 border border-border2 focus:border-accent outline-none text-sm" 
                  placeholder="Nome completo" 
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium uppercase tracking-wider">CPF *</label>
                <input 
                  className="w-full p-2.5 border border-border2 focus:border-accent outline-none text-sm" 
                  placeholder="000.000.000-00" 
                  value={cpf}
                  onChange={handleCpfChange}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium uppercase tracking-wider">Cargo / Função *</label>
                <input 
                  className="w-full p-2.5 border border-border2 focus:border-accent outline-none text-sm" 
                  placeholder="Ex: Agente de Segurança" 
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  required
                />
              </div>

              {perfil === "treinador" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium uppercase tracking-wider">Tempo de Experiência</label>
                    <select
                      className="w-full p-2.5 border border-border2 focus:border-accent outline-none bg-surface text-sm"
                      value={experiencia}
                      onChange={(e) => setExperiencia(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      <option value="Menos de 1 ano">Menos de 1 ano</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(year => (
                        <option key={year} value={`${year} ${year === 1 ? 'ano' : 'anos'}`}>
                          {year} {year === 1 ? 'ano' : 'anos'}
                        </option>
                      ))}
                      <option value="Mais de 10 anos">Mais de 10 anos</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[12px] font-medium uppercase tracking-wider">Certificações Vigentes (PDF)</label>
                      <button 
                        type="button"
                        onClick={handleAddCert}
                        className="text-[11px] text-accent hover:underline font-medium"
                      >
                        + Adicionar Certificação
                      </button>
                    </div>
                    <div className="space-y-2">
                      {certs.map((cert, index) => (
                        <div key={index} className="flex gap-2 items-start bg-surface2 p-3 border border-border2">
                          <div className="flex-1 space-y-2">
                            <input 
                              className="w-full p-2 border border-border2 text-xs outline-none focus:border-accent" 
                              placeholder="Nome do curso/certificação"
                              value={cert.name}
                              onChange={(e) => handleCertNameChange(index, e.target.value)}
                            />
                            <input 
                              type="file" 
                              accept=".pdf"
                              className="text-xs"
                              onChange={(e) => handleCertFileChange(index, e.target.files?.[0] || null)}
                            />
                          </div>
                          <button 
                            type="button"
                            onClick={() => handleRemoveCert(index)}
                            className="text-danger hover:bg-red-50 p-1"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      {certs.length === 0 && (
                        <p className="text-[11px] text-hint italic">Nenhuma certificação adicionada.</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium uppercase tracking-wider">E-mail (Login) *</label>
                <input 
                  type="email"
                  className="w-full p-2.5 border border-border2 focus:border-accent outline-none text-sm" 
                  placeholder="email@exemplo.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium uppercase tracking-wider">Senha Inicial *</label>
                <input 
                  className="w-full p-2.5 border border-border2 focus:border-accent outline-none text-sm" 
                  type="password" 
                  placeholder="Mínimo 6 caracteres" 
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                type="button"
                onClick={() => setShowForm(false)} 
                className="px-4 py-2 bg-surface2 hover:bg-surface3 border border-border2 text-[13px] font-medium transition-colors"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-accent hover:bg-accent-dark text-white text-[13px] font-medium transition-colors flex items-center gap-2"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                Cadastrar Usuário
              </button>
            </div>
          </form>
        </div>
      )}

          <div className="bg-surface border border-border shadow-sm overflow-x-auto scrollbar-thin">
            {loading ? (
              <div className="p-10 flex flex-col items-center justify-center text-muted">
                <Loader2 className="animate-spin mb-2" size={24} />
                <p className="text-sm">Carregando usuários...</p>
              </div>
            ) : (
              <div className="min-w-[800px]">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-surface2">
                      <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Usuário</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">CPF</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Cargo</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Perfil</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Status</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map((u) => (
                      <UserRow
                        key={u.id}
                        name={u.nome_completo}
                        cpf={maskCPF(u.cpf)}
                        role={u.cargo}
                        perfil={u.perfil}
                        status={u.ativo ? "Ativo" : "Inativo"}
                        isAdmin={u.perfil === "admin"}
                        onView={() => setSelectedUser(u)}
                      />
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted text-sm italic">
                          Nenhum usuário cadastrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-surface border border-border shadow-sm overflow-x-auto scrollbar-thin">
          {loading ? (
            <div className="p-10 flex flex-col items-center justify-center text-muted">
              <Loader2 className="animate-spin mb-2" size={24} />
              <p className="text-sm">Carregando dispositivos...</p>
            </div>
          ) : (
            <div className="min-w-[600px]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface2">
                    <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Usuário</th>
                    <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">ID do Dispositivo</th>
                    <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Status</th>
                    <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-surface2 transition-colors">
                      <td className="p-3 px-4 text-[13px] font-medium">
                        <div>{u.nome_completo}</div>
                        <div className="text-[11px] text-muted">{u.cargo}</div>
                      </td>
                      <td className="p-3 px-4 font-mono text-[11px] text-muted break-all max-w-[200px]">
                        {u.device_id || <span className="italic text-hint">Não registrado</span>}
                      </td>
                      <td className="p-3 px-4">
                        {u.device_id ? (
                          <span className={cn("px-2 py-0.5 text-[11px] font-mono font-semibold uppercase", 
                            u.device_approved ? "bg-success-light text-success" : "bg-warning-light text-warning")}>
                            {u.device_approved ? "Aprovado" : "Pendente"}
                          </span>
                        ) : (
                          <span className="text-[11px] text-hint">—</span>
                        )}
                      </td>
                      <td className="p-3 px-4">
                        <div className="flex gap-2">
                          {u.device_id && !u.device_approved && (
                            <button 
                              onClick={() => handleApproveDevice(u.id)}
                              className="px-3 py-1 bg-success hover:bg-success-dark text-white text-[11px] font-bold uppercase tracking-wider transition-colors"
                            >
                              Aprovar
                            </button>
                          )}
                          {u.device_id && u.device_approved && (
                            <button 
                              onClick={() => handleBlockDevice(u.id)}
                              className="px-3 py-1 bg-warning hover:bg-warning-dark text-white text-[11px] font-bold uppercase tracking-wider transition-colors"
                            >
                              Bloquear
                            </button>
                          )}
                          {u.device_id && (
                            <button 
                              onClick={() => handleRemoveDevice(u.id)}
                              className="px-3 py-1 bg-surface2 hover:bg-danger hover:text-white border border-border2 text-muted text-[11px] font-bold uppercase tracking-wider transition-colors"
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted text-sm italic">
                        Nenhum dispositivo registrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-surface border border-border w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                  <Eye className="text-accent" size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text uppercase tracking-tight">Detalhes do Usuário</h3>
                  <p className="text-[11px] text-muted font-mono uppercase tracking-widest">{selectedUser.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedUser(null)}
                className="p-2 hover:bg-surface3 text-muted transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-hint uppercase tracking-widest">Nome Completo</p>
                  <p className="text-sm font-medium text-text">{selectedUser.nome_completo}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-hint uppercase tracking-widest">CPF</p>
                  <p className="text-sm font-mono text-text">{maskCPF(selectedUser.cpf)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-hint uppercase tracking-widest">Cargo / Função</p>
                  <p className="text-sm font-medium text-text">{selectedUser.cargo}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-hint uppercase tracking-widest">Perfil de Acesso</p>
                  <span className={cn("inline-block px-2 py-0.5 text-[11px] font-mono font-bold uppercase tracking-tight border", 
                    selectedUser.perfil === "admin" ? "bg-blue-50 text-blue-700 border-blue-200" : 
                    selectedUser.perfil === "treinador" ? "bg-accent-light text-accent border-accent/20" :
                    "bg-surface2 border-border text-muted")}>
                    {selectedUser.perfil}
                  </span>
                </div>
                {selectedUser.experiencia && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-hint uppercase tracking-widest">Experiência</p>
                    <p className="text-sm font-medium text-text">{selectedUser.experiencia}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-hint uppercase tracking-widest">Status da Conta</p>
                  <span className={cn("inline-block px-2 py-0.5 text-[11px] font-mono font-bold uppercase", 
                    selectedUser.ativo ? "bg-success-light text-success" : "bg-danger-light text-danger")}>
                    {selectedUser.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <FileText size={16} className="text-accent" />
                  <h4 className="text-[12px] font-bold uppercase tracking-wider text-text">Certificações e Documentos</h4>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {selectedUser.certificacoes && selectedUser.certificacoes.length > 0 ? (
                    selectedUser.certificacoes.map((cert, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-surface2 border border-border2 hover:border-accent/30 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white border border-border2">
                            <FileText size={16} className="text-danger" />
                          </div>
                          <span className="text-[13px] font-medium text-text">{cert.name}</span>
                        </div>
                        <a 
                          href={cert.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-border2 hover:bg-accent hover:text-white hover:border-accent text-[11px] font-bold uppercase tracking-tight transition-all"
                        >
                          Visualizar PDF <ExternalLink size={12} />
                        </a>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center bg-surface2 border border-dashed border-border2">
                      <p className="text-[12px] text-muted italic">Nenhuma certificação anexada a este perfil.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-border bg-surface2 flex justify-end">
              <button 
                onClick={() => setSelectedUser(null)}
                className="px-6 py-2 bg-text text-white text-[12px] font-bold uppercase tracking-widest hover:bg-black transition-colors"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={executeRemoveDevice}
        title="Remover Dispositivo"
        message="Tem certeza que deseja remover este dispositivo? O usuário perderá o acesso imediato e precisará de uma nova aprovação manual para entrar novamente."
        confirmText="Sim, Remover"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
};

interface UserRowProps {
  name: string;
  cpf: string;
  role: string;
  perfil: string;
  status: string;
  isAdmin?: boolean;
  onView: () => void;
}

const UserRow: React.FC<UserRowProps> = ({
  name,
  cpf,
  role,
  perfil,
  status,
  isAdmin,
  onView,
}) => (
  <tr className="hover:bg-surface2 transition-colors">
    <td className="p-3 px-4 text-[13px] font-medium">{name}</td>
    <td className="p-3 px-4 font-mono text-[12px]">{cpf}</td>
    <td className="p-3 px-4 text-[12px] text-muted">{role}</td>
    <td className="p-3 px-4">
      <span className={cn("px-2 py-0.5 text-[11px] font-mono font-semibold uppercase tracking-tight", 
        isAdmin ? "bg-blue-50 text-blue-700 border border-blue-200" : 
        perfil === "treinador" ? "bg-accent-light text-accent border border-accent/20" :
        "bg-surface2 border border-border text-muted")}>
        {perfil}
      </span>
    </td>
    <td className="p-3 px-4">
      <span className={cn("px-2 py-0.5 text-[11px] font-mono font-semibold uppercase", 
        status === "Ativo" ? "bg-success-light text-success" : "bg-danger-light text-danger")}>
        {status}
      </span>
    </td>
    <td className="p-3 px-4">
      <div className="flex gap-2">
        <button 
          onClick={onView}
          className="p-1.5 bg-surface2 hover:bg-accent hover:text-white border border-border2 text-muted transition-colors" 
          title="Visualizar Detalhes"
        >
          <Eye size={14} />
        </button>
      </div>
    </td>
  </tr>
);
