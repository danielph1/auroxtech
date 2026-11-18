'use client';
import {useQuery} from '@tanstack/react-query';
import {useAuth} from '@/contexts/auth-context';
import {api} from '@/lib/api';
import {permiteModuloNaRota,regraModuloDaRota} from '@/lib/aurox-modulos-acesso';

export function useAuroxModulos(){
 const {user}=useAuth();
 const superadmin=String(user?.tipo||'').toLowerCase()==='superadmin';
 const consulta=useQuery<{modulos:string[]} >({
  queryKey:['aurox-modulos',user?.id,user?.empresa_id],
  queryFn:async()=> (await api.get('/aurox/meus-modulos')).data,
  enabled:!!user?.id&&!superadmin,
  staleTime:15_000,refetchOnWindowFocus:true,refetchInterval:30_000,refetchOnMount:'always',
  retry:1,
 });
 const modulos=Array.isArray(consulta.data?.modulos)?consulta.data.modulos:[];
 return {
  modulos,
  carregando:!superadmin && !!user?.id && consulta.isPending,
  erro:consulta.isError,
  pode:(caminho:string)=>superadmin||permiteModuloNaRota(modulos,caminho),
  exige:(caminho:string)=>regraModuloDaRota(caminho)!==null,
 };
}
