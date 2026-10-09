import fs from 'node:fs';
import path from 'node:path';

const required = {
  supabase: [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ],
  paymentDetails: [
    'NEXT_PUBLIC_EMOLA_NUMBER',
    'NEXT_PUBLIC_EMOLA_MERCHANT_NAME',
  ],
};
const optional = {
  emolaApi: ['EMOLA_API_URL', 'EMOLA_MERCHANT_ID', 'EMOLA_API_KEY'],
};

const envPaths = ['.env.local', '.env'].map((file) => path.resolve(process.cwd(), file));
const existingEnvPaths = envPaths.filter((envPath) => fs.existsSync(envPath));
const hasEnvFile = existingEnvPaths.length > 0;

for (const envPath of existingEnvPaths) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!match || (Object.hasOwn(process.env, match[1]) && process.env[match[1]] !== '')) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    process.env[match[1]] = value;
  }
}

const privateTestMode =
  process.env.NODE_ENV !== 'production' &&
  (process.env.PRIVATE_TEST_MODE === 'true' ||
    process.env.PRIVATE_TEST_MODE === '1' ||
    process.env.NEXT_PUBLIC_PRIVATE_TEST_MODE === 'true' ||
    process.env.NEXT_PUBLIC_PRIVATE_TEST_MODE === '1');

function describeEnv(name, keys) {
  const missing = keys.filter((key) => !process.env[key] || process.env[key]?.trim() === '');
  return {
    name,
    missing,
    ready: missing.length === 0,
  };
}

const groups = Object.entries(required).map(([name, keys]) => describeEnv(name, keys));
const allMissing = groups.flatMap((group) => group.missing);

console.log('=== Betzebi environment check ===');
console.log(hasEnvFile ? 'Arquivo .env encontrado.' : 'Arquivo .env não encontrado. Copie o .env.example antes do deploy real.');

if (privateTestMode) {
  console.log('Modo privado de testes ativo; este resultado não valida uma configuração de produção.');
  process.exit(0);
}

for (const group of groups) {
  const label = {
    supabase: 'Supabase',
    paymentDetails: 'Dados de recebimento manual',
  }[group.name];
  if (group.ready) {
    console.log(`✅ ${label}: pronto.`);
  } else {
    console.log(`⚠️ ${label}: faltam ${group.missing.join(', ')}`);
  }
}

if (allMissing.length === 0) {
  const missingOptional = Object.values(optional).flat().filter((key) => !process.env[key]?.trim());
  console.log('✅ Variáveis obrigatórias encontradas. Isto não valida as contas, integrações, dados comerciais, licença ou autorização para operar.');
  if (missingOptional.length > 0) {
    console.log(`ℹ️ API e-Mola não configurada (opcional no fluxo manual): ${missingOptional.join(', ')}`);
  }
  process.exit(0);
}

console.error('❌ Ambiente incompleto. Corrige as variáveis em falta antes de validar um deploy de produção.');
process.exit(1);
