import test from 'node:test';
import assert from 'node:assert/strict';
import { loadOverview, onRequestGet } from '../functions/api/overview.js';

const HEAD = 'a'.repeat(40);
const OLD = 'b'.repeat(40);
const root = 'https://github.com/kaykygarcia/academy-preview-api';

function fakeGithub({ old = false, status = 'success', fail = false } = {}) {
  const requests = [];
  async function fakeFetch(url, { headers } = {}) {
    requests.push({ url, headers });
    if (fail) return new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0' } });
    const path = new URL(url).pathname;
    let json;
    if (path.endsWith('/pulls')) {
      json = [
        { number: 27, title: 'Ajusta página de relatórios', draft: false, head: { sha: HEAD, ref: 'test/dashboard' }, html_url: `${root}/pull/27` },
        { number: 28, title: 'Refatora endpoint', draft: false, head: { sha: 'c'.repeat(40), ref: 'feature/fix' }, html_url: `${root}/pull/28` },
      ];
    } else if (path.endsWith('/deployments')) {
      json = [
        { id: 102, environment: 'preview-pr-27', sha: old ? OLD : HEAD, created_at: '2026-11-15T23:03:00Z' },
        { id: 101, environment: 'preview-pr-25', sha: OLD, created_at: '2026-11-15T22:00:00Z' },
        { id: 100, environment: 'production', sha: OLD, created_at: '2026-11-15T18:00:00Z' },
      ];
    } else if (path.endsWith('/deployments/102/statuses')) {
      json = [{ state: status, environment_url: 'http://100.57.6.49:3000', created_at: '2026-11-15T23:04:00Z' }];
    } else if (path.endsWith('/deployments/101/statuses')) {
      json = [{ state: 'inactive', environment_url: '', created_at: '2026-11-15T22:03:00Z' }];
    } else {
      throw new Error(`Unexpected GitHub path ${url}`);
    }
    return new Response(JSON.stringify(json), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return { fakeFetch, requests };
}

test('mostra PR real com deployment do commit atual e histórico de encerramento', async () => {
  const { fakeFetch, requests } = fakeGithub();
  const data = await loadOverview({ fetchImpl: fakeFetch, token: 'test-secret' });
  assert.deepEqual(data.summary, { open: 2, ready: 1, pending: 1 });
  assert.deepEqual(data.pullRequests.map(p => p.state), ['ready', 'waiting']);
  assert.equal(data.pullRequests[0].url, 'http://100.57.6.49:3000');
  assert.equal(data.pullRequests[1].url, null);
  assert.deepEqual(data.activity.map(a => a.state), ['success', 'inactive']);
  assert.equal(data.activity[0].number, 27);
  assert(requests.every(r => r.headers.authorization === 'Bearer test-secret'));
});

test('não disponibiliza URL de versão anterior como preview do commit atual', async () => {
  const { fakeFetch } = fakeGithub({ old: true });
  const data = await loadOverview({ fetchImpl: fakeFetch });
  assert.equal(data.pullRequests[0].state, 'updating');
  assert.equal(data.pullRequests[0].url, null);
  assert.equal(data.summary.ready, 0);
});

test('um deployment inativo não é considerado disponível', async () => {
  const { fakeFetch } = fakeGithub({ status: 'inactive' });
  const data = await loadOverview({ fetchImpl: fakeFetch });
  assert.equal(data.pullRequests[0].state, 'inactive');
  assert.equal(data.pullRequests[0].url, null);
  assert.equal(data.summary.ready, 0);
});

test('rate limit produz erro útil em vez de dados fictícios', async () => {
  const { fakeFetch } = fakeGithub({ fail: true });
  await assert.rejects(
    loadOverview({ fetchImpl: fakeFetch }),
    /Limite de requisições do GitHub atingido/
  );
});

test('o endpoint devolve resposta 502 quando o GitHub está indisponível', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0' } });
  try {
    const response = await onRequestGet({ request: new Request('http://localhost/api/overview'), env: {} });
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.match(body.error, /Limite de requisições/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
