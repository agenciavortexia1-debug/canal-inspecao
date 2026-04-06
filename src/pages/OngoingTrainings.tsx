import React, { useState, useEffect, useRef } from "react";
import { Play, Square, Clock, AlertCircle, BarChart2, User, FileText, CheckCircle2, XCircle, Search, Check, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabase";
import { OngoingTraining, TrainingSessionRecord, TrainingType } from "../types";
import { toast } from "sonner";
import { cn } from "../lib/utils";

import { CRITERIA_A, CRITERIA_B, SCENARIOS_C, ACTIVITIES } from "../constants";

import { PHASES } from "../constants";
import SignatureCanvas from "react-signature-canvas";

const Card: React.FC<{ title: string; tag?: string; children: React.ReactNode }> = ({ title, tag, children }) => (
  <div className="bg-surface border border-border shadow-sm overflow-hidden rounded-sm">
    <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-surface2/50">
      <h3 className="text-[13px] font-bold text-text uppercase tracking-tight">{title}</h3>
      {tag && (
        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 bg-accent/10 border border-accent/20 text-accent font-bold rounded-full">
          {tag}
        </span>
      )}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

export const OngoingTrainings: React.FC = () => {
  const [trainings, setTrainings] = useState<OngoingTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTraining, setSelectedTraining] = useState<OngoingTraining | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string>("");
  const [selectedCriterion, setSelectedCriterion] = useState<"A" | "B" | "C" | "">("");
  const [activityHistory, setActivityHistory] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<TrainingSessionRecord | null>(null);
  const [activeSessions, setActiveSessions] = useState<Record<string, any>>({});
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [filter, setFilter] = useState("");
  const [isEditingEvals, setIsEditingEvals] = useState(false);
  const [expandedEval, setExpandedEval] = useState<"A" | "B" | "C" | null>(null);
  const [showFinalizeActivity, setShowFinalizeActivity] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [activityToFinalize, setActivityToFinalize] = useState<string>("");
  const [hitRateInput, setHitRateInput] = useState<string>("");
  
  const trainerSigRef = useRef<SignatureCanvas>(null);
  const traineeSigRef = useRef<SignatureCanvas>(null);
  const sessionTrainerSigRef = useRef<SignatureCanvas>(null);
  const sessionTraineeSigRef = useRef<SignatureCanvas>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<any>(null);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err) {
      console.error("Erro ao solicitar Wake Lock:", err);
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  const currentPhase = selectedTraining?.current_phase || 1;
  const phaseInfo = PHASES.find(p => p.id === currentPhase);
  const phaseActivities = phaseInfo?.activities || [];

  const filteredTrainings = trainings.filter(t => 
    t.colaborador_nome.toLowerCase().includes(filter.toLowerCase()) ||
    t.colaborador_cpf.includes(filter)
  );

  const handleUpdateEval = async (field: string, value: any, activityName?: string, index?: number) => {
    if (!selectedTraining) return;
    try {
      let updateData: any = {};
      
      if (activityName) {
        const currentStatus = JSON.parse(JSON.stringify(selectedTraining.atividades_status || {}));
        const activityStatus = currentStatus[activityName] || {
          concluida: false,
          notas_a: {},
          notas_b: {},
          resultados_c: {},
          timestamps_a: {},
          timestamps_b: {},
          timestamps_c: {},
          tempo_segundos: 0
        };
        
        const now = new Date().toISOString();

        if (field === 'notas_a') {
          activityStatus.notas_a = value;
          if (index !== undefined) {
            if (!activityStatus.timestamps_a) activityStatus.timestamps_a = {};
            activityStatus.timestamps_a[index] = now;
          }
        } else if (field === 'notas_b') {
          activityStatus.notas_b = value;
          if (index !== undefined) {
            if (!activityStatus.timestamps_b) activityStatus.timestamps_b = {};
            activityStatus.timestamps_b[index] = now;
          }
        } else if (field === 'resultados_c') {
          activityStatus.resultados_c = value;
          if (index !== undefined) {
            if (!activityStatus.timestamps_c) activityStatus.timestamps_c = {};
            activityStatus.timestamps_c[index] = now;
          }
        } else {
          // For other fields that might be top-level
          updateData[field] = value;
        }
        
        currentStatus[activityName] = activityStatus;
        updateData.atividades_status = currentStatus;
      } else {
        updateData[field] = value;
      }

      const { error } = await supabase
        .from('treinamentos')
        .update(updateData)
        .eq('id', selectedTraining.id);
      
      if (error) throw error;
      
      const updatedTraining = { ...selectedTraining, ...updateData };
      setSelectedTraining(updatedTraining);
      setTrainings(trainings.map(t => t.id === selectedTraining.id ? updatedTraining : t));
    } catch (err: any) {
      toast.error("Erro ao atualizar avaliação: " + err.message);
    }
  };

  const handleFinalizeActivity = async () => {
    if (!selectedTraining || !activityToFinalize) return;
    if (trainerSigRef.current?.isEmpty() || traineeSigRef.current?.isEmpty()) {
      toast.error("Assinaturas do treinador e do aluno são obrigatórias.");
      return;
    }

    const status = selectedTraining.atividades_status?.[activityToFinalize];
    if (!status) {
      toast.error("Atividade não iniciada.");
      return;
    }

    if (selectedTraining.current_phase === 3) {
      // Check if evaluations are complete
      const hasA = Object.keys(status.notas_a || {}).length > 0;
      const hasB = Object.keys(status.notas_b || {}).length > 0;
      const hasC = Object.keys(status.resultados_c || {}).length > 0;

      if (!hasA || !hasB || !hasC) {
        toast.error("Avaliações A, B e C devem estar concluídas para finalizar a atividade.");
        return;
      }
    }

    try {
      setLoading(true);
      
      // Use base64 for signatures to avoid "Bucket not found" errors
      const trainerSigUrl = trainerSigRef.current?.getTrimmedCanvas().toDataURL('image/png');
      const traineeSigUrl = traineeSigRef.current?.getTrimmedCanvas().toDataURL('image/png');

      if (!trainerSigUrl || !traineeSigUrl) {
        toast.error("Ambas as assinaturas são obrigatórias.");
        return;
      }

      const currentStatus = JSON.parse(JSON.stringify(selectedTraining.atividades_status || {}));
      currentStatus[activityToFinalize] = {
        ...currentStatus[activityToFinalize],
        concluida: true,
        assinatura_treinador_url: trainerSigUrl,
        assinatura_aluno_url: traineeSigUrl
      };

      // Check for phase progression
      let nextPhase = selectedTraining.current_phase || 1;
      const currentPhaseInfo = PHASES.find(p => p.id === nextPhase);
      const allPhaseActivitiesDone = currentPhaseInfo?.activities.every(act => currentStatus[act]?.concluida);
      
      if (allPhaseActivitiesDone && nextPhase < 3) {
        nextPhase += 1;
        const nextPhaseInfo = PHASES.find(p => p.id === nextPhase);
        nextPhaseInfo?.activities.forEach(act => {
          if (!currentStatus[act]) {
            currentStatus[act] = {
              concluida: false,
              notas_a: {},
              notas_b: {},
              resultados_c: {},
              tempo_segundos: 0
            };
          }
        });
        toast.success(`Fase ${selectedTraining.current_phase} concluída! Avançando para Fase ${nextPhase}.`);
      }

      // Update metadata
      currentStatus._metadata = {
        ...(currentStatus._metadata || {}),
        current_phase: nextPhase
      };

      const { error: trainingError } = await supabase
        .from('treinamentos')
        .update({ 
          atividades_status: currentStatus
        })
        .eq('id', selectedTraining.id);

      if (trainingError) throw trainingError;

      const updatedTraining = { 
        ...selectedTraining, 
        atividades_status: currentStatus,
        current_phase: nextPhase
      };
      setSelectedTraining(updatedTraining);
      setTrainings(trainings.map(t => t.id === selectedTraining.id ? updatedTraining : t));

      toast.success("Atividade finalizada com sucesso!");
      setShowFinalizeActivity(false);
      setActivityToFinalize("");
      setSelectedActivity("");
      setSelectedCriterion("");
      fetchTrainings();
    } catch (err: any) {
      toast.error("Erro ao finalizar atividade: " + err.message);
    } finally {
      setLoading(false);
    }
  };
  const handleFinalizeTraining = async () => {
    if (!selectedTraining) return;

    // Calculate overall scores from all activities
    const allStatus = Object.values(selectedTraining.atividades_status || {}) as any[];
    
    let totalA = 0, countA = 0;
    let totalB = 0, countB = 0;
    let totalHitsC = 0, totalTestsC = 0;

    allStatus.forEach(status => {
      const valsA = Object.values(status.notas_a || {}) as number[];
      if (valsA.length > 0) {
        totalA += valsA.reduce((a, b) => a + b, 0);
        countA += valsA.length;
      }

      const valsB = Object.values(status.notas_b || {}) as number[];
      if (valsB.length > 0) {
        totalB += valsB.reduce((a, b) => a + b, 0);
        countB += valsB.length;
      }

      const valsC = Object.values(status.resultados_c || {}) as boolean[];
      if (valsC.length > 0) {
        totalHitsC += valsC.filter(v => v).length;
        totalTestsC += valsC.length;
      }
    });

    const avgA = countA > 0 ? totalA / countA : 0;
    const avgB = countB > 0 ? totalB / countB : 0;
    const pctC = totalTestsC > 0 ? (totalHitsC / totalTestsC) * 100 : 0;

    const hoursMet = (selectedTraining.horas_acumuladas || 0) >= (selectedTraining.horas_necessarias || 0);

    if (!hoursMet) {
      toast.error("Carga horária insuficiente para finalizar.");
      return;
    }

    if (avgA < 7 || avgB < 7 || pctC < 70) {
      toast.error(`Avaliações abaixo da média mínima. (A: ${avgA.toFixed(1)}, B: ${avgB.toFixed(1)}, C: ${pctC.toFixed(0)}%)`);
      return;
    }

    // Check if all phases are complete
    if (selectedTraining.current_phase < 3) {
      toast.error("Todas as fases devem ser concluídas antes de finalizar o treinamento.");
      return;
    }

    try {
      const { error } = await supabase
        .from('treinamentos')
        .update({ 
          status: 'concluido',
          situacao: 'apto',
          encerrado_em: new Date().toISOString(),
          media_a: avgA,
          media_b: avgB,
          percentual_c: pctC
        })
        .eq('id', selectedTraining.id);

      if (error) throw error;

      toast.success("Treinamento finalizado com sucesso!");
      setSelectedTraining(null);
      fetchTrainings();
    } catch (err: any) {
      toast.error("Erro ao finalizar treinamento: " + err.message);
    }
  };

  const fetchActivityHistory = async (trainingId: string) => {
    try {
      const { data, error } = await supabase
        .from('historico_atividades')
        .select('*')
        .eq('treinamento_id', trainingId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setActivityHistory(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar histórico:", err);
    }
  };

  useEffect(() => {
    if (selectedTraining) {
      fetchActivityHistory(selectedTraining.id);
    }
  }, [selectedTraining]);

  // Fetch ongoing trainings
  const fetchTrainings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('treinamentos')
        .select('*')
        .eq('status', 'em_andamento')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const mappedData = (data || []).map(t => {
        const meta = t.atividades_status?._metadata || {};
        return {
          ...t,
          current_phase: meta.current_phase || 1,
          horas_simulacao: meta.horas_simulacao || 0,
          horas_pratica: meta.horas_pratica || 0,
          media_hit_rate: meta.media_hit_rate || 0
        };
      });
      setTrainings(mappedData);

      // Fetch all active sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessoes_treinamento')
        .select('*')
        .is('fim', null);

      if (sessionsError) throw sessionsError;
      
      const sessionsMap: Record<string, any> = {};
      sessions?.forEach(s => {
        sessionsMap[s.training_id] = s;
      });
      setActiveSessions(sessionsMap);

      // If there's an active session for the current user (this client), set it
      // Note: In a real app, we might want to track which user started which session
      // For now, if the selected training has an active session, we show it
      if (selectedTraining && sessionsMap[selectedTraining.id]) {
        const session = sessionsMap[selectedTraining.id];
        setActiveSession(session);
        setSelectedActivity(session.metadata?.atividade || "");
        setSelectedCriterion(session.metadata?.criterio || "");
        
        // Calculate elapsed time
        const start = new Date(session.inicio).getTime();
        const now = new Date().getTime();
        setSessionSeconds(Math.floor((now - start) / 1000));
      }
    } catch (err: any) {
      toast.error("Erro ao carregar treinamentos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainings();
  }, []);

  useEffect(() => {
    if (selectedTraining) {
      const updated = trainings.find(t => t.id === selectedTraining.id);
      if (updated) {
        setSelectedTraining(updated);
      }
    }
  }, [trainings]);

  // Timer logic
  useEffect(() => {
    if (activeSession) {
      requestWakeLock();
      const startTime = new Date(activeSession.inicio).getTime();
      timerRef.current = setInterval(() => {
        const now = new Date().getTime();
        setSessionSeconds(Math.floor((now - startTime) / 1000));
      }, 1000);
    } else {
      releaseWakeLock();
      if (timerRef.current) clearInterval(timerRef.current);
      setSessionSeconds(0);
    }
    return () => {
      releaseWakeLock();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeSession]);

  const handleStartSession = async (training: OngoingTraining, activityOverride?: string) => {
    const activity = activityOverride || selectedActivity;
    if (!activity) {
      toast.error("Selecione uma atividade para iniciar.");
      return;
    }
    if (training.current_phase === 3 && !selectedCriterion) {
      toast.error("Selecione qual critério (A, B ou C) será avaliado.");
      return;
    }

    try {
      const startTime = new Date().toISOString();
      const sessionData = {
        training_id: training.id,
        inicio: startTime,
        duracao_segundos: 0,
        metadata: { 
          atividade: activity, 
          criterio: training.current_phase === 3 ? selectedCriterion : null
        }
      };

      const { data, error } = await supabase
        .from('sessoes_treinamento')
        .insert(sessionData)
        .select()
        .single();

      if (error) throw error;
      setActiveSession(data);
      setSelectedTraining(training);
      fetchTrainings(); // Refresh to update activeSessions map
      toast.success(`Sessão iniciada para: ${selectedActivity}`);
    } catch (err: any) {
      toast.error("Erro ao iniciar sessão: " + err.message);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession || !selectedTraining) return;
    setShowSessionModal(true);
    setHitRateInput("");
  };

  const handleSaveSession = async () => {
    if (!activeSession || !selectedTraining) return;
    
    if (sessionTrainerSigRef.current?.isEmpty() || sessionTraineeSigRef.current?.isEmpty()) {
      toast.error("Assinaturas do treinador e do aluno são obrigatórias.");
      return;
    }

    const isSimulation = activeSession.metadata?.atividade === "Simulador de interpretação de imagens de raios-X";
    if (isSimulation && !hitRateInput) {
      toast.error("Por favor, insira o Hit-Rate da seção.");
      return;
    }

    try {
      setLoading(true);
      const endTime = new Date().toISOString();
      
      // Use base64 for signatures to avoid "Bucket not found" errors
      const trainerSigUrl = sessionTrainerSigRef.current!.getTrimmedCanvas().toDataURL('image/png');
      const traineeSigUrl = sessionTraineeSigRef.current!.getTrimmedCanvas().toDataURL('image/png');

      const { error: sessionError } = await supabase
        .from('sessoes_treinamento')
        .update({
          fim: endTime,
          duracao_segundos: sessionSeconds,
          metadata: {
            ...activeSession.metadata,
            hit_rate: isSimulation ? parseFloat(hitRateInput) : null,
            assinatura_treinador_url: trainerSigUrl,
            assinatura_aluno_url: traineeSigUrl
          }
        })
        .eq('id', activeSession.id);

      if (sessionError) throw sessionError;

      const activityName = activeSession.metadata?.atividade || selectedActivity || "Avaliação Geral";
      const criterion = activeSession.metadata?.criterio || selectedCriterion;

      // Save to historico_atividades - use metadata if columns are missing
      const historyData: any = {
        treinamento_id: selectedTraining.id,
        nome_atividade: activityName,
        criterio: criterion,
        hora_inicio: activeSession.inicio,
        hora_fim: endTime,
        tempo_execucao: sessionSeconds,
        hit_rate: isSimulation ? parseFloat(hitRateInput) : null,
        assinatura_treinador_url: trainerSigUrl,
        assinatura_aluno_url: traineeSigUrl
      };

      const { error: historyError } = await supabase
        .from('historico_atividades')
        .insert(historyData);

      // If historyError is about missing columns, try a more basic insert
      if (historyError && historyError.message.includes("column")) {
        const basicHistoryData = {
          treinamento_id: selectedTraining.id,
          nome_atividade: activityName,
          criterio: criterion,
          hora_inicio: activeSession.inicio,
          hora_fim: endTime,
          tempo_execucao: sessionSeconds
        };
        await supabase.from('historico_atividades').insert(basicHistoryData);
      }

      // Update accumulated hours in training
      const newAccumulated = (selectedTraining.horas_acumuladas || 0) + sessionSeconds;
      
      // Update specific Phase 2 hours
      let newSimulacao = selectedTraining.horas_simulacao || 0;
      let newPratica = selectedTraining.horas_pratica || 0;
      
      if (activityName === "Simulador de interpretação de imagens de raios-X") {
        newSimulacao += sessionSeconds;
      } else if (activityName === "Prática Supervisionada nas funções I, II, III, IV, V e controle de acesso") {
        newPratica += sessionSeconds;
      }

      // Update atividades_status
      const currentStatus = JSON.parse(JSON.stringify(selectedTraining.atividades_status || {}));
      
      if (activityName) {
        const activityStatus = currentStatus[activityName] || {
          concluida: false,
          notas_a: {},
          notas_b: {},
          resultados_c: {},
          tempo_segundos: 0
        };
        
        activityStatus.tempo_segundos = (activityStatus.tempo_segundos || 0) + sessionSeconds;
        currentStatus[activityName] = activityStatus;
      }

      // Calculate new media_hit_rate if applicable
      let newMediaHitRate = selectedTraining.media_hit_rate || 0;
      if (isSimulation) {
        // Fetch all simulation sessions for this training to get accurate average
        const { data: simSessions } = await supabase
          .from('historico_atividades')
          .select('hit_rate')
          .eq('treinamento_id', selectedTraining.id)
          .eq('nome_atividade', "Simulador de interpretação de imagens de raios-X");
        
        const allRates = (simSessions || []).map(s => s.hit_rate).filter(r => r !== null) as number[];
        allRates.push(parseFloat(hitRateInput));
        newMediaHitRate = allRates.reduce((a, b) => a + b, 0) / allRates.length;
      }

      // Update metadata
      currentStatus._metadata = {
        ...currentStatus._metadata,
        current_phase: selectedTraining.current_phase || 1,
        horas_simulacao: newSimulacao,
        horas_pratica: newPratica,
        media_hit_rate: newMediaHitRate
      };

      const { error: trainingError } = await supabase
        .from('treinamentos')
        .update({ 
          horas_acumuladas: newAccumulated,
          atividades_status: currentStatus
        })
        .eq('id', selectedTraining.id);

      if (trainingError) throw trainingError;

      const updatedTraining = { 
        ...selectedTraining, 
        horas_acumuladas: newAccumulated,
        horas_simulacao: newSimulacao,
        horas_pratica: newPratica,
        media_hit_rate: newMediaHitRate,
        atividades_status: currentStatus
      };
      setSelectedTraining(updatedTraining);
      setTrainings(trainings.map(t => t.id === selectedTraining.id ? updatedTraining : t));

      toast.success("Sessão encerrada e histórico registrado!");
      setActiveSession(null);
      setSessionSeconds(0);
      setShowSessionModal(false);
      fetchTrainings(); // Refresh list
      fetchActivityHistory(selectedTraining.id);
    } catch (err: any) {
      toast.error("Erro ao encerrar sessão: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const calculateProgress = (training: OngoingTraining) => {
    if (!training.horas_necessarias) return 0;
    
    if (training.current_phase === 2) {
      // Phase 2 specific progress: 12h simulation + 20h practice
      const simProgress = Math.min(((training.horas_simulacao || 0) / (12 * 3600)) * 100, 100);
      const pracProgress = Math.min(((training.horas_pratica || 0) / (20 * 3600)) * 100, 100);
      return (simProgress + pracProgress) / 2;
    }
    
    return Math.min((training.horas_acumuladas / training.horas_necessarias) * 100, 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="page-header">
          <h2 className="text-xl font-semibold text-text">Treinamentos em Andamento</h2>
          <p className="text-[13px] text-muted mt-1">
            Gerencie o progresso e as sessões de treinamento dos colaboradores
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
          <input
            type="text"
            placeholder="Buscar colaborador ou CPF..."
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border focus:border-accent outline-none text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      {activeSession && selectedTraining && (
        <div className="bg-accent/5 border border-accent/20 p-6 shadow-sm animate-pulse-subtle">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-accent text-white rounded-full flex items-center justify-center">
                <Clock size={24} />
              </div>
              <div>
                <div className="text-[11px] text-accent font-bold uppercase tracking-wider">Avaliação em Andamento: {selectedActivity}</div>
                <div className="text-lg font-bold text-text">{selectedTraining.colaborador_nome}</div>
                <div className="text-[12px] text-muted">{selectedTraining.tipo_treinamento} — {selectedTraining.local_treinamento}</div>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <div className="text-[10px] text-muted uppercase font-mono">Duração Atual</div>
                <div className="text-2xl font-mono font-bold text-accent">{formatDuration(sessionSeconds)}</div>
              </div>
              <button
                onClick={handleEndSession}
                className="px-6 py-3 bg-danger hover:bg-danger-dark text-white text-[13px] font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95"
              >
                <Square size={18} fill="currentColor" /> ENCERRAR SESSÃO
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-surface border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface2">
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Colaborador</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Tipo</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Fase</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Progresso</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Carga Horária</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Início</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTrainings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted text-[13px]">
                    Nenhum treinamento em andamento encontrado.
                  </td>
                </tr>
              ) : (
                filteredTrainings.map((training) => (
                  <tr 
                    key={training.id} 
                    className={cn(
                      "hover:bg-surface2 transition-colors cursor-pointer",
                      selectedTraining?.id === training.id && "bg-accent/5"
                    )}
                    onClick={() => {
                      if (selectedTraining?.id !== training.id) {
                        setSelectedTraining(training);
                        
                        // Restore active session state if exists
                        const session = activeSessions[training.id];
                        if (session) {
                          setActiveSession(session);
                          setSelectedActivity(session.metadata?.atividade || "");
                          setSelectedCriterion(session.metadata?.criterio || "");
                          
                          const start = new Date(session.inicio).getTime();
                          const now = new Date().getTime();
                          setSessionSeconds(Math.floor((now - start) / 1000));
                        } else {
                          setActiveSession(null);
                          setSelectedActivity("");
                          setSelectedCriterion("");
                        }
                        
                        setIsEditingEvals(false);
                        setExpandedEval(null);
                      }
                    }}
                  >
                    <td className="p-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="text-[13px] font-bold">{training.colaborador_nome}</div>
                        {activeSessions[training.id] && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-accent text-white text-[9px] font-bold uppercase rounded animate-pulse">
                            <Play size={10} fill="currentColor" /> EM SESSÃO
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-muted">{training.colaborador_cpf}</div>
                    </td>
                    <td className="p-3 px-4">
                      <span className="px-2 py-0.5 bg-surface2 border border-border text-[10px] font-mono text-muted uppercase">
                        {training.tipo_treinamento}
                      </span>
                    </td>
                    <td className="p-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-surface2 rounded-full overflow-hidden max-w-[100px]">
                          <div 
                            className="h-full bg-accent" 
                            style={{ width: `${calculateProgress(training)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-accent">{calculateProgress(training).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="p-3 px-4 text-[12px] font-mono">
                      {formatDuration(training.horas_acumuladas || 0)} / {formatDuration(training.horas_necessarias || 0)}
                    </td>
                    <td className="p-3 px-4 text-[12px] text-muted">
                      {new Date(training.iniciado_em).toLocaleDateString()}
                    </td>
                    <td className="p-3 px-4">
                      <span className="px-2 py-0.5 bg-accent/10 border border-accent/20 text-[10px] font-bold text-accent uppercase rounded">
                        Fase {training.current_phase || 1}
                      </span>
                    </td>
                    <td className="p-3 px-4">
                      <button 
                        className="px-4 py-2 bg-accent hover:bg-accent-dark text-white text-[11px] font-bold transition-colors shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTraining(training);
                          setIsEditingEvals(true);
                          // Scroll to details
                          setTimeout(() => {
                            document.getElementById('training-details')?.scrollIntoView({ behavior: 'smooth' });
                          }, 100);
                        }}
                      >
                        AVALIAR / INICIAR
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTraining && (
        <div id="training-details" className="bg-surface border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">Detalhes do Treinamento</h3>
            <button 
              onClick={() => setSelectedTraining(null)}
              className="text-[12px] text-muted hover:text-text"
            >
              Fechar
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <Card title="Atividades Executadas" tag="Obrigatório">
                <div className="space-y-2">
                  {(PHASES.find(p => p.id === (selectedTraining.current_phase || 1))?.activities || []).map(act => {
                    const status = selectedTraining.atividades_status?.[act];
                    const isCompleted = status?.concluida;
                    const hasTime = (status?.tempo_segundos || 0) > 0;
                    const session = activeSessions[selectedTraining.id];
                    const isActive = session?.metadata?.atividade === act;
                    
                    return (
                      <div 
                        key={act} 
                        className={cn(
                          "flex items-center justify-between p-3 border transition-all",
                          isActive ? "border-accent ring-1 ring-accent/20 bg-accent/5" : "bg-surface border-border hover:bg-surface2",
                          isCompleted && "bg-success-light/10 border-success/30"
                        )}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className={cn(
                            "w-4 h-4 border flex items-center justify-center transition-colors",
                            isCompleted ? "bg-success border-success text-white" : "border-border2 bg-surface"
                          )}>
                            {isCompleted && <Check size={10} />}
                          </div>
                          <span className={cn(
                            "text-[12px] leading-tight",
                            isCompleted ? "text-success font-medium" : "text-text",
                            isActive && "text-accent font-bold"
                          )}>
                            {act}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {hasTime && !isCompleted && !isActive && (
                            <span className="text-[10px] font-mono text-muted">
                              {formatDuration(status?.tempo_segundos || 0)}
                            </span>
                          )}
                          
                          {isActive ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent text-[11px] font-bold rounded animate-pulse">
                              <span className="w-2 h-2 bg-accent rounded-full" />
                              EM CURSO
                            </div>
                          ) : (
                            <button
                              disabled={!!activeSession || isCompleted}
                              onClick={() => {
                                setSelectedActivity(act);
                                if (selectedTraining.current_phase < 3) {
                                  handleStartSession(selectedTraining, act);
                                }
                              }}
                              className={cn(
                                "px-6 py-1.5 text-white text-[12px] font-bold rounded-sm shadow-sm transition-all active:scale-95 disabled:opacity-50",
                                isCompleted 
                                  ? "bg-success/50 cursor-default" 
                                  : "bg-[#94a3b8] hover:bg-slate-500"
                              )}
                            >
                              {isCompleted ? "CONCLUÍDO" : "Iniciar"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedTraining.current_phase < 3 && (
                  <div className="pt-4 mt-4 border-t border-border flex justify-end">
                    <button
                      onClick={async () => {
                        const nextPhase = (selectedTraining.current_phase || 1) + 1;
                        const currentStatus = JSON.parse(JSON.stringify(selectedTraining.atividades_status || {}));
                        currentStatus._metadata = {
                          ...(currentStatus._metadata || {}),
                          current_phase: nextPhase
                        };

                        const { error } = await supabase
                          .from('treinamentos')
                          .update({ atividades_status: currentStatus })
                          .eq('id', selectedTraining.id);
                        
                        if (error) {
                          toast.error("Erro ao avançar fase");
                        } else {
                          toast.success(`Avançado para Fase ${nextPhase}`);
                          setSelectedTraining({ 
                            ...selectedTraining, 
                            atividades_status: currentStatus,
                            current_phase: nextPhase 
                          });
                          fetchTrainings();
                        }
                      }}
                      className="px-6 py-2.5 bg-[#ef4444] hover:bg-red-700 text-white text-[13px] font-bold flex items-center gap-2 transition-all active:scale-95 rounded-sm shadow-sm"
                    >
                      Próximo: {selectedTraining.current_phase === 1 ? "Iniciar Identificação de Ameaças" : "Iniciar Avaliação"} <ChevronRight size={16} />
                    </button>
                  </div>
                )}

                {selectedTraining.current_phase === 3 && (
                  <div className="space-y-4 pt-4 border-t border-border">
                    <div className="space-y-2">
                      <label className="text-[10px] text-muted uppercase font-mono">Critério de Avaliação (Fase 3)</label>
                      <select 
                        className="w-full p-2 border border-border text-[12px] bg-surface outline-none focus:border-accent"
                        value={selectedCriterion}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setSelectedCriterion(val);
                          if (val) setExpandedEval(val);
                        }}
                      >
                        <option value="">Selecione o critério para avaliar...</option>
                        <option value="A">Critério A — Comportamento</option>
                        <option value="B">Critério B — Detecção</option>
                        <option value="C">Critério C — Testes Aleatórios</option>
                      </select>
                    </div>
                    
                    <button
                      disabled={!!activeSession || !selectedActivity || !selectedCriterion}
                      onClick={() => handleStartSession(selectedTraining)}
                      className="w-full py-2.5 bg-accent hover:bg-accent-dark text-white text-[12px] font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 rounded-sm shadow-sm"
                    >
                      <Play size={16} fill="currentColor" /> INICIAR AVALIAÇÃO
                    </button>
                  </div>
                )}
              </Card>

              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted border-b pb-2 pt-4">Histórico de Atividades</h4>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                {!selectedActivity ? (
                  <div className="text-[12px] text-muted italic">Selecione uma atividade para ver o histórico de avaliações.</div>
                ) : !selectedTraining.atividades_status?.[selectedActivity] || 
                    (Object.keys(selectedTraining.atividades_status[selectedActivity].notas_a || {}).length === 0 && 
                     Object.keys(selectedTraining.atividades_status[selectedActivity].notas_b || {}).length === 0 && 
                     Object.keys(selectedTraining.atividades_status[selectedActivity].resultados_c || {}).length === 0) ? (
                  <div className="text-[12px] text-muted italic">Nenhuma avaliação registrada para esta atividade.</div>
                ) : (
                  <div className="space-y-4">
                    {/* Evaluations History (Current Grades with Timestamps) */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-accent uppercase tracking-widest border-l-2 border-accent pl-2 mb-2">Avaliações Atuais — {selectedActivity}</div>
                      
                      {/* Critério A */}
                      {Object.entries(selectedTraining.atividades_status[selectedActivity].notas_a || {}).map(([idx, nota]) => (
                        <div key={`eval-a-${idx}`} className="p-2 bg-accent/5 border border-accent/10 rounded text-[11px]">
                          <div className="font-medium text-text">{CRITERIA_A[parseInt(idx)]}</div>
                          <div className="flex justify-between items-center mt-1 text-[10px]">
                            <span className="text-accent font-bold">Nota: {nota}</span>
                            <span className="text-hint">
                              {selectedTraining.atividades_status?.[selectedActivity]?.timestamps_a?.[parseInt(idx)] 
                                ? new Date(selectedTraining.atividades_status[selectedActivity].timestamps_a![parseInt(idx)]).toLocaleString()
                                : "Data N/A"}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Critério B */}
                      {Object.entries(selectedTraining.atividades_status[selectedActivity].notas_b || {}).map(([idx, nota]) => (
                        <div key={`eval-b-${idx}`} className="p-2 bg-accent/5 border border-accent/10 rounded text-[11px]">
                          <div className="font-medium text-text">{CRITERIA_B[parseInt(idx)]}</div>
                          <div className="flex justify-between items-center mt-1 text-[10px]">
                            <span className="text-accent font-bold">Nota: {nota}</span>
                            <span className="text-hint">
                              {selectedTraining.atividades_status?.[selectedActivity]?.timestamps_b?.[parseInt(idx)] 
                                ? new Date(selectedTraining.atividades_status[selectedActivity].timestamps_b![parseInt(idx)]).toLocaleString()
                                : "Data N/A"}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Critério C */}
                      {Object.entries(selectedTraining.atividades_status[selectedActivity].resultados_c || {}).map(([idx, result]) => (
                        <div key={`eval-c-${idx}`} className="p-2 bg-accent/5 border border-accent/10 rounded text-[11px]">
                          <div className="font-medium text-text">{SCENARIOS_C[parseInt(idx)]}</div>
                          <div className="flex justify-between items-center mt-1 text-[10px]">
                            <span className="text-accent font-bold">Resultado: {result ? "ACERTO ✅" : "ERRO ❌"}</span>
                            <span className="text-hint">
                              {selectedTraining.atividades_status?.[selectedActivity]?.timestamps_c?.[parseInt(idx)] 
                                ? new Date(selectedTraining.atividades_status[selectedActivity].timestamps_c![parseInt(idx)]).toLocaleString()
                                : "Data N/A"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted border-b pb-2">Informações Gerais</h4>
              <div className="space-y-3">
                <DetailItem label="Colaborador" value={selectedTraining.colaborador_nome} />
                <DetailItem label="CPF" value={selectedTraining.colaborador_cpf} />
                <DetailItem label="Matrícula" value={selectedTraining.colaborador_mat} />
                <DetailItem label="Tipo" value={selectedTraining.tipo_treinamento} />
                <DetailItem label="Local" value={selectedTraining.local_treinamento} />
                
                {selectedTraining.current_phase === 2 && (
                  <div className="pt-4 space-y-3 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-muted uppercase font-mono">Simulação (12h)</span>
                      <span className="text-[11px] font-bold">{formatDuration(selectedTraining.horas_simulacao || 0)}</span>
                    </div>
                    <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent" 
                        style={{ width: `${Math.min(((selectedTraining.horas_simulacao || 0) / (12 * 3600)) * 100, 100)}%` }}
                      />
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-muted uppercase font-mono">Prática (20h)</span>
                      <span className="text-[11px] font-bold">{formatDuration(selectedTraining.horas_pratica || 0)}</span>
                    </div>
                    <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent" 
                        style={{ width: `${Math.min(((selectedTraining.horas_pratica || 0) / (20 * 3600)) * 100, 100)}%` }}
                      />
                    </div>

                    {selectedTraining.media_hit_rate !== undefined && (
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-[11px] text-muted uppercase font-mono">Média Hit-Rate</span>
                        <span className={cn(
                          "text-[11px] font-bold",
                          (selectedTraining.media_hit_rate || 0) >= 80 ? "text-success" : "text-danger"
                        )}>
                          {(selectedTraining.media_hit_rate || 0).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted border-b pb-2">Progresso da Carga Horária</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div className="text-2xl font-bold">{formatDuration(selectedTraining.horas_acumuladas || 0)}</div>
                  <div className="text-[12px] text-muted">de {formatDuration(selectedTraining.horas_necessarias || 0)}</div>
                </div>
                <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent" 
                    style={{ width: `${calculateProgress(selectedTraining)}%` }}
                  />
                </div>
                <div className="text-[11px] text-muted italic">
                  Tempo restante: {formatDuration(Math.max((selectedTraining.horas_necessarias || 0) - (selectedTraining.horas_acumuladas || 0), 0))}
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between border-b pb-2 mb-4">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted">Avaliações {selectedActivity ? `— ${selectedActivity}` : ""}</h4>
                  <div className="flex gap-2">
                    {selectedActivity && !selectedTraining.atividades_status?.[selectedActivity]?.concluida && (
                      <button 
                        onClick={() => {
                          setActivityToFinalize(selectedActivity);
                          setShowFinalizeActivity(true);
                        }}
                        className="text-[10px] text-success hover:underline font-bold uppercase"
                      >
                        Finalizar Atividade
                      </button>
                    )}
                    {selectedTraining.current_phase === 3 && (
                      <button 
                        onClick={() => {
                          const nextState = !isEditingEvals;
                          setIsEditingEvals(nextState);
                          if (nextState && selectedCriterion) {
                            setExpandedEval(selectedCriterion as any);
                          } else if (!nextState) {
                            setExpandedEval(null);
                          }
                        }}
                        className="text-[10px] text-accent hover:underline font-bold uppercase"
                      >
                        {isEditingEvals ? "Salvar" : "Editar"}
                      </button>
                    )}
                  </div>
                </div>
                {selectedTraining.current_phase < 3 ? (
                  <div className="p-8 text-center bg-surface2 border border-dashed border-border rounded">
                    <AlertCircle className="mx-auto text-muted mb-2" size={24} />
                    <p className="text-[12px] text-muted italic">
                      As avaliações por critérios (A, B e C) são realizadas apenas na <strong>Fase 3 – Prática Avaliada</strong>.
                    </p>
                  </div>
                ) : isEditingEvals ? (
                  <div className="space-y-6">
                    {!selectedActivity ? (
                      <div className="text-[12px] text-muted italic p-4 text-center bg-surface2 border border-dashed border-border">
                        Selecione uma atividade na tabela acima para editar suas avaliações.
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <h5 
                            className="text-[12px] font-bold text-accent uppercase border-b pb-1 cursor-pointer flex justify-between items-center hover:bg-surface2 transition-colors px-1"
                            onClick={() => setExpandedEval(expandedEval === "A" ? null : "A")}
                          >
                            Avaliação A — Comportamento
                            <span className="text-[10px]">{expandedEval === "A" ? "▲" : "▼"}</span>
                          </h5>
                          {expandedEval === "A" && (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin animate-in slide-in-from-top-2 duration-200">
                              {CRITERIA_A.map((criterion, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-4 p-2 bg-surface2 border border-border rounded">
                                  <span className="text-[12px] leading-tight">{criterion}</span>
                                  <input 
                                    type="number" 
                                    min="0" max="10" step="0.5"
                                    className="w-16 p-1 border border-border text-center text-sm"
                                    value={selectedTraining.atividades_status?.[selectedActivity]?.notas_a?.[idx] ?? ""}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      const newNotas = { ...(selectedTraining.atividades_status?.[selectedActivity]?.notas_a || {}), [idx]: val };
                                      handleUpdateEval('notas_a', newNotas, selectedActivity, idx);
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <h5 
                            className="text-[12px] font-bold text-accent uppercase border-b pb-1 cursor-pointer flex justify-between items-center hover:bg-surface2 transition-colors px-1"
                            onClick={() => setExpandedEval(expandedEval === "B" ? null : "B")}
                          >
                            Avaliação B — Detecção
                            <span className="text-[10px]">{expandedEval === "B" ? "▲" : "▼"}</span>
                          </h5>
                          {expandedEval === "B" && (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin animate-in slide-in-from-top-2 duration-200">
                              {CRITERIA_B.map((criterion, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-4 p-2 bg-surface2 border border-border rounded">
                                  <span className="text-[12px] leading-tight">{criterion}</span>
                                  <input 
                                    type="number" 
                                    min="0" max="10" step="0.5"
                                    className="w-16 p-1 border border-border text-center text-sm"
                                    value={selectedTraining.atividades_status?.[selectedActivity]?.notas_b?.[idx] ?? ""}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      const newNotas = { ...(selectedTraining.atividades_status?.[selectedActivity]?.notas_b || {}), [idx]: val };
                                      handleUpdateEval('notas_b', newNotas, selectedActivity, idx);
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <h5 
                            className="text-[12px] font-bold text-accent uppercase border-b pb-1 cursor-pointer flex justify-between items-center hover:bg-surface2 transition-colors px-1"
                            onClick={() => setExpandedEval(expandedEval === "C" ? null : "C")}
                          >
                            Avaliação C — Testes Aleatórios
                            <span className="text-[10px]">{expandedEval === "C" ? "▲" : "▼"}</span>
                          </h5>
                          {expandedEval === "C" && (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin animate-in slide-in-from-top-2 duration-200">
                              {SCENARIOS_C.map((scenario, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-4 p-2 bg-surface2 border border-border rounded">
                                  <span className="text-[12px] leading-tight">{scenario}</span>
                                  <select 
                                    className="p-1 border border-border text-sm bg-surface"
                                    value={selectedTraining.atividades_status?.[selectedActivity]?.resultados_c?.[idx] === undefined ? "" : selectedTraining.atividades_status[selectedActivity].resultados_c[idx] ? "hit" : "miss"}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const newResults = { ...(selectedTraining.atividades_status?.[selectedActivity]?.resultados_c || {}) };
                                      if (val === "") delete newResults[idx];
                                      else newResults[idx] = val === "hit";
                                      handleUpdateEval('resultados_c', newResults, selectedActivity, idx);
                                    }}
                                  >
                                    <option value="">—</option>
                                    <option value="hit">✅</option>
                                    <option value="miss">❌</option>
                                  </select>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="cursor-pointer transition-transform active:scale-95" onClick={() => { setIsEditingEvals(true); setExpandedEval("A"); }}>
                      <EvalBox label="A" score={calculateAvg(selectedActivity ? selectedTraining.atividades_status?.[selectedActivity]?.notas_a : selectedTraining.notas_a)} min={7} />
                    </div>
                    <div className="cursor-pointer transition-transform active:scale-95" onClick={() => { setIsEditingEvals(true); setExpandedEval("B"); }}>
                      <EvalBox label="B" score={calculateAvg(selectedActivity ? selectedTraining.atividades_status?.[selectedActivity]?.notas_b : selectedTraining.notas_b)} min={7} />
                    </div>
                    <div className="cursor-pointer transition-transform active:scale-95" onClick={() => { setIsEditingEvals(true); setExpandedEval("C"); }}>
                      <EvalBox label="C" score={calculatePctC(selectedActivity ? selectedTraining.atividades_status?.[selectedActivity]?.resultados_c : selectedTraining.resultados_c)} min={70} isPct />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-10 flex justify-end gap-3 border-t pt-6">
            <button
              onClick={() => setSelectedTraining(null)}
              className="px-5 py-2.5 bg-surface2 hover:bg-surface3 border border-border2 text-[13px] font-medium transition-colors"
            >
              Voltar
            </button>
            <button
              onClick={handleFinalizeTraining}
              className="px-6 py-2.5 bg-success hover:bg-green-700 text-white text-[13px] font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"
            >
              <CheckCircle2 size={18} /> FINALIZAR TREINAMENTO
            </button>
          </div>
        </div>
      )}

      {showSessionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-surface border border-border w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Encerrar Sessão e Registrar Histórico</h3>
                <p className="text-[12px] text-muted">{selectedActivity} — {formatDuration(sessionSeconds)}</p>
              </div>
              <button 
                onClick={() => setShowSessionModal(false)}
                className="text-muted hover:text-text"
              >
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {activeSession?.metadata?.atividade === "Simulador de interpretação de imagens de raios-X" && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Hit-Rate da Sessão (%)</label>
                  <input 
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-full p-2 border border-border text-sm bg-surface outline-none focus:border-accent"
                    placeholder="Ex: 85.5"
                    value={hitRateInput}
                    onChange={(e) => setHitRateInput(e.target.value)}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Assinatura do Treinador</label>
                  <div className="border border-border bg-white rounded overflow-hidden">
                    <SignatureCanvas 
                      ref={sessionTrainerSigRef}
                      penColor="black"
                      canvasProps={{ className: "w-full h-40" }}
                    />
                  </div>
                  <button 
                    onClick={() => sessionTrainerSigRef.current?.clear()}
                    className="text-[10px] text-accent hover:underline font-bold uppercase"
                  >
                    Limpar
                  </button>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Assinatura do Aluno</label>
                  <div className="border border-border bg-white rounded overflow-hidden">
                    <SignatureCanvas 
                      ref={sessionTraineeSigRef}
                      penColor="black"
                      canvasProps={{ className: "w-full h-40" }}
                    />
                  </div>
                  <button 
                    onClick={() => sessionTraineeSigRef.current?.clear()}
                    className="text-[10px] text-accent hover:underline font-bold uppercase"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 bg-surface2 border-t border-border flex justify-end gap-3">
              <button 
                onClick={() => setShowSessionModal(false)}
                className="px-6 py-2 border border-border text-[13px] font-bold hover:bg-surface3 transition-colors"
              >
                CANCELAR
              </button>
              <button 
                onClick={handleSaveSession}
                disabled={loading}
                className="px-6 py-2 bg-success hover:bg-green-700 text-white text-[13px] font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? "SALVANDO..." : "SALVAR REGISTRO"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFinalizeActivity && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Finalizar Atividade</h3>
                <p className="text-[12px] text-muted">{activityToFinalize}</p>
              </div>
              <button 
                onClick={() => setShowFinalizeActivity(false)}
                className="text-muted hover:text-text"
              >
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Assinatura do Treinador</label>
                  <div className="border border-border bg-white rounded overflow-hidden">
                    <SignatureCanvas 
                      ref={trainerSigRef}
                      penColor="black"
                      canvasProps={{ className: "w-full h-40" }}
                    />
                  </div>
                  <button 
                    onClick={() => trainerSigRef.current?.clear()}
                    className="text-[10px] text-accent hover:underline font-bold uppercase"
                  >
                    Limpar
                  </button>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Assinatura do Aluno</label>
                  <div className="border border-border bg-white rounded overflow-hidden">
                    <SignatureCanvas 
                      ref={traineeSigRef}
                      penColor="black"
                      canvasProps={{ className: "w-full h-40" }}
                    />
                  </div>
                  <button 
                    onClick={() => traineeSigRef.current?.clear()}
                    className="text-[10px] text-accent hover:underline font-bold uppercase"
                  >
                    Limpar
                  </button>
                </div>
              </div>
              
              <div className="bg-accent/5 border border-accent/20 p-4 rounded text-[12px] text-accent flex gap-3">
                <AlertCircle size={18} className="shrink-0" />
                <p>
                  Ao finalizar esta atividade, os dados de avaliação e as assinaturas serão registrados permanentemente. 
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            
            <div className="p-6 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => setShowFinalizeActivity(false)}
                className="px-5 py-2.5 bg-surface2 hover:bg-surface3 border border-border2 text-[13px] font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleFinalizeActivity}
                disabled={loading}
                className="px-6 py-2.5 bg-success hover:bg-green-700 text-white text-[13px] font-bold flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? "Processando..." : "Confirmar e Finalizar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-[10px] text-muted uppercase font-mono">{label}</div>
    <div className="text-[13px] font-medium">{value}</div>
  </div>
);

const EvalBox = ({ label, score, min, isPct }: { label: string; score: number; min: number; isPct?: boolean }) => {
  const passed = score >= min;
  return (
    <div className={cn(
      "p-3 border text-center space-y-1",
      passed ? "bg-success-light border-success/30" : "bg-danger-light border-danger/30"
    )}>
      <div className="text-[10px] font-bold text-muted">AVAL. {label}</div>
      <div className={cn("text-lg font-bold", passed ? "text-success" : "text-danger")}>
        {score.toFixed(1)}{isPct ? "%" : ""}
      </div>
      <div className={cn("text-[9px] font-bold uppercase", passed ? "text-success" : "text-danger")}>
        {passed ? "Aprovado" : "Pendente"}
      </div>
    </div>
  );
};

const calculateAvg = (scores: Record<number, number> | undefined) => {
  if (!scores) return 0;
  const values = Object.values(scores).filter(v => typeof v === 'number' && !isNaN(v));
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

const calculatePctC = (results: Record<number, boolean> | undefined) => {
  if (!results) return 0;
  const values = Object.values(results).filter(v => v !== undefined);
  if (values.length === 0) return 0;
  const hits = values.filter(v => v === true).length;
  return (hits / values.length) * 100;
};
