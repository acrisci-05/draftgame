/**
 * La finestra di configurazione della sfida al bot, provata nel browser.
 *
 * Controlla che la home resti pulita (il selettore non deve piu' stare in
 * linea), che la finestra si apra dal pulsante, che la scelta arrivi davvero
 * fino alle regole della partita -- al ribasso deve comparire "PRENDI ORA", in
 * classica i rilanci -- e che venga ricordata alla riapertura.
 *
 * Guarda anche la console: e' li' che si e' visto l'aggancio fallito
 * ("Hydration failed") di quando la scelta veniva letta dentro `useState`, e
 * senza questo controllo sarebbe passato inosservato -- l'interfaccia
 * funzionava lo stesso, solo ridisegnata due volte.
 *
 * Serve il sito acceso. Uso:  node scripts/bot-mode-check.js [indirizzo]
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT_DIR = process.argv[3] ?? null;
const PORT = 9286;
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
  else {
    ko += 1;
    console.log("  FAIL " + l + (d !== undefined ? " -> " + d : ""));
  }
};

/** Cerca un pulsante dal testo e ci fa qualcosa. Niente scorciatoie fragili. */
function premiCol(testo) {
  return (
    "(() => {" +
    "  const b = [...document.querySelectorAll('button')]" +
    "    .find((x) => new RegExp(" +
    JSON.stringify(testo) +
    ", 'i').test(x.textContent || '') && !x.disabled);" +
    "  if (!b) return 'assente';" +
    "  b.scrollIntoView({ block: 'center' });" +
    "  b.click();" +
    "  return 'premuto';" +
    "})()"
  );
}

(async () => {
  const exe = BROWSERS.find((c) => c && fs.existsSync(c));
  if (!exe) return console.log("nessun browser trovato");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "pp-mode-"));
  const child = spawn(
    exe,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=2",
      "--remote-debugging-port=" + PORT,
      "--user-data-dir=" + profile,
      "--window-size=390,844",
      BASE,
    ],
    { stdio: "ignore" },
  );

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
    const socket = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
    await new Promise((r) => socket.addEventListener("open", r));

    let id = 0;
    const pending = new Map();
    const errori = [];
    socket.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
        errori.push(
          m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 400),
        );
      }
      if (m.method === "Runtime.exceptionThrown") {
        errori.push((m.params.exceptionDetails?.exception?.description ?? "ecc").slice(0, 400));
      }
      const r = pending.get(m.id);
      if (r) {
        pending.delete(m.id);
        r(m.result);
      }
    });
    const send = (method, params) =>
      new Promise((resolve) => {
        id += 1;
        const mine = id;
        pending.set(mine, resolve);
        socket.send(JSON.stringify({ id: mine, method, params }));
        setTimeout(() => {
          if (pending.delete(mine)) resolve(null);
        }, 25000);
      });
    const ev = async (x) =>
      (await send("Runtime.evaluate", { expression: x, returnByValue: true }))?.result?.value;
    const shot = async (n) => {
      const s = await send("Page.captureScreenshot", { format: "png" });
      if (s?.data && OUT_DIR) fs.writeFileSync(path.join(OUT_DIR, n), Buffer.from(s.data, "base64"));
    };
    const testo = () => ev("document.body.innerText");

    await send("Runtime.enable", {});
    await send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });

    /** Home pulita, tutorial chiuso. */
    const home = async () => {
      await send("Page.navigate", { url: BASE });
      await wait(3500);
      await ev(premiCol("salta|ho gi"));
      await wait(1000);
    };

    console.log("\n== La home resta pulita ==");
    await home();
    await shot("mode-home.png");
    const pagina = await testo();
    check("il selettore non e' piu' in linea sulla home", !/Asta Classica/i.test(pagina));
    check("il pulsante del bot c'e' ancora", /pick-asso|bot/i.test(pagina));

    console.log("\n== La finestra si apre ==");
    check("il pulsante apre la finestra", (await ev(premiCol("pick-asso|bot"))) === "premuto");
    await wait(1300);
    await shot("mode-modale.png");
    const modale = await testo();
    check("dentro ci sono tutte e due le modalita'",
      /Asta Classica/i.test(modale) && /Dutch Draft/i.test(modale));
    check("ci sono anche le altre varianti",
      /Blind Draft/i.test(modale) && /Mystery Box/i.test(modale) && /Flop Draft/i.test(modale));
    check("c'e' il pulsante di conferma", /avvia sfida/i.test(modale));

    /** Sceglie una modalita' dentro la finestra e conferma. */
    const giocaCol = async (etichetta) => {
      await home();
      if ((await ev(premiCol("pick-asso|bot"))) !== "premuto") return "finestra non aperta";
      await wait(1300);
      if ((await ev(premiCol(etichetta))) !== "premuto") return "casella assente";
      await wait(600);
      if ((await ev(premiCol("avvia sfida"))) !== "premuto") return "avvio assente";
      await wait(6000);
      // Martello e via.
      await ev("(() => { [...document.querySelectorAll('button[aria-pressed]')].forEach((b) => b.click()); return 1; })()");
      await wait(1400);
      await ev(premiCol("avvia il draft"));
      return "partita";
    };

    console.log("\n== Asta classica ==");
    check("si arriva in partita", (await giocaCol("Asta Classica")) === "partita");
    await wait(4500);
    await shot("mode-classica.png");
    const classica = await testo();
    check("in classica NON compare il pulsante del ribasso", !/PRENDI ORA/i.test(classica));
    check("in classica ci sono i rilanci", /Passa/i.test(classica),
      classica.slice(0, 80).replace(/\n/g, " | "));

    console.log("\n== Dutch Draft ==");
    check("si arriva in partita", (await giocaCol("Dutch Draft")) === "partita");
    let dutch = "";
    for (let attesa = 0; attesa < 12; attesa += 1) {
      await wait(1200);
      dutch = await testo();
      if (/PRENDI ORA/i.test(dutch)) break;
    }
    await shot("mode-dutch.png");
    check("al ribasso compare PRENDI ORA", /PRENDI ORA/i.test(dutch),
      dutch.slice(0, 80).replace(/\n/g, " | "));

    const prezzo = () =>
      ev("(() => { const b = [...document.querySelectorAll('button')].find((x) => /PRENDI ORA/i.test(x.textContent || '')); const m = b && b.textContent.match(/(\\d+)/); return m ? Number(m[1]) : null; })()");
    const p1 = await prezzo();
    await wait(3000);
    const p2 = await prezzo();
    check(
      "il prezzo scende anche contro il bot",
      p1 !== null && (p2 === null || p2 < p1),
      p1 + " -> " + (p2 === null ? "lotto gia' assegnato" : p2),
    );

    console.log("\n== La scelta viene ricordata ==");
    await home();
    await ev(premiCol("pick-asso|bot"));
    await wait(1300);
    check(
      "riaprendo la finestra resta selezionato il ribasso",
      await ev("(() => { const b = [...document.querySelectorAll('button')].find((x) => /Dutch Draft/.test(x.textContent || '')); return Boolean(b && b.className.includes('bg-neon')); })()"),
    );

    if (errori.length) {
      console.log("  messaggi raccolti: " + errori.length);
      errori.slice(0, 4).forEach((e, i) => console.log("   " + (i + 1) + ") " + e));
    }
    check("nessun errore in console", errori.length === 0);
  } finally {
    child.kill();
  }

  console.log("");
  console.log(ko === 0 ? "LA FINESTRA DEL BOT FUNZIONA" : ko + " CONTROLLI FALLITI");
  process.exit(ko === 0 ? 0 : 1);
})();
