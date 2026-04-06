-- SQL para configurar o banco de dados no Supabase

-- 1. Tabela de Perfis (Profiles)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    nome_completo TEXT NOT NULL,
    cpf TEXT NOT NULL,
    cargo TEXT NOT NULL,
    perfil TEXT NOT NULL CHECK (perfil IN ('admin', 'treinador', 'cliente', 'colaborador')),
    ativo BOOLEAN DEFAULT TRUE,
    device_id TEXT,
    device_approved BOOLEAN DEFAULT FALSE,
    experiencia TEXT,
    certificacoes JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Treinamentos
CREATE TABLE public.treinamentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    treinador_id UUID REFERENCES public.profiles(id),
    colaborador_nome TEXT NOT NULL,
    colaborador_cpf TEXT NOT NULL,
    colaborador_mat TEXT NOT NULL,
    tipo_formulario TEXT NOT NULL,
    tipo_treinamento TEXT NOT NULL,
    local_treinamento TEXT NOT NULL,
    atividades TEXT[] DEFAULT '{}',
    iniciado_em TIMESTAMPTZ DEFAULT NOW(),
    encerrado_em TIMESTAMPTZ,
    horas_acumuladas INTEGER DEFAULT 0, -- em segundos
    horas_necessarias INTEGER DEFAULT 0, -- em segundos
    prazo_dias INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'em_andamento',
    situacao TEXT, -- 'apto', 'nao_apto'
    notas_a JSONB DEFAULT '{}',
    notas_b JSONB DEFAULT '{}',
    resultados_c JSONB DEFAULT '{}',
    assinatura_url TEXT,
    assinatura_treinador_url TEXT,
    media_a NUMERIC DEFAULT 0,
    media_b NUMERIC DEFAULT 0,
    percentual_c NUMERIC DEFAULT 0,
    observacoes TEXT,
    atividades_status JSONB DEFAULT '{}',
    -- Novas colunas para assinaturas finais
    assinatura_final_colaborador_url TEXT,
    assinatura_final_treinador_url TEXT,
    assinatura_final_treinador_2_url TEXT,
    assinatura_final_cliente_url TEXT,
    data_assinatura_final_colaborador TIMESTAMPTZ,
    data_assinatura_final_treinador TIMESTAMPTZ,
    data_assinatura_final_treinador_2 TIMESTAMPTZ,
    data_assinatura_final_cliente TIMESTAMPTZ,
    data_formacao_base DATE,
    ip_assinatura_treinador TEXT,
    ip_assinatura_colaborador TEXT,
    ip_assinatura_cliente TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Sessões de Treinamento
CREATE TABLE public.sessoes_treinamento (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    training_id UUID REFERENCES public.treinamentos(id) ON DELETE CASCADE,
    inicio TIMESTAMPTZ NOT NULL,
    fim TIMESTAMPTZ,
    duracao_segundos INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}', -- Armazena atividade e critério da sessão
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Histórico de Atividades
CREATE TABLE public.historico_atividades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    treinamento_id UUID REFERENCES public.treinamentos(id) ON DELETE CASCADE,
    nome_atividade TEXT NOT NULL,
    criterio TEXT, -- Critério avaliado (A, B ou C)
    hora_inicio TIMESTAMPTZ NOT NULL,
    hora_fim TIMESTAMPTZ NOT NULL,
    tempo_execucao INTEGER NOT NULL, -- em segundos
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela de Documentos Anexos (Lacuna 3)
CREATE TABLE public.documentos_anexos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    treinamento_id UUID REFERENCES public.treinamentos(id) ON DELETE CASCADE,
    nome_arquivo TEXT NOT NULL,
    caminho_storage TEXT NOT NULL,
    tipo TEXT NOT NULL, -- 'comprovante_final', 'evidencia', etc.
    tamanho_bytes BIGINT,
    expires_at TIMESTAMPTZ, -- ANAC exige 5 anos
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Habilitar RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treinamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessoes_treinamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_anexos ENABLE ROW LEVEL SECURITY;

-- 6. Políticas para Profiles
CREATE POLICY "Perfis são visíveis por usuários autenticados" 
ON public.profiles FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários podem atualizar seus próprios perfis" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Admins podem inserir perfis" 
ON public.profiles FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND perfil = 'admin'
    ) OR 
    NOT EXISTS (SELECT 1 FROM public.profiles) -- Permite o primeiro admin
);

-- 6. Políticas para Treinamentos (Lacuna 2 - Refinada)
-- Removemos a política genérica anterior se existir
-- DROP POLICY IF EXISTS "Treinamentos são visíveis por usuários autenticados" ON public.treinamentos;

CREATE POLICY "Treinadores e Admins veem tudo" 
ON public.treinamentos FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND perfil IN ('admin', 'treinador')
    )
);

CREATE POLICY "Clientes veem seus treinamentos" 
ON public.treinamentos FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND perfil = 'cliente'
    )
    -- Nota: Aqui assumimos que o treinamento teria um campo cliente_id se fosse multi-empresa.
    -- No escopo atual, clientes veem o que lhes é permitido.
);

CREATE POLICY "Colaboradores veem apenas seus próprios treinamentos" 
ON public.treinamentos FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND perfil = 'colaborador' AND cpf = colaborador_cpf
    )
);

CREATE POLICY "Treinadores podem inserir treinamentos" 
ON public.treinamentos FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Treinadores podem atualizar seus treinamentos" 
ON public.treinamentos FOR UPDATE 
USING (auth.uid() = treinador_id OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND perfil = 'admin'
));

-- 7. Políticas para Sessões
CREATE POLICY "Sessões são visíveis por usuários autenticados" 
ON public.sessoes_treinamento FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Qualquer autenticado pode gerenciar sessões" 
ON public.sessoes_treinamento FOR ALL 
USING (auth.role() = 'authenticated');

-- 8. Políticas para Histórico de Atividades
CREATE POLICY "Histórico é visível por usuários autenticados" 
ON public.historico_atividades FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Qualquer autenticado pode inserir no histórico" 
ON public.historico_atividades FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- 9. Políticas para Documentos Anexos
CREATE POLICY "Documentos são visíveis por quem vê o treinamento" 
ON public.documentos_anexos FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.treinamentos 
        WHERE id = treinamento_id
    )
);

CREATE POLICY "Apenas treinadores e admins inserem documentos" 
ON public.documentos_anexos FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND perfil IN ('admin', 'treinador')
    )
);

-- 10. Storage (Buckets para Assinaturas, Certificações e Documentos)
-- Estes comandos criam os buckets se eles não existirem
INSERT INTO storage.buckets (id, name, public) 
VALUES ('assinaturas', 'assinaturas', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('certificacoes', 'certificacoes', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('documentos', 'documentos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas para storage.objects
CREATE POLICY "Objetos são públicos" 
ON storage.objects FOR SELECT 
USING (bucket_id IN ('assinaturas', 'certificacoes', 'documentos'));

CREATE POLICY "Usuários autenticados podem subir arquivos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id IN ('assinaturas', 'certificacoes', 'documentos') AND auth.role() = 'authenticated');
