export type AppMode = 'manual';

export const APP_MODE: AppMode = 'manual';

export const isLiveMode = false;

export function getOperationMode() {
  const privateTestMode =
    process.env.PRIVATE_TEST_MODE === 'true' ||
    process.env.PRIVATE_TEST_MODE === '1' ||
    process.env.NEXT_PUBLIC_PRIVATE_TEST_MODE === 'true' ||
    process.env.NEXT_PUBLIC_PRIVATE_TEST_MODE === '1';

  return {
    mode: APP_MODE,
    isDemo: false,
    isLive: isLiveMode,
    isPrivateTest: privateTestMode,
    label: privateTestMode ? 'Teste Interno' : 'Operação Manual',
    badge: privateTestMode ? 'TESTE' : 'MANUAL',
    currency: 'MT',
    walletLabel: 'Saldo Disponível (MT)',
  };
}

export function getPaymentProviderStatus() {
  return {
    mode: APP_MODE,
    provider: 'e-mola',
    enabled: false,
    ready: false,
    missing: [],
    message: 'Integração automática desativada. Pedidos de carteira são registos manuais; nenhuma transferência real é feita.',
  };
}

export function ensureLiveOperationsAllowed() {
  const status = getPaymentProviderStatus();
  if (!status.ready) {
    return {
      ...status,
      allowed: false,
      error: 'Operações financeiras reais estão desativadas. Este projeto apenas regista pedidos manuais.',
    };
  }

  return {
    ...status,
    allowed: true,
    error: null,
  };
}
