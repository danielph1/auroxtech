/** Checagens estruturais sem banco: NÃO substituem teste integrado no Supabase. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const file=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
test('pedido comercial vai exclusivamente para a empresa interna AUROX',()=>{
 const api=file('app/api/comercial/solicitar/route.ts');
 assert.match(api,/slug='aurox-plataforma'/);
 assert.doesNotMatch(api,/b\.empresa_id|b\.empresaId/);
 assert.match(api,/INSERT INTO public\.triagem/);
 assert.match(api,/getPool\(\)\.connect\(\)/);
 assert.match(api,/cotarAurox\(modulos\)/);
});
test('telefone, consentimento e limite de requisições obrigatórios',()=>{
 const api=file('app/api/comercial/solicitar/route.ts');
 assert.match(api,/telefone\.length<10/);
 assert.match(api,/consentimento=b\.consentimento===true/);
 assert.match(api,/Muitas solicitações/);
 assert.match(api,/15 minutes/);
});
test('não oferece mais de um WhatsApp na página pública',()=>{
 const page=file('app/login/page.tsx');const api=file('app/api/comercial/solicitar/route.ts');
 assert.doesNotMatch(page,/numerosWhatsApp/);
 assert.match(api,/b\.numerosWhatsApp !== undefined && b\.numerosWhatsApp !== 1/);
});
test('preços não consultam Supabase para exibir a simulação',()=>{
 const page=file('app/login/page.tsx'),prices=file('lib/aurox-precos-publicos.ts');
 assert.doesNotMatch(prices,/@\/lib\/db|DATABASE_URL|fetch\(/);
 assert.match(page,/AuroxSolicitarImplantacao/);
 assert.match(page,/Solicitar implantação/);
});
test('somente superadmin pode atender solicitações',()=>{
 const api=file('app/api/aurox/comercial/solicitacoes/route.ts');
 assert.match(api,/isSuperAdmin\(user\)/);
});
