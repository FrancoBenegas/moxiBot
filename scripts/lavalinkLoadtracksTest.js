require('../Util/silentDotenv')();

const host = process.env.LAVALINK_NODE_HOST;
const port = Number(process.env.LAVALINK_NODE_PORT || 2333);
const password = process.env.LAVALINK_NODE_PASSWORD;
const secure = String(process.env.LAVALINK_NODE_SECURE || '').toLowerCase() === 'true';
const identifier = process.argv[2];

async function main() {
  if (!identifier) {
    console.error('Usage: node scripts/lavalinkLoadtracksTest.js <identifier>');
    process.exitCode = 1;
    return;
  }

  if (!host || !password) {
    console.error('Missing env vars: LAVALINK_NODE_HOST/LAVALINK_NODE_PASSWORD');
    process.exitCode = 1;
    return;
  }

  const base = `http${secure ? 's' : ''}://${host}:${port}`;
  const url = `${base}/v4/loadtracks?identifier=${encodeURIComponent(identifier)}`;
  const fetchFn = globalThis.fetch || (await import('undici').then((m) => m.fetch));

  try {
    const res = await fetchFn(url, {
      method: 'GET',
      headers: { Authorization: password },
    });

    const text = await res.text();
    console.log('URL:', url);
    console.log('Status:', res.status, res.statusText);
    console.log('Body:', text);
    if (!res.ok) process.exitCode = 2;
  } catch (e) {
    console.error('Request failed:', e?.message || e);
    process.exitCode = 3;
  }
}

main();
