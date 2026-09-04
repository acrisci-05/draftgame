const path = require("path");
const Module = require("module");
const OUT = path.resolve(process.cwd(), process.argv[2] ?? ".tmp-check/lib");

const ROOT = path.resolve(OUT, "..");
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  const target = request.startsWith("@/") ? path.join(ROOT, request.slice(2)) : request;
  return resolveFilename.call(this, target, ...rest);
};

const auth = require(path.join(OUT, "auth.js"));

/*
 * L'accesso, messo alla prova sugli indirizzi veri.
 *
 * Questo controllo nasce da un errore vero e costoso: la classe della regex era
 * stata scritta "[^s@]" invece di "[^\s@]" -- una barra persa -- e quella
 * classe non esclude gli spazi, esclude la lettera "s". Ogni indirizzo con una
 * "s" dentro veniva rifiutato come non valido: rossi@, esposito@, tutti gli
 * alias con "+test". Da fuori sembrava che la registrazione fosse rotta a
 * caso, perche' per meta' delle persone funzionava.
 *
 * Una regex non si legge a occhio: si prova. Qui si provano gli indirizzi che
 * la gente ha davvero.
 */

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail !== undefined ? ` -> ${detail}` : ""}`);
  }
}

console.log("\nAccesso e registrazione\n");

/* ---------------- Indirizzi che devono passare ---------------- */

const buoni = [
  "rossi@gmail.com",
  "mario.esposito@libero.it",
  "anna@tiscali.it",
  "luca+test@gmail.com",
  "s@s.it",
  "nome.cognome-secondo@studenti.universita-di-bologna.it",
  "giuseppe_verdi99@outlook.co.uk",
  "a.b.c@d.e.f.org",
];

for (const indirizzo of buoni) {
  check(`accetta ${indirizzo}`, auth.isValidEmail(indirizzo) === true);
}

/* ---------------- Indirizzi che devono essere fermati ---------------- */

const cattivi = [
  ["", "vuoto"],
  ["mario", "senza chiocciola"],
  ["mario@", "senza dominio"],
  ["@gmail.com", "senza nome"],
  ["mario@gmail", "senza punto"],
  ["mario rossi@gmail.com", "spazio in mezzo"],
  ["mario@gmail .com", "spazio nel dominio"],
  ["mario@@gmail.com", "due chiocciole"],
];

for (const [indirizzo, perche] of cattivi) {
  check(`ferma "${indirizzo}" (${perche})`, auth.isValidEmail(indirizzo) === false);
}

/* ---------------- La pulizia di quello che scrive la tastiera ---------------- */

check(
  "toglie lo spazio in coda del completamento",
  auth.normalizeEmail("mario@gmail.com ") === "mario@gmail.com",
  auth.normalizeEmail("mario@gmail.com "),
);
check(
  "toglie lo spazio davanti",
  auth.normalizeEmail("  mario@gmail.com") === "mario@gmail.com",
);
check(
  "abbassa la maiuscola messa dal telefono",
  auth.normalizeEmail("Mario.Rossi@Gmail.COM") === "mario.rossi@gmail.com",
  auth.normalizeEmail("Mario.Rossi@Gmail.COM"),
);
check(
  "un indirizzo con spazi attorno resta valido",
  auth.isValidEmail("  Mario@Gmail.com  ") === true,
);

/* ---------------- Le quattro regole della password ---------------- */

check("password corta rifiutata", auth.isStrongPassword("Ab1!") === false);
check("senza maiuscola rifiutata", auth.isStrongPassword("abcdef1!") === false);
check("senza numero rifiutata", auth.isStrongPassword("Abcdefg!") === false);
check("senza carattere speciale rifiutata", auth.isStrongPassword("Abcdefg1") === false);
check("con tutte e quattro accettata", auth.isStrongPassword("Abcdefg1!") === true);
check(
  "il minimo dichiarato e quello applicato coincidono",
  auth.passwordChecks("A".repeat(auth.MIN_PASSWORD)).length === true &&
    auth.passwordChecks("A".repeat(auth.MIN_PASSWORD - 1)).length === false,
);

/* ---------------- Il nickname che diventa l'indirizzo pubblico ---------------- */

check("il nickname perde le maiuscole", auth.normalizeNickname("Crispy") === "crispy");
check("e i caratteri che il database rifiuta", auth.normalizeNickname("cri spy!") === "crispy");
check("e si ferma a venti caratteri", auth.normalizeNickname("a".repeat(30)).length === 20);



/* ---------------- L'username di chi entra con Google ---------------- */

/*
 * Chi entra con Google non sceglie niente: il servizio consegna quello che ha
 * -- un nome con lo spazio in mezzo, o un indirizzo di posta intero -- e
 * finche' non lo si tratta quello resta. Il vincolo del database e'
 * '^[a-z0-9_]{3,20}$': tutto quello che esce da qui deve passarlo, perche' un
 * nome proposto che il database rifiuta e' peggio di nessun nome, l'errore
 * arriva dopo il tocco su "salva".
 */

const VINCOLO = /^[a-z0-9_]{3,20}$/;

const pulizie = [
  ["Mario Rossi", "mario_rossi", "lo spazio diventa underscore"],
  ["luca.bianchi90", "luca_bianchi90", "il punto dell'indirizzo pure"],
  ["  Anna   Verdi  ", "anna_verdi", "gli spazi in piu' si fondono in uno"],
  ["Nicolò", "nicolo", "l'accento si scioglie, la lettera resta"],
  ["José Álvarez-Díaz", "jose_alvarez_diaz", "accenti e trattino insieme"],
  ["D'Angelo", "dangelo", "l'apostrofo lega, non separa"],
  ["MARIO", "mario", "via le maiuscole"],
  ["mario_rossi", "mario_rossi", "chi e' gia' pulito resta com'e'"],
  ["mario__rossi", "mario_rossi", "gli underscore doppi si fondono"],
  ["_mario_", "mario", "niente underscore in testa o in coda"],
  ["mario 🎮", "mario", "gli emoji spariscono senza lasciare la coda"],
  ["Giuseppe Alessandro Verdi", "giuseppe_alessandro", "si taglia a venti"],
  ["田中", "", "quello che non sopravvive alla pulizia resta vuoto"],
];

for (const [grezzo, atteso, perche] of pulizie) {
  check(`${perche}: "${grezzo}"`, auth.sanitizeUsername(grezzo) === atteso, auth.sanitizeUsername(grezzo));
}

check(
  "il taglio a venti non lascia l'underscore appeso",
  !auth.sanitizeUsername("Giuseppe Alessandro Verdi").endsWith("_"),
  auth.sanitizeUsername("Giuseppe Alessandro Verdi"),
);

/* ---------------- Da dove viene il nome ---------------- */

check(
  "il nome vero di Google batte l'indirizzo",
  auth.usernameBase({
    email: "mario.rossi.1987@gmail.com",
    metadata: { full_name: "Mario Rossi" },
  }) === "mario_rossi",
  auth.usernameBase({ email: "mario.rossi.1987@gmail.com", metadata: { full_name: "Mario Rossi" } }),
);

check(
  "senza full_name si guarda name",
  auth.usernameBase({ email: "x@y.it", metadata: { name: "Anna Verdi" } }) === "anna_verdi",
);

check(
  "senza nome resta la parte prima della chiocciola",
  auth.usernameBase({ email: "luca.bianchi90@gmail.com", metadata: {} }) === "luca_bianchi90",
);

/*
 * L'indirizzo intero non deve diventare un nickname: il nickname si legge sulla
 * card che si condivide fuori dal gioco, e regalare la propria email a chiunque
 * guardi un video non e' una scelta che uno ha fatto.
 */
check(
  "il dominio dell'email non entra mai nel nome",
  !auth.usernameBase({ email: "luca@gmail.com", metadata: {} }).includes("gmail"),
  auth.usernameBase({ email: "luca@gmail.com", metadata: {} }),
);

check(
  "un nome troppo corto cede il posto all'indirizzo piu' ricco",
  auth.usernameBase({ email: "bo.rossi@gmail.com", metadata: { full_name: "Bo" } }) === "bo_rossi",
  auth.usernameBase({ email: "bo.rossi@gmail.com", metadata: { full_name: "Bo" } }),
);

check(
  "senza niente da cui partire si riparte dal gioco",
  auth.usernameBase({ email: null, metadata: null }) === "picker",
  auth.usernameBase({ email: null, metadata: null }),
);

check(
  "un nome in un alfabeto che non sopravvive non blocca l'accesso",
  VINCOLO.test(auth.usernameBase({ email: null, metadata: { full_name: "田中" } })),
);

/* ---------------- Le cifre in coda ---------------- */

/*
 * Servono a due cose: allungare un nome troppo corto e liberare un nome che e'
 * gia' di qualcun altro. In tutti e due i casi il risultato deve stare dentro
 * i venti caratteri, altrimenti il database lo rifiuta proprio quando serve.
 */
for (let giro = 0; giro < 200; giro += 1) {
  const corto = auth.withRandomDigits("bo", 3);
  const lungo = auth.withRandomDigits("giuseppealessandroverdi", 4);
  if (!VINCOLO.test(corto) || !VINCOLO.test(lungo)) {
    check("le cifre in coda rispettano sempre il vincolo", false, `${corto} / ${lungo}`);
    break;
  }
  if (giro === 199) check("le cifre in coda rispettano sempre il vincolo", true);
}

check("il nome corto si allunga restando riconoscibile", /^bo_\d{3}$/.test(auth.withRandomDigits("bo", 3)), auth.withRandomDigits("bo", 3));
check(
  "un nome gia' al limite si accorcia per far posto alle cifre",
  auth.withRandomDigits("giuseppealessandroverdi", 4).length <= 20,
);
check(
  "e non resta con l'underscore prima delle cifre",
  !/__\d+$/.test(auth.withRandomDigits("mario_rossi_verdi_xy", 4)),
  auth.withRandomDigits("mario_rossi_verdi_xy", 4),
);

/* ---------------- L'ordine dei tentativi ---------------- */

const tentativi = auth.usernameAttempts({ email: null, metadata: { full_name: "Mario Rossi" } });
check("si prova prima il nome vero", tentativi[0] === "mario_rossi", tentativi[0]);
check("poi le varianti con le cifre", tentativi.length > 1 && /^mario_rossi_\d{3,4}$/.test(tentativi[1]), tentativi[1]);
check("tutti i tentativi sono validi", tentativi.every((nome) => VINCOLO.test(nome)), tentativi.join(" "));

const cortissimi = auth.usernameAttempts({ email: "bo@gmail.com", metadata: {} });
check(
  "da un nome di due lettere non si propone mai il nome nudo",
  cortissimi.every((nome) => VINCOLO.test(nome)),
  cortissimi.join(" "),
);

/* ---------------- Quando si sa davvero se c'e' un profilo ---------------- */

/*
 * Questo blocco nasce da un guasto vero: fra il momento in cui si conosce la
 * sessione e quello in cui si conosce il profilo passa un istante, e in quello
 * istante chi il profilo ce l'ha sembra uno che deve ancora scegliersi il
 * nickname. La barra in alto reagiva li', e a ogni ricarico di pagina la
 * finestra del profilo saltava addosso a chi stava giocando -- da fuori,
 * sembrava che la partita fosse andata persa.
 */
check(
  "prima di sapere della sessione non si sa niente",
  auth.accountSettled({ sessionLoaded: false, hasSession: true, accountFetched: true }) === false,
);
check(
  "con la sessione ma senza il profilo si aspetta",
  auth.accountSettled({ sessionLoaded: true, hasSession: true, accountFetched: false }) === false,
);
check(
  "letto il profilo si sa",
  auth.accountSettled({ sessionLoaded: true, hasSession: true, accountFetched: true }) === true,
);
check(
  "senza sessione non c'e' niente da aspettare",
  auth.accountSettled({ sessionLoaded: true, hasSession: false, accountFetched: false }) === true,
);
console.log(
  failures === 0 ? "\nACCESSO IN ORDINE\n" : `\n${failures} controlli falliti.\n`,
);
process.exit(failures === 0 ? 0 : 1);
