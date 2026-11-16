const icons = {
  'layers': '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  'activity': '<path d="M22 12h-4l-3 9-6-18-3 9H2"/>',
  'git-pull-request': '<circle cx="6" cy="3" r="2"/><path d="M6 5v12"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="6" r="2"/><path d="M18 8v7a4 4 0 0 1-4 4h-2"/>',
  'external-link': '<path d="M15 3h6v6M10 14 21 3M21 13v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7"/>',
  'server': '<rect x="3" y="3" width="18" height="8" rx="2"/><rect x="3" y="13" width="18" height="8" rx="2"/><path d="M7 7h.01M7 17h.01"/>',
  'github': '<path fill="currentColor" stroke="none" d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.11.76-.24.76-.54v-2.1c-3.1.68-3.75-1.32-3.75-1.32-.51-1.29-1.25-1.63-1.25-1.63-1.02-.7.08-.68.08-.68 1.12.08 1.71 1.14 1.71 1.14 1 .17 1.69.66 2.07 1.02.1-.72.39-1.21.71-1.49-2.47-.29-5.06-1.24-5.06-5.49 0-1.21.43-2.2 1.14-2.97-.12-.29-.49-1.41.11-2.94 0 0 .93-.3 3.05 1.13A10.6 10.6 0 0 1 12 6.42c.94 0 1.88.13 2.77.37 2.12-1.43 3.05-1.13 3.05-1.13.6 1.53.23 2.65.11 2.94a4.3 4.3 0 0 1 1.14 2.97c0 4.26-2.59 5.2-5.07 5.48.4.35.76 1.03.76 2.08v2.86c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z"/>',
  'arrow-up-right': '<path d="M7 17 17 7M8 7h9v9"/>',
  'refresh-cw': '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 9a7 7 0 0 1 12.1-2L20 12M4 12l2.9 5A7 7 0 0 0 19 15"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  'clock-3': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
  'search': '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'code-2': '<path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-12-2 16"/>',
  'check': '<path d="m5 12 4 4L19 6"/>',
  'loader': '<path d="M21 12a9 9 0 0 1-9 9M3 12a9 9 0 0 1 9-9"/>',
  'minus-circle': '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  'x-circle': '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',
  'git-branch': '<circle cx="6" cy="3" r="2"/><path d="M6 5v12"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="6" r="2"/><path d="M18 8a6 6 0 0 1-6 6H6"/>',
  'inbox': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 13 5 0 2 3h4l2-3h5"/>',
};

function icon(name, extra = '') {
  return `<svg class="icon ${extra}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.layers}</svg>`;
}

for (const element of document.querySelectorAll('[data-icon]')) {
  element.innerHTML = icon(element.dataset.icon);
}

const $ = selector => document.querySelector(selector);
const state = { data: null, filter: 'all', search: '', loading: false, lastFetch: 0, lastAttempt: 0, fail: null };
const locales = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function safeUrl(value, protocols = ['https:', 'http:']) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function timeAgo(value) {
  if (!value) return 'Horário indisponível';
  const diff = Math.max(0, Date.now() - Date.parse(value));
  if (!Number.isFinite(diff)) return 'Horário indisponível';
  if (diff < 45_000) return 'agora';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} d`;
}

function statusFor(pr) {
  const map = {
    ready: ['Publicado', 'positive', 'check'],
    updating: ['Desatualizado', 'blue', 'refresh-cw'],
    failed: ['Falha no deploy', 'danger', 'x-circle'],
    inactive: ['Inativo', 'muted', 'minus-circle'],
    waiting: ['Sem preview', 'warm', 'clock-3'],
  };
  return map[pr.state] ?? map.waiting;
}

function displayPreviewUrl(raw) {
  const url = safeUrl(raw);
  if (!url) return 'URL indisponível';
  const parsed = new URL(url);
  return parsed.host + (parsed.pathname === '/' ? '' : parsed.pathname);
}

function renderPr(pr) {
  const [label, tone, badgeIcon] = statusFor(pr);
  const branch = escapeHtml(pr.branch);
  const title = escapeHtml(pr.title);
  const sha = escapeHtml((pr.sha || '').slice(0, 7));
  const preview = safeUrl(pr.url);
  const github = safeUrl(pr.link, ['https:']) || 'https://github.com/kaykygarcia/academy-preview-api/pulls';
  const ready = pr.state === 'ready' && preview;
  return `<article class="pr-card" aria-label="Pull request ${pr.number}: ${title}">
    <div class="pr-primary">
      <div class="pr-topline"><span class="pr-number">${icon('git-pull-request')} #${Number(pr.number)}</span><span class="status-badge status-${tone}">${icon(badgeIcon)} ${escapeHtml(label)}</span></div>
      <h3>${title}</h3>
      <div class="pr-meta"><span class="sha">${icon('code-2')} ${sha}</span><span class="meta-dot">·</span><span class="pr-branch" title="${branch}">${icon('git-branch')} ${branch}</span></div>
    </div>
    <div class="pr-bottom">
      <div class="environment-detail"><strong>${escapeHtml(pr.environment)}</strong><span>${ready ? icon('external-link') + escapeHtml(displayPreviewUrl(preview)) : 'Aguardando deployment do commit atual'}</span></div>
      <div class="pr-actions">${ready ? `<a class="button-dark" href="${escapeHtml(preview)}" target="_blank" rel="noopener noreferrer">Abrir preview ${icon('arrow-up-right')}</a>` : `<span class="button-disabled" aria-disabled="true">Sem link atual ${icon('clock-3')}</span>`}<a class="button-ghost" href="${escapeHtml(github)}" target="_blank" rel="noopener noreferrer" title="Ver pull request no GitHub">${icon('github')}</a></div>
    </div>
  </article>`;
}

function renderPrList() {
  if (!state.data) return;
  const all = state.data.pullRequests || [];
  const phrase = state.search.trim().toLowerCase();
  const filtered = all.filter(pr => {
    if (state.filter === 'ready' && pr.state !== 'ready') return false;
    if (state.filter === 'pending' && pr.state === 'ready') return false;
    if (!phrase) return true;
    return [pr.number, pr.title, pr.branch, pr.sha, pr.environment].some(
      v => String(v ?? '').toLowerCase().includes(phrase)
    );
  });

  $('#pr-count').textContent = `${filtered.length}`;
  $('#pr-truncated').hidden = !state.data.truncated;
  if (filtered.length) {
    $('#pr-list').innerHTML = filtered.map(renderPr).join('');
    return;
  }
  const noPrs = all.length === 0;
  $('#pr-list').innerHTML = `<div class="empty-state"><span class="empty-symbol">${icon('inbox')}</span><strong>${noPrs ? 'Nenhum PR aberto' : 'Nenhum PR encontrado'}</strong><span>${noPrs ? 'Abra um Pull Request para iniciar a automação de preview.' : 'Tente outro filtro ou termo de busca.'}</span><a href="https://github.com/kaykygarcia/academy-preview-api/pulls" target="_blank" rel="noopener noreferrer">Ver pull requests ${icon('arrow-up-right')}</a></div>`;
}

function renderActivity() {
  if (!state.data) return;
  const events = state.data.activity || [];
  if (events.length === 0) {
    $('#activity-list').innerHTML = `<div class="empty-activity"><span class="empty-symbol">${icon('activity')}</span><strong>Sem atividades recentes</strong><span>Os deployments registrados no GitHub aparecerão aqui.</span></div>`;
    return;
  }
  const stateLabels = {
    success: ['Deployment publicado', 'positive', 'check'],
    inactive: ['Preview encerrado', 'muted', 'minus-circle'],
    failure: ['Deployment falhou', 'danger', 'x-circle'],
    error: ['Erro no deployment', 'danger', 'x-circle'],
    pending: ['Deployment pendente', 'blue', 'clock-3'],
    in_progress: ['Deployment em andamento', 'blue', 'refresh-cw'],
  };
  $('#activity-list').innerHTML = events.map(event => {
    const [label, tone, eventIcon] = stateLabels[event.state] || ['Deployment registrado', 'muted', 'activity'];
    const link = `https://github.com/kaykygarcia/academy-preview-api/pull/${Number(event.number)}`;
    return `<div class="activity-event"><span class="activity-node activity-${tone}">${icon(eventIcon)}</span><div class="activity-body"><strong>${escapeHtml(label)}</strong><span>PR #${Number(event.number)} <span class="mini-separator">·</span> ${escapeHtml((event.sha || '').slice(0, 7))}</span><span class="activity-time">${escapeHtml(timeAgo(event.at))}</span><a href="${link}" target="_blank" rel="noopener noreferrer" aria-label="Abrir PR ${Number(event.number)} no GitHub">${icon('arrow-up-right')}</a></div></div>`;
  }).join('');
}

function render() {
  if (!state.data) return;
  const summary = state.data.summary;
  $('#metric-open').textContent = `${summary.open}`;
  $('#metric-ready').textContent = `${summary.ready}`;
  $('#metric-pending').textContent = `${summary.pending}`;
  const at = new Date(state.data.fetchedAt);
  $('#sync-text').textContent = Number.isFinite(at.getTime())
    ? `Atualizado às ${locales.format(at)}` : 'Dados recebidos do GitHub';
  $('#sync-dot').classList.remove('sync-error');
  document.querySelector('.status-strip > span:last-child').textContent = `Atualiza a cada ${state.data.refreshSeconds >= 60 ? Math.round(state.data.refreshSeconds / 60) + ' min' : state.data.refreshSeconds + ' s'}`;
  renderPrList();
  renderActivity();
}

async function refresh({ manual = false } = {}) {
  if (state.loading) return;
  if (manual && Date.now() - state.lastFetch < 8_000) return;
  state.loading = true;
  state.lastAttempt = Date.now();
  $('#refresh-button').classList.add('is-spinning');
  $('#refresh-button').disabled = true;
  try {
    const response = await fetch('/api/overview', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `GitHub API: HTTP ${response.status}`);
    if (!data.summary || !Array.isArray(data.pullRequests) || !Array.isArray(data.activity)) {
      throw new Error('Resposta inválida do endpoint de deployments.');
    }
    state.data = data;
    state.fail = null;
    state.lastFetch = Date.now();
    $('#error-banner').hidden = true;
    render();
  } catch (err) {
    state.fail = err.message || 'Falha ao consultar GitHub.';
    $('#error-message').textContent = state.fail;
    $('#error-banner').hidden = false;
    $('#sync-text').textContent = state.data ? 'Última atualização indisponível' : 'Falha ao consultar o GitHub';
    $('#sync-dot').classList.add('sync-error');
    if (!state.data) {
      $('#pr-list').innerHTML = '<div class="empty-state"><strong>Não foi possível carregar os PRs.</strong><span>Use o botão Tentar novamente acima.</span></div>';
      $('#activity-list').innerHTML = '<div class="empty-activity">Atividade indisponível.</div>';
    }
  } finally {
    state.loading = false;
    $('#refresh-button').classList.remove('is-spinning');
    $('#refresh-button').disabled = false;
  }
}

for (const filter of document.querySelectorAll('[data-filter]')) {
  filter.addEventListener('click', () => {
    state.filter = filter.dataset.filter;
    for (const other of document.querySelectorAll('[data-filter]')) {
      const selected = other === filter;
      other.classList.toggle('active', selected);
      other.setAttribute('aria-pressed', String(selected));
    }
    renderPrList();
  });
}

$('#pr-search').addEventListener('input', event => { state.search = event.target.value; renderPrList(); });
$('#refresh-button').addEventListener('click', () => refresh({ manual: true }));
$('#retry-button').addEventListener('click', () => refresh());

refresh();
const nextRefreshDue = () => Date.now() - state.lastAttempt >= (state.data?.refreshSeconds || 90) * 1000;
setInterval(() => {
  if (!document.hidden && nextRefreshDue()) refresh();
}, 10_000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && nextRefreshDue()) refresh();
});
