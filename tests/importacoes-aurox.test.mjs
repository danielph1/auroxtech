import test from 'node:test';
import assert from 'node:assert/strict';
import {csvParaLinhas,processarLeads,processarVeiculos,extrairPlacas,normalizarTelefone,normalizarPreco,detectarMapeamento} from '../lib/aurox-importacao-core.ts';

test('leads: exige só nome e telefone, ignora linhas sem ambos',()=>{
 const lines=csvParaLinhas('Nome;Telefone;Observação\nAna;21 99999-1234;Ligou hoje\nCarlos;;Sem telefone\n;21912345678;Sem nome\nBruno;(11) 97777-4321;\n');
 const {validos,rejeitados}=processarLeads(lines);
 assert.equal(validos.length,2);assert.equal(rejeitados.length,2);
 assert.equal(validos[0].nome,'Ana');assert.equal(validos[0].telefone,'21999991234');
 assert.equal(validos[1].interesse,'');
});
test('leads: aceita 55 e não duplica telefone dentro do arquivo',()=>{
 const {validos,rejeitados}=processarLeads(csvParaLinhas('cliente,whatsapp\nMaria,+55 (21) 99999-0000\nMaria B,21999990000\n'));
 assert.equal(validos.length,1);assert.match(rejeitados[0].motivo,/repetido/);
});
test('csv: separadores e aspas, vírgulas dentro de texto, quebras',()=>{
 const data=csvParaLinhas('"Nome","Celular","Obs"\n"Marcos","(21) 99999-2222","Quer carro, azul"\n');
 assert.equal(data[1][2],'Quer carro, azul');
 const semicolon=csvParaLinhas('Nome;Telefone;Mensagem\nJoão;21999995555;"linha 1\nlinha 2"');
 assert.equal(semicolon[1][2],'linha 1\nlinha 2');
});
test('preços brasileiros e placas antigas e Mercosul',()=>{
 assert.equal(normalizarPreco('R$ 35.900,00'),35900);
 assert.deepEqual(extrairPlacas('Fotos Honda placa ABC-1234 traseira.jpeg'),['ABC1234']);
 assert.deepEqual(extrairPlacas('Carro ABC1D23 - lateral.jpg'),['ABC1D23']);
 assert.deepEqual(extrairPlacas('xABC1D23y'),[]);
});
test('veículos: necessita marca, modelo, ano e preço, e loja',()=>{
 const lines=csvParaLinhas('Marca;Modelo;Ano;Preço;Placa\nHonda;Civic;2020;"R$ 90.000,00";ABC1D23\n;Gol;2021;48000;DEF1234');
 const result=processarVeiculos(lines,'001');
 assert.equal(result.validos.length,1);assert.equal(result.validos[0].placa,'ABC1D23');assert.equal(result.validos[0].patio,'001');
 assert.equal(result.rejeitados.length,1);
});
test('colunas mapeadas por sinônimos',()=>{
 assert.deepEqual(detectarMapeamento(['WhatsApp','Nome completo','Interesse']).telefone,0);
 assert.equal(normalizarTelefone('somente letras'),null);
});
