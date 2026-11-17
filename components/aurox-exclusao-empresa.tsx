'use client';
import {useState} from 'react';
import {api} from '@/lib/api';
import {toast} from 'sonner';
type Props={empresa:{id:number;nome:string;slug?:string|null;ativo:boolean};onDeleted:()=>void};
export function AuroxExclusaoEmpresa({empresa,onDeleted}:Props){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[preview,setPreview]=useState<Record<string,number>|null>(null);
 const [slug,setSlug]=useState(''),[senha,setSenha]=useState(''),[confirmar,setConfirmar]=useState('');
 const protectedCompany=empresa.slug==='aurox-plataforma';
 async function verificar(){setOpen(true);setPreview(null);try{const {data}=await api.get(`/aurox/empresas/${empresa.id}/exclusao`);setPreview(data.contagens||{})}catch(e:any){toast.error(e?.response?.data?.error||'Falha na conferência')}}
 async function excluir(){if(!preview||empresa.ativo||slug!==empresa.slug||confirmar!=='EXCLUIR'||!senha)return;
  setBusy(true);try{const {data}=await api.delete(`/aurox/empresas/${empresa.id}/exclusao`,{data:{slug,senha,confirmar}});
  if(data?.ok){toast.success('Exclusão relacional concluída. Verifique os arquivos de Storage.');setOpen(false);onDeleted()}}
  catch(e:any){toast.error(e?.response?.data?.error||'Exclusão cancelada; verifique dependências.')}
  finally{setBusy(false);setSenha('')}
 }
 if(protectedCompany)return null;
 return <div className="ax-delete-company"><button type="button" className="ax-delete-launch" onClick={()=>void verificar()}>Excluir empresa definitivamente</button>
 {open&&<div className="ax-delete-modal"><h3>Excluir {empresa.nome}?</h3><p>Operação irreversível. Os registros relacionais da empresa, inclusive leads e usuários, serão excluídos se todas as dependências permitirem. Mídias e arquivos externos exigem verificação separada.</p>
 {empresa.ativo&&<p className="ax-delete-warning">Primeiro desative a empresa usando o controle de contrato acima.</p>}
 {preview&&<details open><summary>Prévia das tabelas afetadas</summary><div className="ax-delete-counts">{Object.entries(preview).map(([t,n])=><span key={t}>{t}: <b>{n}</b></span>)}</div></details>}
 <label>Digite o identificador exato <code>{empresa.slug}</code><input value={slug} onChange={e=>setSlug(e.target.value)} autoComplete="off"/></label>
 <label>Digite EXCLUIR<input value={confirmar} onChange={e=>setConfirmar(e.target.value)} autoComplete="off"/></label>
 <label>Senha do superadmin<input type="password" autoComplete="current-password" value={senha} onChange={e=>setSenha(e.target.value)}/></label>
 <div><button type="button" onClick={()=>{setOpen(false);setSenha('')}}>Cancelar</button><button type="button" className="ax-delete-execute" disabled={busy||empresa.ativo||!preview||slug!==empresa.slug||confirmar!=='EXCLUIR'||!senha} onClick={()=>void excluir()}>{busy?'Excluindo…':'Confirmar exclusão irreversível'}</button></div></div>}</div>;
}
