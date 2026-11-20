/** Configuração segura do portal: somente valores enumerados, nunca HTML livre. */
export type CampanhaPortal='institucional'|'promocao'|'feirao'|'natal'|'ofertao';
export type BannerModo='nenhum'|'estatico'|'carrossel';
export const BANNERS_PORTAL=[
 '/ficha-banners/promocao.webp','/ficha-banners/feirao.webp',
 '/ficha-banners/natal.webp','/ficha-banners/ofertao.webp',
] as const;
export const CAMPANHAS_PORTAL=[
 {id:'institucional',rotulo:'Institucional',icone:'🛡️'},
 {id:'promocao',rotulo:'Promoção',icone:'🏷️'},
 {id:'feirao',rotulo:'Feirão',icone:'🏁'},
 {id:'natal',rotulo:'Natal',icone:'🎄'},
 {id:'ofertao',rotulo:'Ofertão',icone:'📣'},
] as const;
export const TEMA_PADRAO={
 titulo:'Ficha de cadastro',
 mensagem:'Preencha seus dados com segurança. Sua concessionária receberá as informações para conferência.',
 cor_primaria:'#0F766E',cor_fundo:'#F8FAFC',cor_texto:'#0F172A',
 logo_data_uri:null as string|null,
 campanha:'institucional' as CampanhaPortal,
 modo_banner:'nenhum' as BannerModo,
 banners:[0,1,2] as number[],
 empresa_nome:'Sua concessionária',
};
