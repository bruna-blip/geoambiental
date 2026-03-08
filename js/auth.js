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

document.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log("auth.js carregado");

    if (!window.supabaseClient) {
      setMessage("Supabase não foi carregado.", "error");
      return;
    }

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      console.error("Erro ao verificar sessão:", error);
    }

    if (data?.session) {
      window.location.href = "index.html";
      return;
    }

    const form = document.getElementById("loginForm");
    if (!form) {
      setMessage("Formulário de login não encontrado.", "error");
      return;
    }

    form.addEventListener("submit", loginWithPassword);
    console.log("Evento de submit conectado com sucesso");
  } catch (err) {
    console.error("Erro ao iniciar auth.js:", err);
    setMessage("Erro ao iniciar a tela de login.", "error");
  }
});

async function loginWithPassword(event) {
  event.preventDefault();
  console.log("Função loginWithPassword executada");

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const submitBtn = document.getElementById("loginSubmit");

  if (!email || !password) {
    setMessage("Informe e-mail e senha.", "error");
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  setMessage("Entrando...", "info");

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    console.log("Resposta do Supabase:", { data, error });

    if (error) {
      setMessage(error.message, "error");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    if (!data?.session) {
      setMessage("Login não retornou sessão válida.", "error");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    window.location.href = "index.html";
  } catch (err) {
    console.error("Erro inesperado no login:", err);
    setMessage("Erro inesperado ao tentar login.", "error");
    if (submitBtn) submitBtn.disabled = false;
  }
}