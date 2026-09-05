/**
 * Prova end-to-end del voto esterno.
 *
 * Gioca una partita locale fino in fondo, controlla che la stanza NON cada
 * sulla schermata "entra nella stanza" quando la partita finisce (il guasto
 * segnalato), genera il link del voto e lo apre con un profilo browser pulito --
 * cioe' una giuria esterna senza nessuna sessione salvata. Poi vota, e verifica
 * che compaia la classifica e non un modulo di ingresso, anche dopo un ricarico.
 *
 * Serve il sito acceso e Supabase configurato: il link del voto passa da li'.
 * Uso:  node scripts/vote-e2e-check.js [indirizzo] [cartella-per-le-foto]
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT_DIR = process.argv[3] ?? null;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const BROWSERS = [
  process.env["ProgramFiles"] + "/Google/Chrome/Application/chrome.exe",
  process.env["ProgramFiles(x86)"] + "/Google/Chrome/Application/chrome.exe",
  process.env["ProgramFiles(x86)"] + "/Microsoft/Edge/Application/msedge.exe",
  process.env["ProgramFiles"] + "/Microsoft/Edge/Application/msedge.exe",
];

let ko = 0;
const check = (l, ok, d) => {
  if (ok) console.log("  ok   " + l);
  else { ko += 1; console.log("  FAIL " + l + (d !== undefined ? " -> " + d : "")); }
};

/** Apre un browser isolato e restituisce gli attrezzi per pilotarlo. */
async function apri(port, w, h) {
  const exe = BROWSERS.find((c) => c && fs.existsSync(c));
  if (!exe) throw new Error("nessun browser trovato");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "pp-vote-"));
  const child = spawn(exe, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--force-device-scale-factor=2",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--window-size=${w},${h}`, BASE,
  ], { stdio: "ignore" });

  let endpoint = null;
  for (let i = 0; i < 30 && !endpoint; i += 1) {
    await wait(400);
    try {
      endpoint = (await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json()))
        .webSocketDebuggerUrl;
    } catch {}
  }
  if (!endpoint) throw new Error("browser non raggiungibile su " + port);

  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
  const tab = tabs.find((e) => e.type === "page");
  const socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => socket.addEventListener("open", r));

  let id = 0;
  const pending = new Map();
  const errori = [];
  socket.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      errori.push(m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 180));
    }
    if (m.method === "Runtime.exceptionThrown") {
      errori.push((m.params.exceptionDetails?.exception?.description ?? "ecc").slice(0, 180));
    }
    const res = pending.get(m.id);
    if (res) { pending.delete(m.id); res(m.result); }
  });
  const send = (method, params) => new Promise((resolve) => {
    id += 1;
    const mine = id;
    pending.set(mine, resolve);
    socket.send(JSON.stringify({ id: mine, method, params }));
    setTimeout(() => { if (pending.delete(mine)) resolve(null); }, 25000);
  });
  const ev = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
    return r?.result?.value;
  };
  const shot = async (nome) => {
    const s = await send("Page.captureScreenshot", { format: "png" });
    if (s?.data && OUT_DIR) {
      fs.writeFileSync(path.join(OUT_DIR, nome), Buffer.from(s.data, "base64"));
    }
  };
  await send("Runtime.enable", {});
  await send("Emulation.setDeviceMetricsOverride", {
    width: w, height: h, deviceScaleFactor: 2, mobile: w < 700,
  });
  const testo = () => ev(`document.body.innerText`);

  return { send, ev, shot, testo, errori, chiudi: () => child.kill() };
}

const CHIUDI_TUTORIAL = `(() => {
  const h = [...document.querySelectorAll("button,a")].find((e) => /salta|ho gi/i.test(e.textContent||""));
  if (h) h.click(); return true;
})()`;

(async () => {
  console.log("\n== 1. Partita giocata fino in fondo (host) ==");
  const host = await apri(9260, 390, 844);
  let voteUrl = null;

  try {
    await host.send("Page.navigate", { url: BASE + "/create" });
    await wait(4000);
    await host.ev(CHIUDI_TUTORIAL);
    await wait(1200);

    // Ribasso acceso: si prende subito e i lotti volano.
    await host.ev(`(() => {
      const sw = [...document.querySelectorAll("button[role=switch]")]
        .find((b) => (b.textContent||"").trim().startsWith("Dutch Draft"));
      if (sw && sw.getAttribute("aria-checked") !== "true") sw.click();
      return true;
    })()`);
    await wait(500);
    // Tre elementi a testa: la partita finisce in fretta.
    await host.ev(`(() => {
      const meno = [...document.querySelectorAll("button")]
        .filter((b) => (b.textContent||"").trim() === "−" || (b.textContent||"").trim() === "-");
      meno.forEach((b) => { b.click(); b.click(); });
      return meno.length;
    })()`);
    await wait(600);

    await host.ev(`(() => {
      const b = [...document.querySelectorAll("button")]
        .filter((x) => x.getAttribute("role") !== "switch" && !x.disabled)
        .find((x) => /crea stanza/i.test(x.textContent||""));
      if (b) b.click(); return true;
    })()`);
    await wait(3500);

    for (const nome of ["Ana", "Bea"]) {
      await host.ev(`(() => {
        const i = [...document.querySelectorAll("input")].find((x) => /giocatore/i.test(x.placeholder||""));
        if (!i) return false;
        const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;
        s.call(i, ${JSON.stringify(nome)});
        i.dispatchEvent(new Event("input",{bubbles:true}));
        return true;
      })()`);
      await wait(350);
      await host.ev(`(() => {
        const b = [...document.querySelectorAll("button")]
          .filter((x) => x.getAttribute("role") !== "switch" && !x.disabled)
          .find((x) => /nome giocatore/i.test(x.getAttribute("aria-label")||""));
        if (b) b.click(); return true;
      })()`);
      await wait(800);
    }

    await host.ev(`(() => {
      [...document.querySelectorAll("button[aria-pressed]")].forEach((b) => b.click());
      return true;
    })()`);
    await wait(1400);
    await host.ev(`(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /avvia il draft/i.test(x.textContent||""));
      if (b && !b.disabled) b.click(); return true;
    })()`);
      await wait(5000);

    // Si gioca: prendi appena il pulsante e' acceso, poi avanti.
    let ultimo = "";
    for (let giro = 0; giro < 220; giro += 1) {
      const fatto = await host.ev(`(() => {
        const finito = [...document.querySelectorAll("button")]
          .some((x) => /genera link di voto/i.test(x.textContent||""));
        if (finito) return "fine";
        const prendi = [...document.querySelectorAll("button")]
          .find((x) => /PRENDI ORA/i.test(x.textContent||"") && !x.disabled);
        if (prendi) { prendi.click(); return "preso"; }
        const avanti = [...document.querySelectorAll("button")]
          .find((x) => /prossimo lotto|scopri la classifica|chiudi la partita/i.test(x.textContent||"") && !x.disabled);
        if (avanti) { avanti.click(); return "avanti"; }
        const vota = [...document.querySelectorAll("button")]
          .find((x) => /vota rosa/i.test(x.textContent||"") && !x.disabled);
        if (vota) { vota.click(); return "voto"; }
        return "attendo";
      })()`);
      if (fatto !== ultimo) { console.log("    ...", fatto); ultimo = fatto; }
      if (fatto === "fine") break;
      await wait(700);
    }
    await wait(3000);

    const testoStanza = await host.testo();
    await host.shot("e2e-stanza-fine.png");

    /* IL GUASTO SEGNALATO: la stanza non deve cadere sull'ingresso. */
    check(
      "a partita finita la stanza NON mostra \"entra nella stanza\"",
      /draft completato|roster finali/i.test(testoStanza),
      testoStanza.slice(0, 90).replace(/\n/g, " | "),
    );
    check(
      "a partita finita la stanza NON chiede il nome",
      !/il tuo nome/i.test(testoStanza),
    );
    check(
      "la schermata finale e' a video",
      /draft completato|roster finali/i.test(testoStanza),
      testoStanza.slice(0, 90).replace(/\n/g, " | "),
    );

    console.log("    pulsanti a fine partita:", await host.ev(`(() => {
      return [...document.querySelectorAll("button")].map((b) => (b.textContent||"").trim().slice(0,40)).filter(Boolean).join(" / ");
    })()`));
    // Un clic solo, poi si aspetta: premere piu' volte fa partire piu'
    // scritture e la seconda viene respinta.
    await host.ev(`(() => {
      const b = [...document.querySelectorAll("button")]
        .find((x) => /genera link di voto/i.test(x.textContent||"") && !x.disabled);
      if (b) { b.scrollIntoView({ block: "center" }); b.click(); }
      return Boolean(b);
    })()`);
    for (let attesa = 0; attesa < 20 && !voteUrl; attesa += 1) {
      await wait(1500);
      /*
       * Si legge dall'elemento, non da innerText: l'indirizzo e' lungo e va a
       * capo dentro il riquadro, e innerText quell'a capo se lo porta dietro
       * spezzando l'identificativo a meta'. textContent no.
       */
      voteUrl = await host.ev(`(() => {
        const nodo = [...document.querySelectorAll("p")]
          .find((e) => (e.textContent || "").includes("/vote/"));
        return nodo ? nodo.textContent.trim() : null;
      })()`);
    }
    await host.shot("e2e-genera.png");
    check("il link del voto viene generato", Boolean(voteUrl), voteUrl);

    // Un ricarico della stanza a partita finita: deve restare la classifica.
    const codice = await host.ev(`location.pathname.split("/").pop()`);
    await host.send("Page.navigate", { url: BASE + "/room/" + codice });
    await wait(4000);
    const dopoRicarico = await host.testo();
    check(
      "ricaricando la stanza finita non si finisce sull'ingresso",
      !/il tuo nome/i.test(dopoRicarico),
      dopoRicarico.slice(0, 80).replace(/\n/g, " | "),
    );
    check("nessun errore in console (host)", host.errori.length === 0, host.errori[0]);
  } finally {
    host.chiudi();
    await wait(600);
  }

  if (!voteUrl) {
    console.log("\nsenza link del voto non si puo' provare la giuria");
    console.log(ko === 0 ? "\nNIENTE DI ROTTO" : "\n" + ko + " CONTROLLI FALLITI");
    process.exit(ko === 0 ? 0 : 1);
  }

  console.log("\n== 2. La giuria esterna (browser pulito, nessuna sessione) ==");
  const giuria = await apri(9261, 390, 844);
  try {
    const url = voteUrl.replace(/^https?:\/\/[^/]+/, BASE);
    await giuria.send("Page.navigate", { url });
    await wait(5000);
    await giuria.ev(CHIUDI_TUTORIAL);
    await wait(1000);

    const prima = await giuria.testo();
    await giuria.shot("e2e-voto-prima.png");
    check(
      "chi vota da fuori non deve creare un profilo",
      !/il tuo nome/i.test(prima) && !/entra nella stanza/i.test(prima),
      prima.slice(0, 90).replace(/\n/g, " | "),
    );
    check("le rose sono visibili prima di votare", /vota|rose/i.test(prima));

    const votato = await giuria.ev(`(() => {
      const b = [...document.querySelectorAll("button")]
        .find((x) => /^vota\\b/i.test((x.textContent||"").trim()) && !x.disabled);
      if (!b) return "nessun pulsante";
      b.click();
      return "votato";
    })()`);
    check("si riesce a votare", votato === "votato", votato);
    // La scena del batti cinque dura poco piu' di un secondo.
    await wait(4000);

    const dopo = await giuria.testo();
    await giuria.shot("e2e-voto-dopo.png");
    check(
      "dopo il voto NON compare l'ingresso stanza",
      !/entra nella stanza/i.test(dopo) && !/il tuo nome/i.test(dopo),
      dopo.slice(0, 90).replace(/\n/g, " | "),
    );
    check(
      "dopo il voto si vede la classifica",
      /classifica|risultati in diretta|voti|%/i.test(dopo),
      dopo.slice(0, 90).replace(/\n/g, " | "),
    );
    check("l'indirizzo resta sulla pagina del voto",
      /\/vote\//.test(await giuria.ev(`location.pathname`)),
      await giuria.ev(`location.pathname`));

    const flag = await giuria.ev(`(() => {
      const k = Object.keys(localStorage).find((x) => x.startsWith("pp:vote:"));
      return k ? k + " = " + localStorage.getItem(k) : null;
    })()`);
    check("il voto resta segnato nel dispositivo", Boolean(flag), flag);

    // Ricarico: si deve arrivare dritti ai risultati.
    await giuria.send("Page.reload", {});
    await wait(5000);
    const ricaricato = await giuria.testo();
    await giuria.shot("e2e-voto-ricarico.png");
    check(
      "ricaricando si arriva dritti alla classifica",
      /risultati in diretta|voti|%/i.test(ricaricato) && !/il tuo nome/i.test(ricaricato),
      ricaricato.slice(0, 90).replace(/\n/g, " | "),
    );
    check("nessun errore in console (giuria)", giuria.errori.length === 0, giuria.errori[0]);
  } finally {
    giuria.chiudi();
  }

  console.log("");
  console.log(ko === 0 ? "IL VOTO ESTERNO FUNZIONA" : ko + " CONTROLLI FALLITI");
  process.exit(ko === 0 ? 0 : 1);
})();
