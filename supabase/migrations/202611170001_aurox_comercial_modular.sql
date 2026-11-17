-- AUROX | Fundação comercial modular (aditiva; SEM habilitar bloqueios de módulos).
-- Roda no Supabase SQL Editor depois de backup. Sem alteração das tabelas legadas.
-- O catálogo desta etapa é espelho dos preços públicos, mantido para a fase futura de cobrança.
BEGIN;

CREATE TABLE IF NOT EXISTS public.aurox_catalogo_servicos (
  codigo text PRIMARY KEY CHECK (codigo ~ '^[a-z][a-z0-9_]{1,48}$'),
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  preco_mensal_centavos integer NOT NULL CHECK (preco_mensal_centavos >= 0),
  unidade text NOT NULL DEFAULT 'modulo',
  disponivel_comercialmente boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.aurox_contratos_comerciais (
  empresa_id integer PRIMARY KEY REFERENCES public.empresas(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','teste','ativo','suspenso','cancelado')),
  plano_base text NOT NULL DEFAULT 'vanguard' CHECK (plano_base IN ('vanguard','command','black')),
  base_mensal_centavos integer NOT NULL DEFAULT 14900 CHECK (base_mensal_centavos>=0),
  inicio timestamptz,
  ciclo_fim timestamptz,
  promocoes_permitidas boolean NOT NULL DEFAULT true,
  primeira_mensalidade_promocional boolean NOT NULL DEFAULT false,
  promocao_inicio timestamptz,
  promocao_fim timestamptz,
  promo_desconto_porcento smallint NOT NULL DEFAULT 50 CHECK (promo_desconto_porcento BETWEEN 0 AND 100),
  notas_internas text,
  criado_por integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aurox_promo_datas_check CHECK (
    (promocao_inicio IS NULL AND promocao_fim IS NULL) OR
    (promocao_inicio IS NOT NULL AND promocao_fim IS NOT NULL AND promocao_fim > promocao_inicio
     AND promocao_fim <= promocao_inicio + INTERVAL '1 month')
  )
);

CREATE TABLE IF NOT EXISTS public.aurox_contrato_servicos (
  empresa_id integer NOT NULL REFERENCES public.aurox_contratos_comerciais(empresa_id) ON DELETE CASCADE,
  codigo text NOT NULL REFERENCES public.aurox_catalogo_servicos(codigo) ON DELETE RESTRICT,
  ativo boolean NOT NULL DEFAULT false,
  preco_mensal_centavos integer NOT NULL CHECK (preco_mensal_centavos>=0),
  quantidade integer NOT NULL DEFAULT 1 CHECK (quantidade BETWEEN 1 AND 100000),
  incluido_ate integer NOT NULL DEFAULT 1 CHECK (incluido_ate BETWEEN 0 AND 100000),
  ativado_em timestamptz,
  desativado_em timestamptz,
  atualizado_por integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id,codigo)
);
CREATE INDEX IF NOT EXISTS aurox_contrato_servicos_ativos_idx
  ON public.aurox_contrato_servicos(empresa_id,codigo) WHERE ativo=true;

CREATE TABLE IF NOT EXISTS public.aurox_uso_servicos (
  empresa_id integer NOT NULL REFERENCES public.aurox_contratos_comerciais(empresa_id) ON DELETE CASCADE,
  codigo text NOT NULL REFERENCES public.aurox_catalogo_servicos(codigo) ON DELETE RESTRICT,
  competencia date NOT NULL,
  utilizado bigint NOT NULL DEFAULT 0 CHECK (utilizado>=0),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(empresa_id,codigo,competencia),
  CONSTRAINT aurox_uso_competencia_check CHECK (EXTRACT(DAY FROM competencia)=1)
);

CREATE TABLE IF NOT EXISTS public.aurox_eventos_contrato (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id integer NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  ator_id integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  evento text NOT NULL CHECK (char_length(evento) BETWEEN 3 AND 80),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aurox_eventos_contrato_empresa_idx
  ON public.aurox_eventos_contrato(empresa_id,criado_em DESC);

-- NÃO sobrescrever valores que o operador tenha definido posteriormente.
INSERT INTO public.aurox_catalogo_servicos(codigo,nome,descricao,preco_mensal_centavos,disponivel_comercialmente)
VALUES
('crm','CRM e funil de leads','Triagem, atendimento, follow-up e tarefas',14900,true),
('financeiro','Financeiro','Contas, parcelas e faturamento',17900,true),
('anuncios','Integrações de anúncios','Conectores sujeitos a homologação',8900,false),
('whatsapp','Aurox-WhatsApp','Conexões por empresa; exige validação de capacidade',19900,false),
('whatsapp_extra','Número adicional Aurox-WhatsApp','Preço por número adicional',6900,false),
('oficina','Oficina e documental','Veículos e documentos',9900,true),
('inteligencia','Inteligência comercial','Métricas, metas e rankings',7900,false),
('parceiros','Rede de parceiros','Compartilhamentos autorizados',9900,false),
('site','Site personalizado','Domínio e site da concessionária',11900,false)
ON CONFLICT (codigo) DO NOTHING;

-- Isolamento: somente backend com privilégios do servidor; NÃO dar SELECT público.
ALTER TABLE public.aurox_catalogo_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aurox_contratos_comerciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aurox_contrato_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aurox_uso_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aurox_eventos_contrato ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.aurox_catalogo_servicos,public.aurox_contratos_comerciais,
  public.aurox_contrato_servicos,public.aurox_uso_servicos,public.aurox_eventos_contrato
  FROM anon,authenticated;
COMMIT;

-- Complemento opcional de infraestrutura para execução assíncrona futura:
-- criação aditiva, SEM despachar mensagens nem executar tarefas nesta etapa.
BEGIN;
CREATE TABLE IF NOT EXISTS public.aurox_trabalhos_assincronos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id integer REFERENCES public.empresas(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo ~ '^[a-z][a-z0-9_]{1,64}$'),
  chave_idempotencia text NOT NULL CHECK (char_length(chave_idempotencia) BETWEEN 8 AND 200),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  estado text NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente','executando','concluido','erro','cancelado')),
  tentativas smallint NOT NULL DEFAULT 0 CHECK (tentativas BETWEEN 0 AND 30),
  disponivel_em timestamptz NOT NULL DEFAULT now(),
  reservado_em timestamptz,
  reservado_por text,
  ultimo_erro text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aurox_trabalho_empresa_chave_unico UNIQUE (empresa_id,tipo,chave_idempotencia)
);
CREATE INDEX IF NOT EXISTS aurox_trabalhos_pendentes_idx
  ON public.aurox_trabalhos_assincronos(disponivel_em,id) WHERE estado='pendente';
ALTER TABLE public.aurox_trabalhos_assincronos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.aurox_trabalhos_assincronos FROM anon,authenticated;
COMMIT;
