import { createClient } from '@supabase/supabase-js';

const shouldRunOnce = process.argv.includes('--once');
const pollMs = Number(process.env.OUTBOX_INTERVAL_MS || 30000);
const mode = (process.env.EMAIL_MODE || 'console').toLowerCase();
const fromAddress = process.env.EMAIL_FROM || 'noreply@localhost';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Set them before running the outbox worker.');
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function markSuccess(client, id) {
  const { error } = await client.from('outbox_emails').update({
    sent: true,
    sent_at: new Date().toISOString(),
    attempts: 1,
    last_error: null,
  }).eq('id', id);

  if (error) {
    console.error('markSuccess failed:', error.message);
  }
}

async function markError(client, id, message) {
  const { data: current, error: loadErr } = await client.from('outbox_emails').select('attempts').eq('id', id).single();
  if (loadErr) {
    console.error('Could not read attempts for failed email:', loadErr.message);
  }

  const attempts = Number(current?.attempts || 0) + 1;
  const { error } = await client.from('outbox_emails').update({
    attempts,
    last_error: message,
    sent: false,
  }).eq('id', id);

  if (error) {
    console.error('markError failed:', error.message);
  }
}

async function sendWithResend(subject, body, toEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [toEmail],
      subject,
      html: `<p>${escapeHtml(body)}</p>`,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend error: ${response.status} ${text}`);
  }

  return true;
}

async function sendEmail(toEmail, subject, body) {
  if (mode === 'console') {
    console.log(`[outbox][dry-run] ${toEmail} :: ${subject}`);
    return true;
  }

  if (mode === 'resend') {
    return sendWithResend(subject, body, toEmail);
  }

  throw new Error(`Unsupported EMAIL_MODE: ${mode}. Use console or resend.`);
}

async function processOnce(client) {
  const { data, error } = await client
    .from('outbox_emails')
    .select('*')
    .eq('sent', false)
    .order('created_at', { ascending: true })
    .limit(20);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    console.log('[outbox] No pending emails.');
    return 0;
  }

  let sentCount = 0;

  for (const row of data) {
    const toEmail = row.to_email;
    const subject = row.subject;
    const body = row.body;

    if (!toEmail || !subject || !body) {
      console.warn('[outbox] Skipping invalid row', row.id);
      await markError(client, row.id, 'Invalid payload');
      continue;
    }

    try {
      await sendEmail(toEmail, subject, body);
      await markSuccess(client, row.id);
      sentCount += 1;
      console.log(`[outbox] Sent ${row.id} -> ${toEmail}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[outbox] Failed ${row.id}: ${message}`);
      await markError(client, row.id, message);
    }
  }

  return sentCount;
}

async function main() {
  try {
    const client = getSupabaseClient();
    console.log(`[outbox] running in ${mode} mode`);

    if (shouldRunOnce) {
      const sent = await processOnce(client);
      console.log(`[outbox] processed: ${sent} email(s)`);
      return;
    }

    while (true) {
      await processOnce(client);
      await sleep(pollMs);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[outbox] startup failed:', message);
    process.exitCode = 1;
  }
}

main();
