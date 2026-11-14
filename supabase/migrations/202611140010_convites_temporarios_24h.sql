-- AUROX Rede Hotfix V1.1 — convite temporario por 24 horas.
-- APLICAR UMA VEZ apos backup e teste em homologacao.
-- Compativel com a migracao 202611140009_rede_parcerias_direcionais.sql.
-- Nao altera leads, estoque, empresas, usuarios ou parcerias ja enviadas.
BEGIN;

ALTER TABLE public.aurox_rede_codigos
  ADD COLUMN IF NOT EXISTS expira_em timestamptz;

-- Convites criados antes desta atualizacao expiram 24h apos a ultima geracao.
-- Se ja venceram, ficam invalidos, mas pedidos existentes seguem preservados.
UPDATE public.aurox_rede_codigos
   SET expira_em = COALESCE(atualizado_em, criado_em, now()) + interval '24 hours'
 WHERE expira_em IS NULL;

ALTER TABLE public.aurox_rede_codigos
  ALTER COLUMN expira_em SET DEFAULT (now() + interval '24 hours');
ALTER TABLE public.aurox_rede_codigos
  ALTER COLUMN expira_em SET NOT NULL;

COMMENT ON COLUMN public.aurox_rede_codigos.expira_em IS
  'Validade do convite: 24 horas apos geracao; nao revoga solicitacoes anteriores nem parcerias aprovadas.';
COMMIT;
