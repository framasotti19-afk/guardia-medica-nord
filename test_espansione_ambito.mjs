// Test di espandiAmbito (motore): verifica che l'espansione compatta di un "ambito" nei singoli
// slot {giorno, turno} sia ESATTA, confrontandola con un calcolo INDIPENDENTE (JS Date per il giorno
// della settimana + liste di festivi/prefestivi HARDCODATE, senza riusare turniDelGiorno/FESTIVI_MAP).
// Copre mesi con festivi e prefestivi non banali, inclusi i PREFESTIVI CROSS-MESE (30 aprile ← 1° maggio;
// 31 dicembre ← 1° gennaio) — proprio i casi che l'AI, calcolando "a mente", tende a sbagliare.
import { espandiAmbito, diurniNascosti } from "./engine_test.mjs";
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

// Calcolo INDIPENDENTE dell'insieme dei dow (getDay) per un ambito giorni_settimana — token→getDay
// e wraparound scritti QUI a mano, senza riusare espandiAmbito.
const ORD_T = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
const TOK_T = { lun: 1, mar: 2, mer: 3, gio: 4, ven: 5, sab: 6, dom: 0 };
function dowSetIndip(gs) {
  const s = new Set();
  const tk = (x) => String(x).trim().toLowerCase().slice(0, 3);
  if (Array.isArray(gs)) gs.forEach((x) => { const v = TOK_T[tk(x)]; if (v != null) s.add(v); });
  else if (gs && gs.da != null && gs.a != null) {
    const pa = ORD_T.indexOf(tk(gs.da)), pb = ORD_T.indexOf(tk(gs.a));
    if (pa >= 0 && pb >= 0) for (let i = pa; ; i = (i + 1) % 7) { s.add(TOK_T[ORD_T[i]]); if (i === pb) break; }
  }
  return s;
}

// Calcolo INDIPENDENTE dei slot attesi. G esiste solo nei giorni weekend/festivo/prefestivo; N sempre.
function expectedSlots(anno, mese0, ambito, turni, escludi) {
  const nG = new Date(anno, mese0 + 1, 0).getDate();
  const d0 = MESE_DATA[`${anno}-${mese0}`];
  const fest = new Set(d0.festivi), pref = new Set(d0.prefestivi), esc = new Set((escludi || []).map(Number));
  const req = (turni && turni.length ? turni : ["N"]).filter((t) => t === "G" || t === "N");
  const gsSet = (ambito && typeof ambito === "object" && ambito.giorni_settimana != null) ? dowSetIndip(ambito.giorni_settimana) : null;
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
    else if (gsSet) inA = gsSet.has(dow);
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
  // --- giorni_settimana: elenco ---
  { ambito: { giorni_settimana: ["lun"] }, turni: ["N"] },
  { ambito: { giorni_settimana: ["lun", "mer"] }, turni: ["N"] },
  { ambito: { giorni_settimana: ["mar", "gio", "ven"] }, turni: ["N"] },
  { ambito: { giorni_settimana: ["Lunedì", "MERCOLEDI"] }, turni: ["N"] }, // nomi interi/maiuscole → stessi di ["lun","mer"]
  { ambito: { giorni_settimana: ["lun", "mer", "xyz"] }, turni: ["N"] },    // token sconosciuto ignorato
  // --- giorni_settimana: intervallo (il caso rotto nel collaudo) ---
  { ambito: { giorni_settimana: { da: "mar", a: "gio" } }, turni: ["N"] },
  { ambito: { giorni_settimana: { da: "lun", a: "gio" } }, turni: ["N"] },
  { ambito: { giorni_settimana: { da: "ven", a: "lun" } }, turni: ["G", "N"] }, // wraparound: ven,sab,dom,lun (weekend → anche G)
  { ambito: { giorni_settimana: { da: "mar", a: "mar" } }, turni: ["N"] },      // range degenere = solo martedì
  // --- giorni_settimana su festivo infrasettimanale (dicembre: 8=mar, 25=ven) + escludi ---
  { ambito: { giorni_settimana: ["mar"] }, turni: ["G", "N"] },
  { ambito: { giorni_settimana: ["ven"] }, turni: ["G", "N"] },
  { ambito: { giorni_settimana: ["lun", "mar", "mer", "gio", "ven"] }, turni: ["N"] }, // tutti i feriali-settimana (≠ "feriali" sui festivi)
  { ambito: { giorni_settimana: ["ven"] }, turni: ["N"], escludi: [25] },
  { ambito: { giorni_settimana: ["sab"] }, turni: ["G", "N"] }, // "tutti i sabati" → weekend, G+N
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

// --- Spot-check giorni_settimana (il nuovo ambito) ---
// Giorni del mese (indipendenti) il cui getDay è uno di dowVals
const giorniConDow = (anno, mese0, dowVals) => {
  const nG = new Date(anno, mese0 + 1, 0).getDate(), out = [];
  for (let d = 1; d <= nG; d++) if (dowVals.includes(new Date(anno, mese0, d).getDay())) out.push(d);
  return out;
};
s.test('"da martedì a giovedì" (caso rotto nel collaudo) = esattamente i mar/mer/gio del mese, nessun lunedì', () => {
  for (const [anno, mese0] of [[2026, 7], [2026, 11]]) {
    const got = espandiAmbito({ giorni_settimana: { da: "mar", a: "gio" } }, ["N"], [], anno, mese0, {}).map((x) => x.giorno);
    const atteso = giorniConDow(anno, mese0, [2, 3, 4]); // mar=2, mer=3, gio=4
    s.eq(J(got), J(atteso), `mar→gio ${anno}-${mese0 + 1} sbagliato`);
    const lunedi = giorniConDow(anno, mese0, [1]);
    s.assert(!got.some((d) => lunedi.includes(d)), "incluso un lunedì di troppo (il bug del collaudo)");
  }
});
s.test('wraparound "da venerdì a lunedì" = solo dow ven/sab/dom/lun', () => {
  const got = espandiAmbito({ giorni_settimana: { da: "ven", a: "lun" } }, ["G", "N"], [], 2026, 7, {});
  const okDow = new Set([5, 6, 0, 1]); // ven,sab,dom,lun
  s.assert(got.every((x) => okDow.has(new Date(2026, 7, x.giorno).getDay())), "un giorno fuori da ven/sab/dom/lun");
  s.eq(J([...new Set(got.map((x) => new Date(2026, 7, x.giorno).getDay()))].sort()), J([0, 1, 5, 6]), "insieme dow diverso da {ven,sab,dom,lun}");
});
s.test('dicembre: "il martedì" G+N include l\'8 (martedì festivo) con G, gli altri martedì solo N', () => {
  const got = espandiAmbito({ giorni_settimana: ["mar"] }, ["G", "N"], [], 2026, 11, {});
  s.eq(J(got.filter((x) => x.giorno === 8)), J([{ giorno: 8, turno: "G" }, { giorno: 8, turno: "N" }]), "8 dicembre (martedì festivo) non è G+N");
  s.eq(J(got.filter((x) => x.giorno === 1)), J([{ giorno: 1, turno: "N" }]), "1 dicembre (martedì feriale) non è solo N");
});
s.test('DISTINZIONE feriali vs giorni_settimana: [lun..ven] include i festivi infrasettimanali (8, 25 dic), "feriali" no', () => {
  const gs = espandiAmbito({ giorni_settimana: ["lun", "mar", "mer", "gio", "ven"] }, ["N"], [], 2026, 11, {}).map((x) => x.giorno);
  const fer = espandiAmbito("feriali", ["N"], [], 2026, 11, {}).map((x) => x.giorno);
  s.assert(gs.includes(8) && gs.includes(25), "giorni_settimana [lun..ven] dovrebbe includere 8 (mar) e 25 (ven), festivi in settimana");
  s.assert(!fer.includes(8) && !fer.includes(25), '"feriali" NON deve includere 8/25 (festivi)');
});
s.test("giorni_settimana con turno omesso → default N (i giorni della settimana significano le notti)", () => {
  const got = espandiAmbito({ giorni_settimana: ["lun", "mer"] }, [], [], 2026, 7, {});
  s.assert(got.length > 0 && got.every((x) => x.turno === "N"), "default turni diverso da solo N");
});

// --- diurniNascosti: i festivi/prefestivi INFRASETTIMANALI col diurno non inserito ---
// Calcolo INDIPENDENTE: giorno d è "a sorpresa" se è nell'ambito, non escluso, festivo/prefestivo, NON
// weekend, e G non è stato richiesto (turni senza G).
function expectedDiurniNascosti(anno, mese0, ambito, turni, escludi) {
  const nG = new Date(anno, mese0 + 1, 0).getDate();
  const d0 = MESE_DATA[`${anno}-${mese0}`];
  const fest = new Set(d0.festivi), pref = new Set(d0.prefestivi), esc = new Set((escludi || []).map(Number));
  const req = (turni && turni.length ? turni : ["N"]).filter((t) => t === "G" || t === "N");
  const gsSet = (ambito && typeof ambito === "object" && ambito.giorni_settimana != null) ? dowSetIndip(ambito.giorni_settimana) : null;
  const out = [];
  for (let d = 1; d <= nG; d++) {
    if (esc.has(d)) continue;
    const dow = new Date(anno, mese0, d).getDay();
    const weekend = dow === 0 || dow === 6;
    const isFest = fest.has(d), isPref = pref.has(d);
    let inA;
    if (ambito === "mese") inA = true;
    else if (ambito === "feriali") inA = !weekend && !isFest && !isPref;
    else if (ambito === "weekend") inA = weekend;
    else if (gsSet) inA = gsSet.has(dow);
    else { const da = Math.min(ambito.da, ambito.a), a = Math.max(ambito.da, ambito.a); inA = d >= da && d <= a; }
    if (inA && (isFest || isPref) && !weekend && !req.includes("G")) out.push(d);
  }
  return out;
}
const casiND = [
  { ambito: { giorni_settimana: ["mar"] }, turni: ["N"] },            // dicembre: 8 (mar festivo)
  { ambito: { giorni_settimana: ["mar"] }, turni: ["G", "N"] },        // G richiesto → nessun nascosto
  { ambito: { giorni_settimana: ["ven"] }, turni: ["N"] },            // dicembre: 25 (ven festivo) + prefestivi ven
  { ambito: { giorni_settimana: ["lun", "mar", "mer", "gio", "ven"] }, turni: ["N"] },
  { ambito: { giorni_settimana: { da: "lun", a: "ven" } }, turni: ["N"] },
  { ambito: { giorni_settimana: { da: "mar", a: "gio" } }, turni: ["N"] },     // forma-intervallo (caso Iengo): il segnale deve scattare
  { ambito: { giorni_settimana: { da: "mar", a: "gio" } }, turni: ["G", "N"] }, // G richiesto → nessun nascosto anche per l'intervallo
  { ambito: { giorni_settimana: ["sab"] }, turni: ["N"] },            // sabato = weekend → mai "nascosto"
  { ambito: "feriali", turni: ["N"] },                                 // feriali esclude i festivi → nessuno
  { ambito: "weekend", turni: ["N"] },                                 // weekend → mai infrasettimanale
  { ambito: { da: 1, a: 15 }, turni: ["N"] },                          // intervallo: cattura festivi in settimana
];
for (const [k, dat] of Object.entries(MESE_DATA)) {
  const [anno, mese0] = k.split("-").map(Number);
  for (const c of casiND) {
    s.test(`diurniNascosti ${dat.nome} — ${J(c.ambito)} ${J(c.turni)}`, () => {
      const slots = espandiAmbito(c.ambito, c.turni, [], anno, mese0, {});
      const got = diurniNascosti(slots, anno, mese0, {});
      const exp = expectedDiurniNascosti(anno, mese0, c.ambito, c.turni, []);
      s.eq(J(got), J(exp), `nascosti mismatch\n  got=${J(got)}\n  exp=${J(exp)}`);
    });
  }
}
s.test('dicembre "il martedì" solo N → diurniNascosti = [8] (martedì festivo con diurno non inserito)', () => {
  const slots = espandiAmbito({ giorni_settimana: ["mar"] }, ["N"], [], 2026, 11, {});
  s.eq(J(diurniNascosti(slots, 2026, 11, {})), J([8]), "atteso solo l'8 dicembre");
});
s.test('agosto "il lunedì" solo N → nessun diurno nascosto (nessun lunedì festivo)', () => {
  const slots = espandiAmbito({ giorni_settimana: ["lun"] }, ["N"], [], 2026, 7, {});
  s.eq(J(diurniNascosti(slots, 2026, 7, {})), J([]), "atteso nessun nascosto");
});
s.test('FORMA-INTERVALLO (caso Iengo): dicembre "da martedì a giovedì" solo N → il segnale diurno scatta (include l\'8)', () => {
  const amb = { giorni_settimana: { da: "mar", a: "gio" } };
  const slots = espandiAmbito(amb, ["N"], [], 2026, 11, {});
  const nasc = diurniNascosti(slots, 2026, 11, {});
  s.eq(J(nasc), J(expectedDiurniNascosti(2026, 11, amb, ["N"], [])), "diurno-nascosto sull'intervallo settimanale diverso dal calcolo indipendente");
  s.assert(nasc.includes(8), "manca l'8 dicembre (martedì festivo) tra i diurni nascosti dell'intervallo mar→gio");
  s.assert(nasc.every((g) => [2, 3, 4].includes(new Date(2026, 11, g).getDay())), "un giorno nascosto è fuori da mar/mer/gio");
});

s.finish();
