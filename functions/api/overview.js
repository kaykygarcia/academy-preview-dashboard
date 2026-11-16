
const OWNER = 'kaykygarcia';
const REPO = 'academy-preview-api';
const API_ROOT = `https://api.github.com/repos/${OWNER}/${REPO}`;
const CACHE_SECONDS = 25;
const RECENT_LIMIT = 6;
const MAX_OPEN_PRS = 30;
const MAX_STATUS_LOOKUPS = 38; // 30 PRs + 6 eventos recentes (+ margem)
const PREVIEW_ENV = /^preview-pr-(\d+)$/;

function responseJson(value, status = 200, cache = false) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cache
        ? `public, max-age=0, s-maxage=${CACHE_SECONDS}`
        : 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

function errorForGitHub(status, remaining) {
  if (status === 403 || status === 429) {
    return new Error(remaining === '0'
      ? 'Limite de requisições do GitHub atingido. Aguarde alguns minutos ou configure GITHUB_TOKEN na Cloudflare.'
      : `O GitHub recusou a consulta (${status}). Tente atualizar novamente.`);
  }
  return new Error(`Não foi possível consultar o GitHub (${status}).`);
}

export async function loadOverview({ token = '', fetchImpl = fetch } = {}) {
  const headers = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
  };
  if (token) headers.authorization = `Bearer ${token}`;

  async function githubGet(path) {
    const res = await fetchImpl(`${API_ROOT}${path}`, { headers });
    if (!res.ok) {
      console.error('GitHub API request failed', {
        path,
        status: res.status,
        authenticated: Boolean(token),
        rateLimitRemaining: res.headers.get('x-ratelimit-remaining'),
        rateLimitResource: res.headers.get('x-ratelimit-resource'),
        githubRequestId: res.headers.get('x-github-request-id'),
      });
      throw errorForGitHub(res.status, res.headers.get('x-ratelimit-remaining'));
    }
    return res.json();
  }

  const [pulls, deployments] = await Promise.all([
    githubGet('/pulls?state=open&sort=updated&direction=desc&per_page=100'),
    githubGet('/deployments?per_page=100'),
  ]);

  if (!Array.isArray(pulls) || !Array.isArray(deployments)) {
    throw new Error('Resposta inesperada da API do GitHub.');
  }

  const open = pulls.slice(0, MAX_OPEN_PRS);
  const previews = deployments.filter(d => PREVIEW_ENV.test(d.environment || ''));
  const recent = previews.slice(0, RECENT_LIMIT);
  const byEnvironment = new Map();

  for (const deployment of previews) {
    if (!byEnvironment.has(deployment.environment)) {
      byEnvironment.set(deployment.environment, deployment);
    }
  }

  const selected = new Map();
  for (const pr of open) {
    const deployment = byEnvironment.get(`preview-pr-${pr.number}`);
    if (deployment) selected.set(deployment.id, deployment);
  }
  for (const deployment of recent) selected.set(deployment.id, deployment);

  const selectedDeployments = [...selected.values()].slice(0, MAX_STATUS_LOOKUPS);
  const statusPairs = await Promise.all(selectedDeployments.map(async deployment => {
    const statuses = await githubGet(`/deployments/${deployment.id}/statuses?per_page=1`);
    return [deployment.id, Array.isArray(statuses) ? statuses[0] ?? null : null];
  }));
  const statusById = new Map(statusPairs);

  const items = open.map(pr => {
    const environment = `preview-pr-${pr.number}`;
    const deployment = byEnvironment.get(environment) ?? null;
    const status = deployment ? statusById.get(deployment.id) ?? null : null;
    const sameCommit = Boolean(deployment && deployment.sha === pr.head?.sha);

    let state = 'waiting';
    if (deployment && status) {
      if (!sameCommit) state = status.state === 'success' ? 'updating' : 'waiting';
      else if (status.state === 'success') state = 'ready';
      else if (['failure', 'error'].includes(status.state)) state = 'failed';
      else if (status.state === 'inactive') state = 'inactive';
    }

    const url = status?.state === 'success' ? status.environment_url || null : null;
    return {
      number: pr.number,
      title: pr.title,
      branch: pr.head?.ref ?? '',
      sha: pr.head?.sha ?? '',
      link: pr.html_url,
      draft: Boolean(pr.draft),
      environment,
      state,
      url: state === 'ready' ? url : null,
      deployedSha: deployment?.sha ?? null,
      deployedAt: status?.created_at ?? null,
    };
  });

  const activity = recent.map(deployment => {
    const status = statusById.get(deployment.id) ?? null;
    const match = PREVIEW_ENV.exec(deployment.environment);
    return {
      id: deployment.id,
      number: match ? Number(match[1]) : null,
      environment: deployment.environment,
      sha: deployment.sha,
      state: status?.state ?? 'unknown',
      at: status?.created_at ?? deployment.created_at,
      url: status?.state === 'success' ? status.environment_url || null : null,
    };
  }).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const ready = items.filter(item => item.state === 'ready').length;
  return {
    source: `${OWNER}/${REPO}`,
    sourceUrl: `https://github.com/${OWNER}/${REPO}`,
    fetchedAt: new Date().toISOString(),
    refreshSeconds: token ? 30 : 300,
    summary: {
      open: pulls.length,
      ready,
      pending: items.length - ready,
    },
    truncated: pulls.length > MAX_OPEN_PRS,
    pullRequests: items,
    activity,
  };
}

export async function onRequestGet(context) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = new Request(new URL('/api/overview', context.request.url).toString());

  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  try {
    const data = await loadOverview({ token: context.env?.GITHUB_TOKEN || '' });
    const response = responseJson(data, 200, true);
    if (cache && context.waitUntil) {
      context.waitUntil(cache.put(cacheKey, response.clone()));
    }
    return response;
  } catch (error) {
    console.error('GitHub dashboard error:', error);
    return responseJson({ error: error.message || 'Falha temporária na consulta ao GitHub.' }, 502);
  }
}
