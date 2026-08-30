/**
 * Controlla che le pagine non sbordino in orizzontale.
 *
 * Apre il browser di sistema in modalità silenziosa, carica ogni pagina alla
 * larghezza di un telefono e misura quanto è larga la pagina rispetto allo
 * schermo: se il contenuto è più largo, indica anche gli elementi colpevoli.
 *
 * Uso:  node scripts/check-layout.js [indirizzo] [larghezza] [porta]
 *
 * La porta di controllo del browser si puo' cambiare: la 9222 e' quella di
 * default di Chrome, e capita che sia gia' occupata da un altro programma.
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const BASE = process.argv[2] ?? "http://localhost:3000";
const WIDTH = Number(process.argv[3] ?? 390);
const HEIGHT = 844;
const PORT = Number(process.argv[4] ?? 9222);

const PAGES = ["/", "/create", "/categories", "/pickmates", "/studio"];

const BROWSERS = [
  `${process.env["ProgramFiles"]}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env["ProgramFiles(x86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env["ProgramFiles(x86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env["ProgramFiles"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

function findBrowser() {
  return BROWSERS.find((candidate) => candidate && fs.existsSync(candidate)) ?? null;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Misura da eseguire dentro la pagina. */
const MEASURE = `(() => {
  const doc = document.documentElement;
  const overflow = doc.scrollWidth - doc.clientWidth;
  const guilty = [];
  if (overflow > 0) {
    for (const node of document.querySelectorAll("body *")) {
      const box = node.getBoundingClientRect();
      if (box.width === 0) continue;
      if (box.right > doc.clientWidth + 1) {
        guilty.push({
          tag: node.tagName.toLowerCase(),
          cls: (node.getAttribute("class") ?? "").slice(0, 70),
          right: Math.round(box.right),
        });
      }
      if (guilty.length >= 6) break;
    }
  }
  return JSON.stringify({ width: doc.clientWidth, scroll: doc.scrollWidth, overflow, guilty });
})()`;

(async () => {
  const browser = findBrowser();
  if (!browser) {
    console.log("Nessun browser trovato: controllo saltato.");
    return;
  }

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "pp-layout-"));
  const child = spawn(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      BASE,
    ],
    { stdio: "ignore" },
  );

  let failures = 0;
  const problems = [];
  try {
    // Il browser impiega un attimo ad aprire la porta di controllo.
    let endpoint = null;
    for (let attempt = 0; attempt < 20 && !endpoint; attempt += 1) {
      await wait(400);
      try {
        const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
        endpoint = (await response.json()).webSocketDebuggerUrl;
      } catch {
        /* non ancora pronto */
      }
    }
    if (!endpoint) throw new Error("browser non raggiungibile");

    // Una sola scheda per tutte le pagine: la si fa navigare da un indirizzo
    // all'altro parlando direttamente con il browser.
    const tabs = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
    const tab = tabs.find((entry) => entry.type === "page");
    if (!tab) throw new Error("nessuna scheda disponibile");

    const socket = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve) => socket.addEventListener("open", resolve));

    let messageId = 0;
    const pending = new Map();
    /* Errori e avvisi che la pagina scrive in console mentre viene visitata. */
    const noise = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
        noise.push(
          message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ").slice(0, 160),
        );
      }
      if (message.method === "Runtime.exceptionThrown") {
        noise.push(
          (message.params.exceptionDetails?.exception?.description ?? "eccezione").slice(0, 160),
        );
      }
      const resolve = pending.get(message.id);
      if (resolve) {
        pending.delete(message.id);
        resolve(message.result);
      }
    });
    const send = (method, params) =>
      new Promise((resolve) => {
        messageId += 1;
        const id = messageId;
        pending.set(id, resolve);
        socket.send(JSON.stringify({ id, method, params }));
        // Nessuna risposta entro dieci secondi: si va avanti lo stesso.
        setTimeout(() => {
          if (pending.delete(id)) resolve(null);
        }, 10000);
      });

    await send("Runtime.enable", {});

    // Il viewport lo si impone qui: la finestra del browser non c'entra, e
    // così la misura vale davvero per uno schermo di quella larghezza.
    await send("Emulation.setDeviceMetricsOverride", {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: WIDTH < 700,
    });

    for (const page of PAGES) {
      await send("Page.navigate", { url: BASE + page });
      // Un attimo perché React finisca di disegnare, poi si misura.
      await wait(3000);
      const evaluated = await send("Runtime.evaluate", {
        expression: MEASURE,
        returnByValue: true,
      });

      const data = JSON.parse(evaluated?.result?.value ?? "{}");
      const label = page.padEnd(12);
      if (data.overflow > 0) {
        failures += 1;
        console.log(`  KO  ${label} sborda di ${data.overflow}px (${data.scroll} su ${data.width})`);
        for (const node of data.guilty ?? []) {
          console.log(`         <${node.tag} class="${node.cls}"> arriva a ${node.right}px`);
        }
      } else {
        console.log(`  ok  ${label} sta nello schermo (${data.width}px)`);
      }
    }
    problems.push(...new Set(noise));
  } finally {
    child.kill();
    // Il profilo temporaneo resta in uso ancora per un istante: se non si
    // riesce a cancellarlo pazienza, ci penserà il sistema.
    await wait(500);
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch {
      /* cartella ancora occupata dal browser che sta chiudendo */
    }
  }

  console.log(
    failures === 0
      ? `\nNESSUNO SBORDAMENTO A ${WIDTH}px`
      : `\n${failures} pagine sbordano a ${WIDTH}px`,
  );
  if (problems.length > 0) {
    console.log(`\n${problems.length} errori in console:`);
    problems.forEach((line) => console.log(`  ${line}`));
  } else {
    console.log("Nessun errore in console.");
  }
  if (failures > 0 || problems.length > 0) process.exitCode = 1;
})();
