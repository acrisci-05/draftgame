"use client";

import { motion } from "framer-motion";
import { Bot, Gavel, Heart, LayoutGrid, LogIn, Plus, Undo2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useClientValue } from "@/lib/client-store";
import { APP_FULL_NAME, APP_TAGLINE, APP_VERSION } from "@/lib/config";
import { DEFAULT_AVATAR } from "@/lib/avatars";
import { DEFAULT_CONFIG, randomPlayableCategory } from "@/lib/game";
import { openPanel } from "@/lib/panels";
import { useSettings } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { ensureProfile, readProfile, saveConfig, saveProfile, saveSession,
  allCategories,
  readConfig,
  resumableSession,
  clearSession,
} from "@/lib/storage";
import { showToast } from "@/lib/toast";
import type { RoomConfig } from "@/lib/types";
import type { Profile } from "@/lib/types";
import { roomCode } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { BotSetupModal } from "@/components/game/BotSetupModal";
import { AvatarPicker } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { JoinModal } from "@/components/ui/JoinModal";
import { LogoMark, LogoWordmark } from "@/components/ui/Logo";
import { PickerBanner } from "@/components/ui/PickerBenefits";
import { SupportModal } from "@/components/ui/SupportModal";

const HOW_KEYS = ["home.how1", "home.how2", "home.how3", "home.how4"] as const;

export default function HomePage() {
  const router = useRouter();
  const { t } = useSettings();
  const stored = useClientValue<Profile | null>(readProfile, null);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [emojiDraft, setEmojiDraft] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  /*
   * Chi ha un profilo entra in partita con quel nome: il campo qui sotto parte
   * gia' compilato col nickname e l'avatar scelti in fase di registrazione,
   * invece di chiederli una seconda volta. Resta modificabile: il nome in
   * partita puo' essere diverso da quello dell'account.
   */
  const { account } = useAuth();
  const name = nameDraft ?? stored?.name ?? account?.nickname ?? "";
  const emoji = emojiDraft ?? stored?.emoji ?? account?.emoji ?? DEFAULT_AVATAR;

  const persistProfile = (): Profile => {
    const profile = { ...ensureProfile(), name: name.trim() || "Player", emoji };
    saveProfile(profile);
    return profile;
  };

  const goToCreate = () => {
    persistProfile();
    router.push("/create");
  };

  /* La stanza aperta di recente su questo dispositivo, se c'e'. */
  const aperta = useClientValue(resumableSession, null);
  const [scartata, setScartata] = useState(false);

  /*
   * L'uno contro uno contro il bot.
   *
   * Parte e basta: niente schermata di configurazione, niente scelta della
   * lista. Chi preme qui vuole giocare adesso -- e' il pulsante di chi apre
   * l'app da solo -- quindi la categoria la tira il dado, fra quelle che
   * reggono una partita a due, e le regole sono le ultime usate. La sfida vive
   * su questo dispositivo: non serve una stanza in rete per un avversario che
   * sta gia' qui dentro.
   */
  /*
   * La finestra di configurazione della sfida.
   *
   * Il pulsante non fa piu' partire la partita: apre la finestra, e a farla
   * partire e' il pulsante li' dentro. Un tocco in piu' per chi gioca col bot,
   * zero ingombro sulla home per tutti gli altri.
   */
  const [botSetup, setBotSetup] = useState(false);
  const configSalvata = useClientValue<RoomConfig>(readConfig, DEFAULT_CONFIG);

  const playAgainstBot = (config: RoomConfig) => {
    /*
     * Le regole scelte si mettono da parte, non solo nella sessione della
     * partita: alla prossima apertura la finestra riparte da queste, che e'
     * quasi sempre quello che si vuole.
     */
    saveConfig(config);
    setBotSetup(false);
    const category = randomPlayableCategory(allCategories(), {
      players: 2,
      slots: config.slots,
    });
    if (!category) {
      showToast(t("home.botNoCategory"), "error");
      return;
    }

    const profile = persistProfile();
    const code = roomCode();
    saveSession({
      code,
      mode: "local",
      playerId: profile.id,
      isHost: true,
      name: profile.name || "Player",
      emoji: profile.emoji,
      categoryId: category.id,
      config,
      practice: true,
    });
    router.push(`/room/${code}`);
  };

  const joinRoom = (code: string) => {
    const profile = persistProfile();
    saveSession({
      code,
      mode: "online",
      playerId: profile.id,
      isHost: false,
      name: profile.name,
      emoji: profile.emoji,
    });
    router.push(`/room/${code}`);
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 safe-bottom">
      {/*
        La partita lasciata a meta'. Su telefono basta uno scorrimento storto
        per uscire dal sito, e ripartire dalla home con l'asta ancora in corso
        significa perdere i propri turni. Si propone, non si trascina dentro a
        forza: magari quella partita e' finita e si voleva davvero tornare qui.
      */}
      {aperta && !scartata ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-2xl border border-neon/50 bg-neon/10 p-2 ps-4"
        >
          <button
            type="button"
            onClick={() => router.push(`/room/${aperta.code}`)}
            className="flex min-w-0 flex-1 items-center gap-3 py-2 text-start"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neon/20 text-neon">
              <Undo2 className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-neon">{t("home.resume")}</span>
              <span className="block truncate text-xs text-muted">
                {t("home.resumeHint", { code: aperta.code })}
              </span>
            </span>
          </button>

          {/*
            Si puo' scartare a mano. La proposta non deve diventare una cosa
            che si subisce: chi sa che quella partita e' finita la toglie e non
            la rivede piu'.
          */}
          <button
            type="button"
            aria-label={t("common.close")}
            title={t("common.close")}
            onClick={() => {
              clearSession(aperta.code);
              setScartata(true);
            }}
            className="shrink-0 self-start rounded-lg p-2 text-faint transition-colors hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </motion.div>
      ) : null}

      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-3xl border border-line bg-surface grid-noise"
      >
        <div className="flex flex-col items-center gap-4 px-5 pt-8 text-center">
          <LogoMark size={104} />
          <div>
            <h1 className="text-5xl font-black leading-none tracking-tight sm:text-6xl">
              <LogoWordmark />
            </h1>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.32em] text-violet">
              {APP_TAGLINE}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet/40 bg-violet/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-violet">
            <Gavel className="size-3" /> {t("home.badge")}
          </span>
          <p className="max-w-md text-sm text-muted">{t("home.subtitle")}</p>
        </div>

        <div className="mt-6 border-t border-line p-5">
          <Input
            label={t("home.profile")}
            value={name}
            maxLength={16}
            placeholder={t("home.namePlaceholder")}
            onChange={(event) => setNameDraft(event.target.value)}
          />

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
              {t("home.avatar")}
            </p>
            <AvatarPicker value={emoji} onChange={setEmojiDraft} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Button size="lg" className="w-full rounded-xl" onClick={goToCreate}>
              <Plus className="size-5" />
              {t("home.create")}
            </Button>
            <Button
              size="lg"
              variant="violet"
              className="w-full rounded-xl"
              onClick={() => setJoinOpen(true)}
            >
              <LogIn className="size-5" />
              {t("home.joinCta")}
            </Button>
          </div>

          {/*
            La spiegazione sta attaccata ai due pulsanti che descrive: piu' in
            basso, dopo la sfida al bot, sembrava riferita a quella -- che
            invece non fa scegliere niente.
          */}
          <p className="mt-2.5 text-center text-xs text-faint">{t("home.createHint")}</p>

          {/*
            La terza via, sotto le altre due perche' e' quella che si sceglie
            quando le prime due non si possono usare: non c'e' nessun altro,
            oppure non c'e' voglia di aspettare che arrivi.
          */}
          <Button
            variant="outline"
            /*
              Il ciano e' quello con cui finisce la scritta del logo: il pulsante
              si stacca dal fondo nero senza inventarsi un colore nuovo, e senza
              pestare i piedi ai due sopra -- verde per creare, viola per
              entrare. L'alone e' appena accennato e cresce al passaggio: deve
              farsi notare, non illuminare la stanza.
            */
            className="mt-3 w-full rounded-xl border-cyan-400/50 text-cyan-300 shadow-[0_0_18px_-7px_rgb(34_211_238/0.7)] transition-all hover:border-cyan-400 hover:bg-cyan-400/10 hover:text-cyan-200 hover:shadow-[0_0_26px_-6px_rgb(34_211_238/0.9)]"
            onClick={() => setBotSetup(true)}
          >
            <Bot className="size-5" />
            {t("home.playBot")}
          </Button>

          <p className="mt-2 text-center text-xs text-faint">{t("home.playBotHint")}</p>
        </div>
      </motion.section>

      {/* Invito a farsi un profilo: compare solo a chi gioca da ospite. */}
      <PickerBanner />

      <section className="flex flex-col gap-3 text-sm text-muted">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-faint">
            {t("home.howTitle")}
          </h2>
          <span className="h-px flex-1 bg-line" />
        </div>
        <ol className="grid gap-2 sm:grid-cols-2">
          {HOW_KEYS.map((key, index) => (
            <li key={key} className="flex gap-2">
              <span className="font-mono text-xs font-bold text-neon">{index + 1}</span>
              <span className="text-xs leading-relaxed">{t(key)}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-faint">
        <button
          type="button"
          onClick={() => router.push("/categories")}
          className="flex items-center gap-1.5 transition-colors hover:text-fg"
        >
          <LayoutGrid className="size-3.5" />
          {t("home.categories")}
        </button>
        <button
          type="button"
          onClick={() => openPanel("creator")}
          className="flex items-center gap-1.5 transition-colors hover:text-gold"
        >
          <span aria-hidden>👑</span>
          {t("nav.creator")}
        </button>
        <button
          type="button"
          onClick={() => setSupportOpen(true)}
          className="flex items-center gap-1.5 transition-colors hover:text-violet"
        >
          <Heart className="size-3.5" />
          {t("support.title")}
        </button>
      </div>

      <p className="text-center text-[11px] text-faint">
        {APP_FULL_NAME} · v{APP_VERSION}
      </p>

      <JoinModal open={joinOpen} onClose={() => setJoinOpen(false)} onJoin={joinRoom} />

      <BotSetupModal
        open={botSetup}
        config={configSalvata}
        onClose={() => setBotSetup(false)}
        onStart={playAgainstBot}
      />
      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </main>
  );
}
