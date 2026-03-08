document.addEventListener("DOMContentLoaded", async () => {

  const { data } = await supabaseClient.auth.getSession();

  if (data?.session) {
    window.location.href = "index.html";
    return;
  }

});
const GeoAmbientalConfig = window.GEO_AMBIENTAL_CONFIG || {};
const SUPABASE_URL = GeoAmbientalConfig.supabaseUrl || '';
const SUPABASE_ANON_KEY = GeoAmbientalConfig.supabaseAnonKey || '';
const DASHBOARD_PAGE = GeoAmbientalConfig.dashboardPage || 'index.html';

if (!window.supabase?.createClient) {
  throw new Error('Biblioteca do Supabase não carregada.');
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

function getNextUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('next') || DASHBOARD_PAGE;
}

function setMessage(message, type = 'info') {
  const el = document.getElementById('loginMessage');
  if (!el) return;
  el.textContent = message;
  el.className = `login-message ${type}`;
}

async function ensureLoggedOutPage() {
  const { data } = await supabaseClient.auth.getSession();
  if (data?.session) {
    window.location.href = getNextUrl();
  }
}

async function loginWithPassword(event) {
  event.preventDefault();

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const submitBtn = document.getElementById('loginSubmit');

  if (!email || !password) {
    setMessage('Informe e-mail e senha.', 'error');
    return;
  }

  submitBtn.disabled = true;

  try {

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      setMessage(error.message, 'error');
      submitBtn.disabled = false;
      return;
    }

    // login OK
    window.location.href = "index.html";

  } catch (err) {

    console.error(err);
    setMessage('Erro inesperado ao tentar login.', 'error');
    submitBtn.disabled = false;

  }
}

  submitBtn.disabled = true;
  setMessage('Entrando...', 'info');

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  submitBtn.disabled = false;

  if (error) {
    setMessage(error.message || 'Não foi possível entrar.', 'error');
    return;
  }

  window.location.href = getNextUrl();
}

async function requestPasswordReset(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) {
    setMessage('Digite seu e-mail para receber o link de redefinição.', 'error');
    return;
  }

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}${window.location.pathname}`,
  });

  if (error) {
    setMessage(error.message || 'Não foi possível enviar o link.', 'error');
    return;
  }

  setMessage('Link de redefinição enviado. Verifique seu e-mail.', 'success');
}

document.addEventListener('DOMContentLoaded', async () => {
  await ensureLoggedOutPage();
  document.getElementById('loginForm')?.addEventListener('submit', loginWithPassword);
  document.getElementById('forgotPassword')?.addEventListener('click', requestPasswordReset);
});
