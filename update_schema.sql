-- Update schema for new training workflow
ALTER TABLE public.historico_atividades 
ADD COLUMN IF NOT EXISTS hit_rate NUMERIC,
ADD COLUMN IF NOT EXISTS assinatura_treinador_url TEXT,
ADD COLUMN IF NOT EXISTS assinatura_aluno_url TEXT;

ALTER TABLE public.treinamentos
ADD COLUMN IF NOT EXISTS horas_simulacao INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS horas_pratica INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS media_hit_rate NUMERIC DEFAULT 0;
