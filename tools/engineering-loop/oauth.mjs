import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { requireThat } from './core.mjs';
import { readJson, writeJson, command } from './io.mjs';
import { secretDirectory, SCOPE, GoogleDocsSource } from './ssot.mjs';

export function protectPrivateStore(root) {
  const directory = path.resolve(secretDirectory());
  requireThat(!directory.toLowerCase().startsWith(path.resolve(root).toLowerCase() + path.sep), 'OAuth store cannot be inside repository');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  requireThat(!fs.lstatSync(directory).isSymbolicLink(), 'OAuth store cannot be a symlink');
  if (process.platform === 'win32') {
    const sid = command('whoami.exe', ['/user', '/fo', 'csv', '/nh'], root).match(/S-1-[\d-]+/)?.[0];
    requireThat(sid, 'Cannot resolve current user for private OAuth ACL');
    command('icacls.exe', [directory, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`, '/T', '/Q'], root);
  } else fs.chmodSync(directory, 0o700);
  return directory;
}

export async function authorize(root) {
  const adapter = new GoogleDocsSource({ root, cfg: {} });
  adapter.costProof(); // No consent request if $0/project/billing evidence is absent.
  const file = path.join(secretDirectory(), 'client.json');
  requireThat(fs.existsSync(file), 'Existing owner-supplied Desktop OAuth client missing; no cloud resource created');
  const client = readJson(file).installed;
  requireThat(client?.client_id?.endsWith('.apps.googleusercontent.com') && client.token_uri === 'https://oauth2.googleapis.com/token', 'Invalid Desktop OAuth client');
  const directory = protectPrivateStore(root);
  const state = randomBytes(32).toString('base64url'), verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  let timer;
  const code = new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname !== '/callback' || url.searchParams.get('state') !== state) { res.writeHead(400); res.end('Invalid authorization state'); return; }
      const value = url.searchParams.get('code');
      res.end('Authorization received. Return to the local terminal.'); server.close(); clearTimeout(timer);
      if (value && !url.searchParams.has('error')) resolve({ code: value, redirect: `http://127.0.0.1:${server.address()?.port ?? port}/callback` });
      else reject(new Error('OAuth consent denied or missing code'));
    });
    let port;
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({ client_id: client.client_id, redirect_uri: `http://127.0.0.1:${port}/callback`, response_type: 'code',
        scope: SCOPE, access_type: 'offline', prompt: 'consent', state, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
      // Contains only public OAuth client ID and ephemeral CSRF/PKCE challenge, never secrets/tokens/code verifier.
      console.log('Open this URL and approve only the named file access yourself:\n' + url.href);
    });
    server.on('error', () => reject(new Error('Cannot open OAuth loopback listener')));
    timer = setTimeout(() => { server.close(); reject(new Error('OAuth consent timeout')); }, 300000);
  });
  const response = await code;
  const token = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: client.client_id,
      client_secret: client.client_secret ?? '', code: response.code, code_verifier: verifier, redirect_uri: response.redirect, grant_type: 'authorization_code' }) });
  requireThat(token.ok, `OAuth code exchange failed (${token.status}); response/secret not logged`);
  const data = await token.json();
  requireThat(data.refresh_token && data.scope === SCOPE, 'Missing refresh token or unexpected broad OAuth scopes');
  writeJson(path.join(directory, 'tokens.json'), { refresh_token: data.refresh_token, scope: SCOPE, createdAt: new Date().toISOString() });
  protectPrivateStore(root);
  console.log('OAuth credential saved outside repository with a private ACL. File access still needs live Docs API read verification; this is not a successful SSOT gate.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const action = process.argv[2] ?? 'status';
  const run = async () => {
    if (action === 'status') console.log(JSON.stringify(new GoogleDocsSource({ root, cfg: {} }).status(), null, 2));
    else if (action === 'protect') console.log(JSON.stringify({ protectedDirectory: protectPrivateStore(root) }));
    else if (action === 'authorize') await authorize(root);
    else throw new Error('Commands: status, protect, authorize (explicit owner action only)');
  };
  run().catch(e => { console.error(JSON.stringify({ status: 'BLOCKED', blocker: e.message })); process.exitCode = 1; });
}
