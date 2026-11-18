'use client';
import {useEffect,useMemo,useState} from 'react';
import {api} from '@/lib/api';
import {toast} from 'sonner';
import {AUROX_MODULOS_PUBLICOS,cotarAurox,reais} from '@/lib/aurox-precos-publicos';
type Props={empresaId:number;modulos:string[];onSaved:()=>void};
export function AuroxModulosEmpresa({empresaId,modulos,onSaved}:Props){
 const [ids,setIds]=useState<string[]>(modulos||[]);const [saving,setSaving]=useState(false);
 useEffect(()=>{setIds(modulos||[])},[empresaId,JSON.stringify(modulos)]);
 const cotacao=useMemo(()=>cotarAurox(ids),[ids]);
 const toggle=(id:string)=>setIds(xs=>xs.includes(id)?xs.filter(x=>x!==id):[...xs,id]);
 async function salvar(){setSaving(true);try{await api.put(`/aurox/empresas/${empresaId}/modulos`,{modulos:ids});toast.success('Módulos do contrato atualizados');onSaved()}catch(e:any){toast.error(e?.response?.data?.error||'Falha ao salvar módulos')}finally{setSaving(false)}}
 return <section className="ax-admin-modules" aria-label="Serviços contratados"><header><div><h3>Serviços da concessionária</h3><p>Selecione o pacote contratado. Valores mensais estimados.</p></div><strong>{reais(cotacao.normalCentavos)}/mês</strong></header>
 <div className="ax-admin-module-grid">{AUROX_MODULOS_PUBLICOS.map(m=><label key={m.id}><input type="checkbox" checked={ids.includes(m.id)} onChange={()=>toggle(m.id)}/><span><b>{m.nome}</b><small>{reais(m.centavos)}/mês</small></span></label>)}</div>
 <div className="ax-admin-module-bottom"><small>Base R$ 149,00 incluída. {cotacao.elegivelPromocao?`1º mês estimado: ${reais(cotacao.primeiroMesCentavos)}`:'Promoção para pacotes acima de R$ 500'}. Alterações financeiras exigem confirmação contratual.</small><button type="button" onClick={()=>void salvar()} disabled={saving}>{saving?'Salvando…':'Salvar serviços'}</button></div></section>
}
