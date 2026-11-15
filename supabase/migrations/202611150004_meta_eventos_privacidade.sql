-- Eventos Meta assinados. NÃO representa exclusão automática de dados.
-- Aplicar em homologação primeiro.
BEGIN;
CREATE TABLE IF NOT EXISTS public.aurox_meta_eventos_privacidade (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tipo text NOT NULL CHECK(tipo IN ('desautorizacao','exclusao')),
 usuario_hash text NOT NULL CHECK(usuario_hash ~ '^[a-f0-9]{64}$'),
 emitido_em timestamptz NOT NULL,
 codigo text UNIQUE,
 status text NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','em_analise','concluido','recusado')),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT aurox_meta_evento_unico UNIQUE(tipo,usuario_hash,emitido_em),
 CONSTRAINT aurox_meta_codigo_exclusao CHECK (tipo='exclusao' OR codigo IS NULL)
);
ALTER TABLE public.aurox_meta_eventos_privacidade ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.aurox_meta_eventos_privacidade FROM anon, authenticated;
COMMIT;
