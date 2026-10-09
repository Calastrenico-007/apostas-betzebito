import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'A API de depósitos não está ativa. Usa o pedido manual pela carteira.' },
    { status: 410 },
  );
}
