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

console.log(
  failures === 0 ? "\nACCESSO IN ORDINE\n" : `\n${failures} controlli falliti.\n`,
);
process.exit(failures === 0 ? 0 : 1);
