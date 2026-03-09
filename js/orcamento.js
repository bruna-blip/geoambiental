import { supabase } from "./supabase.js";

const formOrcamento = document.getElementById("form-orcamento");
const orcamentosTbody = document.getElementById("orcamentos-tbody");
const clienteSelect = document.getElementById("orcamento_cliente_id");
const responsavelSelect = document.getElementById("orcamento_responsavel_id");

async function getCurrentUser() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Erro ao obter usuário:", error);
    return null;
  }

  return user;
}

function formatCurrency(value) {
  const number = Number(value || 0);
  return number.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

async function carregarClientesOrcamento() {
  if (!clienteSelect) return;

  const { data, error } = await supabase
    .from("clientes")
    .select("id, razao_social")
    .order("razao_social", { ascending: true });

  if (error) {
    console.error("Erro ao carregar clientes:", error);
    return;
  }

  clienteSelect.innerHTML = `<option value="">Selecione um cliente</option>`;

  data.forEach((cliente) => {
    const option = document.createElement("option");
    option.value = cliente.id;
    option.textContent = cliente.razao_social;
    clienteSelect.appendChild(option);
  });
}

async function carregarResponsaveisOrcamento() {
  if (!responsavelSelect) return;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Erro ao carregar responsáveis:", error);
    return;
  }

  responsavelSelect.innerHTML = `<option value="">Selecione</option>`;

  data.forEach((usuario) => {
    const option = document.createElement("option");
    option.value = usuario.id;
    option.textContent = `${usuario.full_name} (${usuario.role})`;
    responsavelSelect.appendChild(option);
  });
}

async function listarOrcamentos() {
  if (!orcamentosTbody) return;

  const { data, error } = await supabase
    .from("orcamentos")
    .select(`
      id,
      numero,
      titulo,
      status,
      validade,
      valor_final,
      clientes (
        razao_social
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao listar orçamentos:", error);
    orcamentosTbody.innerHTML = `
      <tr>
        <td colspan="7">Erro ao carregar orçamentos.</td>
      </tr>
    `;
    return;
  }

  if (!data || data.length === 0) {
    orcamentosTbody.innerHTML = `
      <tr>
        <td colspan="7">Nenhum orçamento cadastrado.</td>
      </tr>
    `;
    return;
  }

  orcamentosTbody.innerHTML = data
    .map((orcamento) => {
      const clienteNome = orcamento.clientes?.razao_social || "-";

      return `
        <tr>
          <td>${orcamento.numero || "-"}</td>
          <td>${clienteNome}</td>
          <td>${orcamento.titulo || "-"}</td>
          <td>${orcamento.status || "-"}</td>
          <td>${formatDate(orcamento.validade)}</td>
          <td>${formatCurrency(orcamento.valor_final)}</td>
          <td>
            <button class="btn-edit" data-id="${orcamento.id}">Editar</button>
            <button class="btn-delete" data-id="${orcamento.id}">Excluir</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function salvarOrcamento(event) {
  event.preventDefault();

  const user = await getCurrentUser();

  if (!user) {
    alert("Usuário não autenticado.");
    return;
  }

  const cliente_id = document.getElementById("orcamento_cliente_id").value;
  const numero = document.getElementById("orcamento_numero").value.trim();
  const titulo = document.getElementById("orcamento_titulo").value.trim();
  const descricao = document.getElementById("orcamento_descricao").value.trim();
  const data_orcamento = document.getElementById("orcamento_data").value || null;
  const validade = document.getElementById("orcamento_validade").value || null;
  const status = document.getElementById("orcamento_status").value;
  const valor_total = Number(document.getElementById("orcamento_valor_total").value || 0);
  const desconto = Number(document.getElementById("orcamento_desconto").value || 0);
  const valor_final_input = document.getElementById("orcamento_valor_final").value;
  const valor_final = valor_final_input ? Number(valor_final_input) : valor_total - desconto;
  const condicoes_pagamento = document.getElementById("orcamento_condicoes_pagamento").value.trim();
  const prazo_execucao = document.getElementById("orcamento_prazo_execucao").value.trim();
  const observacoes = document.getElementById("orcamento_observacoes").value.trim();
  const responsavel_id = document.getElementById("orcamento_responsavel_id").value || null;

  if (!cliente_id) {
    alert("Selecione um cliente.");
    return;
  }

  if (!titulo) {
    alert("Informe o título do orçamento.");
    return;
  }

  const payload = {
    cliente_id,
    numero: numero || null,
    titulo,
    descricao: descricao || null,
    data_orcamento,
    validade,
    status,
    valor_total,
    desconto,
    valor_final,
    condicoes_pagamento: condicoes_pagamento || null,
    prazo_execucao: prazo_execucao || null,
    observacoes: observacoes || null,
    responsavel_id,
    created_by: user.id,
    updated_by: user.id
  };

  const { error } = await supabase
    .from("orcamentos")
    .insert([payload]);

  if (error) {
    console.error("Erro ao salvar orçamento:", error);
    alert("Erro ao salvar orçamento: " + error.message);
    return;
  }

  alert("Orçamento salvo com sucesso!");
  formOrcamento.reset();
  await listarOrcamentos();
}

async function excluirOrcamento(id) {
  const confirmou = confirm("Deseja realmente excluir este orçamento?");

  if (!confirmou) return;

  const { error } = await supabase
    .from("orcamentos")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao excluir orçamento:", error);
    alert("Erro ao excluir orçamento: " + error.message);
    return;
  }

  alert("Orçamento excluído com sucesso.");
  await listarOrcamentos();
}

function registrarEventosTabela() {
  if (!orcamentosTbody) return;

  orcamentosTbody.addEventListener("click", async (event) => {
    const target = event.target;

    if (target.classList.contains("btn-delete")) {
      const id = target.dataset.id;
      await excluirOrcamento(id);
    }

    if (target.classList.contains("btn-edit")) {
      alert("A edição será o próximo passo. Primeiro vamos deixar cadastro e listagem funcionando.");
    }
  });
}

async function initOrcamentos() {
  if (!formOrcamento) return;

  formOrcamento.addEventListener("submit", salvarOrcamento);
  registrarEventosTabela();

  await carregarClientesOrcamento();
  await carregarResponsaveisOrcamento();
  await listarOrcamentos();
}

document.addEventListener("DOMContentLoaded", initOrcamentos);