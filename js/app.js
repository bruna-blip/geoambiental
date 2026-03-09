/* ==========================================
   GeoAmbiental — JavaScript Principal
   app.js
   ========================================== */

// ==========================================
//  ESTADO GLOBAL
// ==========================================
const State = {
  currentPage: 'dashboard',
  clientes: [],
  licencas: [],
  condicionantes: [],
  checklists: [],
  modelos: [],
  checklistItems: [],        // itens em edição
  charts: {},
  pagination: {
    clientes:      { page: 1, limit: 10, total: 0 },
    licencas:      { page: 1, limit: 10, total: 0 },
    condicionantes:{ page: 1, limit: 10, total: 0 },
  },
};

// ==========================================
//  API HELPERS (SUPABASE)
// ==========================================
function getSupabase() {
  const client = window.supabaseClient;
  if (!client) {
    throw new Error('Supabase não configurado. Verifique js/supabase-config.js');
  }
  return client;
}
async function requireAuth() {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    window.location.href = 'login.html';
    throw new Error('Usuário não autenticado');
  }

  return data.session;
}

async function logoutUser() {
  const supabase = getSupabase();
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}
function tableQuery(table) {
  return getSupabase().from(table);
}

function normalizeRows(rows) {
  return (rows || []).map(row => {
    if (row && typeof row.itens === 'object' && row.itens !== null && !Array.isArray(row.itens)) {
      try { row.itens = JSON.stringify(row.itens); } catch (_) {}
    }
    return row;
  });
}

function buildSearch(query, table, search) {
  if (!search) return query;
  const s = String(search).trim();
  if (!s) return query;

  const fieldsByTable = {
    clientes: ['razao_social', 'nome_fantasia', 'cnpj_cpf', 'setor', 'municipio', 'responsavel', 'email'],
    licencas: ['numero', 'tipo', 'orgao_emissor', 'empreendimento', 'numero_processo', 'atividade'],
    condicionantes: ['numero', 'descricao', 'categoria', 'responsavel', 'status'],
    checklists: ['titulo', 'categoria', 'observacoes', 'status'],
    modelos_documentos: ['titulo', 'categoria', 'descricao', 'tags', 'conteudo', 'status'],
  };

  const fields = fieldsByTable[table] || [];
  if (!fields.length) return query;

  const escaped = s.replaceAll(',', ' ');
  const orClause = fields.map(f => `${f}.ilike.%${escaped}%`).join(',');
  return query.or(orClause);
}

function applyCommonFilters(query, params = {}) {
  Object.entries(params).forEach(([key, value]) => {
    if (['page', 'limit', 'search'].includes(key)) return;
    if (value === '' || value === null || value === undefined) return;
    query = query.eq(key, value);
  });
  return query;
}

async function apiGet(table, params = {}) {
  const page = Math.max(parseInt(params.page || 1, 10), 1);
  const limit = Math.max(parseInt(params.limit || 50, 10), 1);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = tableQuery(table).select('*', { count: 'exact' });
  query = buildSearch(query, table, params.search);
  query = applyCommonFilters(query, params);
  query = query.order('created_at', { ascending: false, nullsFirst: false });
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: normalizeRows(data), total: count || 0 };
}

async function apiGetById(table, id) {
  const { data, error } = await tableQuery(table).select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function apiPost(table, data) {
  const payload = { ...data };
  const { data: inserted, error } = await tableQuery(table).insert(payload).select().single();
  if (error) throw error;
  return inserted;
}

async function apiPut(table, id, data) {
  const payload = { ...data };
  const { data: updated, error } = await tableQuery(table).update(payload).eq('id', id).select().single();
  if (error) throw error;
  return updated;
}

async function apiDelete(table, id) {
  const { error } = await tableQuery(table).delete().eq('id', id);
  if (error) throw error;
}

async function loadCurrentUser() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user || null;
}

async function loadCurrentProfile(userId) {
  try {
    const { data, error } = await tableQuery('profiles').select('*').eq('id', userId).single();
    if (error) throw error;
    return data;
  } catch (_) {
    return null;
  }
}

async function requireAuth() {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.href = 'login.html';
    throw new Error('Usuário não autenticado');
  }
  return data.session;
}

async function setupUserHeader() {
  try {
    const session = await requireAuth();
    const user = session.user;
    const profile = await loadCurrentProfile(user.id);
    const supabase = getSupabase();

    const nameEl = document.getElementById('topbarUserName');
    const emailEl = document.getElementById('topbarUserEmail');
    const roleEl = document.getElementById('topbarUserRole');
    const avatarEl = document.querySelector('.user-avatar');

    const displayName =
      profile?.full_name ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'Usuário';

    const displayRole = profile?.role || 'viewer';

    if (nameEl) nameEl.textContent = displayName;
    if (emailEl) emailEl.textContent = user.email || '';
    if (roleEl) roleEl.textContent = displayRole;

    const topbarSpan = document.querySelector('.topbar-user span');
    if (topbarSpan) topbarSpan.textContent = displayName;

    if (avatarEl && displayName) {
      avatarEl.innerHTML = `<span>${displayName.charAt(0).toUpperCase()}</span>`;
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
      };
    }

    window.currentUserProfile = profile;
    console.log('Perfil carregado:', profile);
  } catch (e) {
    console.error('Erro em setupUserHeader:', e);
  }
}

function canEditByRole(role) {
  return ['admin', 'consultor', 'assistente'].includes(role);
}

function isAdminRole(role) {
  return role === 'admin';
}

function applyPermissions(profile) {
  const role = profile?.role || 'viewer';
  console.log('Aplicando permissões para role:', role);

  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.style.display = canEditByRole(role) ? '' : 'none';
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.style.display = isAdminRole(role) ? '' : 'none';
  });

  document.querySelectorAll('[data-admin-only="true"]').forEach(el => {
    el.style.display = isAdminRole(role) ? '' : 'none';
  });
}
// ==========================================
//  TOAST
// ==========================================
function toast(msg, type = 'success') {
  const icons = { success: 'fa-check-circle', warning: 'fa-exclamation-circle', error: 'fa-times-circle' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<i class="fas ${icons[type] || icons.success}"></i><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => { el.classList.add('exit'); setTimeout(() => el.remove(), 350); }, 3200);
}

// ==========================================
//  NAVIGATION
// ==========================================
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById(`page-${page}`);
  if (pg) pg.classList.add('active');
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');
  State.currentPage = page;
  updateBreadcrumb(page);
  loadPage(page);
  // close mobile sidebar
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.querySelector('.sidebar-backdrop')?.classList.remove('open');
}

const breadcrumbMap = {
  dashboard:      '<i class="fas fa-chart-pie"></i> Dashboard',
  clientes:       '<i class="fas fa-building"></i> Clientes',
  licencas:       '<i class="fas fa-certificate"></i> Licenças Ambientais',
  condicionantes: '<i class="fas fa-tasks"></i> Condicionantes & Prazos',
  checklists:     '<i class="fas fa-clipboard-check"></i> Checklists',
  modelos:        '<i class="fas fa-file-alt"></i> Modelos de Documentos',
  prazos:         '<i class="fas fa-calendar-exclamation"></i> Agenda de Prazos',
  orcamentos: '<i class="fas fa-file-invoice-dollar"></i> Orçamentos',
  'relatorios-visitas': '<i class="fas fa-clipboard-list"></i> Relatórios de Visitas',
  financeiro: '<i class="fas fa-wallet"></i> Financeiro',
};

function updateBreadcrumb(page) {
  document.getElementById('breadcrumb').innerHTML = breadcrumbMap[page] || page;
}

async function loadPage(page) {
  switch (page) {
    case 'dashboard':      await loadDashboard();      break;
    case 'clientes':       await loadClientes();       break;
    case 'licencas':       await loadLicencas();       break;
    case 'condicionantes': await loadCondicionantes();  break;
    case 'checklists':     await loadChecklists();     break;
    case 'modelos':        await loadModelos();        break;
    case 'prazos':         await loadPrazos();         break;
case 'orcamentos':
  if (typeof loadOrcamentos === "function") {
    await loadOrcamentos();
  }
  break;

case 'relatorios-visitas':
  if (typeof loadRelatoriosVisitas === "function") {
    await loadRelatoriosVisitas();
  }
  if (typeof loadClientesRelatorioVisita === "function") {
    await loadClientesRelatorioVisita();
  }
  break;

case 'financeiro':
  if (typeof loadFinanceiro === "function") {
    await loadFinanceiro();
  }
  if (typeof loadClientesFinanceiro === "function") {
    await loadClientesFinanceiro();
  }
  break;
  }
}

// ==========================================
//  UTILS
// ==========================================
function fmtDate(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (isNaN(d)) return dt;
  return d.toLocaleDateString('pt-BR');
}

function diasRestantes(date) {
  if (!date) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(date); d.setHours(0,0,0,0);
  return Math.round((d - today) / 86400000);
}

function daysTag(dias) {
  if (dias === null) return '<span class="days-indicator days-expired">—</span>';
  if (dias < 0)   return `<span class="days-indicator days-expired"><i class="fas fa-times"></i> Vencida</span>`;
  if (dias === 0) return `<span class="days-indicator days-danger"><i class="fas fa-exclamation"></i> Vence Hoje</span>`;
  if (dias <= 30) return `<span class="days-indicator days-danger"><i class="fas fa-fire"></i> ${dias}d</span>`;
  if (dias <= 90) return `<span class="days-indicator days-warning"><i class="fas fa-clock"></i> ${dias}d</span>`;
  return `<span class="days-indicator days-ok"><i class="fas fa-check"></i> ${dias}d</span>`;
}

function statusBadge(status, type = 'licenca') {
  const map = {
    'Vigente':       'status-vigente',
    'Vencida':       'status-vencida',
    'Em Renovação':  'status-renovacao',
    'Suspensa':      'status-suspensa',
    'Em Análise':    'status-analise',
    'Cancelada':     'status-cancelada',
    'Ativo':         'status-ativo',
    'Inativo':       'status-inativo',
    'Prospecto':     'status-prospecto',
    'Pendente':      'status-pendente',
    'Em Andamento':  'status-andamento',
    'Cumprida':      'status-cumprida',
    'Atrasada':      'status-atrasada',
    'Concluído':     'status-cumprida',
    'Arquivado':     'status-cancelada',
    'Ativo ':        'status-ativo',
    'Rascunho':      'status-prospecto',
  };
  const cls = map[status] || 'badge-muted';
  return `<span class="badge ${cls}">${status || '—'}</span>`;
}

function priorBadge(prioridade) {
  const map = { 'Alta': 'priority-alta', 'Média': 'priority-media', 'Baixa': 'priority-baixa' };
  return `<span class="badge ${map[prioridade] || 'badge-muted'}">${prioridade || '—'}</span>`;
}

function getClienteNome(id) {
  const c = State.clientes.find(x => x.id === id);
  return c ? (c.nome_fantasia || c.razao_social || '—') : '—';
}
function getLicencaNum(id) {
  const l = State.licencas.find(x => x.id === id);
  return l ? `${l.tipo?.split(' ')[0] || ''} ${l.numero || ''}`.trim() : '—';
}

// ==========================================
//  MODAL
// ==========================================
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('open');
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('open');
}

// ==========================================
//  CONFIRM DELETE
// ==========================================
function confirmDelete(msg, callback) {
  document.getElementById('confirmMessage').textContent = msg;
  document.getElementById('confirmBtn').onclick = () => { closeModal('modalConfirm'); callback(); };
  openModal('modalConfirm');
}

// ==========================================
//  DASHBOARD
// ==========================================
async function loadDashboard() {
  try {
    const [cliRes, licRes, condRes] = await Promise.all([
      apiGet('clientes', { limit: 500 }),
      apiGet('licencas', { limit: 500 }),
      apiGet('condicionantes', { limit: 500 }),
    ]);
    State.clientes       = cliRes.data  || [];
    State.licencas       = licRes.data  || [];
    State.condicionantes = condRes.data || [];

    renderStats();
    renderDashLicVenc();
    renderDashCondUrgentes();
    renderChartLicencas();
    renderChartCondicionantes();
    updateTopbarAlert();
  } catch (e) { console.error(e); }
}

function renderStats() {
  const today = new Date(); today.setHours(0,0,0,0);
  const ativas   = State.clientes.filter(c => c.status === 'Ativo').length;
  const vigentes = State.licencas.filter(l => l.status === 'Vigente').length;
  const vencidas = State.licencas.filter(l => l.status === 'Vencida').length;
  const pendentes= State.condicionantes.filter(c => c.status === 'Pendente' || c.status === 'Em Andamento').length;
  const atrasadas= State.condicionantes.filter(c => c.status === 'Atrasada').length;

  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card stat-green">
      <div class="stat-icon"><i class="fas fa-building"></i></div>
      <div class="stat-info">
        <div class="stat-value">${State.clientes.length}</div>
        <div class="stat-label">Total de Clientes</div>
        <div class="stat-sub">${ativas} ativos</div>
      </div>
    </div>
    <div class="stat-card stat-blue">
      <div class="stat-icon"><i class="fas fa-certificate"></i></div>
      <div class="stat-info">
        <div class="stat-value">${State.licencas.length}</div>
        <div class="stat-label">Licenças Cadastradas</div>
        <div class="stat-sub">${vigentes} vigentes</div>
      </div>
    </div>
    <div class="stat-card stat-orange">
      <div class="stat-icon"><i class="fas fa-tasks"></i></div>
      <div class="stat-info">
        <div class="stat-value">${pendentes}</div>
        <div class="stat-label">Condicionantes Pendentes</div>
        <div class="stat-sub">${atrasadas} atrasadas</div>
      </div>
    </div>
    <div class="stat-card stat-red">
      <div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
      <div class="stat-info">
        <div class="stat-value">${vencidas}</div>
        <div class="stat-label">Licenças Vencidas</div>
        <div class="stat-sub">Requer atenção</div>
      </div>
    </div>
    <div class="stat-card stat-teal">
      <div class="stat-icon"><i class="fas fa-clipboard-check"></i></div>
      <div class="stat-info">
        <div class="stat-value">${State.condicionantes.length}</div>
        <div class="stat-label">Condicionantes Total</div>
        <div class="stat-sub">${State.condicionantes.filter(c=>c.status==='Cumprida').length} cumpridas</div>
      </div>
    </div>
  `;
}

function renderDashLicVenc() {
  const divs = document.getElementById('licencasVencimento');
  const proximas = State.licencas
    .filter(l => l.data_validade && l.status !== 'Cancelada')
    .map(l => ({ ...l, dias: diasRestantes(l.data_validade) }))
    .filter(l => l.dias !== null && l.dias <= 90)
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 5);

  document.getElementById('badgeLicVenc').textContent = proximas.length;

  if (!proximas.length) {
    divs.innerHTML = '<div class="empty-list"><i class="fas fa-check-circle"></i>Nenhuma licença vencendo em 90 dias</div>';
    return;
  }
  divs.innerHTML = proximas.map(l => {
    const cls = l.dias < 0 ? 'item-danger red' : l.dias <= 30 ? 'item-danger red' : 'item-warning orange';
    return `
      <div class="list-item ${cls.split(' ')[0]}">
        <div class="list-item-icon ${cls.split(' ')[1]}"><i class="fas fa-certificate"></i></div>
        <div class="list-item-info">
          <div class="list-item-title">${l.tipo?.split(' ')[0] || 'Lic.'} Nº ${l.numero || '—'}</div>
          <div class="list-item-sub">${getClienteNome(l.cliente_id)} · ${l.orgao_emissor || '—'}</div>
        </div>
        <div class="list-item-badge">${daysTag(l.dias)}</div>
      </div>`;
  }).join('');
}

function renderDashCondUrgentes() {
  const div = document.getElementById('condicionantesUrgentes');
  const urgentes = State.condicionantes
    .filter(c => c.prazo && c.status !== 'Cumprida' && c.status !== 'Cancelada')
    .map(c => ({ ...c, dias: diasRestantes(c.prazo) }))
    .filter(c => c.dias !== null && c.dias <= 60)
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 5);

  document.getElementById('badgeCond').textContent = urgentes.length;

  if (!urgentes.length) {
    div.innerHTML = '<div class="empty-list"><i class="fas fa-check-circle"></i>Nenhuma condicionante urgente</div>';
    return;
  }
  div.innerHTML = urgentes.map(c => {
    const cls = c.dias < 0 ? 'item-danger red' : c.dias <= 15 ? 'item-danger red' : 'item-warning orange';
    return `
      <div class="list-item ${cls.split(' ')[0]}">
        <div class="list-item-icon ${cls.split(' ')[1]}"><i class="fas fa-tasks"></i></div>
        <div class="list-item-info">
          <div class="list-item-title">${c.numero ? `(${c.numero})` : ''} ${(c.descricao || '').replace(/<[^>]*>/g,'').substring(0,60)}${(c.descricao||'').length>60?'...':''}</div>
          <div class="list-item-sub">${getClienteNome(c.cliente_id)}</div>
        </div>
        <div class="list-item-badge">${daysTag(c.dias)}</div>
      </div>`;
  }).join('');
}

function renderChartLicencas() {
  const ctx = document.getElementById('chartLicencas');
  if (!ctx) return;
  if (State.charts.licencas) { State.charts.licencas.destroy(); }

  const tipos = {};
  State.licencas.forEach(l => {
    const t = (l.tipo || 'Outro').split(' ')[0];
    tipos[t] = (tipos[t] || 0) + 1;
  });

  const labels = Object.keys(tipos);
  const data   = Object.values(tipos);
  const colors = ['#1e7d4b','#40c074','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#14b8a6','#f97316'];

  State.charts.licencas = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Quantidade', data, backgroundColor: colors.slice(0, labels.length), borderRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#e8f0ea' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderChartCondicionantes() {
  const ctx = document.getElementById('chartCondicionantes');
  if (!ctx) return;
  if (State.charts.cond) { State.charts.cond.destroy(); }

  const statuses = {};
  State.condicionantes.forEach(c => {
    statuses[c.status || 'Pendente'] = (statuses[c.status || 'Pendente'] || 0) + 1;
  });

  const colorMap = {
    'Pendente':     '#f59e0b',
    'Em Andamento': '#3b82f6',
    'Cumprida':     '#22c55e',
    'Atrasada':     '#ef4444',
    'Cancelada':    '#9ca3af',
  };

  const labels = Object.keys(statuses);
  const data   = Object.values(statuses);
  const bgColors = labels.map(l => colorMap[l] || '#9ca3af');

  State.charts.cond = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: bgColors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 12 } } } },
      cutout: '65%',
    }
  });
}

function updateTopbarAlert() {
  const count = State.licencas.filter(l => {
    const d = diasRestantes(l.data_validade);
    return d !== null && d <= 30 && l.status !== 'Cancelada';
  }).length + State.condicionantes.filter(c => {
    const d = diasRestantes(c.prazo);
    return d !== null && d <= 15 && c.status !== 'Cumprida' && c.status !== 'Cancelada';
  }).length;

  const el = document.getElementById('topbarAlert');
  document.getElementById('alertCount').textContent = count;
  el.style.display = count > 0 ? 'flex' : 'none';
}

// ==========================================
//  CLIENTES
// ==========================================
async function loadClientes(page = 1) {
  const search = document.getElementById('searchClientes')?.value || '';
  const status = document.getElementById('filterClienteStatus')?.value || '';
  const { limit } = State.pagination.clientes;
  try {
    const res = await apiGet('clientes', { page, limit, search });
    let data = res.data || [];
    if (status) data = data.filter(c => c.status === status);
    State.clientes = res.data || [];
    State.pagination.clientes = { page, limit, total: res.total || data.length };
    renderClientesTable(data);
    renderPagination('paginationClientes', page, Math.ceil((res.total || data.length) / limit), loadClientes);
  } catch (e) { toast('Erro ao carregar clientes', 'error'); }
}

function renderClientesTable(data) {
  const tbody = document.getElementById('tbodyClientes');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row"><i class="fas fa-building" style="margin-right:8px;opacity:.3"></i>Nenhum cliente cadastrado</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(c => `
    <tr>
      <td>
        <div class="fw-bold">${c.razao_social || '—'}</div>
        <div style="font-size:.78rem;color:var(--text-muted)">${c.nome_fantasia || ''}</div>
      </td>
      <td><span style="font-family:monospace;font-size:.82rem">${c.cnpj_cpf || '—'}</span></td>
      <td>${c.setor || '—'}</td>
      <td>${c.municipio ? `${c.municipio}/${c.estado || ''}` : '—'}</td>
      <td>
        <div style="font-size:.83rem">${c.responsavel || '—'}</div>
        <div style="font-size:.75rem;color:var(--text-muted)">${c.email || ''}</div>
      </td>
      <td>${statusBadge(c.status)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm btn-outline btn-icon" title="Editar" onclick="editCliente('${c.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-icon" style="background:var(--danger-light);color:var(--danger)" title="Excluir" onclick="deleteCliente('${c.id}')"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function openClienteModal() {
  clearClienteForm();
  document.getElementById('modalClienteTitle').innerHTML = '<i class="fas fa-building"></i> Novo Cliente';
  openModal('modalCliente');
}

function clearClienteForm() {
  ['clienteId','clienteRazaoSocial','clienteNomeFantasia','clienteCnpj','clienteSetor',
   'clienteEmail','clienteTelefone','clienteResponsavel','clienteEndereco','clienteMunicipio',
   'clienteObservacoes'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  const st = document.getElementById('clienteStatus'); if(st) st.value = 'Ativo';
  const tp = document.getElementById('clienteTipo');   if(tp) tp.value = 'PJ';
  const es = document.getElementById('clienteEstado'); if(es) es.value = '';
}

async function saveCliente() {
  const razao = document.getElementById('clienteRazaoSocial').value.trim();
  if (!razao) { toast('Informe a Razão Social / Nome', 'warning'); return; }

  const data = {
    razao_social:   razao,
    nome_fantasia:  document.getElementById('clienteNomeFantasia').value.trim(),
    tipo:           document.getElementById('clienteTipo').value,
    cnpj_cpf:       document.getElementById('clienteCnpj').value.trim(),
    setor:          document.getElementById('clienteSetor').value.trim(),
    status:         document.getElementById('clienteStatus').value,
    email:          document.getElementById('clienteEmail').value.trim(),
    telefone:       document.getElementById('clienteTelefone').value.trim(),
    responsavel:    document.getElementById('clienteResponsavel').value.trim(),
    endereco:       document.getElementById('clienteEndereco').value.trim(),
    municipio:      document.getElementById('clienteMunicipio').value.trim(),
    estado:         document.getElementById('clienteEstado').value,
    observacoes:    document.getElementById('clienteObservacoes').value.trim(),
  };

  const id = document.getElementById('clienteId').value;
  try {
    if (id) { await apiPut('clientes', id, data); toast('Cliente atualizado!'); }
    else    { await apiPost('clientes', data); toast('Cliente cadastrado!'); }
    closeModal('modalCliente');
    loadClientes();
  } catch (e) { toast('Erro ao salvar cliente', 'error'); }
}

async function editCliente(id) {
  try {
    const c = await apiGetById('clientes', id);
    document.getElementById('clienteId').value          = c.id;
    document.getElementById('clienteRazaoSocial').value = c.razao_social || '';
    document.getElementById('clienteNomeFantasia').value= c.nome_fantasia || '';
    document.getElementById('clienteTipo').value        = c.tipo || 'PJ';
    document.getElementById('clienteCnpj').value        = c.cnpj_cpf || '';
    document.getElementById('clienteSetor').value       = c.setor || '';
    document.getElementById('clienteStatus').value      = c.status || 'Ativo';
    document.getElementById('clienteEmail').value       = c.email || '';
    document.getElementById('clienteTelefone').value    = c.telefone || '';
    document.getElementById('clienteResponsavel').value = c.responsavel || '';
    document.getElementById('clienteEndereco').value    = c.endereco || '';
    document.getElementById('clienteMunicipio').value   = c.municipio || '';
    document.getElementById('clienteEstado').value      = c.estado || '';
    document.getElementById('clienteObservacoes').value = c.observacoes || '';
    document.getElementById('modalClienteTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Cliente';
    openModal('modalCliente');
  } catch (e) { toast('Erro ao carregar cliente', 'error'); }
}

function deleteCliente(id) {
  confirmDelete('Excluir este cliente? Todos os dados relacionados podem ser afetados.', async () => {
    try { await apiDelete('clientes', id); toast('Cliente excluído', 'warning'); loadClientes(); }
    catch (e) { toast('Erro ao excluir', 'error'); }
  });
}

// ==========================================
//  LICENÇAS
// ==========================================
async function loadLicencas(page = 1) {
  const search = document.getElementById('searchLicencas')?.value || '';
  const status = document.getElementById('filterLicencaStatus')?.value || '';
  const tipo   = document.getElementById('filterLicencaTipo')?.value || '';
  const { limit } = State.pagination.licencas;
  try {
    const [licRes, cliRes] = await Promise.all([
      apiGet('licencas', { page, limit, search }),
      apiGet('clientes', { limit: 500 }),
    ]);
    State.licencas = licRes.data || [];
    State.clientes = cliRes.data || [];
    let data = licRes.data || [];
    if (status) data = data.filter(l => l.status === status);
    if (tipo)   data = data.filter(l => l.tipo === tipo);
    State.pagination.licencas = { page, limit, total: licRes.total };
    renderLicencasTable(data);
    renderPagination('paginationLicencas', page, Math.ceil((licRes.total || data.length) / limit), loadLicencas);
  } catch (e) { toast('Erro ao carregar licenças', 'error'); }
}

function renderLicencasTable(data) {
  const tbody = document.getElementById('tbodyLicencas');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-row"><i class="fas fa-certificate" style="margin-right:8px;opacity:.3"></i>Nenhuma licença cadastrada</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(l => {
    const dias = diasRestantes(l.data_validade);
    return `
      <tr>
        <td><span class="fw-bold" style="color:var(--primary)">${l.numero || '—'}</span></td>
        <td class="truncate" style="max-width:160px">${getClienteNome(l.cliente_id)}</td>
        <td><span class="badge badge-primary">${(l.tipo||'').split(' ')[0] || '—'}</span></td>
        <td>${l.orgao_emissor || '—'}</td>
        <td>${fmtDate(l.data_emissao)}</td>
        <td>${fmtDate(l.data_validade)}</td>
        <td>${daysTag(dias)}</td>
        <td>${statusBadge(l.status)}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-sm btn-outline btn-icon" title="Editar" onclick="editLicenca('${l.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-icon" style="background:var(--danger-light);color:var(--danger)" title="Excluir" onclick="deleteLicenca('${l.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

async function openLicencaModal() {
  await loadClientesSelect('licencaClienteId');
  clearLicencaForm();
  document.getElementById('modalLicencaTitle').innerHTML = '<i class="fas fa-certificate"></i> Nova Licença Ambiental';
  openModal('modalLicenca');
}

function clearLicencaForm() {
  ['licencaId','licencaNumero','licencaEmpreendimento','licencaNumeroProcesso',
   'licencaOrgaoEmissor','licencaAtividade','licencaDataEmissao','licencaDataValidade',
   'licencaObservacoes'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  const s = document.getElementById('licencaStatus'); if(s) s.value = 'Vigente';
}

async function loadClientesSelect(selectId) {
  try {
    const res = await apiGet('clientes', { limit: 500 });
    State.clientes = res.data || [];
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Selecione o cliente...</option>' +
      State.clientes.map(c => `<option value="${c.id}">${c.razao_social || c.nome_fantasia}</option>`).join('');
    if (cur) sel.value = cur;
  } catch (e) {}
}

async function saveLicenca() {
  const clienteId = document.getElementById('licencaClienteId').value;
  const tipo      = document.getElementById('licencaTipo').value;
  const numero    = document.getElementById('licencaNumero').value.trim();
  if (!clienteId) { toast('Selecione o cliente', 'warning'); return; }
  if (!tipo)      { toast('Selecione o tipo de licença', 'warning'); return; }
  if (!numero)    { toast('Informe o número da licença', 'warning'); return; }

  const data = {
    cliente_id:      clienteId,
    tipo, numero,
    empreendimento:  document.getElementById('licencaEmpreendimento').value.trim(),
    numero_processo: document.getElementById('licencaNumeroProcesso').value.trim(),
    orgao_emissor:   document.getElementById('licencaOrgaoEmissor').value.trim(),
    atividade:       document.getElementById('licencaAtividade').value.trim(),
    data_emissao:    document.getElementById('licencaDataEmissao').value || null,
    data_validade:   document.getElementById('licencaDataValidade').value || null,
    status:          document.getElementById('licencaStatus').value,
    observacoes:     document.getElementById('licencaObservacoes').value.trim(),
  };

  const id = document.getElementById('licencaId').value;
  try {
    if (id) { await apiPut('licencas', id, data); toast('Licença atualizada!'); }
    else    { await apiPost('licencas', data); toast('Licença cadastrada!'); }
    closeModal('modalLicenca');
    loadLicencas();
  } catch (e) { toast('Erro ao salvar licença', 'error'); }
}

async function editLicenca(id) {
  await loadClientesSelect('licencaClienteId');
  try {
    const l = await apiGetById('licencas', id);
    document.getElementById('licencaId').value           = l.id;
    document.getElementById('licencaClienteId').value    = l.cliente_id || '';
    document.getElementById('licencaTipo').value         = l.tipo || '';
    document.getElementById('licencaNumero').value       = l.numero || '';
    document.getElementById('licencaEmpreendimento').value = l.empreendimento || '';
    document.getElementById('licencaNumeroProcesso').value = l.numero_processo || '';
    document.getElementById('licencaOrgaoEmissor').value = l.orgao_emissor || '';
    document.getElementById('licencaAtividade').value    = l.atividade || '';
    document.getElementById('licencaDataEmissao').value  = l.data_emissao ? l.data_emissao.split('T')[0] : '';
    document.getElementById('licencaDataValidade').value = l.data_validade ? l.data_validade.split('T')[0] : '';
    document.getElementById('licencaStatus').value       = l.status || 'Vigente';
    document.getElementById('licencaObservacoes').value  = l.observacoes || '';
    document.getElementById('modalLicencaTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Licença';
    openModal('modalLicenca');
  } catch (e) { toast('Erro ao carregar licença', 'error'); }
}

function deleteLicenca(id) {
  confirmDelete('Excluir esta licença ambiental?', async () => {
    try { await apiDelete('licencas', id); toast('Licença excluída', 'warning'); loadLicencas(); }
    catch (e) { toast('Erro ao excluir', 'error'); }
  });
}

// ==========================================
//  CONDICIONANTES
// ==========================================
async function loadCondicionantes(page = 1) {
  const search  = document.getElementById('searchCondicionantes')?.value || '';
  const status  = document.getElementById('filterCondStatus')?.value || '';
  const prior   = document.getElementById('filterCondPrioridade')?.value || '';
  const { limit } = State.pagination.condicionantes;
  try {
    const [condRes, cliRes, licRes] = await Promise.all([
      apiGet('condicionantes', { page, limit, search }),
      apiGet('clientes', { limit: 500 }),
      apiGet('licencas', { limit: 500 }),
    ]);
    State.condicionantes = condRes.data || [];
    State.clientes       = cliRes.data  || [];
    State.licencas       = licRes.data  || [];
    let data = condRes.data || [];
    if (status) data = data.filter(c => c.status === status);
    if (prior)  data = data.filter(c => c.prioridade === prior);
    State.pagination.condicionantes = { page, limit, total: condRes.total };
    renderCondicionantesTable(data);
    renderPagination('paginationCondicionantes', page, Math.ceil((condRes.total || data.length) / limit), loadCondicionantes);
  } catch (e) { toast('Erro ao carregar condicionantes', 'error'); }
}

function renderCondicionantesTable(data) {
  const tbody = document.getElementById('tbodyCondicionantes');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-row"><i class="fas fa-tasks" style="margin-right:8px;opacity:.3"></i>Nenhuma condicionante cadastrada</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(c => {
    const dias = diasRestantes(c.prazo);
    const descTrunc = (c.descricao || '').replace(/<[^>]*>/g,'').substring(0, 70);
    return `
      <tr>
        <td><span class="badge badge-muted">${c.numero || '—'}</span></td>
        <td style="max-width:220px">
          <div style="font-size:.85rem;line-height:1.3">${descTrunc}${(c.descricao||'').length>70?'...':''}</div>
        </td>
        <td class="truncate" style="max-width:140px">${getClienteNome(c.cliente_id)}</td>
        <td><span style="font-size:.78rem;color:var(--text-muted)">${getLicencaNum(c.licenca_id)}</span></td>
        <td><span class="badge badge-muted" style="font-size:.72rem">${c.categoria || '—'}</span></td>
        <td>
          <div>${fmtDate(c.prazo)}</div>
          <div>${daysTag(dias)}</div>
        </td>
        <td>${priorBadge(c.prioridade)}</td>
        <td>${statusBadge(c.status)}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-sm btn-outline btn-icon" title="Editar" onclick="editCondicionante('${c.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-icon" style="background:var(--danger-light);color:var(--danger)" title="Excluir" onclick="deleteCondicionante('${c.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

async function openCondicionanteModal() {
  await Promise.all([
    loadClientesSelect('condClienteId'),
  ]);
  clearCondForm();
  document.getElementById('modalCondicionanteTitle').innerHTML = '<i class="fas fa-tasks"></i> Nova Condicionante';
  openModal('modalCondicionante');
}

function clearCondForm() {
  ['condicionanteId','condNumero','condDescricao','condResponsavel','condObservacoes',
   'condPrazo','condDataCumprimento'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  const s = document.getElementById('condStatus');       if(s) s.value='Pendente';
  const p = document.getElementById('condPrioridade');   if(p) p.value='Média';
  const per = document.getElementById('condPeriodicidade'); if(per) per.value='Pontual';
  const cat = document.getElementById('condCategoria');  if(cat) cat.value='Programa Ambiental';
}

async function loadLicencasForCond() {
  const clienteId = document.getElementById('condClienteId').value;
  const sel = document.getElementById('condLicencaId');
  if (!clienteId) { sel.innerHTML = '<option value="">Selecione o cliente primeiro...</option>'; return; }
  try {
    const res = await apiGet('licencas', { limit: 500 });
    const filtered = (res.data || []).filter(l => l.cliente_id === clienteId);
    sel.innerHTML = '<option value="">Selecione a licença...</option>' +
      filtered.map(l => `<option value="${l.id}">${l.tipo?.split(' ')[0]} Nº ${l.numero} (${l.orgao_emissor || ''})</option>`).join('');
  } catch(e) {}
}

async function saveCondicionante() {
  const clienteId = document.getElementById('condClienteId').value;
  const descr = document.getElementById('condDescricao').value.trim();
  const prazo = document.getElementById('condPrazo').value;
  if (!clienteId) { toast('Selecione o cliente', 'warning'); return; }
  if (!descr)     { toast('Informe a descrição', 'warning'); return; }
  if (!prazo)     { toast('Informe o prazo', 'warning'); return; }

  const data = {
    cliente_id:      clienteId,
    licenca_id:      document.getElementById('condLicencaId').value || '',
    numero:          document.getElementById('condNumero').value.trim(),
    descricao:       descr,
    categoria:       document.getElementById('condCategoria').value,
    prazo:           prazo || null,
    periodicidade:   document.getElementById('condPeriodicidade').value,
    prioridade:      document.getElementById('condPrioridade').value,
    status:          document.getElementById('condStatus').value,
    responsavel:     document.getElementById('condResponsavel').value.trim(),
    observacoes:     document.getElementById('condObservacoes').value.trim(),
    data_cumprimento:document.getElementById('condDataCumprimento').value || null,
  };

  const id = document.getElementById('condicionanteId').value;
  try {
    if (id) { await apiPut('condicionantes', id, data); toast('Condicionante atualizada!'); }
    else    { await apiPost('condicionantes', data); toast('Condicionante cadastrada!'); }
    closeModal('modalCondicionante');
    loadCondicionantes();
  } catch (e) { toast('Erro ao salvar condicionante', 'error'); }
}

async function editCondicionante(id) {
  await loadClientesSelect('condClienteId');
  try {
    const c = await apiGetById('condicionantes', id);
    document.getElementById('condicionanteId').value  = c.id;
    document.getElementById('condClienteId').value    = c.cliente_id || '';
    await loadLicencasForCond();
    document.getElementById('condLicencaId').value    = c.licenca_id || '';
    document.getElementById('condNumero').value       = c.numero || '';
    document.getElementById('condDescricao').value    = (c.descricao || '').replace(/<[^>]*>/g,'');
    document.getElementById('condCategoria').value    = c.categoria || '';
    document.getElementById('condPrazo').value        = c.prazo ? c.prazo.split('T')[0] : '';
    document.getElementById('condPeriodicidade').value= c.periodicidade || 'Pontual';
    document.getElementById('condPrioridade').value   = c.prioridade || 'Média';
    document.getElementById('condStatus').value       = c.status || 'Pendente';
    document.getElementById('condResponsavel').value  = c.responsavel || '';
    document.getElementById('condObservacoes').value  = (c.observacoes || '').replace(/<[^>]*>/g,'');
    document.getElementById('condDataCumprimento').value = c.data_cumprimento ? c.data_cumprimento.split('T')[0] : '';
    document.getElementById('modalCondicionanteTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Condicionante';
    openModal('modalCondicionante');
  } catch (e) { toast('Erro ao carregar condicionante', 'error'); }
}

function deleteCondicionante(id) {
  confirmDelete('Excluir esta condicionante?', async () => {
    try { await apiDelete('condicionantes', id); toast('Condicionante excluída', 'warning'); loadCondicionantes(); }
    catch (e) { toast('Erro ao excluir', 'error'); }
  });
}

// ==========================================
//  CHECKLISTS
// ==========================================
async function loadChecklists() {
  const search = document.getElementById('searchChecklists')?.value || '';
  const status = document.getElementById('filterCheckStatus')?.value || '';
  try {
    const [ckRes, cliRes] = await Promise.all([
      apiGet('checklists', { limit: 100, search }),
      apiGet('clientes', { limit: 500 }),
    ]);
    State.checklists = ckRes.data || [];
    State.clientes   = cliRes.data || [];
    let data = ckRes.data || [];
    if (status) data = data.filter(c => c.status === status);
    renderChecklistsGrid(data);
  } catch (e) { toast('Erro ao carregar checklists', 'error'); }
}

function renderChecklistsGrid(data) {
  const grid = document.getElementById('checklistsGrid');
  if (!data.length) {
    grid.innerHTML = '<div class="empty-state"><i class="fas fa-clipboard-check"></i><p>Nenhum checklist cadastrado</p></div>';
    return;
  }
  grid.innerHTML = data.map(ck => {
    let itens = [];
    try { itens = JSON.parse(ck.itens || '[]'); } catch(e) {}
    const total   = itens.length;
    const done    = itens.filter(i => i.done).length;
    const pct     = total ? Math.round((done/total)*100) : 0;
    const cliente = getClienteNome(ck.cliente_id);
    return `
      <div class="checklist-card" onclick="viewChecklist('${ck.id}')">
        <div class="cc-header">
          <div>
            <div class="cc-title">${ck.titulo || 'Sem título'}</div>
            <div class="cc-category">${ck.categoria || ''} ${cliente !== '—' ? '· '+cliente : ''}</div>
          </div>
          ${statusBadge(ck.status)}
        </div>
        <div class="cc-progress">
          <div class="cc-progress-label"><span>${done}/${total} itens</span><span>${pct}%</span></div>
          <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="cc-footer">
          <span><i class="fas fa-list" style="margin-right:5px"></i>${total} itens</span>
          <div class="cc-actions" onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-outline btn-icon" title="Editar" onclick="editChecklist('${ck.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-icon" style="background:var(--danger-light);color:var(--danger)" title="Excluir" onclick="deleteChecklist('${ck.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>`;
  }).join('');
}

async function openChecklistModal() {
  await loadClientesSelect('checklistClienteId');
  clearChecklistForm();
  document.getElementById('modalChecklistTitle').innerHTML = '<i class="fas fa-clipboard-check"></i> Novo Checklist';
  openModal('modalChecklist');
}

function clearChecklistForm() {
  ['checklistId','checklistTitulo','checklistObservacoes'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  const s = document.getElementById('checklistStatus'); if(s) s.value='Em Andamento';
  const cat = document.getElementById('checklistCategoria'); if(cat) cat.value='Licenciamento Ambiental';
  State.checklistItems = [];
  renderChecklistEditorItems();
}

function renderChecklistEditorItems() {
  const list = document.getElementById('checklistItemsList');
  if (!list) return;
  if (!State.checklistItems.length) {
    list.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:.85rem"><i class="fas fa-plus-circle" style="margin-right:5px;opacity:.4"></i>Adicione itens ao checklist</div>';
    return;
  }
  list.innerHTML = State.checklistItems.map((item, i) => `
    <div class="checklist-item-row ${item.done ? 'done' : ''}">
      <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleEditorItem(${i})"/>
      <span class="item-label">${item.texto}</span>
      <button class="item-del-btn" onclick="removeEditorItem(${i})"><i class="fas fa-times"></i></button>
    </div>`).join('');
}

function addChecklistItem() {
  const input = document.getElementById('novoItemTexto');
  const texto = input.value.trim();
  if (!texto) return;
  State.checklistItems.push({ texto, done: false });
  input.value = '';
  renderChecklistEditorItems();
  input.focus();
}
function toggleEditorItem(i) { State.checklistItems[i].done = !State.checklistItems[i].done; renderChecklistEditorItems(); }
function removeEditorItem(i) { State.checklistItems.splice(i, 1); renderChecklistEditorItems(); }

async function saveChecklist() {
  const titulo = document.getElementById('checklistTitulo').value.trim();
  if (!titulo) { toast('Informe o título do checklist', 'warning'); return; }
  const pct = State.checklistItems.length
    ? Math.round((State.checklistItems.filter(i=>i.done).length / State.checklistItems.length)*100)
    : 0;
  const data = {
    titulo,
    cliente_id:   document.getElementById('checklistClienteId').value || '',
    categoria:    document.getElementById('checklistCategoria').value,
    status:       document.getElementById('checklistStatus').value,
    observacoes:  document.getElementById('checklistObservacoes').value.trim(),
    itens:        JSON.stringify(State.checklistItems),
    percentual:   pct,
    data_criacao: new Date().toISOString(),
  };
  const id = document.getElementById('checklistId').value;
  try {
    if (id) { await apiPut('checklists', id, data); toast('Checklist atualizado!'); }
    else    { await apiPost('checklists', data); toast('Checklist criado!'); }
    closeModal('modalChecklist');
    loadChecklists();
  } catch (e) { toast('Erro ao salvar checklist', 'error'); }
}

async function editChecklist(id) {
  await loadClientesSelect('checklistClienteId');
  try {
    const ck = await apiGetById('checklists', id);
    document.getElementById('checklistId').value         = ck.id;
    document.getElementById('checklistTitulo').value     = ck.titulo || '';
    document.getElementById('checklistClienteId').value  = ck.cliente_id || '';
    document.getElementById('checklistCategoria').value  = ck.categoria || '';
    document.getElementById('checklistStatus').value     = ck.status || 'Em Andamento';
    document.getElementById('checklistObservacoes').value= ck.observacoes || '';
    try { State.checklistItems = JSON.parse(ck.itens || '[]'); } catch(e) { State.checklistItems = []; }
    renderChecklistEditorItems();
    document.getElementById('modalChecklistTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Checklist';
    openModal('modalChecklist');
  } catch (e) { toast('Erro ao carregar checklist', 'error'); }
}

async function viewChecklist(id) {
  try {
    const ck = await apiGetById('checklists', id);
    let itens = [];
    try { itens = JSON.parse(ck.itens || '[]'); } catch(e) {}
    const done = itens.filter(i=>i.done).length;
    const pct  = itens.length ? Math.round((done/itens.length)*100) : 0;
    document.getElementById('modalVerChecklistTitle').innerHTML =
      `<i class="fas fa-clipboard-check"></i> ${ck.titulo || 'Checklist'}`;
    document.getElementById('modalVerChecklistBody').innerHTML = `
      <div class="view-checklist-header">
        <div>
          ${statusBadge(ck.status)}
          <span class="view-progress-text" style="margin-left:8px">${getClienteNome(ck.cliente_id)}</span>
        </div>
        <span class="view-progress-text">${done}/${itens.length} · ${pct}%</span>
      </div>
      <div style="margin-bottom:16px">
        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="view-checklist-items" id="viewItems_${id}">
        ${itens.map((item, i) => `
          <div class="view-item-row ${item.done ? 'done' : ''}" id="vir_${id}_${i}" onclick="toggleViewItem('${id}', ${i})">
            <input type="checkbox" ${item.done ? 'checked' : ''} onclick="event.stopPropagation(); toggleViewItem('${id}', ${i})"/>
            <span class="view-item-label">${item.texto}</span>
          </div>`).join('') || '<div class="empty-list">Sem itens neste checklist.</div>'
        }
      </div>`;
    // store reference to update
    window._viewChecklistId   = id;
    window._viewChecklistData = ck;
    window._viewChecklistItems = itens;
    openModal('modalVerChecklist');
  } catch (e) { toast('Erro ao abrir checklist', 'error'); }
}

async function toggleViewItem(checklistId, idx) {
  window._viewChecklistItems[idx].done = !window._viewChecklistItems[idx].done;
  const pct = window._viewChecklistItems.length
    ? Math.round((window._viewChecklistItems.filter(i=>i.done).length / window._viewChecklistItems.length)*100) : 0;
  await apiPut('checklists', checklistId, {
    ...window._viewChecklistData,
    itens: JSON.stringify(window._viewChecklistItems),
    percentual: pct,
  });
  viewChecklist(checklistId);
  loadChecklists();
}

function deleteChecklist(id) {
  confirmDelete('Excluir este checklist?', async () => {
    try { await apiDelete('checklists', id); toast('Checklist excluído', 'warning'); loadChecklists(); }
    catch (e) { toast('Erro ao excluir', 'error'); }
  });
}

// ==========================================
//  MODELOS DE DOCUMENTOS
// ==========================================
async function loadModelos() {
  const search   = document.getElementById('searchModelos')?.value || '';
  const categoria= document.getElementById('filterModeloCategoria')?.value || '';
  try {
    const res = await apiGet('modelos_documentos', { limit: 200, search });
    State.modelos = res.data || [];
    let data = res.data || [];
    if (categoria) data = data.filter(m => m.categoria === categoria);
    renderModelosGrid(data);
  } catch (e) { toast('Erro ao carregar modelos', 'error'); }
}

const modeloIcons = {
  'Relatório Ambiental': 'fa-file-chart-line',
  'Requerimento':        'fa-file-signature',
  'Ofício':              'fa-envelope',
  'Projeto':             'fa-drafting-compass',
  'Procuração':          'fa-user-shield',
  'Contrato':            'fa-file-contract',
  'Checklist':           'fa-clipboard-check',
  'Plano de Trabalho':   'fa-project-diagram',
  'ART/TRT':             'fa-stamp',
  'Outro':               'fa-file-alt',
};

function renderModelosGrid(data) {
  const grid = document.getElementById('modelosGrid');
  if (!data.length) {
    grid.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><p>Nenhum modelo cadastrado</p></div>';
    return;
  }
  grid.innerHTML = data.map(m => {
    const icon = modeloIcons[m.categoria] || 'fa-file-alt';
    const tags = (m.tags || '').split(',').filter(t => t.trim()).slice(0, 4);
    return `
      <div class="modelo-card">
        <div class="mc-header">
          <div class="mc-icon-row">
            <div class="mc-icon"><i class="fas ${icon}"></i></div>
            <div>
              <div class="mc-title">${m.titulo || 'Sem título'}</div>
              <div class="mc-category">${m.categoria || '—'}</div>
            </div>
          </div>
        </div>
        <div class="mc-desc">${m.descricao || 'Sem descrição'}</div>
        <div class="mc-tags">${tags.map(t => `<span class="mc-tag">${t.trim()}</span>`).join('')}</div>
        <div class="mc-footer">
          <span class="mc-version">${statusBadge(m.status)} ${m.versao ? '· '+m.versao : ''}</span>
          <div class="mc-actions">
            <button class="btn btn-sm btn-outline" onclick="viewModelo('${m.id}')"><i class="fas fa-eye"></i></button>
            <button class="btn btn-sm btn-outline btn-icon" onclick="editModelo('${m.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-icon" style="background:var(--danger-light);color:var(--danger)" onclick="deleteModelo('${m.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function clearModeloForm() {
  ['modeloId','modeloTitulo','modeloDescricao','modeloTags','modeloConteudo'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  const s = document.getElementById('modeloStatus'); if(s) s.value='Ativo';
  const v = document.getElementById('modeloVersao'); if(v) v.value='v1.0';
}

async function saveModelo() {
  const titulo = document.getElementById('modeloTitulo').value.trim();
  if (!titulo) { toast('Informe o título do modelo', 'warning'); return; }
  const data = {
    titulo,
    categoria:  document.getElementById('modeloCategoria').value,
    status:     document.getElementById('modeloStatus').value,
    versao:     document.getElementById('modeloVersao').value.trim(),
    descricao:  document.getElementById('modeloDescricao').value.trim(),
    tags:       document.getElementById('modeloTags').value.trim(),
    conteudo:   document.getElementById('modeloConteudo').value.trim(),
  };
  const id = document.getElementById('modeloId').value;
  try {
    if (id) { await apiPut('modelos_documentos', id, data); toast('Modelo atualizado!'); }
    else    { await apiPost('modelos_documentos', data); toast('Modelo criado!'); }
    closeModal('modalModelo');
    loadModelos();
  } catch (e) { toast('Erro ao salvar modelo', 'error'); }
}

async function editModelo(id) {
  try {
    const m = await apiGetById('modelos_documentos', id);
    document.getElementById('modeloId').value        = m.id;
    document.getElementById('modeloTitulo').value    = m.titulo || '';
    document.getElementById('modeloCategoria').value = m.categoria || '';
    document.getElementById('modeloStatus').value    = m.status || 'Ativo';
    document.getElementById('modeloVersao').value    = m.versao || 'v1.0';
    document.getElementById('modeloDescricao').value = m.descricao || '';
    document.getElementById('modeloTags').value      = m.tags || '';
    document.getElementById('modeloConteudo').value  = (m.conteudo || '').replace(/<[^>]*>/g,'');
    document.getElementById('modalModeloTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Modelo';
    openModal('modalModelo');
  } catch (e) { toast('Erro ao carregar modelo', 'error'); }
}

async function viewModelo(id) {
  try {
    const m = await apiGetById('modelos_documentos', id);
    document.getElementById('modalVerModeloTitle').innerHTML = `<i class="fas fa-file-alt"></i> ${m.titulo}`;
    document.getElementById('modalVerModeloBody').innerHTML = `
      <div class="modelo-meta">
        <span class="badge badge-primary">${m.categoria || '—'}</span>
        ${statusBadge(m.status)}
        ${m.versao ? `<span class="badge badge-muted">${m.versao}</span>` : ''}
      </div>
      ${m.descricao ? `<p style="margin-bottom:12px;color:var(--text-muted);font-size:.875rem">${m.descricao}</p>` : ''}
      <div class="modelo-preview-content">${(m.conteudo || '').replace(/<[^>]*>/g,'') || 'Sem conteúdo'}</div>`;
    openModal('modalVerModelo');
  } catch (e) { toast('Erro ao abrir modelo', 'error'); }
}

function deleteModelo(id) {
  confirmDelete('Excluir este modelo de documento?', async () => {
    try { await apiDelete('modelos_documentos', id); toast('Modelo excluído', 'warning'); loadModelos(); }
    catch (e) { toast('Erro ao excluir', 'error'); }
  });
}

// ==========================================
//  AGENDA DE PRAZOS
// ==========================================
async function loadPrazos() {
  const periodo = parseInt(document.getElementById('filterPrazoPeriodo')?.value || 90);
  const tipo    = document.querySelector('.chip.active')?.dataset.type || 'all';
  try {
    const [licRes, condRes, cliRes] = await Promise.all([
      apiGet('licencas',       { limit: 500 }),
      apiGet('condicionantes', { limit: 500 }),
      apiGet('clientes',       { limit: 500 }),
    ]);
    State.licencas       = licRes.data  || [];
    State.condicionantes = condRes.data || [];
    State.clientes       = cliRes.data  || [];

    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const items = [];

    if (tipo === 'all' || tipo === 'licenca') {
      State.licencas.filter(l => l.data_validade && l.status !== 'Cancelada').forEach(l => {
        const dias = diasRestantes(l.data_validade);
        if (dias !== null && dias <= periodo) {
          items.push({ type: 'licenca', dias, label: `${(l.tipo||'').split(' ')[0]} Nº ${l.numero}`, sub: getClienteNome(l.cliente_id), meta: `${l.orgao_emissor || ''} · Validade: ${fmtDate(l.data_validade)}`, status: l.status, id: l.id });
        }
      });
    }

    if (tipo === 'all' || tipo === 'condicionante') {
      State.condicionantes.filter(c => c.prazo && c.status !== 'Cumprida' && c.status !== 'Cancelada').forEach(c => {
        const dias = diasRestantes(c.prazo);
        if (dias !== null && dias <= periodo) {
          items.push({ type: 'condicionante', dias, label: `${c.numero ? `(${c.numero}) ` : ''}${(c.descricao||'').replace(/<[^>]*>/g,'').substring(0,60)}`, sub: getClienteNome(c.cliente_id), meta: `Prazo: ${fmtDate(c.prazo)} · ${c.prioridade || ''} · ${c.status || ''}`, status: c.status, id: c.id });
        }
      });
    }

    items.sort((a, b) => a.dias - b.dias);
    renderPrazosList(items);
  } catch (e) { toast('Erro ao carregar agenda', 'error'); }
}

function renderPrazosList(items) {
  const div = document.getElementById('prazosList');
  if (!items.length) {
    div.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-check"></i><p>Nenhum prazo encontrado no período</p></div>';
    return;
  }
  div.innerHTML = items.map(item => {
    const isRed    = item.dias <= 15;
    const isOrange = item.dias > 15 && item.dias <= 45;
    const colorCls = isRed ? 'red' : isOrange ? 'orange' : 'green';
    const cardCls  = isRed ? 'urgente' : isOrange ? 'alerta' : '';
    const typeIcon = item.type === 'licenca' ? 'fa-certificate' : 'fa-tasks';
    const daysLabel = item.dias < 0 ? 'Vencido' : item.dias === 0 ? 'Hoje' : `${item.dias} dias`;
    return `
      <div class="prazo-item ${cardCls}">
        <div class="prazo-icon ${colorCls}"><i class="fas ${typeIcon}"></i></div>
        <div class="prazo-info">
          <div class="prazo-title">${item.label}</div>
          <div class="prazo-sub">${item.sub}</div>
          <div class="prazo-meta">${item.meta} ${statusBadge(item.status)}</div>
        </div>
        <div class="prazo-date">
          <div class="prazo-days ${colorCls}">${daysLabel}</div>
          <div class="prazo-date-label">${item.type === 'licenca' ? 'Licença' : 'Condicionante'}</div>
        </div>
      </div>`;
  }).join('');
}

// ==========================================
//  PAGINATION
// ==========================================
function renderPagination(containerId, currentPage, totalPages, loadFn) {
  const div = document.getElementById(containerId);
  if (!div || totalPages <= 1) { if(div) div.innerHTML=''; return; }
  let html = '';
  if (currentPage > 1) html += `<button class="page-btn" onclick="${loadFn.name}(${currentPage-1})"><i class="fas fa-chevron-left"></i></button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage-1 && i <= currentPage+1)) {
      html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="${loadFn.name}(${i})">${i}</button>`;
    } else if (i === currentPage-2 || i === currentPage+2) {
      html += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`;
    }
  }
  if (currentPage < totalPages) html += `<button class="page-btn" onclick="${loadFn.name}(${currentPage+1})"><i class="fas fa-chevron-right"></i></button>`;
  div.innerHTML = html;
}

// ==========================================
//  SIDEBAR MOBILE
// ==========================================
function setupMobileSidebar() {
  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);

  document.getElementById('mobileToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('mobile-open');
    backdrop.classList.toggle('open');
  });
  backdrop.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('mobile-open');
    backdrop.classList.remove('open');
  });
}

// ==========================================
//  SEARCH & FILTER LISTENERS
// ==========================================
function setupListeners() {
  // Navegação
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      if (page) navigateTo(page);
    });
  });

  // Searches
  let searchTimer;
  const debounce = (fn) => { clearTimeout(searchTimer); searchTimer = setTimeout(fn, 350); };

  document.getElementById('searchClientes')?.addEventListener('input', () => debounce(loadClientes));
  document.getElementById('searchLicencas')?.addEventListener('input', () => debounce(loadLicencas));
  document.getElementById('searchCondicionantes')?.addEventListener('input', () => debounce(loadCondicionantes));
  document.getElementById('searchChecklists')?.addEventListener('input', () => debounce(loadChecklists));
  document.getElementById('searchModelos')?.addEventListener('input', () => debounce(loadModelos));

  // Filters
  document.getElementById('filterClienteStatus')?.addEventListener('change', loadClientes);
  document.getElementById('filterLicencaStatus')?.addEventListener('change', loadLicencas);
  document.getElementById('filterLicencaTipo')?.addEventListener('change', loadLicencas);
  document.getElementById('filterCondStatus')?.addEventListener('change', loadCondicionantes);
  document.getElementById('filterCondPrioridade')?.addEventListener('change', loadCondicionantes);
  document.getElementById('filterCheckStatus')?.addEventListener('change', loadChecklists);
  document.getElementById('filterModeloCategoria')?.addEventListener('change', loadModelos);
  document.getElementById('filterPrazoPeriodo')?.addEventListener('change', loadPrazos);

  // Prazo type chips
  document.getElementById('filterPrazosTipo')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    document.querySelectorAll('#filterPrazosTipo .chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    loadPrazos();
  });

  // Open modals via "Novo" buttons - fix button references
  document.querySelector('[onclick="openModal(\'modalCliente\')"]')?.addEventListener('click', (e) => { e.preventDefault(); clearClienteForm(); document.getElementById('clienteId').value = ''; openModal('modalCliente'); });
  document.querySelector('[onclick="openModal(\'modalLicenca\')"]')?.addEventListener('click', async (e) => { e.preventDefault(); await loadClientesSelect('licencaClienteId'); clearLicencaForm(); openModal('modalLicenca'); });
  document.querySelector('[onclick="openModal(\'modalCondicionante\')"]')?.addEventListener('click', async (e) => { e.preventDefault(); await loadClientesSelect('condClienteId'); clearCondForm(); openModal('modalCondicionante'); });
  document.querySelector('[onclick="openModal(\'modalChecklist\')"]')?.addEventListener('click', async (e) => { e.preventDefault(); await loadClientesSelect('checklistClienteId'); clearChecklistForm(); openModal('modalChecklist'); });
  document.querySelector('[onclick="openModal(\'modalModelo\')"]')?.addEventListener('click', (e) => { e.preventDefault(); clearModeloForm(); document.getElementById('modeloId').value = ''; openModal('modalModelo'); });

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });
}
// ==========================================
//  INIT
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const session = await requireAuth();
    if (!session) return;

    await setupUserHeader();

    const profile = await loadCurrentProfile(session.user.id);
    console.log('Perfil vindo do banco no DOMContentLoaded:', profile);

    applyPermissions(profile);

    setupMobileSidebar();
    setupListeners();

    navigateTo('dashboard');
  } catch (e) {
    console.error('Erro na inicialização:', e);
  }
});
    const lic = document.getElementById('licencasVencimento');
    if (lic) {
      lic.innerHTML = '<div class="empty-list">Carregamento inicial leve ativado.</div>';
    }

    const cond = document.getElementById('condicionantesUrgentes');
    if (cond) {
      cond.innerHTML = '<div class="empty-list">Abra os módulos pelo menu lateral.</div>';
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', logoutUser);
    }

  } catch (e) {
    console.error('Erro ao iniciar sistema:', e);
    alert('Erro ao iniciar o sistema: ' + (e.message || e));
  }

  if (typeof loadOrcamentos === "function") {
  await loadOrcamentos();
}

if (typeof loadRelatoriosVisitas === "function") {
  await loadRelatoriosVisitas();
}

if (typeof loadClientesRelatorioVisita === "function") {
  await loadClientesRelatorioVisita();
}

if (typeof loadFinanceiro === "function") {
  await loadFinanceiro();
}

if (typeof loadClientesFinanceiro === "function") {
  await loadClientesFinanceiro();
}
});
