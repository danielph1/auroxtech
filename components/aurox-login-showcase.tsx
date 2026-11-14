import { ArrowDownRight, ArrowRight, BadgeCheck, CarFront, CheckCheck, CircleDot, Clock3, LayoutDashboard, MessageCircleMore, ShieldCheck, Sparkles, TrendingUp, Wallet, Wrench } from 'lucide-react';

function MicroHeader({number,eyebrow,title,description}:{number:string;eyebrow:string;title:string;description:string}){
 return <div className="aurox-story-head"><span className="aurox-story-index">{number} / AUROX</span><span className="aurox-story-eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>;
}

export function AuroxLoginShowcase(){
 return <div className="aurox-story-sections" aria-label="Conheça o Aurox">
  <section className="aurox-story-section">
   <MicroHeader number="01" eyebrow="Atendimento conectado" title="Nenhum contato fica solto." description="Triagem, carteira do vendedor, conversa e retorno no mesmo fluxo. Menos troca de tela, mais clareza em cada atendimento."/>
   <div className="aurox-micro-card aurox-funnel-preview" aria-label="Ilustração do fluxo de atendimento">
    <div className="aurox-micro-title"><div className="aurox-micro-icon violet"><MessageCircleMore size={17}/></div><div><strong>Jornada comercial</strong><span>Da primeira mensagem ao próximo passo</span></div><span className="aurox-demo-tag">Prévia</span></div>
    <div className="aurox-funnel-steps">
     <div className="aurox-funnel-step"><span className="aurox-step-dot cold"><CircleDot size={14}/></span><strong>Novo contato</strong><small>Triagem</small></div>
     <ArrowRight className="aurox-step-arrow" size={16}/>
     <div className="aurox-funnel-step"><span className="aurox-step-dot warm"><Clock3 size={14}/></span><strong>Em conversa</strong><small>Responsável</small></div>
     <ArrowRight className="aurox-step-arrow" size={16}/>
     <div className="aurox-funnel-step"><span className="aurox-step-dot success"><CheckCheck size={14}/></span><strong>Próximo passo</strong><small>Venda ou retorno</small></div>
    </div>
    <div className="aurox-micro-note"><span className="aurox-micro-live"/><span>Atendimento, ficha e Follow Up conectados</span><BadgeCheck size={15}/></div>
   </div>
  </section>
  <section className="aurox-story-section">
   <MicroHeader number="02" eyebrow="Gestão de veículos" title="Do pátio ao anúncio. Sem perder o contexto." description="Acompanhe disponibilidade, preparação e localização do veículo com uma visão que acompanha a rotina da loja."/>
   <div className="aurox-micro-card aurox-stock-preview" aria-label="Ilustração de estados de veículos">
    <div className="aurox-micro-title"><div className="aurox-micro-icon teal"><CarFront size={18}/></div><div><strong>Operação de estoque</strong><span>Veículos e etapas</span></div><span className="aurox-demo-tag">Prévia</span></div>
    <div className="aurox-stock-line"><span className="aurox-stock-symbol"><CarFront size={20}/></span><span><strong>Pronto para venda</strong><small>Estoque · disponível</small></span><span className="aurox-small-pill teal">Disponível</span></div>
    <div className="aurox-stock-line"><span className="aurox-stock-symbol"><Wrench size={19}/></span><span><strong>Em preparação</strong><small>Oficina · acompanhamento</small></span><span className="aurox-small-pill amber">Preparação</span></div>
    <div className="aurox-stock-line"><span className="aurox-stock-symbol"><ShieldCheck size={18}/></span><span><strong>Negociação ativa</strong><small>Disponibilidade acompanhada</small></span><span className="aurox-small-pill violet">Reservado</span></div>
    <div className="aurox-stock-footer"><Sparkles size={14}/><span>Uma visão para estoque, oficina e anúncios</span></div>
   </div>
  </section>
  <section className="aurox-story-section">
   <MicroHeader number="03" eyebrow="Visão de resultados" title="O número importa. A origem também." description="Aurox diferencia venda documentada de dinheiro recebido, além de conectar o resultado ao atendimento e à operação."/>
   <div className="aurox-micro-card aurox-results-preview" aria-label="Ilustração de indicadores comerciais">
    <div className="aurox-micro-title"><div className="aurox-micro-icon violet"><LayoutDashboard size={17}/></div><div><strong>Panorama comercial</strong><span>Indicadores organizados por tipo</span></div><span className="aurox-demo-tag">Prévia</span></div>
    <div className="aurox-result-cards"><div><TrendingUp size={17}/><span>Funil comercial</span><strong>Conversão</strong><small>Das etapas ao fechamento</small></div><div><Wallet size={17}/><span>Financeiro</span><strong>Recebimentos</strong><small>Somente valores confirmados</small></div></div>
    <div className="aurox-visual-bars" aria-hidden="true"><span style={{height:'29%'}}/><span style={{height:'48%'}}/><span style={{height:'39%'}}/><span style={{height:'69%'}}/><span style={{height:'56%'}}/><span style={{height:'82%'}}/><span style={{height:'71%'}}/><span style={{height:'91%'}}/></div>
    <div className="aurox-results-footer"><span><span className="aurox-chart-dot"/> Leitura de tendência</span><span>Dados do CRM <ArrowDownRight size={13}/></span></div>
   </div>
  </section>
  <footer className="aurox-story-footer"><span>© {new Date().getFullYear()} Aurox · Plataforma de gestão</span><span>Mais clareza em cada etapa.</span></footer>
 </div>;
}
