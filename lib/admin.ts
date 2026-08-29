"use client";

import { notifyClientStore, useClientValue } from "./client-store";

/**
 * Modalità creatore: solo chi possiede la chiave può creare o modificare le liste.
 * È una protezione dell'interfaccia, non del database: le liste ufficiali sul
 * database restano scrivibili solo dalla console Supabase (vedi supabase/schema.sql).
 */

const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY?.trim() ?? "";
const STORAGE_KEY = "pp:admin";

export const isAdminConfigured = ADMIN_KEY.length > 0;

export function checkAdminKey(input: string): boolean {
  const value = input.trim();
  if (!value) return false;
  if (isAdminConfigured) return value === ADMIN_KEY;
  // Senza chiave impostata lo Studio resta accessibile solo in sviluppo.
  return process.env.NODE_ENV !== "production";
}

export function readAdmin(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function unlockAdmin(key: string): boolean {
  if (!checkAdminKey(key)) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* senza storage la modalità dura solo per la sessione corrente */
  }
  notifyClientStore();
  return true;
}

export function lockAdmin() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* niente da ripulire */
  }
  notifyClientStore();
}

/**
 * In sviluppo, finché non è stata scelta una chiave, la modalità creatore è già
 * attiva: sul proprio computer non ha senso chiedere una password inventata.
 * Appena NEXT_PUBLIC_ADMIN_KEY viene impostata, vale solo quella.
 */
const OPEN_IN_DEVELOPMENT = !isAdminConfigured && process.env.NODE_ENV !== "production";

export function useAdmin(): boolean {
  const unlocked = useClientValue(readAdmin, false);
  return OPEN_IN_DEVELOPMENT || unlocked;
}
