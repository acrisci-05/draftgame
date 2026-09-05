/**
 * Verifica dell'interfaccia dell'asta al ribasso su tre ambienti: telefono (sito), PC (sito), telefono in PWA.
 *
 * Della PWA si simula quello che cambia davvero per il gioco: `display-mode:
 * standalone` (niente barra del browser, area utile diversa) e l'assenza di
 * chrome attorno alla pagina. Il resto del codice e' identico -- e' la stessa
 * applicazione servita dallo stesso indirizzo.
 *
 * Controlla, per ognuno: che il pulsante esista e sia premibile, che porti le
 * regole anti-zoom/anti-ritardo, che il prezzo scenda davvero, e che la
 * schermata non sbordi.
 *
 * Serve il sito acceso: `npm run dev` in un'altra finestra.
 * Uso:  node scripts/dutch-ux-check.js [indirizzo] [cartella-per-le-foto]
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT_DIR = process.argv[3] ?? null;
const PORT = 9240;

const AMBIENTI = [
  { nome: "telefono-sito", w: 390, h: 844, mobile: true, pwa: false },
  { nome: "pc-sito", w: 1280, h: 900, mobile: false, pwa: false },
  { nome: "telefono-pwa", w: 390, h: 844, mobile: true, pwa: true },
];

const BROWSERS = [
  process.env["ProgramFiles"] + "/Google/Chrome/Application/chrome.exe",
  process.env["ProgramFiles(x86)"] + "/Google/Chrome/Application/chrome.exe",
  process.env["ProgramFiles(x86)"] + "/Microsoft/Edge/Application/msedge.exe",
  process.env["ProgramFiles"] + "/Microsoft/Edge/Application/msedge.exe",
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let falliti = 0;
function check(label, ok, dettaglio) {
  if (ok) console.log("    ok   " + label);
  else {
    falliti += 1;
    console.log("    FAIL " + label + (dettaglio !== undefined ? " -> " + dettaglio : ""));
  }
}

(async () => {
  const browser = BROWSERS.find((c) => c && fs.existsSync(c));
  if (!browser) return console.log("nessun browser trovato");

  for (const amb of AMBIENTI) {
    console.log("\n== " + amb.nome + " (" + amb.w + "x" + amb.h + ") ==");
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "pp-fin-"));
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=2",
      "--remote-debugging-port=" + PORT,
      "--user-data-dir=" + profile,
      "--window-size=" + amb.w + "," + amb.h,
      BASE,
    ];
    if (amb.pwa) args.push("--app=" + BASE);
    const child = spawn(browser, args, { stdio: "ignore" });

    try {
      let endpoint = null;
      for (let i = 0; i < 30 && !endpoint; i += 1) {
        await wait(400);
        try {
          endpoint = (
            await fetch("http://127.0.0.1:" + PORT + "/json/version").then((r) => r.json())
          ).webSocketDebuggerUrl;
        } catch {}
      }
      if (!endpoint) throw new Error("browser non raggiungibile");

      const tabs = await fetch("http://127.0.0.1:" + PORT + "/json/list").then((r) => r.json());
      const tab = tabs.find((e) => e.type === "page");
      const socket = new WebSocket(tab.webSocketDebuggerUrl);
      await new Promise((r) => socket.addEventListener("open", r));

      let id = 0;
      const pending = new Map();
      const errori = [];
      socket.addEventListener("message", (ev) => {
        const m = JSON.parse(ev.data);
        if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
          errori.push(m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 160));
        }
        if (m.method === "Runtime.exceptionThrown") {
          errori.push((m.params.exceptionDetails?.exception?.description ?? "ecc").slice(0, 160));
        }
        const res = pending.get(m.id);
        if (res) { pending.delete(m.id); res(m.result); }
      });
      const send = (method, params) =>
        new Promise((resolve) => {
          id += 1;
          const mine = id;
          pending.set(mine, resolve);
          socket.send(JSON.stringify({ id: mine, method, params }));
          setTimeout(() => { if (pending.delete(mine)) resolve(null); }, 20000);
        });
      const ev = async (expr) => {
        const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
        return r?.result?.value;
      };

      await send("Runtime.enable", {});
      await send("Emulation.setDeviceMetricsOverride", {
        width: amb.w, height: amb.h, deviceScaleFactor: 2, mobile: amb.mobile,
      });
      if (amb.pwa) {
        // La PWA gira in standalone: si forza la media query che la distingue.
        await send("Emulation.setEmulatedMedia", {
          features: [{ name: "display-mode", value: "standalone" }],
        });
      }

      await send("Page.navigate", { url: BASE + "/create" });
      await wait(4000);
      await ev(`(() => {
        const h = [...document.querySelectorAll("button,a")].find((e) => /salta|ho gi/i.test(e.textContent||""));
        if (h) h.click(); return true;
      })()`);
      await wait(1200);

      if (amb.pwa) {
        check("modalita' standalone attiva",
          await ev(`window.matchMedia("(display-mode: standalone)").matches`));
      }

      for (const testo of ["Blind Draft", "Mystery Box", "Dutch Draft", "Flop Draft"]) {
        await ev(`(() => {
          const sw = [...document.querySelectorAll("button[role=switch]")]
            .find((b) => (b.textContent||"").trim().startsWith(${JSON.stringify(testo)}));
          if (sw && sw.getAttribute("aria-checked") !== "true") sw.click();
          return true;
        })()`);
        await wait(400);
      }
      check("i quattro interruttori sono accesi",
        (await ev(`(() => {
          return ["Blind Draft","Mystery Box","Dutch Draft","Flop Draft"].every((tt) => {
            const sw = [...document.querySelectorAll("button[role=switch]")]
              .find((b) => (b.textContent||"").trim().startsWith(tt));
            return sw && sw.getAttribute("aria-checked") === "true";
          });
        })()`)) === true);

      await ev(`(() => {
        const b = [...document.querySelectorAll("button")]
          .filter((x) => x.getAttribute("role") !== "switch" && !x.disabled)
          .find((x) => /crea stanza/i.test(x.textContent||""));
        if (b) b.click(); return true;
      })()`);
      await wait(3500);

      for (const nome of ["Ana", "Bea"]) {
        await ev(`(() => {
          const i = [...document.querySelectorAll("input")].find((x) => /giocatore/i.test(x.placeholder||""));
          if (!i) return false;
          const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;
          s.call(i, ${JSON.stringify(nome)});
          i.dispatchEvent(new Event("input",{bubbles:true}));
          return true;
        })()`);
        await wait(350);
        await ev(`(() => {
          const b = [...document.querySelectorAll("button")]
            .filter((x) => x.getAttribute("role") !== "switch" && !x.disabled)
            .find((x) => /nome giocatore/i.test(x.getAttribute("aria-label")||""));
          if (b) b.click(); return true;
        })()`);
        await wait(800);
      }
      // Ogni giocatore batte il martello: senza, l'avvio resta spento.
      const martelli = await ev(`(() => {
        // Si cerca dall'attributo e non dal testo: in locale il pulsante
        // mostra il nome del giocatore, non l'azione.
        const bottoni = [...document.querySelectorAll("button[aria-pressed]")];
        bottoni.forEach((b) => b.click());
        return bottoni.length;
      })()`);
      check("i martelli si possono battere", martelli > 0, martelli);
      await wait(1200);

      const avvio = await ev(`(() => {
        const b = [...document.querySelectorAll("button")]
          .filter((x) => x.getAttribute("role") !== "switch")
          .find((x) => /avvia il draft/i.test(x.textContent||""));
        if (!b) return "assente";
        if (b.disabled) return "spento";
        b.click();
        return "premuto";
      })()`);
      check("l'avvio si accende quando hanno battuto tutti", avvio === "premuto", avvio);
      // Il cartello "ASTA APERTA!" dura un secondo prima del primo lotto.
      await wait(1600);
      await wait(3000);

      const btn = await ev(`(() => {
        const b = [...document.querySelectorAll("button")].find((x) => /PRENDI ORA/i.test(x.textContent||""));
        if (!b) return null;
        const cs = getComputedStyle(b);
        return JSON.stringify({
          testo: b.textContent.trim(),
          attivo: !b.disabled,
          touchAction: cs.touchAction,
          userSelect: cs.userSelect || cs.webkitUserSelect,
          altezza: Math.round(b.getBoundingClientRect().height),
        });
      })()`);
      check("il pulsante PRENDI ORA c'e'", Boolean(btn), btn);
      if (btn) {
        const b = JSON.parse(btn);
        check("è premibile", b.attivo === true);
        check("touch-action: manipulation (niente ritardo e niente zoom col doppio tocco)",
          b.touchAction === "manipulation", b.touchAction);
        check("user-select: none (niente selezione col tocco lungo)",
          b.userSelect === "none", b.userSelect);
        check("area di tocco almeno 44px", b.altezza >= 44, b.altezza + "px");
      }

      // Il prezzo deve scendere davvero.
      const leggi = () => ev(`(() => {
        const b = [...document.querySelectorAll("button")].find((x) => /PRENDI ORA/i.test(x.textContent||""));
        if (!b) return null;
        const m = b.textContent.match(/(\\d+)/);
        return m ? Number(m[1]) : null;
      })()`);
      const p1 = await leggi();
      await wait(3000);
      const p2 = await leggi();
      check("il prezzo scende nel tempo", p1 !== null && p2 !== null && p2 < p1, p1 + " -> " + p2);

      // Nessuno sbordamento orizzontale.
      const over = await ev(`(() => {
        const d = document.documentElement;
        return d.scrollWidth - d.clientWidth;
      })()`);
      check("la pagina non sborda in orizzontale", over <= 0, over + "px");

      // Il tocco funziona e assegna il lotto.
      await ev(`(() => {
        const b = [...document.querySelectorAll("button")].find((x) => /PRENDI ORA/i.test(x.textContent||""));
        if (b && !b.disabled) b.click(); return true;
      })()`);
      await wait(2500);
      const esito = await ev(`(() => /aggiudicat|svelato|€/i.test(document.body.innerText) ? "ok" : "niente")()`);
      check("il tocco assegna il lotto", esito === "ok", esito);

      if (OUT_DIR) {
        const shot = await send("Page.captureScreenshot", { format: "png" });
        if (shot?.data) {
          fs.writeFileSync(
            path.join(OUT_DIR, "ux-" + amb.nome + ".png"),
            Buffer.from(shot.data, "base64"),
          );
        }
      }
      check("nessun errore in console", errori.length === 0, errori.slice(0, 2).join(" | "));
    } finally {
      child.kill();
      await wait(700);
    }
  }

  console.log(falliti === 0 ? "\nTUTTI GLI AMBIENTI OK" : "\n" + falliti + " CONTROLLI FALLITI");
  process.exit(falliti === 0 ? 0 : 1);
})();
