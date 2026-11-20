/* Testes das primitivas reais, isolando SOMENTE zod e sharp (sem acesso a banco/WhatsApp). */
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');
process.env.AUROX_FICHA_PORTAL_SECRET='a'.repeat(64);
const file=path.resolve(__dirname,'../lib/aurox-ficha-portal.ts');
const source=fs.readFileSync(file,'utf8');
const compiled=ts.transpileModule(source,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const chain=new Proxy(()=>chain,{get:(_t,k)=>k==='strict'?()=>chain:()=>chain});
const mockZ={z:new Proxy({}, {get:()=>()=>chain})};
const mod={exports:{}};
const req=(id)=>id==='server-only'?{}:id==='zod'?mockZ:id==='sharp'?(()=>{}):require(id);
new Function('require','module','exports',compiled)(req,mod,mod.exports);
const lib=mod.exports;
test('token URL-safe e hash sem segredo puro',()=>{
 const a=lib.novoToken(),b=lib.novoToken();assert.match(a,/^[a-zA-Z0-9_-]{43}$/);assert.notEqual(a,b);
 assert.equal(lib.tokenValido(a),true);assert.equal(lib.tokenValido('123'),false);
 assert.match(lib.hashToken(a),/^[0-9a-f]{64}$/);assert.notEqual(lib.hashToken(a),a);
});
test('OTP vinculado ao convite, formato 6 digitos e timing-safe',()=>{
 const otp=lib.novoCodigo();assert.match(otp,/^[0-9]{6}$/);const h1=lib.hashToken(lib.novoToken()),h2=lib.hashToken(lib.novoToken());
 const mac=lib.hashCodigo(h1,otp);assert.equal(lib.verificaCodigo(h1,otp,mac),true);
 assert.equal(lib.verificaCodigo(h2,otp,mac),false);assert.equal(lib.verificaCodigo(h1,'111111',mac),otp==='111111');
});
test('dados cifrados nao contem CPF e nao aceitam adulteracao',()=>{
 const d={cpf:'52998224725',nome:'Cliente de teste'};
 const enc=lib.cifrarDados(d);assert(!enc.includes(d.cpf));assert.deepEqual(lib.decifrarDados(enc),d);
 const ix=enc.lastIndexOf('.')+2;const flipped=enc[ix]==='A'?'B':'A';assert.throws(()=>lib.decifrarDados(enc.slice(0,ix)+flipped+enc.slice(ix+1)));
});
test('CPF valido e invalido',()=>{
 assert.equal(lib.cpfValido('52998224725'),true);
 assert.equal(lib.cpfValido('11111111111'),false);
 assert.equal(lib.cpfValido('52998224726'),false);
});
test('origem publica e HTTPS fixa',()=>{
 const token=lib.novoToken();const url=lib.urlPublicaFicha(token);
 assert.match(url,/^https:\/\/auroxtech\.vercel\.app\/ficha-cliente#/);
 assert.equal(url.endsWith('#'+token),true);
});
