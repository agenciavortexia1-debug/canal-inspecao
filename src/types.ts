export enum TrainingType {
  FORMACAO = "formacao",
  ATUALIZACAO = "atualizacao",
  TROCA_POSTO = "troca_posto",
  RECICLAGEM = "reciclagem",
  PROFICIENCIA = "proficiencia",
}

export enum FormType {
  AERODROME = "aerodrome",
  AEREO = "aereo",
}

export enum TrainingStatus {
  EM_ANDAMENTO = "em_andamento",
  APTO = "apto",
  NAO_APTO = "nao_apto",
  CONCLUIDO = "concluido",
}

export interface ActivityStatus {
  concluida: boolean;
  notas_a: Record<number, number>;
  notas_b: Record<number, number>;
  resultados_c: Record<number, boolean>;
  timestamps_a?: Record<number, string>;
  timestamps_b?: Record<number, string>;
  timestamps_c?: Record<number, string>;
  assinatura_treinador_url?: string;
  assinatura_aluno_url?: string;
  tempo_segundos: number;
}

export interface TraineeData {
  nome: string;
  cpf: string;
  matricula: string;
}

export interface TrainingConfig {
  tipoFormulario: FormType;
  tipoTreinamento: TrainingType;
  local: string;
  dataFormacaoBase?: string;
  atividades: string[];
}

export interface EvaluationA {
  scores: Record<number, number>; // index -> score (0-10)
}

export interface EvaluationB {
  scores: Record<number, number>; // index -> score (0-10)
}

export interface EvaluationC {
  results: Record<number, boolean>; // index -> identified (true/false)
}

export interface OngoingTraining {
  id: string;
  treinador_id: string;
  colaborador_nome: string;
  colaborador_cpf: string;
  colaborador_mat: string;
  tipo_treinamento: TrainingType;
  tipo_formulario: FormType;
  local_treinamento: string;
  status: "em_andamento" | "concluido";
  atividades_status: Record<string, any>; // Flexible JSON
  horas_acumuladas: number; // in seconds
  horas_necessarias: number; // in seconds
  prazo_dias: number;
  iniciado_em: string;
  data_treinamento_anterior?: string;
  notas_a: Record<number, number>;
  notas_b: Record<number, number>;
  resultados_c: Record<number, boolean>;
  media_a?: number;
  media_b?: number;
  percentual_c?: number;
  situacao?: "apto" | "nao_apto";
  encerrado_em?: string;
  observacoes?: string;
  created_at: string;
  // Virtual fields (derived from atividades_status._metadata)
  current_phase?: number;
  horas_simulacao?: number;
  horas_pratica?: number;
  media_hit_rate?: number;
}

export interface ActivityHistoryRecord {
  id: string;
  treinamento_id: string;
  colaborador_id?: string;
  nome_atividade: string;
  criterio?: string;
  hora_inicio: string;
  hora_fim: string;
  tempo_execucao: number;
  hit_rate?: number;
  assinatura_treinador_url?: string;
  assinatura_aluno_url?: string;
  created_at: string;
}

export interface TrainingSessionRecord {
  id: string;
  training_id: string;
  inicio: string;
  fim?: string;
  duracao_segundos: number;
  created_at: string;
}

export interface TrainingSession {
  id: string;
  treinadorId: string;
  trainee: TraineeData;
  config: TrainingConfig;
  evalA: EvaluationA;
  evalB: EvaluationB;
  evalC: EvaluationC;
  startTime: number; // timestamp
  endTime?: number; // timestamp
  durationSeconds: number;
  status: TrainingStatus;
  observations?: string;
  signatureUrl?: string;
  ipAddress?: string;
  createdAt: number;
}
