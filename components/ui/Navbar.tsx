"use client";

import {
  BookOpen,
  ChevronRight,
  Crown,
  Download,
  GraduationCap,
  Heart,
  LayoutGrid,
  Lightbulb,
  LogOut,
  Menu,
  Moon,
  ShieldCheck,
  Smartphone,
  Star,
  UserRound,
  Users,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { INSTAGRAM_URL } from "@/lib/config";
import { primeAudio } from "@/lib/audio";
import { signOut, useAuth } from "@/lib/auth";
import { languageOption } from "@/lib/i18n";
import { onPanelRequest, type PanelName } from "@/lib/panels";
import { useInstallState } from "@/lib/pwa";
import { syncRemoteLists } from "@/lib/remote-lists";
import { useSettings } from "@/lib/settings";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { AdminModal } from "./AdminModal";
import { OnboardingModal } from "./OnboardingModal";
import { AccountChip } from "./AccountChip";
import { AuthModal } from "./AuthModal";
import { PickerBenefitsModal } from "./PickerBenefits";
import { ToastHost } from "./Toast";
import { InstagramGlyph } from "./BrandGlyphs";
import { InstallPwaModal } from "./InstallPwaModal";
import { Drawer } from "./Drawer";
import { CreatorModal } from "./CreatorModal";
import { LanguagePicker } from "./LanguagePicker";
import { Logo } from "./Logo";
import { Modal } from "./Modal";
import { NotificationBell } from "./NotificationBell";
import { RatingModal } from "./RatingModal";
import { RulesModal } from "./RulesModal";
import { SuggestModal } from "./SuggestModal";
import { SupportModal } from "./SupportModal";
import { Switch } from "./Switch";

type Panel = PanelName | null;

/** Importo del badge rapido nel menu. */
const QUICK_DONATION = 2;

/**
 * Barra in alto e menu laterale.
 *
 * Il menu era un elenco unico e lungo, dove le due cose che si cercano per
 * prime -- entrare col proprio profilo e installare l'app -- finivano in mezzo
 * alle altre, una quarta e una terzultima. Ora stanno in cima come pulsanti
 * veri, e il resto e' diviso per argomento: si scorre meno e si trova prima.
 */
export function Navbar() {
  const { locale, theme, sound, autoImages, toggleTheme, toggleSound, setAutoImages, t } =
    useSettings();
  const { account, session, ready: authReady } = useAuth();
  const install = useInstallState();
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);

  // Le liste pubblicate sul database arrivano una volta per sessione.
  useEffect(() => {
    void syncRemoteLists();
  }, []);

  // Pannelli aperti da altre parti del sito (piè di pagina, notifiche).
  useEffect(() => onPanelRequest((name) => setPanel(name)), []);

  /*
   * Sessione senza profilo: manca solo il nickname.
   *
   * Capita a chi entra con Google la prima volta -- il servizio sa chi e', il
   * gioco no -- e a chi conferma l'email da un dispositivo diverso da quello
   * dove si e' iscritto. Prima bisognava accorgersene da soli e andare a
   * cercare il pannello; adesso si apre da solo, una volta per caricamento, e
   * chi lo chiude non se lo ritrova piu' addosso.
   */
  const chiestoRef = useRef(false);
  useEffect(() => {
    if (!authReady || account || !session || chiestoRef.current) return;
    chiestoRef.current = true;
    setPanel("account");
  }, [authReady, account, session]);

  const language = languageOption(locale);

  const openPanel = (next: Panel) => {
    setPanel(next);
    setMenuOpen(false);
  };

  const onSoundToggle = () => {
    primeAudio();
    toggleSound();
  };

  /*
   * Quando proporre l'installazione.
   *
   * Chi la usa gia' installata non deve vedersela offrire. Sul telefono c'e'
   * gia' la striscia in basso, quindi in barra il pulsante compare solo da
   * schermo largo: li' quella striscia non esiste e prima l'unico modo di
   * arrivarci era cercarlo nel menu.
   */
  const canInstall = install.ready && !install.installed;

  return (
    <>
      <ToastHost />

      <header className="safe-header sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-2.5">
          <Link href="/" className="me-auto min-w-0">
            <Logo size={34} />
          </Link>

          {canInstall ? (
            <button
              type="button"
              onClick={() => setPanel("install")}
              className="hidden h-9 shrink-0 items-center gap-1.5 rounded-full border border-neon/50 bg-neon/10 px-3 text-sm font-bold text-neon transition-colors hover:bg-neon/20 sm:flex"
            >
              <Download className="size-4" />
              {t("nav.installNow")}
            </button>
          ) : null}

          <IconButton label={t("nav.language")} onClick={() => setPanel("language")}>
            <span className="text-base leading-none">{language.flag}</span>
          </IconButton>

          <IconButton label={t("nav.theme")} onClick={toggleTheme}>
            {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </IconButton>

          <IconButton label={t("nav.sound")} onClick={onSoundToggle} active={sound}>
            {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </IconButton>

          <NotificationBell />

          <AccountChip />

          <IconButton label={t("nav.menu")} onClick={() => setMenuOpen(true)}>
            <Menu className="size-5" />
          </IconButton>
        </nav>
      </header>

      <Drawer open={menuOpen} title={t("nav.menu")} onClose={() => setMenuOpen(false)}>
        {/*
          In cima le due azioni che si cercano per prime. Sono pulsanti pieni e
          non voci di elenco: si distinguono a colpo d'occhio da tutto il resto,
          che invece si legge solo quando lo si sta cercando.
        */}
        {authReady && !account ? (
          <button
            type="button"
            onClick={() => openPanel("account")}
            className="flex items-center gap-3 rounded-2xl bg-neon p-3.5 text-start font-bold text-ink transition-opacity hover:opacity-90"
          >
            <UserRound className="size-5 shrink-0" />
            <span className="flex-1">{t("nav.account")}</span>
            <ChevronRight className="size-4 shrink-0 opacity-70" />
          </button>
        ) : null}

        {canInstall ? (
          <button
            type="button"
            onClick={() => openPanel("install")}
            className="flex items-center gap-3 rounded-2xl border border-neon/50 bg-neon/10 p-3.5 text-start transition-colors hover:bg-neon/20"
          >
            <Smartphone className="size-5 shrink-0 text-neon" />
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-neon">{t("nav.installNow")}</span>
              <span className="block text-xs text-muted">{t("nav.installHint")}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-faint" />
          </button>
        ) : null}

        <Section title={t("nav.sectionAccount")}>
          {/*
            Il proprio profilo sopra i Pickmates: si guarda piu' spesso il
            proprio livello che la lista degli amici, e chi cerca "dove sono
            finiti i miei punti" cerca qui.
          */}
          {account ? (
            <MenuButton
              icon={UserRound}
              label={t("account.myProfile")}
              onClick={() => openPanel("account")}
            />
          ) : null}

          <MenuLink
            href="/pickmates"
            icon={Users}
            label={t("nav.pickmates")}
            onGo={() => setMenuOpen(false)}
          />

          {/*
            Uscire sta in fondo e in rosso: e' l'unica voce del menu che si puo'
            premere per sbaglio e pentirsene, quindi non deve stare in mezzo a
            quelle che si premono spesso.
          */}
          {account ? (
            <button
              type="button"
              onClick={async () => {
                setMenuOpen(false);
                await signOut();
                showToast(t("auth.signedOut"), "info");
              }}
              className="mt-1 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-start text-sm font-bold text-red-400 transition-colors hover:border-red-500/60 hover:bg-red-500/10"
            >
              <LogOut className="size-4 shrink-0" />
              <span className="flex-1">{t("auth.signOut")}</span>
            </button>
          ) : null}
        </Section>

        <Section title={t("nav.sectionGame")}>
          <MenuButton icon={BookOpen} label={t("nav.rules")} onClick={() => openPanel("rules")} />
          {/*
            Il tutorial resta raggiungibile dopo la prima volta: compare da solo
            all'inizio, ma chi l'ha saltato -- o chi passa il telefono a un
            amico che non ha mai giocato -- deve poterlo richiamare.
          */}
          <MenuButton
            icon={GraduationCap}
            label={t("tutorial.title")}
            onClick={() => openPanel("tutorial")}
          />
          <MenuLink
            href="/categories"
            icon={LayoutGrid}
            label={t("categories.title")}
            onGo={() => setMenuOpen(false)}
          />
          <MenuButton
            icon={Lightbulb}
            label={t("nav.suggest")}
            onClick={() => openPanel("suggest")}
          />
        </Section>

        <Section title={t("nav.sectionCommunity")}>
          <MenuButton icon={Star} label={t("nav.rate")} onClick={() => openPanel("rate")} />
          <MenuButton
            icon={ShieldCheck}
            label={t("nav.admin")}
            onClick={() => openPanel("admin")}
          />
          <MenuButton icon={Crown} label={t("nav.creator")} onClick={() => openPanel("creator")} />
        </Section>

        <Section title={t("nav.sectionSettings")}>
          <Switch
            checked={autoImages}
            onChange={setAutoImages}
            label={t("nav.autoImages")}
            hint={t("nav.autoImagesHint")}
          />
          <LanguagePicker />
        </Section>

        <Section title={t("nav.sectionSupport")}>
          <div className="rounded-2xl border border-violet/40 bg-violet/10 p-3">
            <p className="text-sm font-semibold text-fg">{t("support.oneLine")}</p>
            <button
              type="button"
              onClick={() => openPanel("support")}
              className="mt-2.5 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-violet font-bold text-white transition-colors hover:bg-violet-soft"
            >
              <Heart className="size-4" />
              {t("support.quick", { amount: `€${QUICK_DONATION}` })}
            </button>
          </div>
        </Section>

        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-auto flex items-center justify-center gap-2 rounded-full border border-violet/40 bg-violet/10 p-2.5 text-sm font-semibold text-violet transition-colors hover:bg-violet/20"
        >
          <InstagramGlyph className="size-5" />
          {t("creator.instagram")}
        </a>
      </Drawer>

      <RulesModal open={panel === "rules"} onClose={() => setPanel(null)} />
      {/*
        Il tutorial vive qui e non nel layout: qui c'e' gia' il meccanismo dei
        pannelli, quindi la stessa finestra serve sia la prima apertura -- dove
        si mostra da sola -- sia la voce di menu che la richiama.
      */}
      <OnboardingModal
        forceOpen={panel === "tutorial"}
        onForcedClose={() => setPanel(null)}
      />
      <SuggestModal open={panel === "suggest"} onClose={() => setPanel(null)} />
      <CreatorModal
        open={panel === "creator"}
        onClose={() => setPanel(null)}
        onFeedback={() => setPanel("suggest")}
        onSupport={() => setPanel("support")}
      />
      <SupportModal open={panel === "support"} onClose={() => setPanel(null)} />
      <RatingModal open={panel === "rate"} onClose={() => setPanel(null)} />
      <AdminModal open={panel === "admin"} onClose={() => setPanel(null)} />
      <AuthModal
        open={panel === "account" || panel === "register"}
        initialTab={panel === "register" ? "up" : "in"}
        onClose={() => setPanel(null)}
      />
      <PickerBenefitsModal open={panel === "picker"} onClose={() => setPanel(null)} />
      <InstallPwaModal open={panel === "install"} onClose={() => setPanel(null)} />

      <Modal open={panel === "language"} title={t("nav.language")} onClose={() => setPanel(null)}>
        <LanguagePicker onPicked={() => setPanel(null)} />
      </Modal>
    </>
  );
}

/**
 * Un gruppo di voci con il suo titolo.
 *
 * Il titolo e' piccolo e spento apposta: serve a far capire dove si e' senza
 * rubare l'occhio alle voci, che sono la cosa da leggere.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <p className="px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-faint">{title}</p>
      {children}
    </section>
  );
}

/** Voce che apre un pannello. Compatta: il menu deve stare in uno schermo. */
function MenuButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof BookOpen;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={VOCE}>
      <Icon className="size-[18px] shrink-0 text-neon" />
      <span className="flex-1 text-sm font-semibold">{label}</span>
      <ChevronRight className="size-4 shrink-0 text-faint" />
    </button>
  );
}

/** Voce che porta a un'altra pagina. */
function MenuLink({
  href,
  icon: Icon,
  label,
  onGo,
}: {
  href: string;
  icon: typeof BookOpen;
  label: string;
  onGo: () => void;
}) {
  return (
    <Link href={href} onClick={onGo} className={VOCE}>
      <Icon className="size-[18px] shrink-0 text-neon" />
      <span className="flex-1 text-sm font-semibold">{label}</span>
      <ChevronRight className="size-4 shrink-0 text-faint" />
    </Link>
  );
}

const VOCE =
  "flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-start transition-colors hover:border-neon/50";

function IconButton({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 transition-colors hover:border-neon/50 hover:text-neon",
        active === false ? "text-faint" : "text-fg",
      )}
    >
      {children}
    </button>
  );
}
