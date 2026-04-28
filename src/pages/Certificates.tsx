import React, { useState, useEffect } from "react";
import { Download, Mail, Search, Loader2 } from "lucide-react";
import { cn, maskCPF, unmaskCPF, getUserIP } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import SignatureCanvas from "react-signature-canvas";
import { CRITERIA_A, CRITERIA_B, SCENARIOS_C } from "../constants";
import { XCircle, CheckCircle2, User, ShieldCheck, Briefcase, Eye, Printer, Send } from "lucide-react";

interface Certificate {
  id: string;
  colaborador_nome: string;
  colaborador_cpf: string;
  colaborador_mat: string;
  tipo_treinamento: string;
  situacao: string;
  treinador_nome?: string;
  iniciado_em: string;
  encerrado_em: string;
  prazo_dias?: number;
  status: string;
  local_treinamento?: string;
  atividades?: string[];
  atividades_status?: Record<string, {
    concluida: boolean;
    notas_a: Record<number, number>;
    notas_b: Record<number, number>;
    resultados_c: Record<number, boolean>;
    tempo_segundos: number;
    assinatura_treinador_url?: string;
    assinatura_aluno_url?: string;
  }>;
  notas_a?: Record<number, number>;
  notas_b?: Record<number, number>;
  resultados_c?: Record<number, boolean>;
  media_a?: number;
  media_b?: number;
  percentual_c?: number;
  observacoes?: string;
  assinatura_treinador_url?: string;
  // Novas assinaturas finais
  assinatura_final_colaborador_url?: string;
  assinatura_final_treinador_url?: string;
  assinatura_final_treinador_2_url?: string;
  assinatura_final_cliente_url?: string;
  data_assinatura_final_colaborador?: string;
  data_assinatura_final_treinador?: string;
  data_assinatura_final_treinador_2?: string;
  data_assinatura_final_cliente?: string;
  horas_acumuladas?: number;
  horas_simulacao?: number;
  horas_pratica?: number;
  media_hit_rate?: number;
  ip_assinatura_treinador?: string;
  ip_assinatura_colaborador?: string;
  ip_assinatura_cliente?: string;
}

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signatureUrl: string) => void;
  role: "colaborador" | "treinador" | "cliente";
  trainingName: string;
}

const SignatureModal: React.FC<SignatureModalProps> = ({ isOpen, onClose, onSave, role, trainingName }) => {
  const sigRef = React.useRef<SignatureCanvas>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    if (sigRef.current?.isEmpty()) {
      toast.error("Por favor, assine antes de salvar.");
      return;
    }
    const signatureUrl = sigRef.current?.getTrimmedCanvas().toDataURL("image/png");
    if (signatureUrl) {
      onSave(signatureUrl);
    }
  };

  const roleLabels = {
    colaborador: "Colaborador",
    treinador: "Treinador",
    cliente: "Cliente",
  };

  const roleIcons = {
    colaborador: <User size={20} />,
    treinador: <ShieldCheck size={20} />,
    cliente: <Briefcase size={20} />,
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4 backdrop-blur-sm">
      <div className="bg-surface border border-border w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-5 border-b border-border flex justify-between items-center bg-surface2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 text-accent rounded-full">
              {roleIcons[role]}
            </div>
            <div>
              <h3 className="text-base font-bold text-text">Assinatura Digital - {roleLabels[role]}</h3>
              <p className="text-[11px] text-muted uppercase tracking-wider">{trainingName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-text transition-colors">
            <XCircle size={22} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="bg-white border-2 border-dashed border-border p-2 rounded-lg">
            <SignatureCanvas 
              ref={sigRef}
              penColor="black"
              canvasProps={{ className: "w-full h-48 cursor-crosshair" }}
            />
          </div>
          
          <div className="flex justify-between items-center">
            <button 
              onClick={() => sigRef.current?.clear()}
              className="text-[12px] text-danger hover:underline font-bold uppercase tracking-tight"
            >
              Limpar Campo
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-surface2 hover:bg-surface3 border border-border text-[13px] font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-success hover:bg-green-700 text-white text-[13px] font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"
              >
                <CheckCircle2 size={18} /> CONFIRMAR ASSINATURA
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  onSign: () => void;
  onSend: () => void;
  onPrint: () => void;
  canSign: boolean;
}

const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({ 
  isOpen, onClose, pdfUrl, onSign, onSend, canSign 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 md:p-8 backdrop-blur-sm">
      <div className="bg-surface border border-border w-full max-w-5xl h-full max-h-[90vh] shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-border flex justify-between items-center bg-surface2">
          <div className="flex items-center gap-2">
            <Eye size={18} className="text-accent" />
            <h3 className="text-base font-bold text-text">Visualização do Documento Completo</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-text transition-colors">
            <XCircle size={22} />
          </button>
        </div>
        
        <div className="flex-1 bg-gray-100 p-1 overflow-hidden">
          {pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-full border-0 shadow-lg bg-white" title="PDF Preview" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-accent" size={32} />
                <p className="text-sm text-muted">Gerando visualização do documento...</p>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-border flex flex-wrap justify-end gap-3 bg-surface2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-surface hover:bg-surface3 border border-border2 text-[13px] font-medium transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={onSend}
            className="px-5 py-2.5 bg-surface hover:bg-surface3 border border-border2 text-[13px] font-medium flex items-center gap-2 transition-colors"
          >
            <Send size={16} /> Enviar documento
          </button>
          {canSign && (
            <button
              onClick={onSign}
              className="px-6 py-2.5 bg-accent hover:bg-accent-dark text-white text-[13px] font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"
            >
              <User size={18} /> ASSINAR DOCUMENTO
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const Certificates: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [filters, setFilters] = useState({
    cpf: "",
    tipo: "Todos",
    situacao: "Todos",
  });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [selectedCertForSignature, setSelectedCertForSignature] = useState<Certificate | null>(null);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const fetchUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setUserProfile(data);
    }
  };

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("treinamentos")
        .select(`
          *,
          profiles:treinador_id (nome_completo)
        `)
        .order("encerrado_em", { ascending: false });

      if (filters.cpf) {
        query = query.eq("colaborador_cpf", unmaskCPF(filters.cpf));
      }
      if (filters.tipo !== "Todos") {
        query = query.eq("tipo_treinamento", filters.tipo.toLowerCase());
      }
      if (filters.situacao !== "Todos") {
        if (filters.situacao === "Em Andamento") {
          query = query.eq("status", "em_andamento");
        } else {
          query = query.eq("situacao", filters.situacao.toLowerCase());
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedData = (data || []).map((item: any) => {
        const meta = item.atividades_status?._metadata || {};
        return {
          ...item,
          treinador_nome: item.profiles?.nome_completo || "N/A",
          current_phase: meta.current_phase || 1,
          horas_simulacao: meta.horas_simulacao || 0,
          horas_pratica: meta.horas_pratica || 0,
          media_hit_rate: meta.media_hit_rate || 0,
          media_a: meta.media_a || item.media_a,
          media_b: meta.media_b || item.media_b,
          percentual_c: meta.percentual_c || item.percentual_c
        };
      });

      setCertificates(formattedData);
    } catch (err: any) {
      toast.error("Erro ao buscar certificados: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
    fetchCertificates();
  }, []);

  const handleSaveSignature = async (signatureUrl: string) => {
    if (!selectedCertForSignature || !userProfile) return;

    const role = userProfile.perfil;
    let updateData: any = {};
    const now = new Date().toISOString();
    const userIP = await getUserIP();

    // Determine which field to update based on profile
    if (role === 'treinador' || role === 'admin') {
      // Check if first trainer signed
      if (!selectedCertForSignature.assinatura_final_treinador_url) {
        updateData = {
          assinatura_final_treinador_url: signatureUrl,
          data_assinatura_final_treinador: now,
          ip_assinatura_treinador: userIP
        };
      } else {
        updateData = {
          assinatura_final_treinador_2_url: signatureUrl,
          data_assinatura_final_treinador_2: now,
          // We don't have a specific column for a second trainer's IP, 
          // but we can reuse the same or add one. 
          // The request said: ip_assinatura_treinador, ip_assinatura_colaborador, ip_assinatura_cliente.
          // I'll stick to those.
          ip_assinatura_treinador: userIP
        };
      }
    } else if (role === 'cliente') {
      updateData = {
        assinatura_final_cliente_url: signatureUrl,
        data_assinatura_final_cliente: now,
        ip_assinatura_cliente: userIP
      };
    } else {
      updateData = {
        assinatura_final_colaborador_url: signatureUrl,
        data_assinatura_final_colaborador: now,
        ip_assinatura_colaborador: userIP
      };
    }

    try {
      const { error } = await supabase
        .from("treinamentos")
        .update(updateData)
        .eq("id", selectedCertForSignature.id);

      if (error) throw error;

      toast.success("Assinatura salva com sucesso!");
      setIsSignatureModalOpen(false);
      
      // Refresh certificates and update current selected cert to refresh PDF
      fetchCertificates();
      
      const updatedCert = { ...selectedCertForSignature, ...updateData };
      setSelectedCertForSignature(updatedCert);
      
      // Regenerate PDF preview
      setPdfUrl(null);
      const newPdfUrl = await generatePDF(updatedCert, false);
      setPdfUrl(newPdfUrl);
    } catch (err: any) {
      toast.error("Erro ao salvar assinatura: " + err.message);
    }
  };

  const handleCpfChange = async (val: string) => {
    const masked = maskCPF(val);
    setFilters({ ...filters, cpf: masked });

    if (val.length >= 3) {
      const { data } = await supabase
        .from("treinamentos")
        .select("colaborador_cpf")
        .ilike("colaborador_cpf", `${unmaskCPF(val)}%`)
        .limit(5);
      
      if (data) {
        const uniqueCpfs = Array.from(new Set(data.map(d => maskCPF(d.colaborador_cpf))));
        setSuggestions(uniqueCpfs);
        setShowSuggestions(true);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const generatePDF = async (cert: Certificate, shouldSave = true) => {
    if (shouldSave) {
      toast.info(`Gerando PDF completo para ${cert.colaborador_nome}...`);
    }
    
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });
      const margin = 10;
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Load Logo
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = "anonymous";
        logoImg.src = "https://lh3.googleusercontent.com/d/1sNzDKhdh2zH8d8DoyqIjx8l5LzBEXN5g";
        await new Promise((resolve, reject) => {
          logoImg.onload = resolve;
          logoImg.onerror = reject;
        });
        // Logo size adjusted to be more prominent and respect margins
        doc.addImage(logoImg, "PNG", margin, margin, 40, 15);
      } catch (e) {
        console.error("Erro ao carregar logo:", e);
      }

      // Fetch detailed history for this training
      const { data: historyData } = await supabase
        .from("historico_atividades")
        .select("*")
        .eq("treinamento_id", cert.id)
        .order("hora_inicio", { ascending: true });

      // Header
      doc.setFontSize(18);
      doc.setTextColor(225, 29, 72); // Red accent
      doc.setFont("helvetica", "bold");
      doc.text("Relatório Completo de Treinamento", pageWidth / 2, margin + 12, { align: "center" });
      
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pageWidth / 2, margin + 18, { align: "center" });

      // Student & Trainer Info
      autoTable(doc, {
        startY: margin + 32,
        margin: { top: margin, right: margin, bottom: margin, left: margin },
        tableWidth: 'auto',
        head: [["Informações Gerais", ""]],
        body: [
          ["Colaborador:", cert.colaborador_nome],
          ["CPF:", maskCPF(cert.colaborador_cpf)],
          ["Matrícula:", cert.colaborador_mat || "N/A"],
          ["Treinador Responsável:", cert.treinador_nome || "N/A"],
          ["Tipo de Treinamento:", cert.tipo_treinamento.toUpperCase()],
          ["Local:", cert.local_treinamento || "N/A"],
          ["Data de Início:", new Date(cert.iniciado_em).toLocaleDateString("pt-BR")],
          ["Data de Término:", cert.encerrado_em ? new Date(cert.encerrado_em).toLocaleDateString("pt-BR") : "Em andamento"],
          ["Situação:", cert.status === 'em_andamento' ? 'EM ANDAMENTO' : (cert.situacao?.toUpperCase() || "N/A")],
        ],
        theme: "striped",
        headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: "bold" },
        styles: { fontSize: 9, cellPadding: 2 },
      });

      // Detailed History
      if (historyData && historyData.length > 0) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(31, 41, 55);
        doc.text("Histórico Detalhado de Atividades", margin, (doc as any).lastAutoTable.finalY + 15);

        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 20,
          margin: { top: margin, right: margin, bottom: margin, left: margin },
          head: [["Atividade", "Critério", "Início", "Fim", "Duração", "Hit-Rate", "Assinaturas"]],
          body: historyData.map(h => [
            h.nome_atividade,
            h.criterio || "-",
            new Date(h.hora_inicio).toLocaleString("pt-BR"),
            new Date(h.hora_fim).toLocaleString("pt-BR"),
            formatDuration(h.tempo_execucao),
            h.hit_rate !== null ? `${h.hit_rate}%` : "-",
            (h.assinatura_treinador_url && h.assinatura_aluno_url) ? "SIM" : "NÃO"
          ]),
          theme: "grid",
          headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: "bold" },
          styles: { fontSize: 7 },
        });
      }

      // Activities and Scores Summary
      if (cert.atividades_status && Object.keys(cert.atividades_status).length > 0) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(31, 41, 55);
        doc.text("Resumo de Avaliações por Atividade", margin, (doc as any).lastAutoTable.finalY + 15);

        Object.entries(cert.atividades_status).forEach(([actName, status], idx) => {
          const avgA = Object.values(status.notas_a).length > 0 
            ? (Object.values(status.notas_a).reduce((a, b) => a + b, 0) / Object.values(status.notas_a).length).toFixed(1)
            : "N/A";
          const avgB = Object.values(status.notas_b).length > 0
            ? (Object.values(status.notas_b).reduce((a, b) => a + b, 0) / Object.values(status.notas_b).length).toFixed(1)
            : "N/A";
          const hitsC = Object.values(status.resultados_c).filter(v => v).length;
          const totalC = Object.values(status.resultados_c).length;
          const pctC = totalC > 0 ? `${((hitsC / totalC) * 100).toFixed(0)}%` : "N/A";

          autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 10,
            margin: { top: margin, right: margin, bottom: margin, left: margin },
            head: [[`Atividade: ${actName}`, "Resultado"]],
            body: [
              ["Avaliação A (Comportamento)", avgA],
              ["Avaliação B (Detecção)", avgB],
              ["Avaliação C (Testes)", pctC],
              ["Tempo Total Acumulado", formatDuration(status.tempo_segundos)],
            ],
            theme: "grid",
            headStyles: { fillColor: [75, 85, 99], textColor: [255, 255, 255], fontStyle: "bold" },
            styles: { fontSize: 8 },
          });
        });
      }

      // Final Results
      const finalResultsBody = [
        ["Média Geral Avaliação A:", cert.media_a?.toFixed(1) || "N/A"],
        ["Média Geral Avaliação B:", cert.media_b?.toFixed(1) || "N/A"],
        ["Aproveitamento Geral Avaliação C:", cert.percentual_c ? `${cert.percentual_c.toFixed(0)}%` : "N/A"],
        ["Carga Horária Total:", formatDuration(cert.horas_acumuladas || 0)],
      ];

      if (cert.horas_simulacao !== undefined) {
        finalResultsBody.push(["Carga Horária Simulação (Fase 2):", formatDuration(cert.horas_simulacao)]);
      }
      if (cert.horas_pratica !== undefined) {
        finalResultsBody.push(["Carga Horária Prática (Fase 2):", formatDuration(cert.horas_pratica)]);
      }
      if (cert.media_hit_rate !== undefined) {
        finalResultsBody.push(["Média Hit-Rate (Simulação):", `${cert.media_hit_rate.toFixed(1)}%`]);
      }

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        margin: { top: margin, right: margin, bottom: margin, left: margin },
        head: [["Resultados Finais do Treinamento", ""]],
        body: finalResultsBody,
        theme: "plain",
        styles: { fontSize: 10, fontStyle: "bold", textColor: [225, 29, 72] },
      });

      // Observations
      if (cert.observacoes) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Observações e Parecer Técnico:", margin, (doc as any).lastAutoTable.finalY + 15);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const splitObs = doc.splitTextToSize(cert.observacoes, pageWidth - (margin * 2));
        doc.text(splitObs, margin, (doc as any).lastAutoTable.finalY + 20);
      }

      // Final Signatures Section
      const finalY = (doc as any).lastAutoTable.finalY + (cert.observacoes ? 40 : 20);
      
      const addSignature = async (url: string | undefined, label: string, date: string | undefined, ip: string | undefined, x: number, y: number) => {
        if (!url) {
          doc.line(x, y + 25, x + 50, y + 25);
          doc.setFontSize(8);
          doc.text(label, x + 25, y + 30, { align: "center" });
          doc.text("(Pendente)", x + 25, y + 35, { align: "center" });
          return;
        }
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = url;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          doc.addImage(img, "PNG", x, y, 50, 25);
          doc.line(x, y + 25, x + 50, y + 25);
          doc.setFontSize(8);
          doc.text(label, x + 25, y + 30, { align: "center" });
          if (date) {
            doc.text(`Data: ${new Date(date).toLocaleDateString("pt-BR")}`, x + 25, y + 35, { align: "center" });
          }
          if (ip) {
            doc.setFontSize(7);
            doc.text(`IP: ${ip}`, x + 25, y + 39, { align: "center" });
          }
        } catch (e) {
          console.error(`Erro ao carregar assinatura ${label}:`, e);
        }
      };

      // Check if we need a new page for signatures
      if (finalY + 80 > doc.internal.pageSize.getHeight()) {
        doc.addPage();
        const sigY = 30;
        await addSignature(cert.assinatura_final_colaborador_url, "Colaborador", cert.data_assinatura_final_colaborador, cert.ip_assinatura_colaborador, margin, sigY);
        await addSignature(cert.assinatura_final_treinador_url, "Treinador 1", cert.data_assinatura_final_treinador, cert.ip_assinatura_treinador, pageWidth / 2 - 25, sigY);
        await addSignature(cert.assinatura_final_cliente_url, "Cliente", cert.data_assinatura_final_cliente, cert.ip_assinatura_cliente, pageWidth - margin - 50, sigY);
        
        if (cert.assinatura_final_treinador_2_url) {
          await addSignature(cert.assinatura_final_treinador_2_url, "Treinador 2", cert.data_assinatura_final_treinador_2, cert.ip_assinatura_treinador, pageWidth / 2 - 25, sigY + 50);
        }
      } else {
        await addSignature(cert.assinatura_final_colaborador_url, "Colaborador", cert.data_assinatura_final_colaborador, cert.ip_assinatura_colaborador, margin, finalY);
        await addSignature(cert.assinatura_final_treinador_url, "Treinador 1", cert.data_assinatura_final_treinador, cert.ip_assinatura_treinador, pageWidth / 2 - 25, finalY);
        await addSignature(cert.assinatura_final_cliente_url, "Cliente", cert.data_assinatura_final_cliente, cert.ip_assinatura_cliente, pageWidth - margin - 50, finalY);
        
        if (cert.assinatura_final_treinador_2_url) {
          await addSignature(cert.assinatura_final_treinador_2_url, "Treinador 2", cert.data_assinatura_final_treinador_2, cert.ip_assinatura_treinador, pageWidth / 2 - 25, finalY + 50);
        }
      }

      if (shouldSave) {
        const pdfBlob = doc.output('blob');
        const fileName = `comprovantes/${cert.colaborador_cpf}/${cert.id}_${Date.now()}.pdf`;
        
        // 1. Upload to Storage
        const { error: uploadError } = await supabase.storage
          .from('documentos')
          .upload(fileName, pdfBlob);
        
        if (uploadError) {
          console.error("Erro ao fazer upload do PDF:", uploadError);
          toast.error("Erro ao salvar cópia no servidor, mas o download local foi iniciado.");
        } else {
          // 2. Register in documentos_anexos
          const expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + 5);
          
          await supabase.from('documentos_anexos').insert({
            treinamento_id: cert.id,
            nome_arquivo: `treinamento_completo_${cert.colaborador_nome.toLowerCase().replace(/\s+/g, "_")}.pdf`,
            caminho_storage: fileName,
            tipo: 'comprovante_final',
            tamanho_bytes: pdfBlob.size,
            expires_at: expiresAt.toISOString()
          });
        }

        doc.save(`treinamento_completo_${cert.colaborador_nome.toLowerCase().replace(/\s+/g, "_")}.pdf`);
        toast.success("PDF completo gerado com sucesso!");
        return null;
      } else {
        return doc.output('bloburl').toString();
      }
    } catch (err: any) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar PDF: " + err.message);
      return null;
    }
  };

  const handleEmail = (cert: Certificate) => {
    const subject = encodeURIComponent(`Comprovante de Treinamento - ${cert.colaborador_nome}`);
    const body = encodeURIComponent(`Olá,\n\nSegue o comprovante de treinamento de ${cert.colaborador_nome}.\n\nTipo: ${cert.tipo_treinamento.toUpperCase()}\nSituação: ${cert.status === 'em_andamento' ? 'EM ANDAMENTO' : (cert.situacao?.toUpperCase() || "N/A")}\nData: ${new Date(cert.encerrado_em || cert.iniciado_em).toLocaleDateString("pt-BR")}\n\nAtenciosamente,\nEquipe de Treinamento`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const calculateExpiration = (dateStr: string, days?: number) => {
    if (!days) return "—";
    const date = new Date(dateStr);
    const expirationDate = new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
    const now = new Date();
    const diffTime = expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "Expirado";
    return `${diffDays} dias`;
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h2 className="text-xl font-semibold text-text">Comprovantes de Treinamento</h2>
        <p className="text-[13px] text-muted mt-1">
          Documentos armazenados por 5 anos · Acesso auditável
        </p>
      </div>

      <div className="bg-surface border border-border shadow-sm">
        <div className="px-5 py-3.5 border-b border-border">
          <span className="text-[13px] font-semibold text-text">Filtrar Documentos</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-1.5 relative">
              <label className="text-[12px] font-medium uppercase tracking-wider">CPF do Colaborador</label>
              <input 
                className="w-full p-2.5 border border-border2 focus:border-accent outline-none text-sm" 
                placeholder="000.000.000-00" 
                value={filters.cpf}
                onChange={(e) => handleCpfChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 w-full bg-surface border border-border shadow-lg mt-1 max-h-40 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-surface2 transition-colors border-b border-border last:border-0"
                      onClick={() => {
                        setFilters({ ...filters, cpf: s });
                        setShowSuggestions(false);
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium uppercase tracking-wider">Tipo de Treinamento</label>
              <select 
                className="w-full p-2.5 border border-border2 focus:border-accent outline-none bg-surface text-sm"
                value={filters.tipo}
                onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}
              >
                <option>Todos</option>
                <option value="formacao">Formação</option>
                <option value="atualizacao">Atualização</option>
                <option value="reciclagem">Reciclagem</option>
                <option value="proficiencia">Proficiência</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium uppercase tracking-wider">Situação</label>
              <select 
                className="w-full p-2.5 border border-border2 focus:border-accent outline-none bg-surface text-sm"
                value={filters.situacao}
                onChange={(e) => setFilters({ ...filters, situacao: e.target.value })}
              >
                <option>Todos</option>
                <option value="apto">Apto</option>
                <option value="nao_apto">Não Apto</option>
                <option value="Em Andamento">Em Andamento</option>
              </select>
            </div>
          </div>
          <button 
            onClick={fetchCertificates}
            disabled={loading}
            className="px-4 py-2 bg-accent hover:bg-accent-dark text-white text-[13px] font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Buscar
          </button>
        </div>
      </div>

      <div className="bg-surface border border-border shadow-sm overflow-x-auto scrollbar-thin">
        <div className="min-w-[900px]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface2">
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Colaborador</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Tipo</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Situação</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Treinador</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Data</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Expira em</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-hint font-mono font-medium p-3 px-4 border-b-2 border-border">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {certificates.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted text-sm">
                    Nenhum certificado encontrado.
                  </td>
                </tr>
              ) : (
                certificates.map((cert) => (
                  <CertificateRow
                    key={cert.id}
                    cert={cert}
                    onDownload={() => generatePDF(cert)}
                    onEmail={() => handleEmail(cert)}
                    onView={() => {
                      setSelectedCertForSignature(cert);
                      setIsDocumentViewerOpen(true);
                      setPdfUrl(null);
                      generatePDF(cert, false).then(url => setPdfUrl(url));
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SignatureModal 
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSave={handleSaveSignature}
        role={userProfile?.perfil === 'admin' ? 'treinador' : (userProfile?.perfil || 'colaborador')}
        trainingName={selectedCertForSignature?.colaborador_nome || ""}
      />

      <DocumentViewerModal 
        isOpen={isDocumentViewerOpen}
        onClose={() => setIsDocumentViewerOpen(false)}
        pdfUrl={pdfUrl}
        onSign={() => setIsSignatureModalOpen(true)}
        onSend={() => selectedCertForSignature && handleEmail(selectedCertForSignature)}
        canSign={selectedCertForSignature?.status === 'concluido'}
      />
    </div>
  );
};

const CertificateRow: React.FC<{
  cert: Certificate;
  onDownload: () => void;
  onEmail: () => void;
  onView: () => void;
}> = ({
  cert,
  onDownload,
  onEmail,
  onView,
}) => {
  const calculateExpiration = (dateStr: string, days?: number) => {
    if (!days) return "—";
    const date = new Date(dateStr);
    const expirationDate = new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
    const now = new Date();
    const diffTime = expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "Expirado";
    return `${diffDays} dias`;
  };

  const date = new Date(cert.encerrado_em || cert.iniciado_em).toLocaleDateString();
  const expires = calculateExpiration(cert.encerrado_em || cert.iniciado_em, cert.prazo_dias);
  const warning = cert.status === 'em_andamento';
  const status = cert.status === 'em_andamento' ? 'Em Andamento' : cert.situacao;
  const statusColor = cert.status === 'em_andamento' ? 'yellow' : cert.situacao === 'apto' ? 'green' : 'red';

  return (
    <tr className={cn("hover:bg-surface2 transition-colors", warning && "bg-warning-light/30")}>
      <td className="p-3 px-4">
        <div className="text-[13px] font-medium">{cert.colaborador_nome} {warning && "⚠️"}</div>
        <div className="text-[11px] font-mono text-muted">{maskCPF(cert.colaborador_cpf)}</div>
      </td>
      <td className="p-3 px-4">
        <span className="px-2 py-0.5 bg-surface2 border border-border text-[11px] font-mono text-muted uppercase">
          {cert.tipo_treinamento}
        </span>
      </td>
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
      <td className="p-3 px-4 text-[12px]">{cert.treinador_nome || "N/A"}</td>
      <td className="p-3 px-4 font-mono text-[12px]">{date}</td>
      <td className={cn("p-3 px-4 font-mono text-[12px]", warning && "text-warning font-bold")}>{expires}</td>
      <td className="p-3 px-4">
        <div className="flex gap-2">
          <button 
            onClick={onDownload}
            className="p-1.5 bg-surface2 hover:bg-surface3 border border-border2 text-muted transition-colors" 
            title="Baixar PDF"
          >
            <Download size={14} />
          </button>
          <button 
            onClick={onEmail}
            className="p-1.5 bg-surface2 hover:bg-surface3 border border-border2 text-muted transition-colors" 
            title="Enviar por E-mail"
          >
            <Mail size={14} />
          </button>
          {cert.status === 'concluido' && (
            <button 
              onClick={onView}
              className="p-1.5 bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accent transition-colors" 
              title="Visualizar e Assinar"
            >
              <Eye size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
