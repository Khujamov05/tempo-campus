// One-time local setup. Never imports a server key into the frontend build.
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { createClient } from '@supabase/supabase-js';
const url = 'https://wsyaztmkqvysfsmwehan.supabase.co';
const publishable = 'sb_publishable_e_2rUitEp1s9_Le1hfjqJQ_7IQiMHMQ';
const requestOptions = {
  global: {
    fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(20000) }),
  },
};
const secret = (await readFile('.supabase-admin.local', 'utf8')).trim();
const admin = createClient(url, secret, {
  ...requestOptions,
  auth: { persistSession: false, autoRefreshToken: false },
});
const source = (await readFile('src/model.ts', 'utf8'))
  .replace(/^import .*from '\.\/i18n-core';\r?\n/m, '')
  .replace(/^export /gm, '');
const compiled = stripTypeScriptTypes(source);
const model = new Function('translate', compiled + '\nreturn { createDemo };')(
  (_language, key) => key,
);
const payload = model.createDemo();
const { data: schedule, error: readError } = await admin
  .from('campus_schedule')
  .select('id')
  .eq('id', 1)
  .maybeSingle();
if (readError) throw readError;
if (!schedule) {
  const { error } = await admin.from('campus_schedule').insert({ id: 1, payload });
  if (error) throw error;
}
const file = 'artifacts/tempo-test-accounts.local';
let accounts = [];
try {
  accounts = JSON.parse(await readFile(file, 'utf8'));
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
for (const role of ['admin', 'teacher', 'student']) {
  if (accounts.some((x) => x.role === role)) continue;
  const email = `${role}@tempo-campus.test`;
  const password = randomBytes(18).toString('base64url') + '!9aA';
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  accounts.push({ role, email, password, id: data.user.id });
  await writeFile(file, JSON.stringify(accounts, null, 2));
}
for (const account of accounts) {
  const { error } = await admin
    .from('profiles')
    .update({
      role: account.role,
      teacher_id: account.role === 'teacher' ? 't1' : null,
      group_id: account.role === 'student' ? 'g1' : null,
    })
    .eq('id', account.id);
  if (error) throw error;
}
const checks = [];
for (const account of accounts) {
  const client = createClient(url, publishable, {
    ...requestOptions,
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: loginError } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (loginError) throw loginError;
  const profile = await client.from('profiles').select('*').eq('id', account.id).single();
  if (profile.error || profile.data.role !== account.role) throw new Error('Profile mismatch');
  const result = await client
    .from('campus_schedule')
    .select('payload,revision')
    .eq('id', 1)
    .single();
  if (result.error) throw result.error;
  if (account.role !== 'admin') {
    const denied = await client.rpc('save_campus_schedule', {
      next_payload: result.data.payload,
      expected_revision: result.data.revision,
    });
    if (!denied.error || denied.error.code !== '42501')
      throw new Error('Unauthorized save was not rejected');
    const promote = await client.from('profiles').update({ role: 'admin' }).eq('id', account.id);
    if (!promote.error) throw new Error('Profile writes must be denied');
  } else {
    const saved = await client.rpc('save_campus_schedule', {
      next_payload: result.data.payload,
      expected_revision: result.data.revision,
    });
    if (saved.error) throw saved.error;
    const stale = await client.rpc('save_campus_schedule', {
      next_payload: result.data.payload,
      expected_revision: result.data.revision,
    });
    if (!stale.error || stale.error.code !== 'P0001')
      throw new Error('Stale save must fail: ' + JSON.stringify(stale));
  }
  await client.auth.signOut({ scope: 'local' });
  checks.push(`${account.role}: login, profile, read and permissions verified`);
}
const anon = createClient(url, publishable, { ...requestOptions, auth: { persistSession: false } });
const denied = await anon.from('campus_schedule').select('payload');
if (!denied.error) throw new Error('Unauthenticated read must be denied');
console.log(checks.join('\n'));
console.log('Anonymous access denied. Credentials saved only in ignored local file.');
