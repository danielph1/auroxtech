/** Configuração segura do portal: somente valores enumerados, nunca HTML livre. */
export type CampanhaPortal='institucional'|'promocao'|'feirao'|'natal'|'ofertao';
export type BannerModo='nenhum'|'estatico'|'carrossel';
export const BANNERS_PORTAL=[
 '/ficha-banners/promocao.webp','/ficha-banners/feirao.webp',
 '/ficha-banners/natal.webp','/ficha-banners/ofertao.webp',
] as const;
export const CAMPANHAS_PORTAL=[
 {id:'institucional',rotulo:'Institucional'},
 {id:'promocao',rotulo:'Promoção'},
 {id:'feirao',rotulo:'Feirão'},
 {id:'natal',rotulo:'Natal'},
 {id:'ofertao',rotulo:'Ofertão'},
] as const;
export type ConteudoBanner={
 titulo:string;
 subtitulo:string;
 destaque:string;
 desconto_percentual:number|null;
};
/** Cada tipo possui texto próprio; a marca sempre vem do cadastro da concessionária. */
export const CONTEUDOS_BANNER_PADRAO:ConteudoBanner[]=[
 {titulo:'Condições para você conhecer',subtitulo:'Confira as opções selecionadas pela nossa equipe.',destaque:'Promoção',desconto_percentual:null},
 {titulo:'Feirão de oportunidades',subtitulo:'Venha conhecer os veículos disponíveis.',destaque:'Feirão',desconto_percentual:null},
 {titulo:'Seu próximo carro neste Natal',subtitulo:'Converse com nossa equipe sobre as condições.',destaque:'Natal',desconto_percentual:null},
 {titulo:'Ofertas em destaque',subtitulo:'Confira os veículos e as condições disponíveis.',destaque:'Ofertão',desconto_percentual:null},
];
/** O JSONB de versões antigas pode conter []; nunca confiar em conteúdo arbitrário. */
export function normalizarConteudosBanner(valor:unknown):ConteudoBanner[]{
 const arr=Array.isArray(valor)?valor:[];
 return CONTEUDOS_BANNER_PADRAO.map((def,i)=>{
  const v=arr[i];if(!v||typeof v!=='object'||Array.isArray(v))return {...def};
  const obj=v as Record<string,unknown>;
  return {
   titulo:typeof obj.titulo==='string'?obj.titulo.slice(0,60):def.titulo,
   subtitulo:typeof obj.subtitulo==='string'?obj.subtitulo.slice(0,110):def.subtitulo,
   destaque:typeof obj.destaque==='string'?obj.destaque.slice(0,40):def.destaque,
   desconto_percentual:typeof obj.desconto_percentual==='number'&&Number.isInteger(obj.desconto_percentual)&&obj.desconto_percentual>=1&&obj.desconto_percentual<=99?obj.desconto_percentual:null,
  };
 });
}
export const TEMA_PADRAO={
 titulo:'Ficha de cadastro',
 mensagem:'Preencha seus dados com segurança. Sua concessionária receberá as informações para conferência.',
 cor_primaria:'#0F766E',cor_fundo:'#F8FAFC',cor_texto:'#0F172A',
 logo_data_uri:null as string|null,
 campanha:'institucional' as CampanhaPortal,
 modo_banner:'nenhum' as BannerModo,
 banners:[0,1,2] as number[],
 empresa_nome:'Concessionária',
 banner_conteudos:CONTEUDOS_BANNER_PADRAO.map(v=>({...v})),
 veiculo_obrigatorio:true as boolean,
};
