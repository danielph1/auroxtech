/**
 * Controle local de admissão (uma instância de Next.js/Node.js).
 * NÃO é fila global/distribuída da Vercel. Para fluxos duráveis, usar uma fila externa.
 * Limite de espera evita aumentar sem limite a latência de consultas.
 */
export class SobrecargaTemporaria extends Error {
  readonly code='AUROX_CAPACIDADE';
  constructor(message='Capacidade temporariamente esgotada') {super(message);this.name='SobrecargaTemporaria';}
}
export class FilaConcorrencia {
  private ativos=0;
  private pendentes: Array<{iniciar:()=>void;cancelar:(err:Error)=>void}> = [];
  private readonly limite:number;
  private readonly maxFila:number;
  private readonly esperaMs:number;
  constructor(limite:number,maxFila:number,esperaMs:number){
    if(!Number.isInteger(limite)||limite<1||!Number.isInteger(maxFila)||maxFila<0||!Number.isInteger(esperaMs)||esperaMs<1)throw Error('Fila inválida');
    this.limite=limite;this.maxFila=maxFila;this.esperaMs=esperaMs;
  }
  get situacao(){return {ativos:this.ativos,aguardando:this.pendentes.length,limite:this.limite};}
  async executar<T>(task:()=>Promise<T>):Promise<T>{
    await this.adquirir();
    try {return await task();}
    finally {this.liberar();}
  }
  private adquirir():Promise<void>{
    if(this.ativos<this.limite){this.ativos++;return Promise.resolve();}
    if(this.pendentes.length>=this.maxFila)return Promise.reject(new SobrecargaTemporaria('Fila de consultas ocupada'));
    return new Promise((resolve,reject)=>{
      let settled=false;
      const entry={iniciar:()=>{},cancelar:(e:Error)=>{}};
      const timer=setTimeout(()=>{
        if(settled)return;settled=true;
        const i=this.pendentes.indexOf(entry);if(i>=0)this.pendentes.splice(i,1);
        reject(new SobrecargaTemporaria('Tempo de espera excedido; tente novamente'));
      },this.esperaMs);
      timer.unref?.();
      entry.iniciar=()=>{if(settled)return;settled=true;clearTimeout(timer);this.ativos++;resolve();};
      entry.cancelar=(e:Error)=>{if(settled)return;settled=true;clearTimeout(timer);reject(e);};
      this.pendentes.push(entry);
    });
  }
  private liberar(){
    this.ativos=Math.max(0,this.ativos-1);
    while(this.ativos<this.limite&&this.pendentes.length){const next=this.pendentes.shift();next?.iniciar();}
  }
}
export function lerLimite(nome:string,padrao:number,min:number,max:number):number{
 const raw=process.env[nome];if(raw===undefined||raw==='')return padrao;
 const n=Number(raw);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(`Variável ${nome} inválida`);
 return n;
}
