-- Executar após 001, 002, 005. Adição segura; não reprova propostas existentes.
BEGIN;
ALTER TABLE public.aurox_solicitacoes_comerciais ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;
ALTER TABLE public.aurox_solicitacoes_comerciais ADD COLUMN IF NOT EXISTS aprovado_por integer REFERENCES public.usuarios(id) ON DELETE SET NULL;
ALTER TABLE public.aurox_solicitacoes_comerciais DROP CONSTRAINT IF EXISTS aurox_solicitacoes_comerciais_status_chk;
ALTER TABLE public.aurox_solicitacoes_comerciais ADD CONSTRAINT aurox_solicitacoes_comerciais_status_chk CHECK (status IN ('novo','em_atendimento','concluido','descartado','aprovado')) NOT VALID;
COMMIT;
