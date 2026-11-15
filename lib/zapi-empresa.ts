/** Integracao Z-API desativada. Nenhum envio externo e permitido. */
export async function enviarWhatsAppDaEmpresa(_empresaId: number, _telefone: string, _texto: string) {
  return {ok:false,status:'removed',message:'Z-API removida. Conecte o Aurox-WhatsApp ou WhatsApp oficial da Meta.'};
}
