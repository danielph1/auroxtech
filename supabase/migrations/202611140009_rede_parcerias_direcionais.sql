-- AUROX Rede V1 — convites, parceria unidirecional e auditoria.
-- IMPORTANTE: backup e homologacao ANTES da producao.
-- Esta migracao NAO muda tabelas de leads, estoque, usuarios, anuncios ou permissoes existentes.
BEGIN;

CREATE TABLE IF NOT EXISTS public.aurox_rede_codigos (
  empresa_id integer PRIMARY KEY REFERENCES public.empresas(id) ON DELETE RESTRICT,
  codigo_hash varchar(64) NOT NULL UNIQUE CHECK (length(codigo_hash)=64),
  gerado_por bigint NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.aurox_rede_parcerias (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  origem_empresa_id integer NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  destino_empresa_id integer NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  compartilhar_leads boolean NOT NULL DEFAULT false,
  compartilhar_estoque boolean NOT NULL DEFAULT false,
  confirmacao_lgpd boolean NOT NULL DEFAULT false,
  status varchar(15) NOT NULL DEFAULT 'pendente',
  criado_por bigint NOT NULL,
  analisado_por bigint,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  aprovado_em timestamptz,
  encerrado_em timestamptz,
  CONSTRAINT aurox_rede_empresas_diferentes CHECK (origem_empresa_id<>destino_empresa_id),
  CONSTRAINT aurox_rede_ao_menos_uma_categoria CHECK (compartilhar_leads OR compartilhar_estoque),
  CONSTRAINT aurox_rede_status_valido CHECK (status IN ('pendente','aprovada','recusada','revogada')),
  CONSTRAINT aurox_rede_leads_com_declaracao CHECK (status<>'aprovada' OR NOT compartilhar_leads OR confirmacao_lgpd)
);

-- Somente uma parceria pendente/aprovada por direcao; a inversa e INDEPENDENTE.
CREATE UNIQUE INDEX IF NOT EXISTS aurox_rede_direcao_ativa_uniq
  ON public.aurox_rede_parcerias (origem_empresa_id,destino_empresa_id)
  WHERE status IN ('pendente','aprovada');
CREATE INDEX IF NOT EXISTS aurox_rede_entrada_idx
  ON public.aurox_rede_parcerias(destino_empresa_id,status,criado_em DESC);
CREATE INDEX IF NOT EXISTS aurox_rede_saida_idx
  ON public.aurox_rede_parcerias(origem_empresa_id,status,criado_em DESC);

CREATE TABLE IF NOT EXISTS public.aurox_rede_auditoria (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parceria_id bigint REFERENCES public.aurox_rede_parcerias(id) ON DELETE RESTRICT,
  empresa_contexto_id integer REFERENCES public.empresas(id) ON DELETE RESTRICT,
  usuario_id bigint,
  acao varchar(32) NOT NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aurox_rede_auditoria_parceria_idx
  ON public.aurox_rede_auditoria(parceria_id,criado_em DESC);

-- Consultas sempre começam por empresa_id e ordem decrescente de ID.
CREATE INDEX IF NOT EXISTS aurox_rede_leads_empresa_idx ON public.leads(empresa_id,id DESC);
CREATE INDEX IF NOT EXISTS aurox_rede_estoque_empresa_idx ON public.estoque_carros(empresa_id,id DESC);

-- Nenhum acesso diretamente via Supabase REST anon/authenticated.
-- O backend com conta PostgreSQL privilegiada filtra escopo por empresa+parceria+papel.
ALTER TABLE public.aurox_rede_codigos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aurox_rede_parcerias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aurox_rede_auditoria ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.aurox_rede_codigos,public.aurox_rede_parcerias,public.aurox_rede_auditoria FROM PUBLIC;
REVOKE ALL ON TABLE public.aurox_rede_codigos,public.aurox_rede_parcerias,public.aurox_rede_auditoria FROM anon,authenticated;
REVOKE ALL ON SEQUENCE public.aurox_rede_parcerias_id_seq,public.aurox_rede_auditoria_id_seq FROM PUBLIC,anon,authenticated;

COMMENT ON TABLE public.aurox_rede_parcerias IS 'Permissao direcional: origem e proprietaria dos dados; destino consulta somente categorias aprovadas pela origem.';
COMMIT;
