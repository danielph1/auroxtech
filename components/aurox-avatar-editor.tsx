'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Camera,Check,Minus,Plus,RotateCcw,X} from 'lucide-react';
import './aurox-avatar-editor.css';

const VIEW=276;
export function AuroxAvatarEditor({fotoUrl,nome,onSave}:{fotoUrl?:string|null;nome?:string;onSave:(file:File)=>Promise<void>}){
 const input=useRef<HTMLInputElement>(null),original=useRef<HTMLImageElement|null>(null),url=useRef<string|null>(null),drag=useRef<{x:number;y:number;ox:number;oy:number}|null>(null);
 const [preview,setPreview]=useState(''),[dims,setDims]=useState({w:1,h:1}),[zoom,setZoom]=useState(1),[offset,setOffset]=useState({x:0,y:0}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const naturalScale=Math.max(VIEW/dims.w,VIEW/dims.h), dw=dims.w*naturalScale*zoom,dh=dims.h*naturalScale*zoom;
 const bounds=useMemo(()=>({x:Math.max(0,(dw-VIEW)/2),y:Math.max(0,(dh-VIEW)/2)}),[dw,dh]);
 const clamp=useCallback((x:number,y:number)=>({x:Math.max(-bounds.x,Math.min(bounds.x,x)),y:Math.max(-bounds.y,Math.min(bounds.y,y))}),[bounds]);
 useEffect(()=>()=>{if(url.current)URL.revokeObjectURL(url.current)},[]);
 function close(){setPreview('');setError('');original.current=null;drag.current=null;if(url.current){URL.revokeObjectURL(url.current);url.current=null}}
 function select(file?:File){if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('Use uma imagem JPG, PNG ou WebP.');return;}if(file.size>15*1024*1024){setError('A foto original deve ter até 15 MB.');return;}
  if(url.current)URL.revokeObjectURL(url.current);const src=URL.createObjectURL(file);url.current=src;const img=new Image();img.onload=()=>{original.current=img;setDims({w:img.naturalWidth,h:img.naturalHeight});setZoom(1);setOffset({x:0,y:0});setError('');setPreview(src)};img.onerror=()=>{URL.revokeObjectURL(src);url.current=null;setError('Não foi possível abrir a imagem.')};img.src=src;
 }
 async function save(){const img=original.current;if(!img||busy)return;setBusy(true);setError('');try{
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Editor de imagem indisponível');
  ctx.fillStyle='#f6f7fb';ctx.fillRect(0,0,512,512);
  const factor=512/VIEW;const safe=clamp(offset.x,offset.y);const dw0=img.naturalWidth*naturalScale*zoom*factor,dh0=img.naturalHeight*naturalScale*zoom*factor;
  ctx.drawImage(img,(512-dw0)/2+safe.x*factor,(512-dh0)/2+safe.y*factor,dw0,dh0);
  let final:Blob|null=null,mime='image/webp';
  for(const q of [0.83,0.74,0.64,0.54]){const b=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,mime,q));if(b){final=b;if(b.size<=180*1024)break;}}
  if(!final){mime='image/jpeg';final=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,mime,0.76))}
  if(!final||final.size>512*1024)throw Error('Não foi possível comprimir a imagem. Escolha outra foto.');
  await onSave(new File([final],`aurox-avatar.${mime==='image/webp'?'webp':'jpg'}`,{type:mime}));close();
 }catch(e){setError(e instanceof Error?e.message:'Erro ao salvar a foto')}finally{setBusy(false)}}
 return <>
  <button type="button" className="aurox-avatar-trigger" onClick={()=>input.current?.click()} aria-label="Selecionar e recortar foto de perfil">
   <span className="aurox-avatar-photo">{fotoUrl?<img src={fotoUrl} alt=""/>:(nome||'?').charAt(0).toUpperCase()}</span>
   <span className="aurox-avatar-camera"><Camera size={15}/></span>
  </button>
  <input ref={input} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{select(e.target.files?.[0]);e.target.value=''}}/>
  {!!preview&&<div className="aurox-avatar-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
   <section className="aurox-avatar-dialog" role="dialog" aria-modal="true" aria-labelledby="aurox-crop-title">
    <header><div><h2 id="aurox-crop-title">Ajustar foto de perfil</h2><p>Arraste para posicionar o rosto dentro do círculo.</p></div><button type="button" onClick={close} disabled={busy} aria-label="Fechar"><X size={18}/></button></header>
    <div className="aurox-avatar-stage" style={{width:VIEW,height:VIEW,touchAction:'none'}} onPointerDown={e=>{drag.current={x:e.clientX,y:e.clientY,ox:offset.x,oy:offset.y};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(drag.current){const d=drag.current;setOffset(clamp(d.ox+e.clientX-d.x,d.oy+e.clientY-d.y))}}} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}>
     <img alt="Prévia do recorte" src={preview} draggable={false} style={{position:'absolute',width:dw,height:dh,left:`calc(50% + ${offset.x}px)`,top:`calc(50% + ${offset.y}px)`,transform:'translate(-50%,-50%)',maxWidth:'none',pointerEvents:'none'}}/>
     <div className="aurox-avatar-mask" aria-hidden="true"/>
    </div>
    <div className="aurox-avatar-zoom"><button type="button" onClick={()=>setZoom(z=>Math.max(1,+(z-.1).toFixed(2)))} aria-label="Diminuir zoom"><Minus size={16}/></button><input aria-label="Zoom da foto" type="range" min="1" max="3" step="0.05" value={zoom} onChange={e=>{setZoom(Number(e.target.value));setOffset({x:0,y:0})}}/><button type="button" onClick={()=>{setZoom(z=>Math.min(3,+(z+.1).toFixed(2)));setOffset({x:0,y:0})}} aria-label="Ampliar zoom"><Plus size={16}/></button><button type="button" aria-label="Centralizar" onClick={()=>{setZoom(1);setOffset({x:0,y:0})}}><RotateCcw size={16}/></button></div>
    <p className="aurox-avatar-hint">A foto será convertida em imagem quadrada de 512 × 512 px, otimizada para o círculo do perfil.</p>
    {!!error&&<p className="aurox-avatar-error" role="alert">{error}</p>}
    <footer><button type="button" onClick={close} disabled={busy}>Cancelar</button><button type="button" onClick={()=>void save()} disabled={busy}><Check size={16}/>{busy?'Salvando…':'Usar esta foto'}</button></footer>
   </section>
  </div>}
 </>
}
