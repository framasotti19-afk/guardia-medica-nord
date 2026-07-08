// Test di espandiAmbito (motore): verifica che l'espansione compatta di un "ambito" nei singoli
// slot {giorno, turno} sia ESATTA, confrontandola con un calcolo INDIPENDENTE (JS Date per il giorno
// della settimana + liste di festivi/prefestivi HARDCODATE, senza riusare turniDelGiorno/FESTIVI_MAP).
// Copre mesi con festivi e prefestivi non banali, inclusi i PREFESTIVI CROSS-MESE (30 aprile ← 1° maggio;
// 31 dicembre ← 1° gennaio) — proprio i casi che l'AI, calcolando "a mente", tende a sbagliare.
import { espandiAmbito } from "./engine_test.mjs";
import { makeSuite, GIORNI_FERIALI_SEMPLICI } from "./test_utils.mjs";

const s = makeSuite("espandiAmbito — calcolo deterministico dei giorni (motore)");

// Dati calendario INDIPENDENTI (hardcodati) per i mesi di test. mese0 = indice 0-based.
// prefestivi include già i prefestivi cross-mese (ultimo giorno del mese se il 1° del successivo è festivo).
const MESE_DATA = {
  "2026-7":  { nome: "agosto 2026",    festivi: [15],           prefestivi: [14] },            // Ferragosto 15 → pref 14
  "2026-11": { nome: "dicembre 2026",  festivi: [8, 25, 26, 31], prefestivi: [7, 24, 25, 30, 31] }, // +31 ← 1 gen 2027
  "2026-3":  { nome: "aprile 2026",    festivi: [5, 6, 25],      prefestivi: [4, 5, 24, 30] },  // Pasqua 5/Pasquetta 6/Lib.25; +30 ← 1 mag
  "2026-8":  { nome: "settembre 2026", festivi: [],             prefestivi: [] },              // mese "pulito"
};

// Calcolo INDIPENDENTE dei slot attesi. G esiste solo nei giorni weekend/festivo/prefestivo; N sempre.
function expectedSlots(anno, mese0, ambito, turni, escludi) {
  const nG = new Date(anno, mese0 + 1, 0).getDate();
  const d0 = MESE_DATA[`${anno}-${mese0}`];
  const fest = new Set(d0.festivi), pref = new Set(d0.prefestivi), esc = new Set((escludi || []).map(Number));
  const req = (turni && turni.length ? turni : ["N"]).filter((t) => t === "G" || t === "N");
  const out = [];
  for (let d = 1; d <= nG; d++) {
    if (esc.has(d)) continue;
    const dow = new Date(anno, mese0, d).getDay();
    const weekend = dow === 0 || dow === 6;
    const isFest = fest.has(d), isPref = pref.has(d);
    const feriale = !weekend && !isFest && !isPref;
    let inA;
    if (ambito === "mese") inA = true;
    else if (ambito === "feriali") inA = feriale;
    else if (ambito === "weekend") inA = weekend;
    else { const da = Math.min(ambito.da, ambito.a), a = Math.max(ambito.da, ambito.a); inA = d >= da && d <= a; }
    if (!inA) continue;
    const hasG = weekend || isFest || isPref;
    for (const t of ["G", "N"]) if (req.includes(t) && (t === "N" || hasG)) out.push({ giorno: d, turno: t });
  }
  return out;
}

const J = (x) => JSON.stringify(x);
const casi = [
  { ambito: "feriali", turni: ["N"] },
  { ambito: "feriali", turni: ["G", "N"] },          // G va ignorato sui feriali → identico a ["N"]
  { ambito: "weekend", turni: ["N"] },
  { ambito: "weekend", turni: ["G", "N"] },
  { ambito: "mese", turni: ["N"] },                  // "tutte le notti"
  { ambito: "mese", turni: ["G", "N"] },
  { ambito: { da: 3, a: 9 }, turni: ["N"] },
  { ambito: { da: 9, a: 3 }, turni: ["N"] },          // da>a: robustezza (= 3..9)
  { ambito: "feriali", turni: ["N"], escludi: [4, 5, 17] },
  { ambito: "mese", turni: ["G", "N"], escludi: [1, 15, 31] },
];

for (const [k, dat] of Object.entries(MESE_DATA)) {
  const [anno, mese0] = k.split("-").map(Number);
  for (const c of casi) {
    s.test(`${dat.nome} — ambito=${J(c.ambito)} turni=${J(c.turni)}${c.escludi ? " escludi=" + J(c.escludi) : ""}`, () => {
      const got = espandiAmbito(c.ambito, c.turni, c.escludi || [], anno, mese0, {});
      const exp = expectedSlots(anno, mese0, c.ambito, c.turni, c.escludi);
      s.eq(J(got), J(exp), `mismatch\n  got=${J(got)}\n  exp=${J(exp)}`);
    });
  }
}

// --- Spot-check espliciti sui casi "trappola" ---
s.test("agosto: feriali N = GIORNI_FERIALI_SEMPLICI (anchor indipendente da test_utils), esclude 14 e 15", () => {
  const got = espandiAmbito("feriali", ["N"], [], 2026, 7, {});
  s.eq(J(got.map((x) => x.giorno)), J(GIORNI_FERIALI_SEMPLICI), "giorni feriali agosto diversi da GIORNI_FERIALI_SEMPLICI");
  s.assert(got.every((x) => x.turno === "N"), "un feriale ha un turno diverso da N");
  s.assert(!got.some((x) => x.giorno === 14 || x.giorno === 15), "feriali contiene 14 (prefestivo) o 15 (Ferragosto)");
});
s.test("aprile: feriali NON contiene il 30 (prefestivo cross-mese, ← 1° maggio)", () => {
  const g = espandiAmbito("feriali", ["N"], [], 2026, 3, {}).map((x) => x.giorno);
  s.assert(!g.includes(30), "il 30 aprile (prefestivo del 1° maggio) è finito tra i feriali");
  s.assert(!g.includes(5) && !g.includes(6) && !g.includes(25), "Pasqua/Pasquetta/Liberazione tra i feriali");
  s.assert(!g.includes(4) && !g.includes(24), "prefestivi 4/24 tra i feriali");
});
s.test("dicembre: feriali esclude festivi (8,25,26,31) e prefestivi (7,24,30)", () => {
  const g = espandiAmbito("feriali", ["N"], [], 2026, 11, {}).map((x) => x.giorno);
  for (const d of [8, 25, 26, 31, 7, 24, 30]) s.assert(!g.includes(d), `dicembre feriali contiene ${d} (festivo/prefestivo)`);
});
s.test("mese con G+N: un giorno feriale ha SOLO N, un giorno weekend/festivo ha G e N", () => {
  const got = espandiAmbito("mese", ["G", "N"], [], 2026, 7, {});
  // 3 agosto = lunedì feriale → solo N; 15 agosto = sabato/Ferragosto → G e N
  s.eq(J(got.filter((x) => x.giorno === 3)), J([{ giorno: 3, turno: "N" }]), "3 agosto (feriale) non è solo N");
  s.eq(J(got.filter((x) => x.giorno === 15)), J([{ giorno: 15, turno: "G" }, { giorno: 15, turno: "N" }]), "15 agosto non è G+N");
});
s.test("MMG attivi non trapelano: espandiAmbito produce solo G/N, mai M/P", () => {
  const extras = { "2026-08-06": { M: true, P: true } };
  const got = espandiAmbito("mese", ["G", "N"], [], 2026, 7, extras);
  s.assert(got.every((x) => x.turno === "G" || x.turno === "N"), "espandiAmbito ha prodotto un turno M/P");
});
s.test("ordine deterministico: giorni crescenti, G prima di N nello stesso giorno", () => {
  const got = espandiAmbito("weekend", ["G", "N"], [], 2026, 7, {});
  for (let i = 1; i < got.length; i++) {
    const p = got[i - 1], c = got[i];
    s.assert(p.giorno < c.giorno || (p.giorno === c.giorno && p.turno === "G" && c.turno === "N"), "ordine non deterministico");
  }
});

s.finish();
