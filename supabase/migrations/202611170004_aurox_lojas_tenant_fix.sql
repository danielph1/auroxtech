-- AUROX multiempresa: corrigir CONSTRAINT GLOBAL de codigo de loja, SE existir.
-- ANTES: execute 202611170003 (somente leitura) e faça backup.
-- Sem CASCADE: dependências estrangeiras impedem qualquer exclusão destrutiva.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS aurox_lojas_empresa_codigo_idx ON public.lojas (empresa_id,UPPER(codigo));
DO $$
DECLARE c record; col smallint; refs integer;
BEGIN
 SELECT a.attnum INTO col FROM pg_attribute a WHERE a.attrelid='public.lojas'::regclass AND a.attname='codigo' AND NOT a.attisdropped;
 FOR c IN
   SELECT oid,conname,conkey FROM pg_constraint WHERE conrelid='public.lojas'::regclass AND contype='u'
 LOOP
  IF c.conkey=ARRAY[col]::smallint[] THEN
   -- Não remover se alguma FK depender da chave global antiga.
   SELECT count(*) INTO refs FROM pg_depend d WHERE d.refobjid=c.oid AND d.deptype IN ('n','a');
   IF refs>0 THEN
    RAISE NOTICE 'Constraint global % mantida: possui % dependencias; revisar manualmente',c.conname,refs;
   ELSE
    EXECUTE format('ALTER TABLE public.lojas DROP CONSTRAINT %I',c.conname);
    RAISE NOTICE 'Removida constraint global indevida: %',c.conname;
   END IF;
  END IF;
 END LOOP;
END $$;

-- Somente restrições conhecidas de loja com valor fixo legado: não remover verificações genéricas.
DO $$
DECLARE c record;
BEGIN
 FOR c IN SELECT cl.relname AS tabela,co.conname,pg_get_constraintdef(co.oid) AS def
          FROM pg_constraint co JOIN pg_class cl ON cl.oid=co.conrelid
          WHERE co.conrelid IN ('public.usuarios'::regclass,'public.vendedores'::regclass)
            AND co.contype='c' AND co.conname IN ('usuarios_loja_check','vendedores_loja_check')
 LOOP
  IF c.def !~* 'length.*80' THEN
   EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',c.tabela,c.conname);
   EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (loja IS NULL OR length(trim(loja::text)) BETWEEN 1 AND 80) NOT VALID',c.tabela,c.conname);
   RAISE NOTICE 'Removido valor de loja hardcoded em %.%',c.tabela,c.conname;
  END IF;
 END LOOP;
END $$;
COMMIT;
