'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {ShieldCheck,LockKeyhole,CheckCircle2} from 'lucide-react';
import {TEMA_PADRAO} from '@/lib/ficha-portal-tema';
import {FichaPortalBanner} from '@/components/ficha-portal-banner';

type Tema=typeof TEMA_PADRAO;
const inputs:ReadonlyArray<[string,string,string,boolean]>=[
 ['nome_completo','Nome completo','text',true],['telefone','Telefone (WhatsApp)','tel',true],['cpf','CPF','text',true],['data_nascimento','Data de nascimento','date',true],
 ['carro_interesse','Veículo de interesse','text',false],['valor_entrada','Valor de entrada (R$)','text',true],
 ['rg','RG','text',false],['nome_mae','Nome da mãe','text',false],['email','E-mail','email',false],
 ['cep','CEP','text',false],['endereco','Endereço','text',false],['bairro','Bairro','text',false],
 ['cidade','Cidade','text',false],['estado','UF (sigla)','text',false],['salario','Renda mensal declarada (R$)','text',false],
];
const input='mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500';
export default function FichaClientePublica(){
 const [token,setToken]=useState(''),[tema,setTema]=useState<Tema>(TEMA_PADRAO),[estado,setEstado]=useState<'carregando'|'pronto'|'concluido'|'erro'>('carregando');
 const [erro,setErro]=useState(''),[aviso,setAviso]=useState(''),[busy,setBusy]=useState(false),[codigo,setCodigo]=useState(''),[consentimento,setConsentimento]=useState(false);
 const [form,setForm]=useState<Record<string,string>>({nome_completo:'',telefone:'',cpf:'',data_nascimento:'',carro_interesse:'',valor_entrada:'',habilitado:'',rg:'',nome_mae:'',email:'',cep:'',endereco:'',bairro:'',cidade:'',estado:'',salario:''});
 async function req(payload:object){const r=await fetch('/api/public/ficha-cliente',{method:'POST',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Não foi possível concluir');return d;}
 useEffect(()=>{const t=window.location.hash.slice(1);window.history.replaceState(null,'',window.location.pathname);
  if(!/^[a-zA-Z0-9_-]{43}$/.test(t)){setEstado('erro');setErro('Este link não está disponível. Solicite um novo ao vendedor.');return;}
  setToken(t);void req({acao:'consultar',token:t}).then(d=>{setTema(d.tema||TEMA_PADRAO);setEstado('pronto')}).catch(e=>{setEstado('erro');setErro(e.message)});
 },[]);
 async function pedirCodigo(){setBusy(true);setAviso('');try{const d=await req({acao:'codigo',token});setAviso(d.message)}catch(e:any){setAviso(e.message)}finally{setBusy(false)}}
 async function enviar(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setAviso('');
  try{await req({acao:'enviar',token,codigo,dados:{...form,estado:form.estado.toUpperCase(),consentimento}});setToken('');setCodigo('');setEstado('concluido')}
  catch(e:any){setAviso(e.message)}finally{setBusy(false)}}
 const mainStyle={backgroundColor:tema.cor_fundo,color:tema.cor_texto};
 return <main className="min-h-screen px-3 py-8 sm:py-14" style={mainStyle}>
  <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
   <FichaPortalBanner tema={tema}/>
   <header className="p-6 sm:p-9 text-white" style={{backgroundColor:tema.cor_primaria}}>
    {tema.logo_data_uri&&<img src={tema.logo_data_uri} alt="Logo da concessionária" className="mb-4 max-h-16 max-w-52 object-contain"/>}
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={19}/> Atendimento seguro · {tema.empresa_nome||"Concessionária"}</div>
    <h1 className="text-2xl font-bold sm:text-3xl">{tema.titulo}</h1><p className="mt-2 text-sm opacity-90">{tema.mensagem}</p>
   </header>
   <section className="space-y-5 p-6 text-slate-900 sm:p-9">
    {estado==='carregando'&&<p>Verificando validade do convite...</p>}
    {estado==='erro'&&<p className="rounded-xl bg-red-50 p-5 text-sm text-red-700" role="alert">{erro}</p>}
    {estado==='concluido'&&<div className="space-y-2 rounded-xl bg-emerald-50 p-6 text-emerald-900" role="status"><CheckCircle2 size={30}/><h2 className="text-xl font-semibold">Dados recebidos!</h2><p>Seu link foi encerrado. O vendedor responsável fará a conferência das informações.</p></div>}
    {estado==='pronto'&&<form className="space-y-5" onSubmit={enviar} autoComplete="on">
     <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"><LockKeyhole size={18} className="mb-2"/><strong>Link de uso único</strong><p className="mt-1 text-slate-600">Seu cadastro é enviado somente à concessionária responsável. Não informe senhas bancárias e nunca envie códigos recebidos para terceiros.</p></div>
     <div className="grid gap-4 sm:grid-cols-2">{inputs.map(([key,label,type,required])=>{const obrigatorio=key==='carro_interesse'?tema.veiculo_obrigatorio!==false:required;return <label key={key} className="text-sm font-medium">{label}{obrigatorio?' *':' (opcional)'}
       <input name={key} type={type} className={input} required={obrigatorio} maxLength={key==='nome_completo'?150:key==='email'?200:key==='carro_interesse'?150:key==='telefone'?24:key==='valor_entrada'?15:key==='endereco'?220:120} value={form[key]||''} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))}/>
      </label>})}</div>
     <fieldset className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <legend className="px-1 text-sm font-semibold">Habilitado — possui CNH? *</legend>
      <div className="mt-2 flex flex-wrap gap-5">
       {([['sim','Sim'],['nao','Não']] as const).map(([valor,rotulo])=><label key={valor} className="flex items-center gap-2 text-sm"><input type="radio" name="habilitado" value={valor} required checked={form.habilitado===valor} onChange={()=>setForm(v=>({...v,habilitado:valor}))}/>{rotulo}</label>)}
      </div>
     </fieldset>
     <div className="rounded-xl border border-slate-200 p-4 space-y-3"><h2 className="font-semibold">Confirmar telefone cadastrado</h2>
      <p className="text-sm text-slate-600">Enviaremos um código ao WhatsApp registrado no lead. O telefone preenchido acima precisa ser o mesmo número.</p>
      <button type="button" disabled={busy} onClick={()=>void pedirCodigo()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Enviar código pelo WhatsApp</button>
      <label className="block text-sm font-medium">Código de seis dígitos
       <input className={input+' tracking-widest'} placeholder="000000" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} required autoComplete="one-time-code" value={codigo} onChange={e=>setCodigo(e.target.value.replace(/\D/g,'').slice(0,6))}/></label>
     </div>
     <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" required checked={consentimento} onChange={e=>setConsentimento(e.target.checked)}/><span>Concordo em fornecer estes dados para análise cadastral e de crédito pela concessionária, conforme sua política de privacidade. Entendo que o envio não equivale à aprovação de financiamento.</span></label>
     {aviso&&<p role="status" className="rounded-lg bg-amber-50 p-3 text-sm">{aviso}</p>}
     <button disabled={busy||!consentimento} type="submit" className="w-full rounded-xl px-5 py-4 text-sm font-semibold text-white disabled:opacity-50" style={{backgroundColor:tema.cor_primaria}}>{busy?'Processando...':'Confirmar e enviar ficha'}</button>
    </form>}
   </section>
   <footer className="border-t border-slate-200 p-4 text-center text-xs text-slate-500">Atendimento da concessionária · Formulário temporário · Não compartilhe seu link</footer>
  </div>
 </main>;
}
