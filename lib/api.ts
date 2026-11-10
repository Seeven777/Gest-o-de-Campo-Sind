import { NextResponse } from 'next/server';
import { currentIdentity, type Role, type Identity } from '@/lib/access';
export async function withRole<T>(roles: Role[], action:(user:Identity)=>Promise<T>) {
  try {
    const user = await currentIdentity();
    if(!user) return NextResponse.json({error:'Acesso não autorizado ou perfil ainda não liberado.'},{status:401});
    if(!roles.includes(user.role)) return NextResponse.json({error:'Permissão insuficiente.'},{status:403});
    return NextResponse.json(await action(user));
  } catch(e) {
    console.error('[API] Falha ao processar solicitação',e instanceof Error?e.message:e);
    return NextResponse.json({error:'Não foi possível concluir a operação. Verifique a configuração e o banco.'},{status:500});
  }
}
