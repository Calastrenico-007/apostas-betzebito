/**
 * Utilitários e cliente operacional para o serviço móvel e-Mola (Movitel Moçambique).
 * Suporta modo assistido por USSD (*898#) + validação de referência/SMS e
 * integração direta por API/Webhook para pagamentos automáticos.
 */

export interface EmolaConfig {
  agentNumber: string;
  agentName: string;
  apiUrl?: string;
  merchantId?: string;
  apiKey?: string;
  webhookSecret?: string;
}

export function getEmolaConfig(): EmolaConfig {
  return {
    agentNumber: process.env.NEXT_PUBLIC_EMOLA_NUMBER || '',
    agentName: process.env.NEXT_PUBLIC_EMOLA_MERCHANT_NAME || 'Betzebi Sportsbook',
    apiUrl: process.env.EMOLA_API_URL,
    merchantId: process.env.EMOLA_MERCHANT_ID,
    apiKey: process.env.EMOLA_API_KEY,
    webhookSecret: process.env.EMOLA_WEBHOOK_SECRET,
  };
}

/** Verifica se as credenciais de API automática da Movitel e-Mola estão ativas */
export function isEmolaApiConfigured(): boolean {
  const cfg = getEmolaConfig();
  return Boolean(cfg.apiUrl && cfg.merchantId && cfg.apiKey);
}

/**
 * Normaliza número de telemóvel moçambicano para 9 dígitos:
 * Aceita: "+258 86 123 4567", "258861234567", "861234567" -> "861234567"
 */
export function normalizeMozambicanPhone(phone: string): string {
  if (!phone) return '';
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('258') && clean.length > 9) {
    clean = clean.slice(3);
  }
  return clean;
}

/**
 * Valida se é um número Movitel válido em Moçambique:
 * Deve ter 9 dígitos e começar por 86 ou 87.
 */
export function isValidEmolaNumber(phone: string): boolean {
  const clean = normalizeMozambicanPhone(phone);
  return /^8[67]\d{7}$/.test(clean);
}

/**
 * Formata número de telefone para leitura clara:
 * "861234567" -> "+258 86 123 4567"
 */
export function formatMozambicanPhone(phone: string): string {
  const clean = normalizeMozambicanPhone(phone);
  if (clean.length !== 9) return phone;
  return `+258 ${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5)}`;
}

export interface ParsedEmolaSms {
  amount?: number;
  reference?: string;
  senderPhone?: string;
  recipientPhone?: string;
  raw: string;
  isValid: boolean;
}

/**
 * Parser inteligente de SMS do e-Mola (Movitel).
 * Lê o texto da mensagem colada pelo apostador e extrai automaticamente
 * o montante em Meticais, código de transação e número.
 */
export function parseEmolaSms(smsText: string): ParsedEmolaSms {
  if (!smsText || typeof smsText !== 'string') {
    return { raw: '', isValid: false };
  }

  const raw = smsText.trim();
  let amount: number | undefined;
  let reference: string | undefined;
  let senderPhone: string | undefined;

  // 1. Extração do valor em Meticais (ex: "500.00 MT", "500MT", "Valor: 250 MT", "transferiu 1000 MT")
  const amountMatch = raw.match(/(?:transferiu|valor|pago|quantia|montante)?\s*[:=]?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:mt|mzn|meticais)/i);
  if (amountMatch) {
    const parsed = parseFloat(amountMatch[1].replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) {
      amount = parsed;
    }
  }

  // 2. Extração de ID de transação ou Referência e-Mola
  // Padrões comuns: "ID da transacao: 12345678", "Ref: 869012345", "TxID: EM12345"
  const refMatch = raw.match(/(?:id(?:\s*da\s*transacao|\s*transação)?|ref(?:erencia|erência)?|txid|transacao|recibo)[:.\s]+([A-Za-z0-9_-]{6,20})/i);
  if (refMatch) {
    reference = refMatch[1].toUpperCase();
  } else {
    // Procura por token numérico de 8 a 12 dígitos que não seja um número de telefone 86/87
    const fallbackMatch = raw.match(/\b([0-9]{8,14})\b/);
    if (fallbackMatch && !fallbackMatch[1].startsWith('86') && !fallbackMatch[1].startsWith('87')) {
      reference = fallbackMatch[1];
    }
  }

  // 3. Extração de número de telefone Movitel (86 ou 87)
  const phoneMatch = raw.match(/\b(8[67]\d{7})\b/);
  if (phoneMatch) {
    senderPhone = phoneMatch[1];
  }

  const isValid = Boolean(amount || reference);

  return {
    amount,
    reference,
    senderPhone,
    raw,
    isValid,
  };
}

/** Gera um código de referência único para o pedido de depósito/levantamento e-Mola */
export function generateEmolaReference(type: 'deposito' | 'levantamento'): string {
  const prefix = type === 'deposito' ? 'EMD' : 'EML';
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${rand}`;
}

export interface EmolaInstructions {
  steps: string[];
  ussdCode: string;
  agentNumber: string;
  agentName: string;
  amountFormatted: string;
}

export function getEmolaInstructions(amount: number, reference: string): EmolaInstructions {
  const cfg = getEmolaConfig();
  const formattedAmount = `${amount.toFixed(2)} MT`;

  return {
    ussdCode: '*898#',
    agentNumber: cfg.agentNumber,
    agentName: cfg.agentName,
    amountFormatted: formattedAmount,
    steps: [
      `No teu telemóvel Movitel, marca o código USSD *898#`,
      `Escolhe a Opção 1: "Enviar Dinheiro"`,
      `Insere o número de destino e-Mola: ${cfg.agentNumber} (${cfg.agentName})`,
      `Insere o montante exato: ${formattedAmount}`,
      `Insere o teu PIN do e-Mola para confirmar a transferência`,
      `Copia o ID da transação da SMS recebida e confirma com a referência: ${reference}`,
    ],
  };
}
