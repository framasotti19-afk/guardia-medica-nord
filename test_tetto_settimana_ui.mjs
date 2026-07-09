// Test della LOGICA del campo "Max turni a settimana" (tab Medici): l'enumerazione delle settimane ISO
// che toccano il mese deve includere le settimane TRONCATE ai bordi (era il buco di De Candido), e le
// chiavi SETT: scritte devono essere lette dal motore via capSettimanale. Il wiring UI è glue; qui si
// verifica la logica pura (settimanaDi/capSettimanale sono funzioni del motore). NON tocca elaboraSchema.
import { settimanaDi, capSettimanale, turniDelGiorno, dk } from "./engine_test.mjs";
import { makeSuite } from "./test_utils.mjs";

const s = makeSuite("Tetto settimanale UI — enumerazione settimane del mese (bordi inclusi)");
const J = (x) => JSON.stringify(x);

// Replica dell'enumerazione fatta dal componente (settimaneDelMese): distinta di settimanaDi su tutti i
// giorni del mese → tutti i lunedì-ISO delle settimane che contengono almeno un giorno del mese.
const settimaneDelMese = (anno, mese) => {
  const nG = new Date(anno, mese + 1, 0).getDate();
  const set = new Set();
  for (let g = 1; g <= nG; g++) set.add(settimanaDi(dk(anno, mese, g)));
  return [...set];
};

s.test("agosto 2026: include le settimane troncate ai bordi (27 lug e 31 ago), niente buchi", () => {
  const wks = settimaneDelMese(2026, 7);
  s.eq(J(wks), J(["2026-07-27", "2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"]), "settimane di agosto 2026 diverse dall'atteso");
  s.assert(wks.includes("2026-07-27"), "manca la settimana del 27 lug (copre 1-2 ago) — buco di bordo");
  s.assert(wks.includes("2026-08-31"), "manca la settimana del 31 ago (sfora a settembre) — buco di bordo");
  // ogni lunedì consecutivo è a 7 giorni dal precedente: nessun buco
  for (let i = 1; i < wks.length; i++) {
    const g = (new Date(wks[i] + "T00:00:00") - new Date(wks[i - 1] + "T00:00:00")) / 86400000;
    s.eq(g, 7, `salto diverso da 7 giorni tra ${wks[i - 1]} e ${wks[i]}`);
  }
});
s.test("il 1° e l'ultimo giorno del mese cadono davvero nelle settimane di bordo enumerate", () => {
  const wks = settimaneDelMese(2026, 7);
  s.assert(wks.includes(settimanaDi(dk(2026, 7, 1))), "la settimana del giorno 1 non è tra quelle enumerate");
  s.assert(wks.includes(settimanaDi(dk(2026, 7, 31))), "la settimana dell'ultimo giorno non è tra quelle enumerate");
});
s.test("scrittura in blocco: capSettimanale legge N su tutte le settimane del mese, null fuori", () => {
  const N = 2, mid = 7;
  const nd = {};
  settimaneDelMese(2026, 7).forEach((wk) => { nd["SETT:" + wk] = { maxTurni: N }; });
  const dispo = { [mid]: nd };
  // il motore trova il tetto per ogni settimana del mese (incluse le troncate)
  for (const wk of settimaneDelMese(2026, 7)) s.eq(capSettimanale(dispo, mid, wk), N, `cap non letto per la settimana ${wk}`);
  // una settimana che NON tocca agosto (es. metà settembre) non ha tetto
  s.eq(capSettimanale(dispo, mid, settimanaDi(dk(2026, 8, 15))), null, "tetto trovato per una settimana fuori dal mese");
});
s.test("campo vuoto = rimozione: nessuna chiave SETT: residua", () => {
  const mid = 7;
  const nd = {};
  settimaneDelMese(2026, 7).forEach((wk) => { nd["SETT:" + wk] = { maxTurni: 3 }; });
  // simula lo svuotamento del campo: rimuovi tutte le SETT:
  Object.keys(nd).forEach((k) => { if (k.startsWith("SETT:")) delete nd[k]; });
  s.eq(Object.keys(nd).filter((k) => k.startsWith("SETT:")).length, 0, "restano chiavi SETT: dopo lo svuotamento");
  s.eq(capSettimanale({ [mid]: nd }, mid, "2026-08-03"), null, "cap ancora presente dopo lo svuotamento");
});
s.test("febbraio 2026 (mese corto): settimane coerenti e bordi inclusi", () => {
  const wks = settimaneDelMese(2026, 1); // febbraio (0-based 1)
  s.assert(wks.includes(settimanaDi(dk(2026, 1, 1))), "manca la settimana del 1 feb");
  s.assert(wks.includes(settimanaDi(dk(2026, 1, 28))), "manca la settimana del 28 feb");
  for (let i = 1; i < wks.length; i++) {
    const g = (new Date(wks[i] + "T00:00:00") - new Date(wks[i - 1] + "T00:00:00")) / 86400000;
    s.eq(g, 7, "salto diverso da 7 giorni");
  }
});

// --- Tetti DIVERSI per settimana (il nuovo pannellino "per settimana") ---
s.test("tetti per-settimana divergenti [2,2,1,2,2]: capSettimanale legge il valore giusto per ogni settimana", () => {
  const mid = 7;
  const wks = settimaneDelMese(2026, 7); // 6 settimane di agosto 2026
  // simula il pannellino: scrive un valore per settimana (la settimana di Ferragosto = 1, le altre = 2)
  const ferragosto = settimanaDi(dk(2026, 7, 15)); // lunedì della settimana del 15 ago
  const nd = {};
  wks.forEach((wk) => { nd["SETT:" + wk] = { maxTurni: wk === ferragosto ? 1 : 2 }; });
  const dispo = { [mid]: nd };
  for (const wk of wks) s.eq(capSettimanale(dispo, mid, wk), wk === ferragosto ? 1 : 2, `cap sbagliato per ${wk}`);
  // "misto" = non tutte le settimane uguali
  const vals = wks.map((wk) => capSettimanale(dispo, mid, wk));
  s.assert(!vals.every((v) => v === vals[0]), "i tetti divergenti dovrebbero risultare 'misti'");
});
s.test("svuotare UNA settimana lascia le altre intatte (rimozione mirata)", () => {
  const mid = 7;
  const wks = settimaneDelMese(2026, 7);
  const nd = {};
  wks.forEach((wk) => { nd["SETT:" + wk] = { maxTurni: 2 }; });
  // svuota solo la 3ª settimana (come farebbe setCapSettimanaDi con valore vuoto)
  delete nd["SETT:" + wks[2]];
  const dispo = { [mid]: nd };
  s.eq(capSettimanale(dispo, mid, wks[2]), null, "la settimana svuotata dovrebbe non avere tetto");
  s.eq(capSettimanale(dispo, mid, wks[0]), 2, "le altre settimane non devono cambiare");
  s.eq(capSettimanale(dispo, mid, wks[1]), 2, "le altre settimane non devono cambiare");
});
s.test("uniforme vs misto: [2,2,2,2,2,2] è uniforme, [2,2,1,2,2,2] è misto", () => {
  const wks = settimaneDelMese(2026, 7);
  const uni = {}; wks.forEach((wk) => { uni["SETT:" + wk] = { maxTurni: 2 }; });
  const mix = {}; wks.forEach((wk, i) => { mix["SETT:" + wk] = { maxTurni: i === 2 ? 1 : 2 }; });
  const valsU = wks.map((wk) => capSettimanale({ 7: uni }, 7, wk));
  const valsM = wks.map((wk) => capSettimanale({ 7: mix }, 7, wk));
  s.assert(valsU.every((v) => v === valsU[0]) && valsU[0] === 2, "il caso uniforme non è riconosciuto come uniforme");
  s.assert(!valsM.every((v) => v === valsM[0]), "il caso misto non è riconosciuto come misto");
});
s.test("pallino festivo: la settimana che contiene Ferragosto (15 ago) ha un festivo/prefestivo", () => {
  // replica la rilevazione di infoSettimana().haFestivo con turniDelGiorno (funzione del motore)
  const haFestivo = (wk) => {
    const lun = new Date(wk + "T00:00:00");
    for (let i = 0; i < 7; i++) {
      const d = new Date(lun); d.setDate(d.getDate() + i);
      const info = turniDelGiorno(d.getFullYear(), d.getMonth(), d.getDate(), {});
      if (info.festivo || info.prefestivo) return true;
    }
    return false;
  };
  const ferragosto = settimanaDi(dk(2026, 7, 15));
  s.assert(haFestivo(ferragosto), "la settimana di Ferragosto non risulta avere festivi (pallino mancante)");
  // una settimana "pulita" di agosto (quella del 3 ago = 3-9, nessun festivo) non ha il pallino
  s.assert(!haFestivo("2026-08-03"), "una settimana feriale pulita non dovrebbe avere il pallino");
});

// --- V-A: settimana a CAVALLO (vincolo dal mese precedente) ---
// Il coordinatore dichiara un tetto; i turni di luglio nella settimana a cavallo lo riducono SOLO per
// quella settimana. SETT:cavallo = {maxTurni: effettivo, dichiarato}. Il motore legge maxTurni (effettivo).
const cavalloDi = (anno, mese0) => { const day1 = dk(anno, mese0, 1); const lun = settimanaDi(day1); return lun < day1 ? lun : null; };
const valoreCavallo = (dich, july) => ({ maxTurni: Math.max(0, dich - july), dichiarato: dich });
s.test("agosto 2026 HA una settimana a cavallo (lun 27 lug < 1 ago); un mese che inizia di lunedì no", () => {
  s.eq(cavalloDi(2026, 7), "2026-07-27", "cavallo di agosto 2026 diverso da lun 27 lug");
  // trova un mese 2026 che inizia di lunedì e verifica che NON abbia cavallo
  let m0 = -1; for (let k = 0; k < 12; k++) if (settimanaDi(dk(2026, k, 1)) === dk(2026, k, 1)) { m0 = k; break; }
  s.assert(m0 >= 0, "atteso almeno un mese 2026 che inizia di lunedì");
  s.eq(cavalloDi(2026, m0), null, "un mese che inizia di lunedì non deve avere cavallo");
});
s.test("giorni di luglio nella settimana a cavallo di agosto = 27,28,29,30,31 lug (tutti feriali → solo N)", () => {
  const lun = cavalloDi(2026, 7), day1 = dk(2026, 7, 1), giorni = [];
  for (let d = new Date(lun + "T00:00:00"); dk(d.getFullYear(), d.getMonth(), d.getDate()) < day1; d.setDate(d.getDate() + 1)) {
    const info = turniDelGiorno(d.getFullYear(), d.getMonth(), d.getDate(), {});
    giorni.push({ g: d.getDate(), haG: info.turni.some((t) => t.id === "G") });
  }
  s.eq(J(giorni.map((x) => x.g)), J([27, 28, 29, 30, 31]), "giorni della settimana a cavallo diversi da 27-31 lug");
  s.assert(giorni.every((x) => !x.haG), "nessuno dei 27-31 lug 2026 dovrebbe avere il diurno (sono feriali)");
});
s.test("V-A: dichiarato 2 + 1 turno a luglio → il MOTORE vede effettivo 1 sul cavallo, dichiarato preservato", () => {
  const lun = cavalloDi(2026, 7), mid = 7;
  const nd = { ["SETT:" + lun]: valoreCavallo(2, 1) }; // dichiarato 2, luglio 1 → effettivo 1
  const dispo = { [mid]: nd };
  s.eq(capSettimanale(dispo, mid, lun), 1, "il motore deve leggere l'effettivo 1 (2 − 1 luglio)");
  s.eq(dispo[mid]["SETT:" + lun].dichiarato, 2, "il dichiarato 2 deve essere preservato nella chiave");
});
s.test("V-A: cambiare i turni di luglio ricalcola l'effettivo senza perdere il dichiarato", () => {
  const lun = cavalloDi(2026, 7), mid = 7, dich = 2;
  // luglio 0 → eff 2 ; luglio 1 → eff 1 ; luglio 2 → eff 0 ; luglio 3 (≥ dich) → eff 0
  for (const [july, atteso] of [[0, 2], [1, 1], [2, 0], [3, 0]]) {
    const dispo = { [mid]: { ["SETT:" + lun]: valoreCavallo(dich, july) } };
    s.eq(capSettimanale(dispo, mid, lun), atteso, `luglio ${july}: effettivo atteso ${atteso}`);
    s.eq(dispo[mid]["SETT:" + lun].dichiarato, dich, `luglio ${july}: dichiarato deve restare ${dich}`);
  }
});
s.test("V-A: le altre settimane non sono toccate (nessun 'dichiarato', maxTurni = valore pieno)", () => {
  const wks = settimaneDelMese(2026, 7), lun = cavalloDi(2026, 7), mid = 7;
  const nd = {}; wks.forEach((wk) => { nd["SETT:" + wk] = wk === lun ? valoreCavallo(2, 1) : { maxTurni: 2 }; });
  const dispo = { [mid]: nd };
  wks.filter((wk) => wk !== lun).forEach((wk) => {
    s.eq(capSettimanale(dispo, mid, wk), 2, `settimana ${wk} non-cavallo deve restare 2`);
    s.assert(dispo[mid]["SETT:" + wk].dichiarato === undefined, `settimana ${wk} non-cavallo non deve avere 'dichiarato'`);
  });
  s.eq(capSettimanale(dispo, mid, lun), 1, "il cavallo deve essere l'effettivo 1");
});
s.test("V-A: senza tetto sul cavallo, i turni di luglio non hanno effetto (nessuna chiave)", () => {
  const lun = cavalloDi(2026, 7), mid = 7;
  const dispo = { [mid]: {} }; // nessuna SETT:cavallo
  s.eq(capSettimanale(dispo, mid, lun), null, "senza tetto dichiarato, il cavallo non ha limite anche con turni a luglio");
});

s.finish();
