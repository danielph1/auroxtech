-- AUROX: dois superadmins já existentes passam a ser atendentes da empresa interna.
-- Não cria contas, não altera o cargo, empresa_id ou loja dos superadmins.
-- Execute após backup. Tudo dentro de uma transação: falha => nenhum vínculo criado.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('aurox:atendentes-internos:v1'));
CREATE TABLE IF NOT EXISTS public.aurox_atendentes_internos (
    usuario_id integer PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    vendedor_id integer NOT NULL UNIQUE REFERENCES public.vendedores(id) ON DELETE RESTRICT,
    empresa_id integer NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
    criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aurox_atendentes_internos_empresa_idx
 ON public.aurox_atendentes_internos (empresa_id);
REVOKE ALL ON public.aurox_atendentes_internos FROM anon, authenticated;
ALTER TABLE public.aurox_atendentes_internos ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  eid integer;
  p_nome text;
  uid integer;
  total integer;
  vid integer;
BEGIN
  SELECT id INTO eid FROM public.empresas
   WHERE slug='aurox-plataforma' AND lower(btrim(nome))='aurox' AND coalesce(ativo,true);
  IF eid IS NULL THEN RAISE EXCEPTION 'Empresa interna AUROX não encontrada/ativa'; END IF;
  FOREACH p_nome IN ARRAY ARRAY['daniel','alexandre'] LOOP
    -- Correspondência segura pelo primeiro nome, somente ENTRE superadmins ativos.
    SELECT count(*)::int, min(id)::int INTO total,uid
      FROM public.usuarios
      WHERE lower(btrim(tipo))='superadmin'
        AND coalesce(ativo,true)
        AND lower(coalesce(status,'ativo'))='ativo'
        AND lower(btrim(nome)) ~ ('^' || p_nome || '([[:space:]]|$)');
    IF total <> 1 THEN
      RAISE EXCEPTION 'Esperado exatamente 1 superadmin ativo cujo nome começa por %, encontrados %. Consulte os IDs antes de vincular.',p_nome,total;
    END IF;
    SELECT vendedor_id INTO vid FROM public.aurox_atendentes_internos WHERE usuario_id=uid;
    IF vid IS NULL THEN
      INSERT INTO public.vendedores(nome,empresa_id,loja,ativo)
      VALUES(initcap(p_nome),eid,'AURX',true) RETURNING id INTO vid;
      INSERT INTO public.aurox_atendentes_internos(usuario_id,vendedor_id,empresa_id)
      VALUES(uid,vid,eid);
    ELSE
      IF NOT EXISTS (SELECT 1 FROM public.vendedores v WHERE v.id=vid AND v.empresa_id=eid AND coalesce(v.ativo,false)) THEN
       RAISE EXCEPTION 'Vínculo antigo incompatível para superadmin %, revisar manualmente',p_nome;
      END IF;
    END IF;
  END LOOP;
END $$;
COMMIT;

-- Consulta de verificação (não altera registros):
SELECT u.id AS usuario_id, u.nome, u.tipo, u.loja AS loja_usuario,
       u.empresa_id AS empresa_usuario, v.id AS vendedor_id, v.loja AS loja_atendimento,
       a.empresa_id AS empresa_atendimento
 FROM public.aurox_atendentes_internos a
 JOIN public.usuarios u ON u.id=a.usuario_id
 JOIN public.vendedores v ON v.id=a.vendedor_id
 ORDER BY u.nome;
