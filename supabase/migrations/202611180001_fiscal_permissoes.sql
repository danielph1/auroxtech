-- AUROX: módulo fiscal contratado (adicional) e bloqueios granulares por empresa/cargo/usuário.
-- PRÉ-REQUISITO: 202611170001_aurox_comercial_modular.sql; executar no Supabase após backup.
-- Não modifica financeiro legado, caixa, contratos existentes, nem cria impostos devidos.
BEGIN;
INSERT INTO public.aurox_catalogo_servicos
  (codigo,nome,descricao,preco_mensal_centavos,disponivel_comercialmente)
VALUES ('fiscal','Fiscal e Tributos','Simulação tributária com base e alíquota informadas; apuração oficial futura',8900,false)
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.aurox_fiscal_simulacoes (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 empresa_id integer NOT NULL REFERENCES public.empresas(id),
 usuario_id integer NOT NULL REFERENCES public.usuarios(id),
 regime text NOT NULL CHECK (regime IN ('simples_nacional','lucro_presumido','lucro_real','nao_informado')),
 base text NOT NULL CHECK (base IN ('receita_bruta','diferenca_venda_compra','manual')),
 descricao text NOT NULL DEFAULT '' CHECK (char_length(descricao)<=200),
 venda_centavos bigint NOT NULL CHECK (venda_centavos>0 AND venda_centavos<=100000000000),
 aquisicao_centavos bigint NOT NULL CHECK (aquisicao_centavos>=0 AND aquisicao_centavos<=100000000000),
 despesas_centavos bigint NOT NULL CHECK (despesas_centavos>=0 AND despesas_centavos<=100000000000),
 base_calculo_centavos bigint NOT NULL CHECK (base_calculo_centavos>=0 AND base_calculo_centavos<=100000000000),
 aliquota_percentual numeric(7,4) NOT NULL CHECK (aliquota_percentual BETWEEN 0 AND 100),
 estimado_centavos bigint NOT NULL CHECK (estimado_centavos>=0),
 margem_centavos bigint NOT NULL,
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aurox_fiscal_simulacoes_empresa ON public.aurox_fiscal_simulacoes(empresa_id,criado_em DESC);

CREATE TABLE IF NOT EXISTS public.aurox_permissoes_cargo (
 empresa_id integer NOT NULL REFERENCES public.empresas(id),
 cargo text NOT NULL CHECK (cargo ~ '^[a-z_]{3,32}$'),
 recurso text NOT NULL CHECK (recurso ~ '^[a-z_]{3,32}$'),
 acao text NOT NULL CHECK (acao IN ('visualizar','criar','editar','excluir','enviar')),
 permitido boolean NOT NULL,
 alterado_por integer REFERENCES public.usuarios(id),
 alterado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(empresa_id,cargo,recurso,acao)
);
CREATE TABLE IF NOT EXISTS public.aurox_permissoes_usuario (
 empresa_id integer NOT NULL REFERENCES public.empresas(id),
 usuario_id integer NOT NULL REFERENCES public.usuarios(id),
 recurso text NOT NULL CHECK (recurso ~ '^[a-z_]{3,32}$'),
 acao text NOT NULL CHECK (acao IN ('visualizar','criar','editar','excluir','enviar')),
 permitido boolean NOT NULL,
 alterado_por integer REFERENCES public.usuarios(id),
 alterado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(empresa_id,usuario_id,recurso,acao)
);
-- Defesa adicional: permissões individuais não podem apontar para usuário de outra empresa.
CREATE OR REPLACE FUNCTION public.aurox_validar_permissao_usuario() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.usuarios WHERE id=NEW.usuario_id AND empresa_id=NEW.empresa_id)
 THEN RAISE EXCEPTION 'Usuário não pertence à empresa da permissão' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS aurox_permissoes_usuario_empresa ON public.aurox_permissoes_usuario;
CREATE TRIGGER aurox_permissoes_usuario_empresa BEFORE INSERT OR UPDATE
ON public.aurox_permissoes_usuario FOR EACH ROW EXECUTE FUNCTION public.aurox_validar_permissao_usuario();

ALTER TABLE public.aurox_fiscal_simulacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aurox_permissoes_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aurox_permissoes_cargo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.aurox_fiscal_simulacoes,public.aurox_permissoes_cargo,public.aurox_permissoes_usuario FROM anon,authenticated;
REVOKE ALL ON FUNCTION public.aurox_validar_permissao_usuario() FROM PUBLIC;
COMMIT;
