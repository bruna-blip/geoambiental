const supabase = window.supabaseClient;

async function loadRelatoriosVisitas() {
  const tbody = document.getElementById("tbodyRelatoriosVisitas");
  if (!tbody) return;

  const { data, error } = await supabase
    .from("relatorios_visitas")
    .select(`
      *,
      clientes(razao_social),
      profiles(full_name)
    `)
    .order("data_visita", { ascending: false });

  if (error) {
    console.error("Erro ao carregar relatórios de visitas:", error);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-row">Erro ao carregar relatórios.</td>
      </tr>
    `;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-row">Nenhum relatório cadastrado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.map(item => `
    <tr>
      <td>${formatDateBR(item.data_visita)}</td>
      <td>${item.clientes?.razao_social || "-"}</td>
      <td>${item.tipo_visita || "-"}</td>
      <td>${item.profiles?.full_name || "-"}</td>
      <td>${item.status || "-"}</td>
      <td>
        <button class="btn-edit" onclick="editRelatorioVisita('${item.id}')">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn-delete" onclick="deleteRelatorioVisita('${item.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join("");
}

async function loadClientesRelatorioVisita() {
  const select = document.getElementById("visitaClienteId");
  if (!select) return;

  const { data, error } = await supabase
    .from("clientes")
    .select("id, razao_social")
    .order("razao_social", { ascending: true });

  if (error) {
    console.error("Erro ao carregar clientes para visitas:", error);
    return;
  }

  select.innerHTML = `<option value="">Selecione...</option>` +
    data.map(cliente => `<option value="${cliente.id}">${cliente.razao_social}</option>`).join("");
}

async function saveRelatorioVisita() {
  const id = document.getElementById("relatorioVisitaId")?.value || "";
  const cliente_id = document.getElementById("visitaClienteId")?.value || null;
  const data_visita = document.getElementById("visitaData")?.value || null;
  const hora_visita = document.getElementById("visitaHora")?.value || null;
  const tipo_visita = document.getElementById("visitaTipo")?.value?.trim() || "Visita Técnica";
  const local_visita = document.getElementById("visitaLocal")?.value?.trim() || null;
  const objetivo = document.getElementById("visitaObjetivo")?.value?.trim() || null;
  const descricao_atividades = document.getElementById("visitaAtividades")?.value?.trim() || null;
  const pendencias = document.getElementById("visitaPendencias")?.value?.trim() || null;
  const proximas_acoes = document.getElementById("visitaProximasAcoes")?.value?.trim() || null;
  const status = document.getElementById("visitaStatus")?.value?.trim() || "Concluído";
  const observacoes = document.getElementById("visitaObservacoes")?.value?.trim() || null;

  if (!cliente_id) {
    alert("Selecione o cliente.");
    return;
  }

  if (!data_visita) {
    alert("Informe a data da visita.");
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
    tecnico_id: user.id,
    data_visita,
    hora_visita,
    tipo_visita,
    local_visita,
    objetivo,
    descricao_atividades,
    pendencias,
    proximas_acoes,
    status,
    observacoes,
    updated_by: user.id
  };

  let error;

  if (id) {
    ({ error } = await supabase
      .from("relatorios_visitas")
      .update(payload)
      .eq("id", id));
  } else {
    payload.created_by = user.id;
    ({ error } = await supabase
      .from("relatorios_visitas")
      .insert([payload]));
  }

  if (error) {
    console.error("Erro ao salvar relatório de visita:", error);
    alert("Erro ao salvar relatório de visita: " + error.message);
    return;
  }

  clearRelatorioVisitaForm();
  closeModal("modalRelatorioVisita");
  await loadRelatoriosVisitas();
}

async function editRelatorioVisita(id) {
  const { data, error } = await supabase
    .from("relatorios_visitas")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("Erro ao buscar relatório de visita:", error);
    alert("Erro ao carregar relatório.");
    return;
  }

  document.getElementById("relatorioVisitaId").value = data.id || "";
  document.getElementById("visitaClienteId").value = data.cliente_id || "";
  document.getElementById("visitaData").value = data.data_visita || "";
  document.getElementById("visitaHora").value = data.hora_visita || "";
  document.getElementById("visitaTipo").value = data.tipo_visita || "";
  document.getElementById("visitaLocal").value = data.local_visita || "";
  document.getElementById("visitaObjetivo").value = data.objetivo || "";
  document.getElementById("visitaAtividades").value = data.descricao_atividades || "";
  document.getElementById("visitaPendencias").value = data.pendencias || "";
  document.getElementById("visitaProximasAcoes").value = data.proximas_acoes || "";
  document.getElementById("visitaStatus").value = data.status || "Concluído";
  document.getElementById("visitaObservacoes").value = data.observacoes || "";

  openModal("modalRelatorioVisita");
}

async function deleteRelatorioVisita(id) {
  if (!confirm("Deseja realmente excluir este relatório de visita?")) return;

  const { error } = await supabase
    .from("relatorios_visitas")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao excluir relatório de visita:", error);
    alert("Erro ao excluir relatório: " + error.message);
    return;
  }

  await loadRelatoriosVisitas();
}

function clearRelatorioVisitaForm() {
  const fields = [
    "relatorioVisitaId",
    "visitaClienteId",
    "visitaData",
    "visitaHora",
    "visitaTipo",
    "visitaLocal",
    "visitaObjetivo",
    "visitaAtividades",
    "visitaPendencias",
    "visitaProximasAcoes",
    "visitaStatus",
    "visitaObservacoes"
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

  const statusEl = document.getElementById("visitaStatus");
  if (statusEl) statusEl.value = "Concluído";
}

function formatDateBR(value) {
  if (!value) return "-";
  const date = new Date(value + "T00:00:00");
  return date.toLocaleDateString("pt-BR");
}

window.loadRelatoriosVisitas = loadRelatoriosVisitas;
window.loadClientesRelatorioVisita = loadClientesRelatorioVisita;
window.saveRelatorioVisita = saveRelatorioVisita;
window.editRelatorioVisita = editRelatorioVisita;
window.deleteRelatorioVisita = deleteRelatorioVisita;
window.clearRelatorioVisitaForm = clearRelatorioVisitaForm;