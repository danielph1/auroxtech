-- Um cursor por concessionária. NÃO altera leads antigos e NÃO toca na empresa AUROX interna.
BEGIN;
CREATE TABLE IF NOT EXISTS public.aurox_rodizio_triagem (
  empresa_id integer PRIMARY KEY REFERENCES public.empresas(id) ON DELETE RESTRICT,
  ultimo_vendedor_id integer NULL REFERENCES public.vendedores(id) ON DELETE SET NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.aurox_rodizio_triagem ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.aurox_rodizio_triagem FROM anon, authenticated;
COMMIT;

-- Consulta opcional: estado do rodízio, sem dados de leads.
SELECT r.empresa_id,e.nome AS empresa,v.nome AS ultimo_vendedor,r.atualizado_em
  FROM public.aurox_rodizio_triagem r
  JOIN public.empresas e ON e.id=r.empresa_id
  LEFT JOIN public.vendedores v ON v.id=r.ultimo_vendedor_id
  ORDER BY e.nome;
