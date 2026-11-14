import { AuroxPulseLoader } from '@/components/aurox-pulse-loader';
/** Compatibilidade: telas existentes continuam usando CarLoader, agora com a identidade Aurox. */
export function CarLoader({compact=false}:{compact?:boolean}){
 return <AuroxPulseLoader compact={compact} fullScreen={!compact} label="Preparando sua área de trabalho…"/>;
}
