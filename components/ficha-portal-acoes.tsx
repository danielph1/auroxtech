'use client';
import {useEffect,useState} from 'react';
import {api} from '@/lib/api';
import {useAuth} from '@/contexts/auth-context';
import {QRCodeSVG} from 'qrcode.react';
import {toast} from 'sonner';
import Link from 'next/link';
import {Link2,ShieldCheck,Send,RefreshCw,SquareArrowOutUpRight} from 'lucide-react';

type Convite={id:string;criado_em:string;expira_em:string;usado_em:string|null;revogado_em:string|null;enviado_whatsapp:boolean;status?:string;dados?:Record<string,unknown>|null};
const button='inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:border-primary disabled:opacity-50';
const privates=new Set(['superadmin','admin','gerente','vendedor']);
const campos:Record<string,string>={nome_completo:'Nome completo',cpf:'CPF',data_nascimento:'Nascimento',telefone:'Telefone',carro_interesse:'Veículo de interesse',habilitado:'Habilitado (CNH)',valor_entrada:'Entrada pretendida (R$)',rg:'RG',nome_mae:'Nome da mãe',email:'E-mail',endereco:'Endereço',bairro:'Bairro',cidade:'Cidade',estado:'UF',cep:'CEP',salario:'Renda declarada'};
export function FichaPortalAcoes({fichaId}:{fichaId:number}){
 const {user}=useAuth();const [rows,setRows]=useState<Convite[]>([]),[link,setLink]=useState(''),[expires,setExpires]=useState('');
 const [busy,setBusy]=useState(false),[ativos,setAtivos]=useState(0);
 const cargo=String(user?.tipo||'').toLowerCase();
 async function refresh(){try{const r=await api.get(`/fichas/${fichaId}/convite`);setRows(r.data.convites||[]);setAtivos(Number(r.data.convites_ativos||0))}catch{}}
 useEffect(()=>{setRows([]);setLink('');setExpires('');if(fichaId)void refresh()},[fichaId]);
 if(!privates.has(cargo))return null;
 async function gerar(modo:'whatsapp'|'qr'){
  if(busy)return;setBusy(true);
  try{const {data}=await api.post(`/fichas/${fichaId}/convite`,{modo});setLink(data.link);setExpires(data.expira_em);
   if(data.whatsapp_enviado)toast.success('Link enviado pelo Aurox-WhatsApp.');
   else if(data.aviso)toast.warning(data.aviso);else toast.success('QR Code temporário criado.');
   await refresh();
  }catch(e:any){toast.error(e?.response?.data?.error||'Não foi possível gerar link')}finally{setBusy(false)}
 }
 async function acao(conviteId:string,operacao:'aprovado'|'recusado'|'revogar'){
  if(!confirm(operacao==='aprovado'?'Confirmar os dados recebidos e atualizar o cadastro do lead?':operacao==='recusado'?'Recusar os dados recebidos?':'Revogar este link?'))return;
  setBusy(true);try{await api.patch(`/fichas/${fichaId}/convite`,{convite_id:conviteId,acao:operacao});toast.success('Atualizado com sucesso');setLink('');await refresh()}
  catch(e:any){toast.error(e?.response?.data?.error||'Não foi possível concluir')}finally{setBusy(false)}
 }
 return <section className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3" aria-label="Ficha para o cliente">
  <div className="flex flex-wrap justify-between gap-2"><div><h3 className="flex items-center gap-2 font-semibold"><ShieldCheck size={17}/> Ficha para o cliente</h3>
   <p className="text-xs text-muted-foreground mt-1">30 minutos · um uso · até 3 clientes ativos por vendedor · vínculo ao vendedor responsável</p></div>
   <button type="button" className={button} onClick={()=>void refresh()}><RefreshCw size={14}/> Atualizar</button></div>
  <div className="flex flex-wrap gap-2">
   <button type="button" className={button} disabled={busy||ativos>=3} onClick={()=>void gerar('whatsapp')}><Send size={15}/> Enviar pelo Aurox-WhatsApp</button>
   <button type="button" className={button} disabled={busy||ativos>=3} onClick={()=>void gerar('qr')}><Link2 size={15}/> Gerar QR Code / link</button>
   {['admin','gerente','superadmin'].includes(cargo)&&<Link href="/fichas/personalizacao" className={button}>Personalizar página <SquareArrowOutUpRight size={14}/></Link>}
  </div>
  {ativos>=3&&<p className="text-xs text-amber-700 dark:text-amber-400">Limite atingido: aguarde um convite expirar ou ser utilizado antes de gerar outro.</p>}
   {link&&<div className="flex flex-col items-center gap-3 rounded-xl bg-card p-4 text-sm sm:flex-row sm:items-start">
   <div className="rounded-lg bg-white p-3"><QRCodeSVG value={link} size={155} level="M" marginSize={3}/></div>
   <div className="min-w-0 flex-1 space-y-2"><p className="font-medium">Link temporário gerado</p><p className="break-all text-xs text-muted-foreground">{link}</p>
   <p className="text-xs">Expira em: {new Date(expires).toLocaleString('pt-BR')}</p>
   <button type="button" className={button} onClick={()=>void navigator.clipboard.writeText(link).then(()=>toast.success('Link copiado'))}>Copiar link</button>
   <p className="text-xs text-muted-foreground">Não compartilhe em grupos. O preenchimento exige código enviado ao número já cadastrado no lead.</p></div>
  </div>}
  {rows.length>0&&<div className="space-y-2"><h4 className="text-sm font-semibold">Convites recentes</h4>{rows.map(c=><div key={c.id} className="rounded-lg border border-border bg-card p-3 text-xs space-y-2">
   <div className="flex flex-wrap justify-between gap-1"><span>{new Date(c.criado_em).toLocaleString('pt-BR')}</span><strong>{c.status==='pendente'?'Aguardando conferência':c.status==='aprovado'?'Dados conferidos':c.status==='recusado'?'Resposta recusada':c.usado_em?'Recebido':c.revogado_em?'Revogado':new Date(c.expira_em)<=new Date()?'Expirado':'Aguardando cliente'}</strong></div>
   {c.status==='pendente'&&c.dados&&<div className="rounded-md bg-muted/50 p-3 grid gap-1 sm:grid-cols-2">{Object.entries(campos).map(([key,label])=><div key={key} className="break-all"><span className="text-muted-foreground">{label}: </span><strong>{key==='habilitado'?(c.dados?.habilitado==='sim'?'Sim':c.dados?.habilitado==='nao'?'Não':'—'):String(c.dados?.[key]||'—')}</strong></div>)}</div>}
   <div className="flex flex-wrap gap-2">{c.status==='pendente'&&<><button type="button" className={button} disabled={busy} onClick={()=>void acao(c.id,'aprovado')}>Conferir e aplicar</button><button type="button" className={button} disabled={busy} onClick={()=>void acao(c.id,'recusado')}>Recusar</button></>}
   {!c.usado_em&&!c.revogado_em&&<button type="button" className={button} disabled={busy} onClick={()=>void acao(c.id,'revogar')}>Revogar link</button>}</div>
  </div>)}</div>}
 </section>;
}
