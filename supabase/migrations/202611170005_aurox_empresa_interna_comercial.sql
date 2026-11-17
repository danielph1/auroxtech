-- AUROX | Empresa interna de atendimento comercial. MIGRACAO ADITIVA, IDEMPOTENTE.
-- EXECUTAR NO SUPABASE SQL EDITOR após backup e após migration 202611170002.
-- NÃO cria login, senha ou usuário. Somente superadmins EXISTENTES acessam a área interna.
-- Não associa a empresa ao usuário comum e não altera a Manu Automóveis.
BEGIN;

DO $$
DECLARE
  v_id integer;
  v_nome text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('aurox:empresa-interna:202611170005'));
  IF to_regclass('public.aurox_solicitacoes_comerciais') IS NULL THEN
    RAISE EXCEPTION 'Execute primeiro a migration 202611170002_aurox_comercial_solicitacoes.sql';
  END IF;

  SELECT id,nome INTO v_id,v_nome
  FROM public.empresas WHERE slug='aurox-plataforma' LIMIT 1;
  IF v_id IS NOT NULL AND lower(btrim(v_nome))<>'aurox' THEN
    RAISE EXCEPTION 'Slug reservado aurox-plataforma associado a outra empresa: revisão manual necessária';
  END IF;

  IF v_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.empresas WHERE lower(btrim(nome))='aurox') THEN
      RAISE EXCEPTION 'Já existe uma empresa denominada AUROX com outro slug. Revisar antes de criar duplicata.';
    END IF;
    INSERT INTO public.empresas(nome,slug,ativo,plano,contrato_inicio)
      VALUES('AUROX','aurox-plataforma',true,'black',CURRENT_DATE)
      RETURNING id INTO v_id;
  END IF;

  -- Unidade técnica interna; não depende de loja 001 nem modifica códigos dos clientes.
  IF NOT EXISTS (SELECT 1 FROM public.lojas WHERE empresa_id=v_id) THEN
    INSERT INTO public.lojas(empresa_id,codigo,nome,ativo,plano)
      VALUES(v_id,'AURX','Atendimento comercial',true,'black');
  END IF;

  -- Um usuário operacional na empresa interna já seria um incidente de isolamento.
  IF EXISTS(SELECT 1 FROM public.usuarios
       WHERE empresa_id=v_id AND lower(coalesce(tipo,''))<>'superadmin') THEN
    RAISE EXCEPTION 'Empresa AUROX tem usuários não-superadmin: revisar antes da migração';
  END IF;
END $$;

-- Defesa também no nível do banco: ninguém cadastra admin, gerente ou vendedor na empresa interna.
CREATE OR REPLACE FUNCTION public.aurox_proteger_empresa_interna_usuario()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_id integer;
BEGIN
  SELECT id INTO v_id FROM public.empresas WHERE slug='aurox-plataforma' LIMIT 1;
  IF v_id IS NOT NULL AND NEW.empresa_id=v_id
      AND lower(coalesce(NEW.tipo,''))<>'superadmin' THEN
    RAISE EXCEPTION 'Empresa interna AUROX: somente superadmin pode ter vínculo de acesso'
      USING ERRCODE='23514',CONSTRAINT='aurox_empresa_interna_superadmin_only';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS aurox_proteger_empresa_interna_usuario_trg ON public.usuarios;
CREATE TRIGGER aurox_proteger_empresa_interna_usuario_trg
BEFORE INSERT OR UPDATE OF empresa_id,tipo ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.aurox_proteger_empresa_interna_usuario();

-- Atendimento e fiscalização comercial privados do superadmin.
ALTER TABLE public.aurox_solicitacoes_comerciais
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'novo';
ALTER TABLE public.aurox_solicitacoes_comerciais
  ADD COLUMN IF NOT EXISTS anotacoes_internas text NOT NULL DEFAULT '';
ALTER TABLE public.aurox_solicitacoes_comerciais
  ADD COLUMN IF NOT EXISTS atualizado_em timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.aurox_solicitacoes_comerciais
  ADD COLUMN IF NOT EXISTS atualizado_por integer REFERENCES public.usuarios(id) ON DELETE SET NULL;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.aurox_solicitacoes_comerciais'::regclass AND conname='aurox_solicitacoes_comerciais_status_chk') THEN
  ALTER TABLE public.aurox_solicitacoes_comerciais
    ADD CONSTRAINT aurox_solicitacoes_comerciais_status_chk
    CHECK(status IN ('novo','em_atendimento','concluido','descartado')) NOT VALID;
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS aurox_comercial_empresa_status_idx
  ON public.aurox_solicitacoes_comerciais(empresa_id,status,criado_em DESC);
ALTER TABLE public.aurox_solicitacoes_comerciais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.aurox_solicitacoes_comerciais FROM anon,authenticated;
COMMIT;

-- Conferência após executar (sem modificar dados):
SELECT id,nome,slug,ativo FROM public.empresas WHERE slug='aurox-plataforma';
SELECT status,count(*) FROM public.aurox_solicitacoes_comerciais
 WHERE empresa_id=(SELECT id FROM public.empresas WHERE slug='aurox-plataforma') GROUP BY status;
