'use client';
import {useState} from 'react';
import {useAuth} from '@/contexts/auth-context';
import {api} from '@/lib/api';
import {toast} from 'sonner';
import {FichaPortalAcoes} from '@/components/ficha-portal-acoes';
import {Send,ChevronDown,ChevronUp} from 'lucide-react';
const roles=['vendedor','gerente','admin','superadmin'];
export function LeadPortalAcoes({leadId}:{leadId:number}){
 const {user}=useAuth(),role=String(user?.tipo||'').toLowerCase();
 const [fichaId,setFichaId]=useState<number|null>(null),[loading,setLoading]=useState(false),[opened,setOpened]=useState(false);
 if(!roles.includes(role))return null;
 async function toggle(){if(opened){setOpened(false);return;}setLoading(true);try{
  const result=await api.post(`/fichas/por-lead/${leadId}`);
  const id=Number(result.data?.ficha_id);if(!Number.isSafeInteger(id)||id<=0)throw Error('Ficha indisponível');
  setFichaId(id);setOpened(true);if(result.data?.criada)toast.success('Ficha vinculada ao vendedor responsável.');
 }catch(e:any){toast.error(e?.response?.data?.error||'Não foi possível preparar a ficha do cliente')}finally{setLoading(false)}}
 return <section className="space-y-3 rounded-xl border border-teal-500/25 p-3">
  <button type="button" disabled={loading} onClick={()=>void toggle()} className="flex w-full items-center justify-between rounded-lg bg-teal-700 px-4 py-3 text-left text-sm font-semibold text-white disabled:opacity-60">
   <span className="flex items-center gap-2"><Send size={16}/>{loading?'Preparando...':'Enviar ficha ao cliente'}</span>{opened?<ChevronUp size={17}/>:<ChevronDown size={17}/>}
  </button>
  {opened&&fichaId&&<FichaPortalAcoes fichaId={fichaId}/>}
  <p className="text-xs text-muted-foreground">Link/QR de uso único, 30 minutos. Até 3 clientes ativos por vendedor.</p>
 </section>
}
