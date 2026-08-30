"use client";

import { Hammer, ShieldCheck } from "lucide-react";
import { useAdmin } from "@/lib/admin";
import { useIsClient } from "@/lib/client-store";
import { isMaintenance } from "@/lib/maintenance";
import { useT } from "@/lib/settings";
import { Logo } from "./Logo";

/**
 * Il cancello della manutenzione.
 *
 * Quando è accesa, al posto del sito compare una schermata sola: niente stanze
 * da creare, niente accessi, nessuna interrogazione al database, perché non
 * viene montato nulla del resto dell'app.
 *
 * Due accortezze:
 * - chi ha la chiave del creatore passa oltre e vede il sito per intero, con una
 *   striscia che ricorda che per tutti gli altri è chiuso: serve a provare le
 *   novità prima di riaprire;
 * - finché non si sa se la chiave c'è (sta nel dispositivo, e si legge dopo il
 *   montaggio) non si mostra niente, altrimenti il creatore vedrebbe la
 *   schermata di chiusura sbattergli in faccia per un istante a ogni pagina.
 */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const isClient = useIsClient();
  const isAdmin = useAdmin();

  if (!isMaintenance) return <>{children}</>;
  if (!isClient) return null;

  if (isAdmin) {
    return (
      <>
        <AdminNotice />
        {children}
      </>
    );
  }

  return <MaintenanceScreen />;
}

function AdminNotice() {
  const t = useT();
  return (
    <p className="flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-2 text-center text-xs font-bold text-amber-400">
      <ShieldCheck className="size-4 shrink-0" />
      {t("maintenance.adminNotice")}
    </p>
  );
}

function MaintenanceScreen() {
  const t = useT();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-ink px-6 py-12 text-center">
      <Logo size={64} />

      <span className="grid size-20 place-items-center rounded-3xl border border-amber-500/40 bg-amber-500/10 text-4xl">
        <Hammer className="size-9 text-amber-400" />
      </span>

      <div className="max-w-md">
        <h1 className="text-3xl font-black tracking-tight text-balance">
          {t("maintenance.title")}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted text-balance">
          {t("maintenance.body")}
        </p>
      </div>

      <p className="text-xs text-faint">{t("maintenance.hint")}</p>
    </main>
  );
}
