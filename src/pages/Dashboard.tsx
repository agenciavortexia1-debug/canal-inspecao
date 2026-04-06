import React, { useEffect, useState } from "react";
import { AlertTriangle, TrendingUp, Users, Clock, FileCheck, Plus } from "lucide-react";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";

interface DashboardProps {
  onNewTraining: () => void;
  onViewTraining: (status: string) => void;
}

interface DashboardStats {
  total: number;
  formacao: number;
  atualizacao: number;
  reciclagem: number;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNewTraining, onViewTraining }) => {
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    formacao: 0,
    atualizacao: 0,
    reciclagem: 0,
  });
  const [recentTrainings, setRecentTrainings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCpf, setFilterCpf] = useState("");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch stats
      const { data: allTrainings, error: statsError } = await supabase
        .from("treinamentos")
        .select("tipo_treinamento, status");

      if (statsError) throw statsError;

      const newStats = {
        total: allTrainings?.length || 0,
        formacao: allTrainings?.filter(t => t.tipo_treinamento === 'formacao' && t.status === 'em_andamento').length || 0,
        atualizacao: allTrainings?.filter(t => t.tipo_treinamento === 'atualizacao' && t.status === 'em_andamento').length || 0,
        reciclagem: allTrainings?.filter(t => t.tipo_treinamento === 'reciclagem' && t.status === 'em_andamento').length || 0,
      };
      setStats(newStats);

      // Fetch recent trainings
      const { data: recent, error: recentError } = await supabase
        .from("treinamentos")
        .select(`
          *,
          profiles:treinador_id (nome_completo)
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentError) throw recentError;
      setRecentTrainings(recent || []);

    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
      toast.error("Erro ao carregar dados da dashboard");
    } finally {
      setLoading(false);
    }
  };

  const filteredTrainings = recentTrainings.filter(t => 
    t.colaborador_cpf.includes(filterCpf)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text">Dashboard</h2>
          <p className="text-[13px] text-muted mt-1">
            Visão geral dos treinamentos em andamento
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchDashboardData}
            className="flex-1 sm:flex-none px-3 py-1.5 bg-surface2 hover:bg-surface3 border border-border2 text-[12px] font-medium transition-colors"
          >
            Atualizar
          </button>
          <button
            onClick={onNewTraining}
            className="flex-1 sm:flex-none px-3 py-1.5 bg-accent hover:bg-accent-dark text-white text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus size={14} /> Novo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Treinamentos" value={stats.total.toString()} detail="Registrados no sistema" />
        <StatCard label="Formação" value={stats.formacao.toString()} detail="Em andamento" accent />
        <StatCard label="Atualização" value={stats.atualizacao.toString()} detail="Em andamento" />
        <StatCard label="Reciclagem" value={stats.reciclagem.toString()} detail="Em andamento" />
      </div>

      <div className="bg-surface border border-border shadow-sm">
        <div className="px-5 py-3.5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-[13px] font-semibold text-text">
            Treinamentos Recentes
          </span>
          <input
            className="w-full sm:w-[180px] p-1.5 px-2.5 text-[12px] border border-border2 outline-none focus:border-accent"
            placeholder="Filtrar por CPF..."
            value={filterCpf}
            onChange={(e) => setFilterCpf(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface2">
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">
                  Colaborador
                </th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">
                  Tipo
                </th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">
                  Local
                </th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">
                  Treinador
                </th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">
                  Carga H.
                </th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">
                  Situação
                </th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted text-[13px]">
                    Carregando dados...
                  </td>
                </tr>
              ) : filteredTrainings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted text-[13px]">
                    Nenhum treinamento encontrado.
                  </td>
                </tr>
              ) : (
                filteredTrainings.map((t) => (
                  <TableRow
                    key={t.id}
                    name={t.colaborador_nome}
                    cpf={t.colaborador_cpf}
                    type={t.tipo_treinamento}
                    location={t.local_treinamento}
                    trainer={t.profiles?.nome_completo || "N/A"}
                    hours={`${Math.floor(t.horas_acumuladas / 3600)}h / ${Math.floor(t.horas_necessarias / 3600)}h`}
                    status={t.status === 'em_andamento' ? 'Em Andamento' : 'Concluído'}
                    statusColor={(t.status === 'em_andamento' ? 'yellow' : 'green') as "green" | "red" | "yellow"}
                    onView={() => onViewTraining(t.status)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) => (
  <div className="bg-surface border border-border p-4 px-5 shadow-sm">
    <div className="text-[10px] uppercase tracking-wider text-hint font-mono mb-2">
      {label}
    </div>
    <div className={cn("text-2xl font-bold font-mono", accent ? "text-accent" : "text-text")}>
      {value}
    </div>
    <div className="text-[11px] text-muted mt-1">{detail}</div>
  </div>
);

interface TableRowProps {
  name: string;
  cpf: string;
  type: string;
  location: string;
  trainer: string;
  hours: string;
  status: string;
  statusColor: "green" | "red" | "yellow";
  onView: () => void;
  warning?: boolean;
}

const TableRow: React.FC<TableRowProps> = ({
  name,
  cpf,
  type,
  location,
  trainer,
  hours,
  status,
  statusColor,
  onView,
  warning,
}) => (
  <tr className={cn("hover:bg-surface2 transition-colors", warning && "bg-warning-light/30")}>
    <td className="p-3 px-4">
      <div className="text-[13px] font-medium">{name} {warning && "⚠️"}</div>
      <div className="text-[11px] font-mono text-muted">CPF {cpf}</div>
    </td>
    <td className="p-3 px-4">
      <span className="px-2 py-0.5 bg-surface2 border border-border text-[11px] font-mono text-muted uppercase">
        {type}
      </span>
    </td>
    <td className="p-3 px-4 text-[12px]">{location}</td>
    <td className="p-3 px-4 text-[12px]">{trainer}</td>
    <td className="p-3 px-4 font-mono text-[12px]">{hours}</td>
    <td className="p-3 px-4">
      <span
        className={cn(
          "px-2 py-0.5 text-[11px] font-mono font-semibold uppercase tracking-tight",
          statusColor === "green" && "bg-success-light text-success",
          statusColor === "red" && "bg-danger-light text-danger",
          statusColor === "yellow" && "bg-warning-light text-warning"
        )}
      >
        {status}
      </span>
    </td>
    <td className="p-3 px-4">
      <button 
        onClick={onView}
        className="px-2.5 py-1 bg-surface2 hover:bg-surface3 border border-border2 text-[11px] font-medium transition-colors"
      >
        Ver
      </button>
    </td>
  </tr>
);

const PlusIcon = ({ size }: { size: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
