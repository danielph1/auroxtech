#!/usr/bin/env python3
"""Apply Meta Lead Ads hydration fix to existing MANU repo, with safeguards.
Run from the root of auroxtech. Does not touch DB or credentials.
"""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parent.parent
repo = Path.cwd()
route = repo / 'app/api/webhooks/meta/route.ts'
if not route.is_file():
    raise SystemExit('Execute a partir da raiz do projeto auroxtech (app/api/webhooks/meta/route.ts ausente).')
s = route.read_text(encoding='utf-8')
if "import { buscarLeadMeta }" not in s:
    anchor = "import { createHmac, timingSafeEqual } from 'node:crypto';"
    assert s.count(anchor) == 1, 'Versão diferente do código, revisão manual necessária'
    s = s.replace(anchor, anchor + "\nimport { buscarLeadMeta } from '@/lib/integracoes/meta-leadgen';")
old = """            results.push(
              await criarLead({
                empresaId: conn.empresa_id,
                nome: v.full_name || v.name || 'Lead Ads',
                telefone: v.phone_number || v.phone || '',
                email: v.email || '',
                mensagem: 'Lead Ads Facebook',
                origem: 'facebook_leadads',
                externalId: `${pageId}:${String(v.leadgen_id || '')}`,
              }),
            );"""
new = """            // Meta sends an ID only; fetch actual form data with the page token.
            const leadId = String(v.leadgen_id || '');
            if (!leadId || !conn.access_token_enc) {
              throw new Error('meta_lead_id_ou_token_ausente');
            }
            const lead = await buscarLeadMeta(leadId, conn.access_token_enc);
            results.push(
              await criarLead({
                empresaId: conn.empresa_id,
                nome: lead.nome,
                telefone: lead.telefone,
                email: lead.email,
                mensagem: lead.mensagem,
                origem: 'facebook_leadads',
                externalId: `${pageId}:${leadId}`,
              }),
            );"""
if old in s:
    s = s.replace(old,new)
elif 'const lead = await buscarLeadMeta' not in s:
    raise SystemExit('Bloco de leadgen alterado no repositório. Patch não aplicado: revisão manual necessária.')
shutil.copy2(route, route.with_suffix('.ts.bak'))
route.write_text(s,encoding='utf-8')
for name in ['meta-leadgen.ts','canais.ts']:
    target=repo/'lib/integracoes'/name
    target.parent.mkdir(parents=True,exist_ok=True)
    if target.exists() and target.read_bytes()!= (root/'lib/integracoes'/name).read_bytes():
        raise SystemExit(f'{name} já existe e difere, não sobrescrevi.')
    shutil.copy2(root/'lib/integracoes'/name,target)
print('Patch Meta aplicado. Revise diff, rode npm run build e teste webhook com Meta antes do deploy.')
