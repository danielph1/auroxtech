import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const f=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('login sem seletor adicional e sem etiquetas comerciais',()=>{
 const s=f('app/login/page.tsx');
 assert.ok(!s.includes('ax-market-state ${m.estado}'));
 assert.ok(!s.includes('Números de WhatsApp (simulação)'));
});
test('aprovação exige senha do superadmin no servidor',()=>{
 const a=f('app/api/aurox/comercial/aprovar/route.ts');
 assert.match(a,/verifyPassword\(senha,admin\.senha_hash\)/);
 assert.match(a,/e\.slug='aurox-plataforma'/);
 assert.match(a,/status='aprovado'/);
});
test('novos contratos são calculados pelo servidor',()=>{
 const a=f('app/api/aurox/empresas/route.ts');
 assert.match(a,/cotarAurox\(modulos\)/);
 assert.match(a,/aurox_contrato_servicos/);
});
test('exclusão protegida e atômica',()=>{
 const a=f('app/api/aurox/empresas/[id]/exclusao/route.ts');
 assert.match(a,/verifyPassword\(senha,admin\.senha_hash\)/);
 assert.match(a,/slug==='aurox-plataforma'/);
 assert.match(a,/await db\.query\('ROLLBACK'\)/);
 const m=f('supabase/migrations/202611170007_aurox_exclusao_controlada.sql');
 assert.match(m,/Desative a empresa/);assert.match(m,/REVOKE ALL ON FUNCTION/);
});
