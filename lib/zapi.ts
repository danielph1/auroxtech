/** Compatibilidade de imports antigos, sem conexao com Z-API. */
export { phoneToZapi } from './aurox-whatsapp/phone';
export async function zapiSendText(_phoneRaw: string, _message: string): Promise<{ok:boolean;skipped:string}> {
 return {ok:false,skipped:'Z-API removida do AUROX'};
}
