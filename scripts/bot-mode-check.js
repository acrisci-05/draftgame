/**
 * Il selettore di modalita' della sfida al bot, provato nel browser.
 *
 * Controlla che le due caselle ci siano, che la scelta arrivi davvero fino
 * alle regole della partita (al ribasso deve comparire "PRENDI ORA", in
 * classica i rilanci +1/+2/+5), e che la scelta venga ricordata al ritorno
 * sulla home.
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
const PORT = 9285;
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

(async () => {
  const exe = BROWSERS.find((c) => c && fs.existsSync(c));
  if (!exe) return console.log("nessun browser trovato");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "pp-mode-"));
  const child = spawn(exe, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--force-device-scale-factor=2",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    "--window-size=390,844", BASE,
  ], { stdio: "ignore" });

  try {
    let endpoint = null;
    for (let i = 0; i < 30 && !endpoint; i += 1) {
      await wait(400);
      try {
        endpoint = (await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json()))
          .webSocketDebuggerUrl;
      } catch {}
    }
    if (!endpoint) throw new Error("browser non raggiungibile");

    const tabs = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
    const tab = tabs.find((e) => e.type === "page");
    const socket = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((r) => socket.addEventListener("open", r));

    let id = 0;
    const pending = new Map();
    const errori = [];
    socket.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
        errori.push(m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 400));
      }
      if (m.method === "Runtime.exceptionThrown") {
        errori.push((m.params.exceptionDetails?.exception?.description ?? "ecc").slice(0, 160));
      }
      const r = pending.get(m.id);
      if (r) { pending.delete(m.id); r(m.result); }
    });
    const send = (method, params) => new Promise((resolve) => {
      id += 1;
      const mine = id;
      pending.set(mine, resolve);
      socket.send(JSON.stringify({ id: mine, method, params }));
      setTimeout(() => { if (pending.delete(mine)) resolve(null); }, 25000);
    });
    const ev = async (x) => (await send("Runtime.evaluate", { expression: x, returnByValue: true }))?.result?.value;
    const shot = async (n) => {
      const s = await send("Page.captureScreenshot", { format: "png" });
      if (s?.data && OUT_DIR) fs.writeFileSync(path.join(OUT_DIR, n), Buffer.from(s.data, "base64"));
    };

    await send("Runtime.enable", {});
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

    /** Sceglie la modalita' sulla home e lancia la sfida al bot. */
    const giocaCol = async (etichetta) => {
      await send("Page.navigate", { url: BASE });
      await wait(3500);
      await ev(`(() => {
        const h = [...document.querySelectorAll("button,a")].find((e) => /salta|ho gi/i.test(e.textContent||""));
        if (h) h.click(); return true;
      })()`);
      await wait(1000);
      const scelto = await ev(`(() => {
        const b = [...document.querySelectorAll("button")]
          .find((x) => (x.textContent||"").includes(${JSON.stringify(etichetta)}));
        if (!b) return "assente";
        b.scrollIntoView({ block: "center" });
        b.click();
        return "scelto";
      })()`);
      await wait(700);
      return scelto;
    };

    console.log("\n== Il selettore sulla home ==");
    await send("Page.navigate", { url: BASE });
    await wait(3500);
    await ev(`(() => {
      const h = [...document.querySelectorAll("button,a")].find((e) => /salta|ho gi/i.test(e.textContent||""));
      if (h) h.click(); return true;
    })()`);
    await wait(1200);
    await ev(`(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /Dutch Draft/.test(x.textContent||""));
      if (b) b.scrollIntoView({ block: "center" });
      return true;
    })()`);
    await wait(500);
    await shot("mode-home.png");

    check("ci sono tutte e due le caselle",
      await ev(`(() => {
        const t = document.body.innerText;
        return /Asta Classica/i.test(t) && /Dutch Draft/i.test(t);
      })()`));

    console.log("\n== Asta classica ==");
    check("la casella classica si seleziona", (await giocaCol("Asta Classica")) === "scelto");
    await ev(`(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /sfida il|gioca contro|pick-asso|bot/i.test(x.textContent||"") && !x.disabled);
      if (b) b.click(); return true;
    })()`);
    await wait(6000);
    await ev(`(() => {
      [...document.querySelectorAll("button[aria-pressed]")].forEach((b) => b.click());
      return true;
    })()`);
    await wait(1200);
    await ev(`(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /avvia il draft/i.test(x.textContent||"") && !x.disabled);
      if (b) b.click(); return true;
    })()`);
    await wait(4000);
    await shot("mode-classica.png");
    const classica = await ev(`document.body.innerText`);
    check("in classica NON compare il pulsante del ribasso", !/PRENDI ORA/i.test(classica));
    check("in classica ci sono i rilanci", /\+1|\+2|\+5|Passa/i.test(classica),
      classica.slice(0, 80).replace(/\n/g, " | "));

    console.log("\n== Dutch Draft ==");
    check("la casella al ribasso si seleziona", (await giocaCol("Dutch Draft")) === "scelto");
    await ev(`(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /sfida il|gioca contro|pick-asso|bot/i.test(x.textContent||"") && !x.disabled);
      if (b) b.click(); return true;
    })()`);
    await wait(6000);
    await ev(`(() => {
      [...document.querySelectorAll("button[aria-pressed]")].forEach((b) => b.click());
      return true;
    })()`);
    await wait(1200);
    await ev(`(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /avvia il draft/i.test(x.textContent||"") && !x.disabled);
      if (b) b.click(); return true;
    })()`);
    let dutch = "";
    for (let attesa = 0; attesa < 12; attesa += 1) {
      await wait(1200);
      dutch = await ev(`document.body.innerText`);
      if (/PRENDI ORA/i.test(dutch)) break;
    }
    await shot("mode-dutch.png");
    check("al ribasso compare PRENDI ORA", /PRENDI ORA/i.test(dutch),
      dutch.slice(0, 80).replace(/\n/g, " | "));
    check("al ribasso non ci sono i rilanci a salire", !/\+2\b/.test(dutch));

    const p1 = await ev(`(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /PRENDI ORA/i.test(x.textContent||""));
      const m = b && b.textContent.match(/(\\d+)/);
      return m ? Number(m[1]) : null;
    })()`);
    await wait(3000);
    const p2 = await ev(`(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /PRENDI ORA/i.test(x.textContent||""));
      const m = b && b.textContent.match(/(\\d+)/);
      return m ? Number(m[1]) : null;
    })()`);
    check(
      "il prezzo scende anche contro il bot",
      p1 !== null && (p2 === null || p2 < p1),
      p1 + " -> " + (p2 === null ? "lotto gia' assegnato" : p2),
    );

    console.log("\n== La scelta viene ricordata ==");
    await send("Page.navigate", { url: BASE });
    await wait(3500);
    check("tornando sulla home resta selezionato il ribasso",
      await ev(`(() => {
        const b = [...document.querySelectorAll("button")].find((x) => /Dutch Draft/.test(x.textContent||""));
        return Boolean(b && b.className.includes("bg-neon"));
      })()`));

    if (errori.length) {
      console.log("  messaggi raccolti: " + errori.length);
      errori.slice(0, 4).forEach((e, i) => console.log("   " + (i + 1) + ") " + e));
    }
    check("nessun errore in console", errori.length === 0);
  } finally {
    child.kill();
  }

  console.log("");
  console.log(ko === 0 ? "IL SELETTORE FUNZIONA" : ko + " CONTROLLI FALLITI");
  process.exit(ko === 0 ? 0 : 1);
})();
