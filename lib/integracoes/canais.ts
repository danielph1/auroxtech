/** Capability registry: never mark a provider's features as live before approval/test. */
export const CANAIS = {
  meta: { leads: 'oauth_app_review', anuncios: 'marketing_api_catalog', webhook: '/api/webhooks/meta', observacao: 'Lead Ads exige leads_retrieval e consulta Graph do leadgen_id; Marketplace não é publicação livre por API.' },
  olx: { leads: 'oauth_homologacao', anuncios: 'oauth_autoupload', webhook: 'Central /integracoes -> URL por empresa', observacao: 'Leads com autoservice; anúncios com autoupload; homologação OLX.' },
  mercadolivre: { leads: 'oauth_vis_leads', anuncios: 'oauth_vehicles', webhook: 'notificacoes VIS Leads', observacao: 'Notificação traz recurso a consultar: não assumir dados pessoais no webhook.' },
  icarros: { leads: 'parceria', anuncios: 'parceria', webhook: 'URL individual se aprovada pelo parceiro', observacao: 'Exige documentação/credenciais de integrador do parceiro.' },
  mobiauto: { leads: 'parceria', anuncios: 'parceria', webhook: 'URL individual se aprovada pelo parceiro', observacao: 'Exige documentação/credenciais de integrador do parceiro.' },
  webmotors: { leads: 'api_parceiro', anuncios: 'api_parceiro', webhook: 'configuracao_por_parceiro', observacao: 'Integração separada, com acesso de integrador autorizado.' },
} as const;
export type Canal = keyof typeof CANAIS;
