/** Verificações estruturais sem banco. Confirma contrato de segurança; não substitui teste de integração real. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
test('pedido comercial escolhe empresa somente no servidor',()=>{
 const api=file('app/api/comercial/solicitar/route.ts');
 assert.match(api,/process\.env\.AUROX_COMERCIAL_EMPRESA_ID/);
 assert.doesNotMatch(api,/b\.empresa_id|b\.empresaId/);
 assert.match(api,/INSERT INTO public\.triagem/);
 assert.match(api,/getPool\(\)\.connect\(\)/);
 assert.match(api,/cotarAurox\(modulos,numeros\)/);
});
test('telefone, consentimento e limite de requisições são obrigatórios',()=>{
 const api=file('app/api/comercial/solicitar/route.ts');
 assert.match(api,/telefone\.length<10/);
 assert.match(api,/consentimento=b\.consentimento===true/);
 assert.match(api,/Muitas solicitações/);
 assert.match(api,/last|15 minutes/);
});
test('preços não fazem requests ao banco no carregamento público',()=>{
 const page=file('app/login/page.tsx');
 const prices=file('lib/aurox-precos-publicos.ts');
 assert.doesNotMatch(prices,/@\/lib\/db|DATABASE_URL|fetch\(/);
 assert.match(page,/AuroxSolicitarImplantacao/);
 assert.match(page,/Solicitar implantação/);
});
test('cadastro administrativo exige telefone',()=>{
 const route=file('app/api/aurox/empresas/route.ts');
 assert.match(route,/telefone\.length<10/);
 assert.match(route,/INSERT INTO public\.empresas\(nome,slug,telefone/);
 assert.match(route,/pg_advisory_xact_lock/);
});
