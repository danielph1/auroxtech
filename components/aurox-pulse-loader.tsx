import './aurox-pulse-loader.css';

type AuroxPulseProps = {compact?:boolean;inline?:boolean;label?:string;fullScreen?:boolean};
/** Três fluxos operacionais convergem para o símbolo A: animação vetorial sem imagens e sem JavaScript. */
export function AuroxPulseLoader({compact=false,inline=false,label='Organizando sua operação…',fullScreen=false}:AuroxPulseProps){
 const mark=<svg className="aurox-pulse-svg" viewBox="0 0 120 86" role="img" aria-label="Pulso Aurox" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="aurox-pulse-grad" x1="15" y1="0" x2="100" y2="80" gradientUnits="userSpaceOnUse"><stop stopColor="#6558E8"/><stop offset=".58" stopColor="#B393F0"/><stop offset="1" stopColor="#65D0C9"/></linearGradient></defs>
  <path className="aurox-pulse-rail" d="M8 21H32L49 39"/><path className="aurox-pulse-rail delay" d="M8 44H33L47 45"/><path className="aurox-pulse-rail delay-two" d="M8 67H32L49 48"/>
  <path className="aurox-pulse-mark" d="M46 66L61 20L76 66M52 49H70" stroke="url(#aurox-pulse-grad)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
  <path className="aurox-pulse-outflow" d="M83 45H110" stroke="url(#aurox-pulse-grad)" strokeWidth="2.4" strokeLinecap="round"/>
  <circle className="aurox-pulse-dot one" r="3" fill="#B393F0"><animateMotion dur="1.75s" repeatCount="indefinite" path="M8 21H32L49 39"/></circle>
  <circle className="aurox-pulse-dot two" r="3" fill="#65D0C9"><animateMotion dur="1.75s" begin=".3s" repeatCount="indefinite" path="M8 44H33L47 45"/></circle>
  <circle className="aurox-pulse-dot three" r="3" fill="#B393F0"><animateMotion dur="1.75s" begin=".6s" repeatCount="indefinite" path="M8 67H32L49 48"/></circle>
 </svg>;
 if(inline)return <span className="aurox-pulse-inline" aria-hidden="true">{mark}</span>;
 return <div className={'aurox-pulse-container'+(compact?' is-compact':'')+(fullScreen?' is-fullscreen':'')} role="status" aria-live="polite">
  <div className="aurox-pulse-glow">{mark}</div><span className="aurox-pulse-wordmark">AUROX</span><span className="aurox-pulse-caption">{label}</span>
 </div>;
}
