-- AUROX · Preparação para exclusão RELACIONAL, protegida. Não executa exclusões.
-- Não usar CASCADE para alterar as FKs nem para excluir empresas.
BEGIN;
CREATE TABLE IF NOT EXISTS public.aurox_exclusoes_auditoria (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 empresa_original_id integer NOT NULL,
 ator_id integer,
 empresa_slug_hash text NOT NULL,
 tabelas jsonb NOT NULL,
 executado_em timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.aurox_exclusoes_auditoria FROM anon,authenticated;
ALTER TABLE public.aurox_exclusoes_auditoria ENABLE ROW LEVEL SECURITY;
COMMIT;

-- Função exclusivamente de manutenção: APAGAMENTO IRREVERSÍVEL de dados relacionais.
-- Abortará por completo em caso de FK não tratada. Arquivos no Storage não estão cobertos.
CREATE OR REPLACE FUNCTION public.aurox_excluir_empresa_relacional(p_empresa_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE
  obj record;
  v_empresa record;
  v_deleted bigint;
  v_log jsonb:='{}'::jsonb;
BEGIN
  IF p_empresa_id IS NULL OR p_empresa_id<=0 THEN RAISE EXCEPTION 'ID inválido'; END IF;
  SELECT id,slug,ativo INTO v_empresa FROM public.empresas WHERE id=p_empresa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Empresa não encontrada'; END IF;
  IF v_empresa.slug='aurox-plataforma' THEN RAISE EXCEPTION 'Empresa interna protegida'; END IF;
  IF v_empresa.ativo THEN RAISE EXCEPTION 'Desative a empresa antes da exclusão'; END IF;
  -- Se algum outro registro referenciar via FK uma entidade da empresa, o banco interrompe.
  -- Processa tabelas com empresa_id, das mais dependentes para as menos dependentes.
  FOR obj IN
    WITH RECURSIVE tenant_rel AS (
      SELECT c.oid,c.relname,n.nspname
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attname='empresa_id' AND NOT a.attisdropped
      WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname NOT IN ('empresas','aurox_exclusoes_auditoria')
    ), edges AS (
      SELECT f.conrelid AS filho, f.confrelid AS pai
      FROM pg_catalog.pg_constraint f
      WHERE f.contype='f' AND f.conrelid IN (SELECT oid FROM tenant_rel)
        AND f.confrelid IN (SELECT oid FROM tenant_rel) AND f.conrelid<>f.confrelid
    ), paths AS (
      SELECT oid,0 AS nivel FROM tenant_rel
      UNION ALL
      SELECT e.pai,p.nivel+1 FROM paths p JOIN edges e ON e.filho=p.oid WHERE p.nivel<24
    )
    SELECT t.nspname,t.relname,COALESCE(MAX(p.nivel),0) AS nivel
    FROM tenant_rel t LEFT JOIN paths p ON p.oid=t.oid
    GROUP BY t.nspname,t.relname ORDER BY nivel ASC,t.relname ASC
  LOOP
    EXECUTE format('DELETE FROM %I.%I WHERE empresa_id=$1',obj.nspname,obj.relname) USING p_empresa_id;
    GET DIAGNOSTICS v_deleted=ROW_COUNT;
    IF v_deleted>0 THEN v_log := v_log || jsonb_build_object(obj.relname,v_deleted); END IF;
  END LOOP;
  DELETE FROM public.empresas WHERE id=p_empresa_id;
  GET DIAGNOSTICS v_deleted=ROW_COUNT;
  IF v_deleted<>1 THEN RAISE EXCEPTION 'Exclusão da empresa não concluída'; END IF;
  RETURN v_log;
END $$;
REVOKE ALL ON FUNCTION public.aurox_excluir_empresa_relacional(integer) FROM PUBLIC,anon,authenticated;
