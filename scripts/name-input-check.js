/** Il campo del nome da battaglia: si puo' svuotare? si possono mettere spazi? */
const { spawn } = require("node:child_process");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const OUT = __dirname + "/shots";
const PORT = 9588;
const CODE = "NAMEZ";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const child = spawn(EDGE, ["--headless=new","--disable-gpu","--hide-scrollbars",
    `--remote-debugging-port=${PORT}`,`--user-data-dir=${OUT}/profilo-nome`,
    "--window-size=420,1200","about:blank"], { stdio: "ignore" });
  let endpoint = null;
  for (let i = 0; i < 40 && !endpoint; i += 1) {
    await wait(400);
    try { const t = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r=>r.json());
      endpoint = t.find(x=>x.type==="page")?.webSocketDebuggerUrl; } catch {}
  }
  const socket = new WebSocket(endpoint);
  await new Promise(r => socket.addEventListener("open", r));
  let id=0; const pending=new Map();
  socket.addEventListener("message",(e)=>{const m=JSON.parse(e.data);const d=pending.get(m.id);if(d){pending.delete(m.id);d(m.result);}});
  const send=(m,p)=>new Promise(res=>{id++;const c=id;pending.set(c,res);socket.send(JSON.stringify({id:c,method:m,params:p}));setTimeout(()=>{if(pending.delete(c))res(null)},30000)});
  const ev=(e)=>send("Runtime.evaluate",{expression:e,returnByValue:true}).then(r=>r?.result?.value);

  await send("Emulation.setDeviceMetricsOverride",{width:420,height:1200,deviceScaleFactor:1,mobile:true});
  await send("Page.navigate",{url:"http://localhost:3000"});
  await wait(4000);
  const cfg = JSON.stringify({budget:20,currency:"EUR",maxPlayers:3,slots:3,blindDraft:false,mysteryBox:false,allowDiscards:true,lotSeconds:15});
  await ev(`(()=>{localStorage.setItem("pp:profile",JSON.stringify({id:"p-h",name:"anti",emoji:"flame"}));
    localStorage.setItem("pp:session:${CODE}",JSON.stringify({code:"${CODE}",mode:"local",playerId:"p-h",isHost:true,name:"anti",emoji:"flame",categoryId:"burger",config:${cfg}}));return 1})()`);
  await send("Page.navigate",{url:`http://localhost:3000/room/${CODE}`});
  await wait(4000);

  // Il pulsante che apre la scheda e' l'avatar, riconoscibile dall'etichetta.
  const apertura = await ev(`(()=>{
    const b=[...document.querySelectorAll("button")].find(x=>/avatar|aspetto|icona/i.test(x.getAttribute("aria-label")??""));
    if(b){b.click();return "aperta"}
    return "etichette: "+[...document.querySelectorAll("button")].map(x=>x.getAttribute("aria-label")).filter(Boolean).slice(0,12).join(" | ")
  })()`);
  console.log("  apertura scheda:", apertura);
  await wait(1500);

  // Il campo e' il primo dentro la finestra aperta: non dipende dal valore,
  // che durante la prova cambia in continuazione.
  // La finestra non ha un ruolo dichiarato: la si riconosce dal contenitore
  // fisso a schermo intero che la ricopre.
  const campo = `(document.querySelector(".fixed.inset-0") || document).querySelector("input")`;
  const scrivi = (v) => ev(`(()=>{const el=${campo};if(!el)return "nessun campo";
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(el,${JSON.stringify(v)});
    el.dispatchEvent(new Event("input",{bubbles:true}));return el.value})()`);

  console.log("");
  console.log("  valore iniziale:      ", await ev(`(()=>{const el=${campo};return el?el.value:"NESSUN CAMPO"})()`));
  console.log("  svuotato del tutto:   ", JSON.stringify(await scrivi("")));
  await wait(300);
  console.log("  resta vuoto?          ", JSON.stringify(await ev(`(()=>{const el=${campo};return el?el.value:"?"})()`)));
  console.log("  scrivo 'Il ' (spazio):", JSON.stringify(await scrivi("Il ")));
  await wait(300);
  console.log("  lo spazio resiste?    ", JSON.stringify(await ev(`(()=>{const el=${campo};return el?el.value:"?"})()`)));
  console.log("  completo in 'Il Lupo':", JSON.stringify(await scrivi("Il Lupo")));
  // Uscita dal campo: qui si consegna.
  // Perdita di fuoco vera: React ascolta focusout, non il blur secco.
  await ev(`(()=>{const el=${campo};el.focus();el.blur();
    el.dispatchEvent(new FocusEvent("focusout",{bubbles:true}));return 1})()`);
  await wait(600);
  console.log("");
  console.log("  nome consegnato:      ", JSON.stringify(await ev(`(()=>{const t=document.body.innerText;return /Il Lupo/.test(t)?"Il Lupo":"NON SALVATO"})()`)));
  socket.close(); child.kill();
})();
