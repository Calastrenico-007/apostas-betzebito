import { NextResponse } from 'next/server';
import { getOperationMode, getPaymentProviderStatus } from '@/lib/operation-mode';

export async function GET() {
  return NextResponse.json({
    ok: true,
    mode: getOperationMode().label,
    paymentProvider: getPaymentProviderStatus(),
  });
}
