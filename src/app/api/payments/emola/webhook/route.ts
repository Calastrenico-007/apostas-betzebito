import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'O webhook automático não está ativo. O operador confirma os pagamentos manualmente.' },
    { status: 410 },
  );
}
