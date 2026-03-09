async function loadFinanceiro() {
  const tbody = document.getElementById("tbodyFinanceiro");
  if (!tbody) return;

  const { data, error } = await supabase
    .from("financeiro")
    .select(`
      *,
      clientes(razao_social)
    `)
    .order("data_vencimento", { ascending: true });

  if (error) {
    console.error("Erro ao carregar financeiro:", error);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-row">Erro ao carregar lançamentos.</td>
      </tr>
    `;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-row">Nenhum lançamento cadastrado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.map(item => `
    <tr>
      <td>${capitalize(item.tipo)}</td>
      <td>${item.clientes?.razao_social || "-"}</td>
      <td>${item.descricao || "-"}</td>
      <td>${formatDateBR(item.data_vencimento)}</td>
      <td>${formatMoney(item.valor)}</td>
      <td>${item.status || "-"}</td>
      <td>
        <button class="btn-edit" onclick="editFinanceiro('${item.id}')">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn-delete" onclick="deleteFinanceiro('${item.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join("");
}

async function loadClientesFinanceiro() {
  const select = document.getElementById("financeiroClienteId");
  if (!select) return;

  const { data, error } = await supabase
    .from("clientes")
    .select("id, razao_social")
    .order("razao_social", { ascending: true });

  if (error) {
    console.error("Erro ao carregar clientes para financeiro:", error);
    return;
  }

  select.innerHTML = `<option value="">Selecione...</option>` +
    data.map(cliente => `<option value="${cliente.id}">${cliente.razao_social}</option>`).join("");
}

async function saveFinanceiro() {
  const id = document.getElementById("financeiroId")?.value || "";
  const tipo = document.getElementById("financeiroTipo")?.value || "receita";
  const cliente_id = document.getElementById("financeiroClienteId")?.value || null;
  const descricao = document.getElementById("financeiroDescricao")?.value?.trim() || "";
  const categoria = document.getElementById("financeiroCategoria")?.value?.trim() || null;
  const data_vencimento = document.getElementById("financeiroDataVencimento")?.value || null;
  const data_pagamento = document.getElementById("financeiroDataPagamento")?.value || null;
  const valor = Number(document.getElementById("financeiroValor")?.value || 0);
  const valor_pago = Number(document.getElementById("financeiroValorPago")?.value || 0);
  const status = document.getElementById("financeiroStatus")?.value || "pendente";
  const forma_pagamento = document.getElementById("financeiroFormaPagamento")?.value?.trim() || null;
  const observacoes = document.getElementById("financeiroObservacoes")?.value?.trim() || null;

  if (!descricao) {
    alert("Informe a descrição.");
    return;
  }

  if (!data_vencimento) {
    alert("Informe a data de vencimento.");
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
    tipo,
    cliente_id,
    descricao,
    categoria,
    data_vencimento,
    data_pagamento,
    valor,
    valor_pago,
    status,
    forma_pagamento,
    observacoes,
    updated_by: user.id
  };

  let error;

  if (id) {
    ({ error } = await supabase
      .from("financeiro")
      .update(payload)
      .eq("id", id));
  } else {
    payload.created_by = user.id;
    ({ error } = await supabase
      .from("financeiro")
      .insert([payload]));
  }

  if (error) {
    console.error("Erro ao salvar lançamento financeiro:", error);
    alert("Erro ao salvar lançamento: " + error.message);
    return;
  }

  clearFinanceiroForm();
  closeModal("modalFinanceiro");
  await loadFinanceiro();
}

async function editFinanceiro(id) {
  const { data, error } = await supabase
    .from("financeiro")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("Erro ao buscar lançamento financeiro:", error);
    alert("Erro ao carregar lançamento.");
    return;
  }

  document.getElementById("financeiroId").value = data.id || "";
  document.getElementById("financeiroTipo").value = data.tipo || "receita";
  document.getElementById("financeiroClienteId").value = data.cliente_id || "";
  document.getElementById("financeiroDescricao").value = data.descricao || "";
  document.getElementById("financeiroCategoria").value = data.categoria || "";
  document.getElementById("financeiroDataVencimento").value = data.data_vencimento || "";
  document.getElementById("financeiroDataPagamento").value = data.data_pagamento || "";
  document.getElementById("financeiroValor").value = data.valor || 0;
  document.getElementById("financeiroValorPago").value = data.valor_pago || 0;
  document.getElementById("financeiroStatus").value = data.status || "pendente";
  document.getElementById("financeiroFormaPagamento").value = data.forma_pagamento || "";
  document.getElementById("financeiroObservacoes").value = data.observacoes || "";

  openModal("modalFinanceiro");
}

async function deleteFinanceiro(id) {
  if (!confirm("Deseja realmente excluir este lançamento?")) return;

  const { error } = await supabase
    .from("financeiro")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao excluir lançamento financeiro:", error);
    alert("Erro ao excluir lançamento: " + error.message);
    return;
  }

  await loadFinanceiro();
}

function clearFinanceiroForm() {
  const fields = [
    "financeiroId",
    "financeiroTipo",
    "financeiroClienteId",
    "financeiroDescricao",
    "financeiroCategoria",
    "financeiroDataVencimento",
    "financeiroDataPagamento",
    "financeiroValor",
    "financeiroValorPago",
    "financeiroStatus",
    "financeiroFormaPagamento",
    "financeiroObservacoes"
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

  const valorPago = document.getElementById("financeiroValorPago");
  if (valorPago) valorPago.value = 0;
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

function capitalize(text) {
  if (!text) return "-";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

window.loadFinanceiro = loadFinanceiro;
window.loadClientesFinanceiro = loadClientesFinanceiro;
window.saveFinanceiro = saveFinanceiro;
window.editFinanceiro = editFinanceiro;
window.deleteFinanceiro = deleteFinanceiro;
window.clearFinanceiroForm = clearFinanceiroForm;