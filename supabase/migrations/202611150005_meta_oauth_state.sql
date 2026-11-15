-- Migração aditiva e segura: impede reutilizar state OAuth e preserva isolamento entre empresas.
CREATE TABLE IF NOT EXISTS public.aurox_meta_oauth_states (
  nonce_hash TEXT PRIMARY KEY CHECK (length(nonce_hash) = 64),
  empresa_id BIGINT NOT NULL REFERENCES public.empresas(id),
  usuario_id BIGINT NOT NULL REFERENCES public.usuarios(id),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aurox_meta_oauth_states_expires_idx
  ON public.aurox_meta_oauth_states (expires_at);
ALTER TABLE public.aurox_meta_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.aurox_meta_oauth_states FROM PUBLIC, anon, authenticated;
-- Servidor usa conexão PostgreSQL privada; não exponha esta tabela via cliente Supabase.
