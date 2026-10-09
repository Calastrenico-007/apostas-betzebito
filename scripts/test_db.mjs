import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let v = m[2] || '';
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[m[1]] = v;
  }
});

const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const key = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const sKey = env['SUPABASE_SERVICE_ROLE_KEY'];

console.log('Testing Supabase URL:', url);
const sbAnon = createClient(url, key);
const sbAdmin = sKey ? createClient(url, sKey) : null;

async function check() {
  console.log('\n--- Checking with Anon Key ---');
  const { count: evCount, error: evErr } = await sbAnon.from('events').select('*', { count: 'exact', head: true });
  if (evErr) console.log('❌ Events error:', evErr.message);
  else console.log('✅ Events table found. Rows:', evCount);

  const { count: prCount, error: prErr } = await sbAnon.from('profiles').select('*', { count: 'exact', head: true });
  if (prErr) console.log('❌ Profiles error:', prErr.message);
  else console.log('✅ Profiles table found. Rows:', prCount);

  const { count: wrCount, error: wrErr } = await sbAnon.from('wallet_requests').select('*', { count: 'exact', head: true });
  if (wrErr) console.log('❌ Wallet requests error:', wrErr.message);
  else console.log('✅ Wallet requests table found. Rows:', wrCount);

  if (sbAdmin) {
    console.log('\n--- Checking with Service Role Key (Admin) ---');
    const { count: usersCount, error: usersErr } = await sbAdmin.from('profiles').select('*', { count: 'exact', head: true });
    if (usersErr) console.log('❌ Admin profiles error:', usersErr.message);
    else console.log('✅ Admin verified profiles count:', usersCount);

    const { data: adminUsers, error: admErr } = await sbAdmin.from('profiles').select('email, username, role').eq('role', 'admin');
    if (admErr) console.log('❌ Error querying admins:', admErr.message);
    else console.log('ℹ️ Existing admin users in DB:', adminUsers);

    const { data: evs, error: evsErr } = await sbAdmin.from('events').select('id, title, kind, status, starts_at, closes_at');
    if (evsErr) console.log('❌ Error querying events:', evsErr.message);
    else console.log('ℹ️ Events in DB:', evs);
  }
}

check().catch(console.error);
