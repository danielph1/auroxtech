// Aurox: dois despachantes independentes executados dentro do worker.
// As credenciais ficam apenas no .env do worker e no servidor (Vercel).
// Uma falha de Push NAO deve interromper o processamento de Follow Up.
export function startPushDispatcher(base) {
  const appUrl = String(base || '').replace(/\/$/, '');
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/.*)?$/i.test(appUrl)) {
    console.warn('[Aurox dispatch] MANU_APP_URL não é uma URL HTTPS válida; Push e Follow Up não iniciados.');
    return;
  }

  const pushSecret = String(process.env.PUSH_DISPATCH_SECRET || '');
  const followupSecret = String(process.env.FOLLOWUP_DISPATCH_SECRET || pushSecret || '');

  function schedule(name, endpoint, secret, onSuccess) {
    if (secret.length < 32) {
      console.warn(`[Aurox ${name}] desativado: configure o segredo correspondente (mínimo de 32 caracteres) também na Vercel.`);
      return;
    }
    let running = false;
    async function tick() {
      if (running) return;
      running = true;
      try {
        const response = await fetch(`${appUrl}${endpoint}`, {
          headers: { Authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(20000),
          cache: 'no-store',
        });
        if (!response.ok) {
          console.warn(`[Aurox ${name}] HTTP ${response.status} ao despachar. Confira chave e logs da Vercel.`);
          return;
        }
        const info = await response.json();
        onSuccess(info);
      } catch (error) {
        console.warn(`[Aurox ${name}] falha de comunicação:`, error instanceof Error ? error.message : 'erro');
      } finally {
        running = false;
      }
    }
    console.info(`[Aurox ${name}] agendador ativo: verificação a cada 30 segundos.`);
    setTimeout(() => { void tick(); }, name === 'Push' ? 6000 : 7000).unref();
    setInterval(() => { void tick(); }, 30000).unref();
  }

  schedule('Push', '/api/cron/push', pushSecret, data => {
    if (Number(data.processados) > 0) console.info(`[Aurox Push] ${data.processados} processados; ${data.entregues || 0} aceitos.`);
  });
  schedule('Follow Up', '/api/cron/follow-up', followupSecret, data => {
    if (data.pausado) console.info('[Aurox Follow Up] agendamento pausado fora do horário configurado.');
    else if (Number(data.processados) > 0) console.info(`[Aurox Follow Up] ${data.processados} processados; ${data.enviados || 0} enviados; ${data.erros || 0} erros.`);
  });

  // Rodízio automático por empresa, independente da página Triagem.
  // Apenas o processo mestre executa este dispatcher; filhos não o executam.
  const waSecret = String(process.env.AUROX_WA_WORKER_SECRET || '');
  if (waSecret.length >= 32) {
    let rodizioRunning = false;
    const rodizioTick = async () => {
      if (rodizioRunning) return;
      rodizioRunning = true;
      try {
        const r = await fetch(`${appUrl}/api/internal/aurox-whatsapp/triagem-rodizio`, {
          headers: { Authorization: `Bearer ${waSecret}` },
          signal: AbortSignal.timeout(20000), cache:'no-store',
        });
        if (!r.ok) {
          console.warn(`[Aurox Rodízio] HTTP ${r.status}; confira migração e credenciais.`);
          return;
        }
        const data = await r.json();
        if (Number(data.atribuidos)>0 || Number(data.erros)>0)
          console.info(`[Aurox Rodízio] atribuídos=${data.atribuidos}, erros=${data.erros}`);
      } catch (e) {
        console.warn('[Aurox Rodízio] serviço indisponível:', e instanceof Error?e.message:'erro');
      } finally { rodizioRunning = false; }
    };
    console.info('[Aurox Rodízio] agendador ativo: a cada 10 segundos');
    setTimeout(()=>{void rodizioTick();},4500).unref();
    setInterval(()=>{void rodizioTick();},10000).unref();
  } else console.warn('[Aurox Rodízio] segredo do worker ausente ou insuficiente');

}
