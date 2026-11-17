-- Diagnóstico seguro, somente leitura: use ANTES de decidir remover chave global antiga.
SELECT t.relname AS tabela, c.conname AS restricao, c.contype AS tipo,
       pg_get_constraintdef(c.oid) AS definicao
FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
JOIN pg_namespace n ON n.oid=t.relnamespace
WHERE n.nspname='public' AND t.relname IN ('lojas','usuarios','empresas')
  AND c.contype IN ('u','c','p','f')
ORDER BY t.relname,c.conname;

-- Confere codigos repetidos entre EMPRESAS: permitido para multi-tenant.
SELECT codigo, COUNT(DISTINCT empresa_id) AS empresas_com_codigo
FROM public.lojas GROUP BY codigo HAVING COUNT(DISTINCT empresa_id)>1
ORDER BY empresas_com_codigo DESC LIMIT 25;

-- Confira antes de aplicar uma migração estrutural:
-- indice/constraint UNIQUE (codigo) em lojas seria GLOBAL e bloquearia a loja 001 de outras empresas.
-- Uma chave correta, quando comprovada e sem dependências, é UNIQUE (empresa_id,codigo).
-- Não derrubamos constraints desconhecidas automaticamente.
