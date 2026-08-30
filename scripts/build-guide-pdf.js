/**
 * Trasforma docs/guida.html nel PDF che si consegna insieme al progetto.
 *
 * Usa il browser già presente sul computer (Chrome o Edge) in modalità
 * silenziosa: nessuna dipendenza da installare.
 *
 * Uso:  npm run docs:pdf
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SOURCE = path.resolve(process.cwd(), "docs/guida.html");
const TARGET = path.resolve(process.cwd(), "docs/Guida-Pick-and-Pay.pdf");

const BROWSERS = [
  `${process.env["ProgramFiles"]}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env["ProgramFiles(x86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env["ProgramFiles(x86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env["ProgramFiles"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

const browser = BROWSERS.find((candidate) => candidate && fs.existsSync(candidate));
if (!browser) {
  console.error("Nessun browser trovato: serve Chrome o Edge per creare il PDF.");
  process.exit(1);
}
if (!fs.existsSync(SOURCE)) {
  console.error("Manca docs/guida.html.");
  process.exit(1);
}

const child = spawn(
  browser,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    `--print-to-pdf=${TARGET}`,
    `file:///${SOURCE.replace(/\\/g, "/")}`,
  ],
  { stdio: "ignore" },
);

child.on("exit", () => {
  if (!fs.existsSync(TARGET)) {
    console.error("PDF non creato.");
    process.exitCode = 1;
    return;
  }
  const size = Math.round(fs.statSync(TARGET).size / 1024);
  console.log(`${path.relative(process.cwd(), TARGET)} — ${size} kb`);
});
