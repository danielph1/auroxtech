/** Numero no formato internacional para sessao Aurox-WhatsApp. */
export function phoneToZapi(raw: string | null | undefined): string {
  let digits = String(raw || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits;
}
