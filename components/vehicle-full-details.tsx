'use client';
import {useMemo} from 'react';
import {BadgeCheck,CarFront,ClipboardList,FileText,Globe2,ShieldCheck,type LucideIcon} from 'lucide-react';

type Row={label:string;value:unknown};
function str(v:unknown):string {
  if(v===null||v===undefined||v==='')return 'Não informado';
  if(typeof v==='boolean')return v?'Sim':'Não';
  if(Array.isArray(v))return v.length?v.map(String).join(' • '):'Não informado';
  if(typeof v==='object')return 'Não informado';
  return String(v);
}
const money=(n:unknown)=>Number.isFinite(Number(n))&&Number(n)>0?Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'Não definido';
function Rows({items}:{items:Row[]}) {return <dl className="grid gap-3 sm:grid-cols-2">{items.map(x=><div key={x.label} className="min-w-0 rounded-xl border border-border/70 bg-muted/20 p-3"><dt className="text-[11px] font-medium text-muted-foreground">{x.label}</dt><dd className="mt-1 break-words text-sm font-semibold text-foreground">{str(x.value)}</dd></div>)}</dl>}
function Group({title,Icon,children}:{title:string;Icon:LucideIcon;children:React.ReactNode}) {return <section className="space-y-3"><h3 className="flex items-center gap-2 text-sm font-bold"><Icon size={16} className="text-primary"/>{title}</h3>{children}</section>}
export function VehicleFullDetails({vehicle,allowSensitive}:{vehicle:Record<string,any>;allowSensitive:boolean}) {
 const raw=vehicle?.aurox_detalhes;
 const d=useMemo(()=>raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{} as Record<string,any>,[raw]);
 const details=(key:string)=>d[key]??vehicle?.[key];
 const portals=d.portais_detalhes&&typeof d.portais_detalhes==='object'?d.portais_detalhes as Record<string,{preco?:number;observacao?:string}>:{};
 const portalNames:Record<string,string>={olx:'OLX',facebook:'Facebook Marketplace',webmotors:'Webmotors',icarros:'iCarros',mercadolivre:'Mercado Livre',napista:'NaPista'};
 const priceRows=Object.entries(portals).filter(([,v])=>v&&(Number(v.preco)>0||!!v.observacao)).map(([key,v])=>({key,name:portalNames[key]||key,preco:v.preco,observacao:v.observacao}));
 const hasComplete=Object.keys(d).length>0;
 return <div className="mt-4 space-y-5 rounded-2xl border border-border/80 bg-card/70 p-4 sm:p-5" aria-label="Ficha completa do veículo">
  <header><strong className="text-base">Ficha completa do veículo</strong><p className="mt-1 text-xs text-muted-foreground">Informações disponíveis no cadastro desta empresa. Campos antigos não preenchidos aparecem como não informados.</p></header>
  {!hasComplete&&<div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-300">Este registro não possui a ficha complementar. O cadastro anterior pode ter armazenado somente os campos básicos. Não é possível recuperar campos que nunca foram gravados.</div>}
  <Group title="Identificação e características" Icon={CarFront}><Rows items={[
    {label:'Marca',value:vehicle.marca},{label:'Modelo',value:vehicle.modelo},{label:'Versão',value:details('versao')},
    {label:'Ano de fabricação',value:vehicle.ano},{label:'Ano do modelo',value:details('ano_modelo')},
    {label:'Tipo',value:details('tipo_veiculo')},{label:'Condição',value:details('condicao')},
    {label:'Cor',value:vehicle.cor},{label:'Combustível',value:details('combustivel')},
    {label:'Câmbio',value:details('cambio')},{label:'Portas',value:details('portas')},
    {label:'Carroceria',value:details('carroceria')},{label:'Quilometragem',value:details('km')!=null?`${Number(details('km')).toLocaleString('pt-BR')} km`:null},
    {label:'Placa',value:vehicle.placa},{label:'Pátio / loja',value:vehicle.patio},
    {label:'Consignado',value:details('consignado')},{label:'Não exibir KM no anúncio',value:details('nao_exibir_km')},
  ]}/></Group>
  {allowSensitive&&<Group title="Dados documentais (acesso restrito)" Icon={ShieldCheck}><Rows items={[{label:'Chassi',value:details('chassi')},{label:'Renavam',value:details('renavam')},{label:'Número do motor',value:details('numero_motor')} ]}/></Group>}
  <Group title="Preço e classificados" Icon={Globe2}>
   <Rows items={[{label:'Preço principal do estoque',value:money(vehicle.preco)},{label:'Preço geral para classificados',value:details('usar_preco_site')===false?money(details('preco_classificados')):'Mesmo preço do estoque'}]}/>
   <p className="text-xs text-muted-foreground">Preços especiais são configurações da ficha, não confirmam publicação. O Mercado Livre usa o valor configurado quando a publicação é realizada sem preço explícito.</p>
   {priceRows.length>0?<div className="grid gap-2 sm:grid-cols-2">{priceRows.map(p=><div key={p.key} className="rounded-xl border border-border/70 p-3"><strong className="text-sm">{p.name}</strong><p className="mt-1 text-sm font-semibold text-primary">{money(p.preco)}</p>{p.observacao&&<p className="mt-2 whitespace-pre-line break-words text-xs text-muted-foreground">{p.observacao}</p>}</div>)}</div>:<p className="text-xs text-muted-foreground">Nenhuma diferença específica por portal cadastrada.</p>}
  </Group>
  <Group title="Descrição" Icon={FileText}><Rows items={[{label:'Observações para o site',value:details('observacoes')},{label:'Observações para classificados',value:details('usar_observacao_classificados')===true?details('observacoes'):details('observacao_classificados')} ]}/></Group>
  <Group title="Opcionais e características" Icon={ClipboardList}><Rows items={[{label:'Características',value:details('caracteristicas')},{label:'Opcionais',value:details('opcionais')} ]}/></Group>
  <p className="flex items-start gap-2 text-xs text-muted-foreground"><BadgeCheck size={15} className="mt-0.5 shrink-0"/>Os dados refletem o que o Aurox recebeu do banco. A publicação em OLX, Webmotors e outros canais depende das integrações específicas.</p>
 </div>;
}
