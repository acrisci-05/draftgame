import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Category } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;

/** Client condiviso; restituisce null se le variabili d'ambiente non sono impostate. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}

export const SHARED_CATEGORIES_TABLE = "categories";

interface SharedCategoryRow {
  id: string;
  name: string;
  emoji: string;
  items: Category["items"];
  created_at?: string;
}

/** Pubblica una categoria e restituisce l'id remoto usato nel link di condivisione. */
export async function publishCategory(category: Category): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase non configurato: aggiungi le variabili in .env.local");

  const payload = {
    name: category.name,
    emoji: category.emoji,
    items: category.items,
  };

  const query = category.shareId
    ? supabase.from(SHARED_CATEGORIES_TABLE).update(payload).eq("id", category.shareId).select("id").single()
    : supabase.from(SHARED_CATEGORIES_TABLE).insert(payload).select("id").single();

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function fetchSharedCategory(shareId: string): Promise<Category> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase non configurato: aggiungi le variabili in .env.local");

  const { data, error } = await supabase
    .from(SHARED_CATEGORIES_TABLE)
    .select("id, name, emoji, items, created_at")
    .eq("id", shareId)
    .single();

  if (error) throw new Error(error.message);
  const row = data as SharedCategoryRow;
  return {
    id: `shared-${row.id}`,
    name: row.name,
    emoji: row.emoji,
    items: row.items,
    source: "shared",
    shareId: row.id,
    createdAt: row.created_at,
  };
}
