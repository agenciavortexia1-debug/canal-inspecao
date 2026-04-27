-- ============================================================
-- MELHORIAS DE SEGURANÇA — Canal Inspeção
-- Execute este arquivo completo no SQL Editor do Supabase
-- Painel Supabase > SQL Editor > New Query > cole tudo > Run
-- ============================================================


-- ============================================================
-- BLOCO 1: CORRIGIR POLÍTICAS RLS EXISTENTES
-- ============================================================

-- --- profiles ---

DROP POLICY IF EXISTS "Perfis são visíveis por usuários autenticados"       ON public.profiles;
DROP POLICY IF EXISTS "Usuários veem apenas o próprio perfil"                ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios perfis"        ON public.profiles;
DROP POLICY IF EXISTS "Admins podem inserir perfis"                          ON public.profiles;
DROP POLICY IF EXISTS "Admins podem atualizar qualquer perfil"               ON public.profiles;

-- CORREÇÃO: cada um vê o próprio perfil; admins veem tudo
CREATE POLICY "Usuários veem apenas o próprio perfil"
ON public.profiles FOR SELECT
USING (
    auth.uid() = id
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.perfil = 'admin'
    )
);

-- CORREÇÃO: elimina subquery recursiva que causava "infinite recursion detected"
CREATE POLICY "Admins podem inserir perfis"
ON public.profiles FOR INSERT
WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.profiles)
    OR (SELECT perfil FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- CORREÇÃO: usuário edita o próprio perfil; admins editam qualquer um (aprovar dispositivo)
CREATE POLICY "Admins podem atualizar qualquer perfil"
ON public.profiles FOR UPDATE
USING (
    auth.uid() = id
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.perfil = 'admin'
    )
);


-- --- treinamentos ---

DROP POLICY IF EXISTS "Treinadores e Admins veem tudo"                           ON public.treinamentos;
DROP POLICY IF EXISTS "Clientes veem seus treinamentos"                          ON public.treinamentos;
DROP POLICY IF EXISTS "Colaboradores veem apenas seus próprios treinamentos"     ON public.treinamentos;
DROP POLICY IF EXISTS "Treinadores podem inserir treinamentos"                   ON public.treinamentos;
DROP POLICY IF EXISTS "Apenas treinadores e admins inserem treinamentos"         ON public.treinamentos;
DROP POLICY IF EXISTS "Treinadores podem atualizar seus treinamentos"            ON public.treinamentos;

CREATE POLICY "Treinadores e Admins veem tudo"
ON public.treinamentos FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.perfil IN ('admin', 'treinador')
    )
);

-- CORREÇÃO: cliente só vê treinamentos cujo CPF bate com o próprio
CREATE POLICY "Clientes veem seus treinamentos"
ON public.treinamentos FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.perfil = 'cliente'
          AND p.cpf = colaborador_cpf
    )
);

CREATE POLICY "Colaboradores veem apenas seus próprios treinamentos"
ON public.treinamentos FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.perfil = 'colaborador' AND p.cpf = colaborador_cpf
    )
);

-- CORREÇÃO: restringe inserção a treinadores e admins
CREATE POLICY "Apenas treinadores e admins inserem treinamentos"
ON public.treinamentos FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.perfil IN ('admin', 'treinador')
    )
);

CREATE POLICY "Treinadores podem atualizar seus treinamentos"
ON public.treinamentos FOR UPDATE
USING (
    auth.uid() = treinador_id
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.perfil = 'admin'
    )
);


-- --- sessoes_treinamento ---

DROP POLICY IF EXISTS "Sessões são visíveis por usuários autenticados"       ON public.sessoes_treinamento;
DROP POLICY IF EXISTS "Qualquer autenticado pode gerenciar sessões"          ON public.sessoes_treinamento;
DROP POLICY IF EXISTS "Sessões visíveis por autenticados"                    ON public.sessoes_treinamento;
DROP POLICY IF EXISTS "Apenas treinadores e admins gerenciam sessões"        ON public.sessoes_treinamento;

CREATE POLICY "Sessões visíveis por autenticados"
ON public.sessoes_treinamento FOR SELECT
USING (auth.role() = 'authenticated');

-- CORREÇÃO: restringe escrita a treinadores/admins
CREATE POLICY "Apenas treinadores e admins gerenciam sessões"
ON public.sessoes_treinamento FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.perfil IN ('admin', 'treinador')
    )
);


-- --- historico_atividades ---

DROP POLICY IF EXISTS "Histórico é visível por usuários autenticados"        ON public.historico_atividades;
DROP POLICY IF EXISTS "Qualquer autenticado pode inserir no histórico"       ON public.historico_atividades;
DROP POLICY IF EXISTS "Apenas treinadores e admins inserem no histórico"     ON public.historico_atividades;

CREATE POLICY "Histórico é visível por usuários autenticados"
ON public.historico_atividades FOR SELECT
USING (auth.role() = 'authenticated');

-- CORREÇÃO: restringe escrita a treinadores/admins
CREATE POLICY "Apenas treinadores e admins inserem no histórico"
ON public.historico_atividades FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.perfil IN ('admin', 'treinador')
    )
);


-- --- documentos_anexos ---

DROP POLICY IF EXISTS "Documentos são visíveis por quem vê o treinamento"                  ON public.documentos_anexos;
DROP POLICY IF EXISTS "Apenas treinadores e admins inserem documentos"                      ON public.documentos_anexos;
DROP POLICY IF EXISTS "Documentos visíveis por autenticados com acesso ao treinamento"      ON public.documentos_anexos;

-- CORREÇÃO: exige autenticação (antes não exigia)
CREATE POLICY "Documentos visíveis por autenticados com acesso ao treinamento"
ON public.documentos_anexos FOR SELECT
USING (
    auth.role() = 'authenticated'
    AND EXISTS (
        SELECT 1 FROM public.treinamentos t
        WHERE t.id = treinamento_id
    )
);

CREATE POLICY "Apenas treinadores e admins inserem documentos"
ON public.documentos_anexos FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.perfil IN ('admin', 'treinador')
    )
);


-- ============================================================
-- BLOCO 2: TABELA DE LOG DE AUDITORIA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    action      TEXT        NOT NULL,
    table_name  TEXT        NOT NULL,
    record_id   UUID,
    old_data    JSONB,
    new_data    JSONB,
    ip_address  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Somente admins leem o audit_log"      ON public.audit_log;
DROP POLICY IF EXISTS "Sistema pode inserir no audit_log"    ON public.audit_log;

CREATE POLICY "Somente admins leem o audit_log"
ON public.audit_log FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.perfil = 'admin'
    )
);

CREATE POLICY "Sistema pode inserir no audit_log"
ON public.audit_log FOR INSERT
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_log_user    ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table   ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);


-- ============================================================
-- BLOCO 3: FUNÇÃO E TRIGGERS DE AUDITORIA
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

    INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_data, new_data)
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

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_treinamentos ON public.treinamentos;
CREATE TRIGGER trg_audit_treinamentos
AFTER INSERT OR UPDATE OR DELETE ON public.treinamentos
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();


-- ============================================================
-- BLOCO 4: RETENÇÃO DE DADOS (LGPD / ANAC — 5 anos)
-- ============================================================

CREATE OR REPLACE VIEW public.vw_registros_para_arquivar AS
SELECT
    id,
    colaborador_nome,
    colaborador_cpf,
    tipo_treinamento,
    encerrado_em,
    status,
    EXTRACT(YEAR FROM AGE(NOW(), encerrado_em)) AS anos_desde_encerramento
FROM public.treinamentos
WHERE encerrado_em IS NOT NULL
  AND encerrado_em < NOW() - INTERVAL '5 years'
ORDER BY encerrado_em ASC;

COMMENT ON VIEW public.vw_registros_para_arquivar IS
'Treinamentos encerrados há mais de 5 anos — candidatos a arquivamento conforme ANAC/LGPD.';


-- ============================================================
-- FIM DO SCRIPT
-- Após executar, confirme em Authentication > Policies
-- que as políticas aparecem listadas corretamente.
-- ============================================================
