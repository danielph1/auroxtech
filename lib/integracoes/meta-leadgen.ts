/** Retrieves real Lead Ads fields. The webhook sends an ID, not contact fields. */
export type MetaLeadFields = { nome: string; telefone: string; email: string; mensagem: string };
export async function buscarLeadMeta(leadId: string, pageToken: string): Promise<MetaLeadFields> {
  if (!/^\d{5,30}$/.test(leadId) || !pageToken) throw new Error('lead_id_ou_token_invalido');
  const version = process.env.META_GRAPH_VERSION || 'v21.0';
  if (!/^v\d+\.\d+$/.test(version)) throw new Error('meta_graph_version_invalida');
  const endpoint = `https://graph.facebook.com/${version}/${leadId}?fields=id,field_data,created_time`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${pageToken}` },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`meta_lead_fetch_${res.status}`);
    const body = await res.json();
    if (String(body.id) !== leadId || !Array.isArray(body.field_data)) throw new Error('meta_lead_payload_invalido');
    const fields = new Map<string, string>();
    for (const f of body.field_data) {
      const key = String(f?.name || '').toLowerCase();
      const value = Array.isArray(f?.values) ? String(f.values[0] ?? '') : '';
      if (key) fields.set(key, value.slice(0, 2000));
    }
    const first = fields.get('first_name') || '';
    const last = fields.get('last_name') || '';
    return {
      nome: (fields.get('full_name') || `${first} ${last}`.trim() || 'Lead Ads').slice(0, 200),
      telefone: (fields.get('phone_number') || fields.get('phone') || '').slice(0, 50),
      email: (fields.get('email') || '').slice(0, 254),
      mensagem: (fields.get('message') || 'Lead Ads Facebook').slice(0, 2000),
    };
  } finally { clearTimeout(timeout); }
}
