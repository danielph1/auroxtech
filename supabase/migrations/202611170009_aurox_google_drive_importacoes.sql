-- AUROX: tokens Google Drive isolados por empresa. NUNCA persistir access token em frontend.
BEGIN;
CREATE TABLE IF NOT EXISTS public.aurox_drive_conexoes (
 empresa_id bigint PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
 refresh_token_enc text NOT NULL,
 conectado_por bigint REFERENCES public.usuarios(id) ON DELETE SET NULL,
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.aurox_drive_oauth_states (
 nonce text PRIMARY KEY,
 empresa_id bigint NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
 usuario_id bigint NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS public.aurox_drive_fotos (
 id bigserial PRIMARY KEY,
 empresa_id bigint NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
 drive_file_id text NOT NULL,
 carro_id bigint NOT NULL REFERENCES public.estoque_carros(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','done')),
 path text,
 criado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(empresa_id,drive_file_id,carro_id)
);
CREATE INDEX IF NOT EXISTS aurox_drive_fotos_empresa_idx ON public.aurox_drive_fotos(empresa_id,carro_id);
ALTER TABLE public.aurox_drive_conexoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aurox_drive_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aurox_drive_fotos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.aurox_drive_conexoes,public.aurox_drive_oauth_states,public.aurox_drive_fotos FROM PUBLIC,anon,authenticated;
COMMIT;
