import {NextRequest,NextResponse} from 'next/server';
import {query,queryOne} from '@/lib/db';
import {requireUser} from '@/lib/session';
import {temaSchema,parseLogo,TEMA_PADRAO} from '@/lib/aurox-ficha-portal';
import {normalizarConteudosBanner} from '@/lib/ficha-portal-tema';
export const runtime='nodejs';export const dynamic='force-dynamic';
const roles=new Set(['admin','gerente','marketing','superadmin']);
const respond=(data:object,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
async function contexto(req:NextRequest,body?:any){
 const u=await requireUser(req);
 if(!u||!roles.has(u.tipo))return null;
 const empresaId=u.tipo==='superadmin'?Number(body?.empresa_id||req.nextUrl.searchParams.get('empresa_id')):Number(u.empresa_id);
 if(!Number.isSafeInteger(empresaId)||empresaId<=0)return null;
 if(u.tipo!=='superadmin'&&empresaId!==Number(u.empresa_id))return null;
 // Gerente edita somente a identidade visual da propria loja.
 const loja=u.tipo==='gerente'?String(u.loja||'').trim():String(body?.loja||req.nextUrl.searchParams.get('loja')||'').trim();
 if(loja.length>30||!/^[\w-]{0,30}$/.test(loja))return null;
 if(u.tipo==='gerente'&&!loja)return null;
 if(u.tipo==='gerente'&&loja!==String(u.loja||'').trim())return null;
 if(loja){const belongs=await queryOne(`SELECT 1 FROM public.lojas WHERE empresa_id=$1 AND UPPER(codigo)=UPPER($2)`,[empresaId,loja]);if(!belongs)return null;}
 const active=await queryOne(`SELECT 1 FROM public.empresas WHERE id=$1 AND ativo=TRUE`,[empresaId]);if(!active)return null;
 return {u,empresaId,loja};
}
export async function GET(req:NextRequest){
 try{const s=await contexto(req);if(!s)return respond({error:'Sem acesso'},403);
 const theme=await queryOne(`SELECT titulo,mensagem,cor_primaria,cor_fundo,cor_texto,logo_data_uri,campanha,modo_banner,banners,veiculo_obrigatorio,banner_conteudos FROM public.aurox_ficha_portal_temas WHERE empresa_id=$1 AND loja=$2`,[s.empresaId,s.loja]);
 const empresa=await queryOne<{nome:string}>(`SELECT nome FROM public.empresas WHERE id=$1`,[s.empresaId]);
 return respond({tema:{...TEMA_PADRAO,...theme,banner_conteudos:normalizarConteudosBanner((theme as any)?.banner_conteudos),empresa_nome:empresa?.nome||'Concessionária'},empresa_id:s.empresaId,loja:s.loja});
 }catch{return respond({error:'Nao foi possivel consultar tema'},503)}
}
export async function PUT(req:NextRequest){
 const b=await req.json().catch(()=>null);
 try{const s=await contexto(req,b);if(!s)return respond({error:'Sem permissao para alterar esta loja'},403);
 const parsed=temaSchema.safeParse(b?.tema);if(!parsed.success)return respond({error:'Cores, logo ou texto invalidos'},400);
 const {empresa_nome:_ignored,...safe}=parsed.data;const theme={...safe,logo_data_uri:await parseLogo(parsed.data.logo_data_uri)};
 await query(`INSERT INTO public.aurox_ficha_portal_temas
 (empresa_id,loja,titulo,mensagem,cor_primaria,cor_fundo,cor_texto,logo_data_uri,atualizado_por,campanha,modo_banner,banners,veiculo_obrigatorio,banner_conteudos)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
 ON CONFLICT(empresa_id,loja) DO UPDATE SET titulo=EXCLUDED.titulo,mensagem=EXCLUDED.mensagem,
 cor_primaria=EXCLUDED.cor_primaria,cor_fundo=EXCLUDED.cor_fundo,cor_texto=EXCLUDED.cor_texto,
 logo_data_uri=EXCLUDED.logo_data_uri,campanha=EXCLUDED.campanha,modo_banner=EXCLUDED.modo_banner,banners=EXCLUDED.banners,veiculo_obrigatorio=EXCLUDED.veiculo_obrigatorio,banner_conteudos=EXCLUDED.banner_conteudos,atualizado_por=EXCLUDED.atualizado_por,atualizado_em=now()`,
 [s.empresaId,s.loja,theme.titulo,theme.mensagem,theme.cor_primaria,theme.cor_fundo,theme.cor_texto,theme.logo_data_uri,s.u.id,theme.campanha,theme.modo_banner,theme.banners,theme.veiculo_obrigatorio,JSON.stringify(theme.banner_conteudos)]);
 return respond({ok:true});
 }catch{return respond({error:'Nao foi possivel salvar tema'},503)}
}
