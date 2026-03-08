function setMessage(message, type = "error") {
  const box = document.getElementById("loginMessage");
  if (!box) {
    alert(message);
    return;
  }

  box.textContent = message;
  box.className = `login-message ${type}`;
  box.style.display = "block";
}

async function loginWithPassword(event) {
  if (event) event.preventDefault();

  setMessage("Botão clicado. Testando login...", "info");

  if (!window.supabaseClient) {
    setMessage("Supabase não foi carregado.", "error");
    return;
  }

  const emailEl = document.getElementById("loginEmail");
  const passwordEl = document.getElementById("loginPassword");

  if (!emailEl || !passwordEl) {
    setMessage("Campos de login não encontrados.", "error");
    return;
  }

  const email = emailEl.value.trim();
  const password = passwordEl.value;

  if (!email || !password) {
    setMessage("Informe e-mail e senha.", "error");
    return;
  }

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setMessage("Erro: " + error.message, "error");
      return;
    }

    if (!data?.session) {
      setMessage("Login sem sessão válida.", "error");
      return;
    }

    setMessage("Login realizado com sucesso.", "info");
    window.location.href = "index.html";
  } catch (err) {
    setMessage("Erro inesperado: " + err.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const box = document.getElementById("loginMessage");
  if (box) {
    box.style.display = "block";
    box.textContent = "Tela de login carregada.";
  }

  if (!window.supabaseClient) {
    setMessage("Supabase não foi carregado ao abrir a página.", "error");
    return;
  }

  try {
    const { data } = await supabaseClient.auth.getSession();
    if (data?.session) {
      window.location.href = "index.html";
    }
  } catch (err) {
    setMessage("Erro ao verificar sessão: " + err.message, "error");
  }
});