/** AUROX: mapa de rotas seguro no browser. Não importa dependências de servidor. */
export type RecursoPagina = 'anuncios' | 'conversas' | 'estoque' | 'faturamento' | 'fichas' | 'financeiro' | 'integracoes' | 'leads' | 'metricas' | 'oficina' | 'triagem' | 'usuarios';
export function recursoDaPagina(pathname:string):RecursoPagina|null{
 const paths:Array<[string,RecursoPagina]>=[
  ['/financas','financeiro'],['/gestao-usuarios','usuarios'],['/triagem','triagem'],
  ['/painel','leads'],['/novo-lead','leads'],['/chat','conversas'],
  ['/estoque','estoque'],['/oficina','oficina'],['/anuncios','anuncios'],
  ['/integracoes','integracoes'],['/fichas','fichas'],['/faturamento','faturamento'],
  ['/metricas','metricas'],
 ];
 return paths.find(([p])=>pathname===p||pathname.startsWith(p+'/'))?.[1] || null;
}
