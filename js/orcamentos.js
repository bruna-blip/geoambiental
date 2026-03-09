const supabase = window.supabaseClient;

async function loadOrcamentos() {
  const tbody = document.getElementById("tbodyOrcamentos");
  if (!tbody) return;

  const { data, error } = await supabase
    .from("orcamentos")
    .select(`
      *,
      clientes(razao_social)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar orçamentos:", error);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-row">Erro ao carregar orçamentos.</td>
      </tr>
    `;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-row">Nenhum orçamento cadastrado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.map(o => `
    <tr>
      <td>${o.numero || "-"}</td>
      <td>${o.clientes?.razao_social || "-"}</td>
      <td>${o.titulo || "-"}</td>
      <td>${o.status || "-"}</td>
      <td>${formatDateBR(o.validade)}</td>
      <td>${formatMoney(o.valor_final)}</td>
      <td>
        <button class="btn-edit" onclick="editOrcamento('${o.id}')">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn-delete" onclick="deleteOrcamento('${o.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join("");
}

async function loadClientesOrcamento() {
  const select = document.getElementById("orcamentoClienteId");
  if (!select) return;

  const { data, error } = await supabase
    .from("clientes")
    .select("id, razao_social")
    .order("razao_social", { ascending: true });

  if (error) {
    console.error("Erro ao carregar clientes para orçamento:", error);
    return;
  }

  select.innerHTML = `<option value="">Selecione...</option>` +
    data.map(cliente => `<option value="${cliente.id}">${cliente.razao_social}</option>`).join("");
}

async function saveOrcamento() {
  const id = document.getElementById("orcamentoId")?.value || "";
  const cliente_id = document.getElementById("orcamentoClienteId")?.value || null;
  const numero = document.getElementById("orcamentoNumero")?.value?.trim() || null;
  const titulo = document.getElementById("orcamentoTitulo")?.value?.trim() || "";
  const data_orcamento = document.getElementById("orcamentoData")?.value || null;
  const validade = document.getElementById("orcamentoValidade")?.value || null;
  const status = document.getElementById("orcamentoStatus")?.value || "rascunho";
  const valor_total = Number(document.getElementById("orcamentoValorTotal")?.value || 0);
  const desconto = Number(document.getElementById("orcamentoDesconto")?.value || 0);
  const valor_final_input = document.getElementById("orcamentoValorFinal")?.value;
  const valor_final = valor_final_input ? Number(valor_final_input) : (valor_total - desconto);
  const descricao = document.getElementById("orcamentoDescricao")?.value?.trim() || null;
  const condicoes_pagamento = document.getElementById("orcamentoCondicoesPagamento")?.value?.trim() || null;
  const prazo_execucao = document.getElementById("orcamentoPrazoExecucao")?.value?.trim() || null;
  const observacoes = document.getElementById("orcamentoObservacoes")?.value?.trim() || null;

  if (!cliente_id) {
    alert("Selecione o cliente.");
    return;
  }

  if (!titulo) {
    alert("Informe o título do orçamento.");
    return;
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    alert("Usuário não autenticado.");
    return;
  }

  const payload = {
    cliente_id,
    numero,
    titulo,
    data_orcamento,
    validade,
    status,
    valor_total,
    desconto,
    valor_final,
    descricao,
    condicoes_pagamento,
    prazo_execucao,
    observacoes,
    updated_by: user.id
  };

  let error;

  if (id) {
    ({ error } = await supabase
      .from("orcamentos")
      .update(payload)
      .eq("id", id));
  } else {
    payload.created_by = user.id;
    ({ error } = await supabase
      .from("orcamentos")
      .insert([payload]));
  }

  if (error) {
    console.error("Erro ao salvar orçamento:", error);
    alert("Erro ao salvar orçamento: " + error.message);
    return;
  }

  clearOrcamentoForm();
  closeModal("modalOrcamento");
  await loadOrcamentos();
}

async function editOrcamento(id) {
  const { data, error } = await supabase
    .from("orcamentos")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("Erro ao buscar orçamento:", error);
    alert("Erro ao carregar orçamento.");
    return;
  }

  document.getElementById("orcamentoId").value = data.id || "";
  document.getElementById("orcamentoClienteId").value = data.cliente_id || "";
  document.getElementById("orcamentoNumero").value = data.numero || "";
  document.getElementById("orcamentoTitulo").value = data.titulo || "";
  document.getElementById("orcamentoData").value = data.data_orcamento || "";
  document.getElementById("orcamentoValidade").value = data.validade || "";
  document.getElementById("orcamentoStatus").value = data.status || "rascunho";
  document.getElementById("orcamentoValorTotal").value = data.valor_total || 0;
  document.getElementById("orcamentoDesconto").value = data.desconto || 0;
  document.getElementById("orcamentoValorFinal").value = data.valor_final || 0;
  document.getElementById("orcamentoDescricao").value = data.descricao || "";
  document.getElementById("orcamentoCondicoesPagamento").value = data.condicoes_pagamento || "";
  document.getElementById("orcamentoPrazoExecucao").value = data.prazo_execucao || "";
  document.getElementById("orcamentoObservacoes").value = data.observacoes || "";

  openModal("modalOrcamento");
}

async function deleteOrcamento(id) {
  if (!confirm("Deseja realmente excluir este orçamento?")) return;

  const { error } = await supabase
    .from("orcamentos")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao excluir orçamento:", error);
    alert("Erro ao excluir orçamento: " + error.message);
    return;
  }

  await loadOrcamentos();
}

function clearOrcamentoForm() {
  const fields = [
    "orcamentoId",
    "orcamentoClienteId",
    "orcamentoNumero",
    "orcamentoTitulo",
    "orcamentoData",
    "orcamentoValidade",
    "orcamentoStatus",
    "orcamentoValorTotal",
    "orcamentoDesconto",
    "orcamentoValorFinal",
    "orcamentoDescricao",
    "orcamentoCondicoesPagamento",
    "orcamentoPrazoExecucao",
    "orcamentoObservacoes"
  ];

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === "SELECT") {
      el.selectedIndex = 0;
    } else {
      el.value = "";
    }
  });

  const descontoEl = document.getElementById("orcamentoDesconto");
  if (descontoEl) descontoEl.value = 0;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatDateBR(value) {
  if (!value) return "-";
  const date = new Date(value + "T00:00:00");
  return date.toLocaleDateString("pt-BR");
}

window.loadOrcamentos = loadOrcamentos;
window.loadClientesOrcamento = loadClientesOrcamento;
window.saveOrcamento = saveOrcamento;
window.editOrcamento = editOrcamento;
window.deleteOrcamento = deleteOrcamento;
window.clearOrcamentoForm = clearOrcamentoForm;