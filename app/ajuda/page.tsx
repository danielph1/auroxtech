import Link from 'next/link';
export const metadata = {title:'Ajuda — Aurox'};
const perguntas = [
  ['Como acessar o AUROX?', 'Solicite à sua empresa as credenciais e as permissões de acesso.'],
  ['Como funciona o suporte?', 'Usuários autenticados podem abrir chamados dentro do AUROX. Os chamados ficam restritos à empresa autorizada e ao suporte central.'],
  ['Como tratar uma solicitação sobre dados pessoais?', 'Consulte a Política de Privacidade e os canais oficiais indicados pela empresa responsável.'],
];
export default function AjudaPublica(){return <main className="mx-auto max-w-3xl px-5 py-14 space-y-7"><header className="space-y-3"><p className="text-cyan-500 text-sm font-semibold">AUROX · INFORMAÇÕES PÚBLICAS</p><h1 className="text-4xl font-bold">Ajuda e suporte</h1><p className="text-muted-foreground">Informações gerais para visitantes. Abertura e consulta de chamados exigem acesso autorizado.</p></header><section className="space-y-3">{perguntas.map(([q,a])=><article key={q} className="rounded-xl border border-border bg-card p-5"><h2 className="font-semibold">{q}</h2><p className="mt-2 text-muted-foreground text-sm">{a}</p></article>)}</section><nav className="flex gap-5 flex-wrap text-cyan-500"><Link href="/login">Entrar e abrir chamado</Link><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos de uso</Link></nav></main>}
