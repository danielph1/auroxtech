'use client';
import {useEffect,type ReactNode} from 'react';
import {X} from 'lucide-react';

/** Apresentação apenas: não substitui autorização/autenticação das APIs. */
export function AuroxModalBase({title,eyebrow,subtitle,children,onClose,footer,wide=false}:{
 title:string;eyebrow?:string;subtitle?:string;children:ReactNode;onClose:()=>void;footer?:ReactNode;wide?:boolean;
}){
 useEffect(()=>{
  const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};
  document.addEventListener('keydown',esc);
  return ()=>document.removeEventListener('keydown',esc);
 },[onClose]);
 return <div className="studio-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className={'studio-dialog'+(wide?' wide':'')} role="dialog" aria-modal="true" aria-label={title}>
   <header className="studio-dialog-head"><div>{eyebrow&&<span className="studio-eyebrow">{eyebrow}</span>}<h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>
    <button type="button" className="studio-icon" onClick={onClose} aria-label="Fechar janela"><X size={20}/></button></header>
   <div className="studio-dialog-body">{children}</div>
   {footer&&<footer className="studio-dialog-footer">{footer}</footer>}
  </section>
 </div>;
}
