import { supabase } from "./supabase.js";

export async function getUserProfile() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Erro ao buscar perfil:", error);
    return null;
  }

  return data;
}

export function canEdit(role) {
  return ["admin", "consultor", "assistente"].includes(role);
}

export function isAdmin(role) {
  return role === "admin";
}