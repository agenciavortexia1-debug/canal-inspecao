-- ============================================================
-- MIGRAÇÃO COMPLETA — Canal de Inspeção
-- Novo Supabase Self-Hosted
-- Schema: canal-inspecao
--
-- INSTRUÇÕES:
-- 1. Acesse seu Supabase > SQL Editor > New Query
-- 2. Cole este arquivo inteiro e clique em Run
-- ============================================================


-- ============================================================
-- ETAPA 1: CRIAR O SCHEMA
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "canal-inspecao";


-- ============================================================
-- ETAPA 2: PERMISSÕES DO SCHEMA
-- ============================================================

GRANT USAGE ON SCHEMA "canal-inspecao" TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA "canal-inspecao"
    GRANT ALL ON TABLES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA "canal-inspecao"
    GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA "canal-inspecao"
    GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;


-- ============================================================
-- ETAPA 3: TABELAS
-- ============================================================

-- Tabela de Perfis
CREATE TABLE "canal-inspecao".profiles (
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

-- Tabela de Treinamentos
CREATE TABLE "canal-inspecao".treinamentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    treinador_id UUID REFERENCES "canal-inspecao".profiles(id),
    colaborador_nome TEXT NOT NULL,
    colaborador_cpf TEXT NOT NULL,
    colaborador_mat TEXT NOT NULL,
    tipo_formulario TEXT NOT NULL,
    tipo_treinamento TEXT NOT NULL,
    local_treinamento TEXT NOT NULL,
    atividades TEXT[] DEFAULT '{}',
    iniciado_em TIMESTAMPTZ DEFAULT NOW(),
    encerrado_em TIMESTAMPTZ,
    horas_acumuladas INTEGER DEFAULT 0,
    horas_necessarias INTEGER DEFAULT 0,
    prazo_dias INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'em_andamento',
    situacao TEXT,
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
    horas_simulacao INTEGER DEFAULT 0,
    horas_pratica INTEGER DEFAULT 0,
    media_hit_rate NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Sessões de Treinamento
CREATE TABLE "canal-inspecao".sessoes_treinamento (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    training_id UUID REFERENCES "canal-inspecao".treinamentos(id) ON DELETE CASCADE,
    inicio TIMESTAMPTZ NOT NULL,
    fim TIMESTAMPTZ,
    duracao_segundos INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Histórico de Atividades
CREATE TABLE "canal-inspecao".historico_atividades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    treinamento_id UUID REFERENCES "canal-inspecao".treinamentos(id) ON DELETE CASCADE,
    nome_atividade TEXT NOT NULL,
    criterio TEXT,
    hora_inicio TIMESTAMPTZ NOT NULL,
    hora_fim TIMESTAMPTZ NOT NULL,
    tempo_execucao INTEGER NOT NULL,
    hit_rate NUMERIC,
    assinatura_treinador_url TEXT,
    assinatura_aluno_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Documentos Anexos
CREATE TABLE "canal-inspecao".documentos_anexos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    treinamento_id UUID REFERENCES "canal-inspecao".treinamentos(id) ON DELETE CASCADE,
    nome_arquivo TEXT NOT NULL,
    caminho_storage TEXT NOT NULL,
    tipo TEXT NOT NULL,
    tamanho_bytes BIGINT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Log de Auditoria
CREATE TABLE "canal-inspecao".audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- ETAPA 4: ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_audit_log_user    ON "canal-inspecao".audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table   ON "canal-inspecao".audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON "canal-inspecao".audit_log(created_at DESC);


-- ============================================================
-- ETAPA 5: ATIVAR SEGURANÇA POR LINHA (RLS)
-- ============================================================

ALTER TABLE "canal-inspecao".profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "canal-inspecao".treinamentos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "canal-inspecao".sessoes_treinamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE "canal-inspecao".historico_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE "canal-inspecao".documentos_anexos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "canal-inspecao".audit_log           ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- ETAPA 6: REGRAS DE ACESSO (POLICIES)
-- ============================================================

-- --- profiles ---

CREATE POLICY "Usuários veem apenas o próprio perfil"
ON "canal-inspecao".profiles FOR SELECT
USING (
    auth.uid() = id
    OR EXISTS (
        SELECT 1 FROM "canal-inspecao".profiles p
        WHERE p.id = auth.uid() AND p.perfil = 'admin'
    )
);

CREATE POLICY "Admins podem inserir perfis"
ON "canal-inspecao".profiles FOR INSERT
WITH CHECK (
    NOT EXISTS (SELECT 1 FROM "canal-inspecao".profiles)
    OR (SELECT perfil FROM "canal-inspecao".profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Admins podem atualizar qualquer perfil"
ON "canal-inspecao".profiles FOR UPDATE
USING (
    auth.uid() = id
    OR EXISTS (
        SELECT 1 FROM "canal-inspecao".profiles p
        WHERE p.id = auth.uid() AND p.perfil = 'admin'
    )
);


-- --- treinamentos ---

CREATE POLICY "Treinadores e Admins veem tudo"
ON "canal-inspecao".treinamentos FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM "canal-inspecao".profiles p
        WHERE p.id = auth.uid() AND p.perfil IN ('admin', 'treinador')
    )
);

CREATE POLICY "Clientes veem seus treinamentos"
ON "canal-inspecao".treinamentos FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM "canal-inspecao".profiles p
        WHERE p.id = auth.uid()
          AND p.perfil = 'cliente'
          AND p.cpf = colaborador_cpf
    )
);

CREATE POLICY "Colaboradores veem apenas seus próprios treinamentos"
ON "canal-inspecao".treinamentos FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM "canal-inspecao".profiles p
        WHERE p.id = auth.uid() AND p.perfil = 'colaborador' AND p.cpf = colaborador_cpf
    )
);

CREATE POLICY "Apenas treinadores e admins inserem treinamentos"
ON "canal-inspecao".treinamentos FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "canal-inspecao".profiles p
        WHERE p.id = auth.uid() AND p.perfil IN ('admin', 'treinador')
    )
);

CREATE POLICY "Treinadores podem atualizar seus treinamentos"
ON "canal-inspecao".treinamentos FOR UPDATE
USING (
    auth.uid() = treinador_id
    OR EXISTS (
        SELECT 1 FROM "canal-inspecao".profiles p
        WHERE p.id = auth.uid() AND p.perfil = 'admin'
    )
);


-- --- sessoes_treinamento ---

CREATE POLICY "Sessões visíveis por autenticados"
ON "canal-inspecao".sessoes_treinamento FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Apenas treinadores e admins gerenciam sessões"
ON "canal-inspecao".sessoes_treinamento FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "canal-inspecao".profiles p
        WHERE p.id = auth.uid() AND p.perfil IN ('admin', 'treinador')
    )
);


-- --- historico_atividades ---

CREATE POLICY "Histórico é visível por usuários autenticados"
ON "canal-inspecao".historico_atividades FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Apenas treinadores e admins inserem no histórico"
ON "canal-inspecao".historico_atividades FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "canal-inspecao".profiles p
        WHERE p.id = auth.uid() AND p.perfil IN ('admin', 'treinador')
    )
);


-- --- documentos_anexos ---

CREATE POLICY "Documentos visíveis por autenticados com acesso ao treinamento"
ON "canal-inspecao".documentos_anexos FOR SELECT
USING (
    auth.role() = 'authenticated'
    AND EXISTS (
        SELECT 1 FROM "canal-inspecao".treinamentos t
        WHERE t.id = treinamento_id
    )
);

CREATE POLICY "Apenas treinadores e admins inserem documentos"
ON "canal-inspecao".documentos_anexos FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "canal-inspecao".profiles p
        WHERE p.id = auth.uid() AND p.perfil IN ('admin', 'treinador')
    )
);


-- --- audit_log ---

CREATE POLICY "Somente admins leem o audit_log"
ON "canal-inspecao".audit_log FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM "canal-inspecao".profiles p
        WHERE p.id = auth.uid() AND p.perfil = 'admin'
    )
);

CREATE POLICY "Sistema pode inserir no audit_log"
ON "canal-inspecao".audit_log FOR INSERT
WITH CHECK (true);


-- ============================================================
-- ETAPA 7: FUNÇÃO E TRIGGERS DE AUDITORIA
-- ============================================================

CREATE OR REPLACE FUNCTION "canal-inspecao".fn_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "canal-inspecao"
AS $$
DECLARE
    v_record_id UUID;
BEGIN
    BEGIN
        IF TG_OP = 'DELETE' THEN
            v_record_id := (OLD.id)::UUID;
        ELSE
            v_record_id := (NEW.id)::UUID;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_record_id := NULL;
    END;

    INSERT INTO "canal-inspecao".audit_log (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        v_record_id,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_profiles ON "canal-inspecao".profiles;
CREATE TRIGGER trg_audit_profiles
AFTER INSERT OR UPDATE OR DELETE ON "canal-inspecao".profiles
FOR EACH ROW EXECUTE FUNCTION "canal-inspecao".fn_audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_treinamentos ON "canal-inspecao".treinamentos;
CREATE TRIGGER trg_audit_treinamentos
AFTER INSERT OR UPDATE OR DELETE ON "canal-inspecao".treinamentos
FOR EACH ROW EXECUTE FUNCTION "canal-inspecao".fn_audit_trigger();


-- ============================================================
-- ETAPA 8: VIEW DE RETENÇÃO (LGPD / ANAC — 5 anos)
-- ============================================================

CREATE OR REPLACE VIEW "canal-inspecao".vw_registros_para_arquivar AS
SELECT
    id,
    colaborador_nome,
    colaborador_cpf,
    tipo_treinamento,
    encerrado_em,
    status,
    EXTRACT(YEAR FROM AGE(NOW(), encerrado_em)) AS anos_desde_encerramento
FROM "canal-inspecao".treinamentos
WHERE encerrado_em IS NOT NULL
  AND encerrado_em < NOW() - INTERVAL '5 years'
ORDER BY encerrado_em ASC;

COMMENT ON VIEW "canal-inspecao".vw_registros_para_arquivar IS
'Treinamentos encerrados há mais de 5 anos — candidatos a arquivamento conforme ANAC/LGPD.';


-- ============================================================
-- ETAPA 9: STORAGE (BUCKETS DE ARQUIVOS)
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('assinaturas', 'assinaturas', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('certificacoes', 'certificacoes', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Objetos são públicos"
ON storage.objects FOR SELECT
USING (bucket_id IN ('assinaturas', 'certificacoes', 'documentos'));

CREATE POLICY "Usuários autenticados podem subir arquivos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id IN ('assinaturas', 'certificacoes', 'documentos')
    AND auth.role() = 'authenticated'
);


-- ============================================================
-- ETAPA 10: EXPOR SCHEMA NO POSTGREST
-- (necessário para o Supabase conseguir acessar o schema)
-- ============================================================

-- Execute esta linha SEPARADAMENTE no SQL Editor caso o schema
-- não apareça na API após rodar o script acima:
--
-- ALTER ROLE authenticator SET pgrst.db_schemas = 'public, canal-inspecao';
-- NOTIFY pgrst, 'reload config';


-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
