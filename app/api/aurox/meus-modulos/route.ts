import {NextRequest,NextResponse} from 'next/server';
import {requireUser} from '@/lib/session';
import {modulosDisponiveis} from '@/lib/aurox-modulos-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const user=await requireUser(req);
 if(!user)return NextResponse.json({error:'Nao autorizado'},{status:401});
 return NextResponse.json({modulos:await modulosDisponiveis(user)},
  {headers:{'Cache-Control':'private, no-store'}});
}
