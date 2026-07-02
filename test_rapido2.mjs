// Test su inserimento rapido e protezione NO (CONTEXT.md §6.2, §6.3).
// toggleSedeCella/setNoCella/setPreferitoCella/applicaRapido vivono dentro il componente
// React (closure su useState) e non sono estraibili come funzioni pure del motore.
// Per testarne le REGOLE (non l'implementazione UI) questo file ne contiene una
// trascrizione fedele in forma pura, mantenuta identica riga per riga alla logica in
// turni-guardia-medica.jsx (righe ~526-753). Se la logica reale cambia, aggiornare qui.
import { normDispo, turniDelGiorno, dk } from './engine_test.mjs';
import { makeSuite, turnoDisp, ANNO_TEST, MESE_TEST } from './test_utils.mjs';

const suite = makeSuite("test_rapido2 — inserimento rapido e protezione NO");

// ---- trascrizione pura di toggleSedeCella (turni-guardia-medica.jsx ~526-566) ----
function toggleSedeCellaPuro(curRaw, sede) {
  const cur = normDispo(curRaw);
  const next = {
    piene: [...cur.piene], pieneLiv: { ...cur.pieneLiv }, ripiego: [...cur.ripiego], ripiegoLiv: { ...cur.ripiegoLiv },
    no: false, preferito: cur.no ? false : cur.preferito, preferitoRip: cur.no ? false : cur.preferitoRip,
  };
  if (next.piene.includes(sede)) {
    const livAttuale = next.pieneLiv[sede] || 1;
    if (livAttuale < 5) next.pieneLiv[sede] = livAttuale + 1;
    else {
      next.piene = next.piene.filter((s) => s !== sede);
      delete next.pieneLiv[sede];
      next.ripiego.push(sede);
      next.ripiegoLiv[sede] = 1;
    }
  } else if (next.ripiego.includes(sede)) {
    const livAttuale = next.ripiegoLiv[sede] || 1;
    if (livAttuale < 5) next.ripiegoLiv[sede] = livAttuale + 1;
    else {
      next.ripiego = next.ripiego.filter((s) => s !== sede);
      delete next.ripiegoLiv[sede];
    }
  } else {
    next.piene.push(sede);
    next.pieneLiv[sede] = 1;
  }
  if (!next.piene.length) { next.preferito = false; next.pieneLiv = {}; }
  if (!next.ripiego.length) { next.preferitoRip = false; next.ripiegoLiv = {}; }
  return next;
}

// ---- trascrizione pura di setNoCella (~567-572) ----
function setNoCellaPuro(valore) {
  if (valore) return { piene: [], pieneLiv: {}, ripiego: [], ripiegoLiv: {}, no: true, preferito: false, preferitoRip: false };
  return undefined; // rappresenta "delete nd[slotKey]" — cella tornata a "non specificato"
}

// ---- trascrizione pura di setPreferitoCella (~573-583) ----
function setPreferitoCellaPuro(curRaw, campo, valore) {
  const cur = normDispo(curRaw);
  if (cur.no) return curRaw; // "un turno non disponibile non può essere preferito": nessuna modifica
  const next = { piene: cur.piene, pieneLiv: cur.pieneLiv, ripiego: cur.ripiego, ripiegoLiv: cur.ripiegoLiv, no: false, preferito: cur.preferito, preferitoRip: cur.preferitoRip };
  next[campo] = valore;
  if (!next.piene.length) next.preferito = false;
  if (!next.ripiego.length) next.preferitoRip = false;
  return next;
}

// ---- trascrizione pura del cuore di applicaRapido (~649-739), per un singolo mese ----
// richiesti(y,m,d): turni "N"/"G" richiesti da rapNotte/rapGiorno e realmente presenti quel giorno
function turniRichiesti(y, m, d, rapNotte, rapGiorno, extras) {
  const info = turniDelGiorno(y, m, d, extras);
  const idsGiorno = info.turni.filter((t) => !t.extra).map((t) => t.id);
  const out = [];
  if (rapNotte && idsGiorno.includes("N")) out.push("N");
  if (rapGiorno && idsGiorno.includes("G")) out.push("G");
  return out;
}
function applicaRapidoPuro({ anno, mese, dispoEsistente, rapMedico, rapInizio, rapFine, rapNotte, rapGiorno, piene, ripiego, rapIndisp, extras }) {
  const patch = {}; // slotKey -> valore
  const touch = (y, m, d, tid, valore) => { patch[`${dk(y, m, d)}|${tid}`] = valore; };
  const inQualcheIndisp = (y, m, d) => {
    const t = new Date(y, m, d).getTime();
    return rapIndisp.some((r) => {
      const a = new Date(r.inizio + "T00:00:00").getTime(), b = new Date(r.fine + "T00:00:00").getTime();
      return t >= a && t <= b;
    });
  };
  let scrittiIndisp = 0, scrittiDisp = 0, protetti = 0;

  // PASSO 1: i periodi di indisponibilità vincono sempre
  rapIndisp.forEach((r) => {
    const rs = new Date(r.inizio + "T00:00:00"), re = new Date(r.fine + "T00:00:00");
    for (let dt = new Date(rs); dt <= re; dt.setDate(dt.getDate() + 1)) {
      const y = dt.getFullYear(), m = dt.getMonth(), d = dt.getDate();
      if (y !== anno || m !== mese) continue;
      turniRichiesti(y, m, d, rapNotte, rapGiorno, extras).forEach((tid) => {
        touch(y, m, d, tid, { piene: [], ripiego: [], ripiegoLiv: {}, no: true, preferito: false, preferitoRip: false });
        scrittiIndisp++;
      });
    }
  });

  // PASSO 2: il resto del periodo diventa disponibile — MA non se già toccato dal passo 1,
  // e non se esisteva già un'indisponibilità esplicita precedente (quella resta protetta)
  if (piene.length || ripiego.length) {
    const start = new Date(rapInizio + "T00:00:00"), end = new Date(rapFine + "T00:00:00");
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      const y = dt.getFullYear(), m = dt.getMonth(), d = dt.getDate();
      if (inQualcheIndisp(y, m, d)) continue;
      if (y !== anno || m !== mese) continue;
      turniRichiesti(y, m, d, rapNotte, rapGiorno, extras).forEach((tid) => {
        const slotKey = `${dk(y, m, d)}|${tid}`;
        const preesistente = normDispo(dispoEsistente[rapMedico]?.[slotKey]);
        if (preesistente.no) { protetti++; return; }
        const ripLivRap = {};
        ripiego.forEach((s) => { ripLivRap[s] = 1; });
        touch(y, m, d, tid, { piene: [...piene], ripiego: [...ripiego], ripiegoLiv: ripLivRap, no: false, preferito: false, preferitoRip: false });
        scrittiDisp++;
      });
    }
  }
  return { patch, scrittiIndisp, scrittiDisp, protetti };
}

// ---------------------------------------------------------------------------
// TOGGLE SEDE CELLA — ciclo dei livelli
// ---------------------------------------------------------------------------
suite.test("fuori → prima piena a livello 1", () => {
  const r = toggleSedeCellaPuro(undefined, "Maniago");
  suite.assert(r.piene.includes("Maniago") && r.pieneLiv.Maniago === 1);
});
suite.test("piena livello1 → livello2 con un secondo tocco", () => {
  const r1 = toggleSedeCellaPuro(undefined, "Maniago");
  const r2 = toggleSedeCellaPuro(r1, "Maniago");
  suite.eq(r2.pieneLiv.Maniago, 2);
});
suite.test("piena livello5 → ripiego livello1 al tocco successivo", () => {
  let r = undefined;
  for (let i = 0; i < 5; i++) r = toggleSedeCellaPuro(r, "Maniago"); // 5 tocchi: liv1..liv5
  suite.eq(r.pieneLiv.Maniago, 5);
  const r6 = toggleSedeCellaPuro(r, "Maniago");
  suite.assert(!r6.piene.includes("Maniago") && r6.ripiego.includes("Maniago") && r6.ripiegoLiv.Maniago === 1);
});
suite.test("ripiego livello5 → fuori al tocco successivo (ciclo completo)", () => {
  let r = undefined;
  for (let i = 0; i < 6; i++) r = toggleSedeCellaPuro(r, "Maniago"); // 5 piena + 1 -> ripiego liv1
  for (let i = 0; i < 4; i++) r = toggleSedeCellaPuro(r, "Maniago"); // ripiego liv1..5
  suite.eq(r.ripiegoLiv.Maniago, 5);
  const rFuori = toggleSedeCellaPuro(r, "Maniago");
  suite.assert(!rFuori.piene.includes("Maniago") && !rFuori.ripiego.includes("Maniago"));
});
suite.test("toggle su due sedi diverse le imposta entrambe come piene indipendenti a livello 1", () => {
  let r = toggleSedeCellaPuro(undefined, "Maniago");
  r = toggleSedeCellaPuro(r, "Spilimbergo");
  suite.eq(r.pieneLiv.Maniago, 1);
  suite.eq(r.pieneLiv.Spilimbergo, 1);
});

// ---------------------------------------------------------------------------
// SET NO CELLA e SET PREFERITO CELLA
// ---------------------------------------------------------------------------
suite.test("setNoCella(true) pulisce piene/ripiego e imposta no", () => {
  const r = setNoCellaPuro(true);
  suite.assert(r.no === true && r.piene.length === 0 && r.ripiego.length === 0 && r.preferito === false);
});
suite.test("setNoCella(false) rimuove la cella (torna a \"non specificato\")", () => {
  suite.eq(setNoCellaPuro(false), undefined);
});
suite.test("setPreferitoCella non fa nulla se la cella è già NO esplicito", () => {
  const cur = turnoDisp([], [], { no: true });
  const r = setPreferitoCellaPuro(cur, "preferito", true);
  suite.eq(r, cur, "un turno NO non può diventare preferito");
});
suite.test("setPreferitoCella forza preferito=false se piene è vuoto", () => {
  const cur = turnoDisp([], ["Meduno"], { ripiegoLiv: { Meduno: 1 } });
  const r = setPreferitoCellaPuro(cur, "preferito", true);
  suite.eq(r.preferito, false, "non si può preferire una piena inesistente");
});

// ---------------------------------------------------------------------------
// APPLICA RAPIDO — range fill e protezione NO
// ---------------------------------------------------------------------------
const M = ANNO_TEST + "-08"; // agosto 2026 in formato YYYY-MM per le date del rapido
suite.test("range di disponibilità scrive piene/ripiego sui giorni feriali richiesti (turno N)", () => {
  const { patch, scrittiDisp } = applicaRapidoPuro({
    anno: ANNO_TEST, mese: MESE_TEST, dispoEsistente: {}, rapMedico: 1,
    rapInizio: `${M}-03`, rapFine: `${M}-05`, rapNotte: true, rapGiorno: false,
    piene: ["Maniago"], ripiego: [], rapIndisp: [], extras: {},
  });
  suite.eq(scrittiDisp, 3, "3 giorni feriali (3,4,5 agosto), tutti con solo turno N");
  suite.assert(patch[`${dk(ANNO_TEST, MESE_TEST, 3)}|N`].piene.includes("Maniago"));
});

suite.test("NO esplicito preesistente NON viene sovrascritto dal passo disponibilità", () => {
  const slotKey = `${dk(ANNO_TEST, MESE_TEST, 4)}|N`;
  const dispoEsistente = { 1: { [slotKey]: turnoDisp([], [], { no: true }) } };
  const { patch, protetti } = applicaRapidoPuro({
    anno: ANNO_TEST, mese: MESE_TEST, dispoEsistente, rapMedico: 1,
    rapInizio: `${M}-03`, rapFine: `${M}-05`, rapNotte: true, rapGiorno: false,
    piene: ["Maniago"], ripiego: [], rapIndisp: [], extras: {},
  });
  suite.eq(protetti, 1, "il giorno 4 (già NO) deve risultare protetto, non sovrascritto");
  suite.assert(!patch[slotKey], "nessuna patch di disponibilità deve toccare il giorno protetto");
});

suite.test("un periodo di indisponibilità esplicito nel range vince sempre sul passo disponibilità", () => {
  const { patch, scrittiIndisp, scrittiDisp } = applicaRapidoPuro({
    anno: ANNO_TEST, mese: MESE_TEST, dispoEsistente: {}, rapMedico: 1,
    rapInizio: `${M}-03`, rapFine: `${M}-07`, rapNotte: true, rapGiorno: false,
    piene: ["Maniago"], ripiego: [], rapIndisp: [{ inizio: `${M}-04`, fine: `${M}-04` }], extras: {},
  });
  suite.eq(scrittiIndisp, 1, "il 4 agosto deve risultare scritto come indisponibile");
  suite.eq(scrittiDisp, 4, "gli altri 4 giorni feriali del range restano disponibili");
  suite.assert(patch[`${dk(ANNO_TEST, MESE_TEST, 4)}|N`].no === true);
  suite.assert(patch[`${dk(ANNO_TEST, MESE_TEST, 3)}|N`].no === false);
});

suite.test("giorni feriali senza turno diurno vengono ignorati per il diurno (nessuna scrittura G)", () => {
  const { patch } = applicaRapidoPuro({
    anno: ANNO_TEST, mese: MESE_TEST, dispoEsistente: {}, rapMedico: 1,
    rapInizio: `${M}-03`, rapFine: `${M}-03`, rapNotte: false, rapGiorno: true,
    piene: ["Maniago"], ripiego: [], rapIndisp: [], extras: {},
  });
  suite.eq(Object.keys(patch).length, 0, "il 3 agosto è feriale semplice: nessun turno G da compilare");
});

suite.finish();
