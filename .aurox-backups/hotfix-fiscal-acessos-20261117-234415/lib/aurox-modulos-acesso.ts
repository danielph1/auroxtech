/**
 * AUROX - catalogo puro de rotas por modulo. Compativel com browser e Node.
 * Nao importar banco, session ou pg neste arquivo.
 * A checagem de frontend NAO substitui a autorizacao do servidor.
 */
export type RegraModulo = {todos?: readonly string[];qualquer?: readonly string[]};
type Entrada = readonly [string, RegraModulo];

const paginas: readonly Entrada[] = [
  ['/agenda',{todos:['crm']}],
  ['/triagem',{todos:['crm']}],
  ['/painel',{todos:['crm']}],
  ['/novo-lead',{todos:['crm']}],
  ['/chat',{todos:['crm']}],
  ['/follow-up',{todos:['crm']}],
  ['/atendimento',{todos:['crm']}],
  ['/fichas',{todos:['crm']}],
  ['/favoritos',{todos:['crm']}],
  ['/tarefas',{todos:['crm']}],
  ['/financas',{todos:['financeiro']}],
  ['/faturamento',{todos:['financeiro']}],
  ['/anuncios',{todos:['anuncios']}],
  ['/anuncio-coletivo',{todos:['anuncios']}],
  ['/integracoes',{qualquer:['anuncios','whatsapp']}],
  ['/oficina',{todos:['oficina']}],
  ['/documental',{todos:['oficina']}],
  ['/processos',{todos:['oficina']}],
  ['/metas',{todos:['inteligencia']}],
  ['/metricas',{todos:['inteligencia']}],
  ['/desempenho',{todos:['inteligencia']}],
  ['/ranking',{todos:['inteligencia']}],
  ['/parcerias',{todos:['parceiros']}],
  ['/marketplace',{todos:['parceiros']}],
];

const apis: readonly Entrada[] = [
  ['/api/financas/fiscal',{todos:['financeiro','fiscal']}],
  ['/api/financas',{todos:['financeiro']}],
  ['/api/faturamento',{todos:['financeiro']}],
  ['/api/triagem',{todos:['crm']}],
  ['/api/leads',{todos:['crm']}],
  ['/api/chat',{todos:['crm']}],
  ['/api/follow-up',{todos:['crm']}],
  ['/api/atendimento',{todos:['crm']}],
  ['/api/fichas',{todos:['crm']}],
  ['/api/favoritos',{todos:['crm']}],
  ['/api/tarefas',{todos:['crm']}],
  ['/api/metas',{todos:['inteligencia']}],
  ['/api/metricas',{todos:['inteligencia']}],
  ['/api/desempenho',{todos:['inteligencia']}],
  ['/api/ranking',{todos:['inteligencia']}],
  ['/api/anuncio-coletivo',{todos:['anuncios']}],
  ['/api/anuncios',{todos:['anuncios']}],
  ['/api/olx/anuncios',{todos:['anuncios']}],
  ['/api/integracoes/aurox-whatsapp',{todos:['whatsapp']}],
  ['/api/integracoes/oauth/whatsapp',{todos:['whatsapp']}],
  ['/api/integracoes/oauth/zapi',{todos:['whatsapp']}],
  ['/api/integracoes/oauth/olx',{todos:['anuncios']}],
  ['/api/integracoes/oauth/mercadolivre',{todos:['anuncios']}],
  ['/api/integracoes/oauth/meta',{todos:['anuncios']}],
  ['/api/integracoes/meta',{todos:['anuncios']}],
  ['/api/integracoes/empresas',{qualquer:['anuncios','whatsapp']}],
  ['/api/integracoes/oauth',{qualquer:['anuncios','whatsapp']}],
  // Rotas genericas para criar conexoes/anuncios nao sao liberadas so por contratar WhatsApp.
  ['/api/integracoes',{todos:['anuncios']}],
  ['/api/oficina',{todos:['oficina']}],
  ['/api/documental',{todos:['oficina']}],
  ['/api/processos',{todos:['oficina']}],
  ['/api/parcerias',{todos:['parceiros']}],
  ['/api/marketplace',{todos:['parceiros']}],
];

function corresponde(caminho: string, prefixo: string): boolean {
  return caminho === prefixo || caminho.startsWith(prefixo + '/');
}
export function regraModuloDaRota(caminho: string): RegraModulo | null {
  const regras = caminho.startsWith('/api/') ? apis : paginas;
  return regras.find(([prefixo]) => corresponde(caminho, prefixo))?.[1] ?? null;
}
export function possuiModulos(modulos: readonly string[], regra: RegraModulo | null): boolean {
  if (!regra) return true; // Areas base, nao contempladas no catalogo.
  const ativos = new Set(modulos);
  if (regra.todos?.some(codigo => !ativos.has(codigo))) return false;
  if (regra.qualquer && !regra.qualquer.some(codigo => ativos.has(codigo))) return false;
  return true;
}
export function permiteModuloNaRota(modulos: readonly string[], caminho: string): boolean {
  return possuiModulos(modulos, regraModuloDaRota(caminho));
}
