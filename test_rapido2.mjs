// Test su inserimento rapido e protezione NO (CONTEXT.md §6.2, §6.3).
// setSedeOpzione/setNoCella/applicaRapido vivono dentro il componente
// React (closure su useState) e non sono estraibili come funzioni pure del motore.
// Per testarne le REGOLE (non l'implementazione UI) questo file ne contiene una
// trascrizione fedele in forma pura, mantenuta identica alla logica in
// turni-guardia-medica.jsx. Se la logica reale cambia, aggiornare qui.
import { normDispo, turniDelGiorno, dk } from './engine_test.mjs';
import { makeSuite, turnoDisp, ANNO_TEST, MESE_TEST } from './test_utils.mjs';

const suite = makeSuite("test_rapido2 — inserimento rapido e protezione NO");

// ---- trascrizione pura di setSedeOpzione (turni-guardia-medica.jsx, menu a tendina) ----
// opzione: "" (non disponibile) | "V1".."V5" (verde) | "B1".."B4" (blu)
function setSedeOpzionePuro(curRaw, sede, opzione) {
  const cur = normDispo(curRaw);
  const next = {
    verde: cur.verde.filter((s) => s !== sede), verdeLiv: { ...cur.verdeLiv },
    blu: cur.blu.filter((s) => s !== sede), bluLiv: { ...cur.bluLiv },
    no: false,
  };
  delete next.verdeLiv[sede];
  delete next.bluLiv[sede];
  if (opzione[0] === "V") { next.verde.push(sede); next.verdeLiv[sede] = Number(opzione.slice(1)); }
  else if (opzione[0] === "B") { next.blu.push(sede); next.bluLiv[sede] = Number(opzione.slice(1)); }
  return next;
}

// ---- trascrizione pura di setNoCella ----
function setNoCellaPuro(valore) {
  if (valore) return { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: true };
  return undefined; // rappresenta "delete nd[slotKey]" — cella tornata a "non specificato"
}

// ---- trascrizione pura del cuore di applicaRapido, per un singolo mese ----
function turniRichiesti(y, m, d, rapNotte, rapGiorno, extras) {
  const info = turniDelGiorno(y, m, d, extras);
  const idsGiorno = info.turni.filter((t) => !t.extra).map((t) => t.id);
  const out = [];
  if (rapNotte && idsGiorno.includes("N")) out.push("N");
  if (rapGiorno && idsGiorno.includes("G")) out.push("G");
  return out;
}
function applicaRapidoPuro({ anno, mese, dispoEsistente, rapMedico, rapInizio, rapFine, rapNotte, rapGiorno, verde, blu, rapIndisp, extras }) {
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
        touch(y, m, d, tid, { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: true });
        scrittiIndisp++;
      });
    }
  });

  // PASSO 2: il resto del periodo diventa disponibile — MA non se già toccato dal passo 1,
  // e non se esisteva già un'indisponibilità esplicita precedente (quella resta protetta)
  if (verde.length || blu.length) {
    const start = new Date(rapInizio + "T00:00:00"), end = new Date(rapFine + "T00:00:00");
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      const y = dt.getFullYear(), m = dt.getMonth(), d = dt.getDate();
      if (inQualcheIndisp(y, m, d)) continue;
      if (y !== anno || m !== mese) continue;
      turniRichiesti(y, m, d, rapNotte, rapGiorno, extras).forEach((tid) => {
        const slotKey = `${dk(y, m, d)}|${tid}`;
        const preesistente = normDispo(dispoEsistente[rapMedico]?.[slotKey]);
        if (preesistente.no) { protetti++; return; }
        const verdeLivRap = {}; verde.forEach((s) => { verdeLivRap[s] = 1; });
        const bluLivRap = {}; blu.forEach((s) => { bluLivRap[s] = 1; });
        touch(y, m, d, tid, { verde: [...verde], verdeLiv: verdeLivRap, blu: [...blu], bluLiv: bluLivRap, no: false });
        scrittiDisp++;
      });
    }
  }
  return { patch, scrittiIndisp, scrittiDisp, protetti };
}

// ---------------------------------------------------------------------------
// SET SEDE OPZIONE — selezione diretta dal menu a tendina
// ---------------------------------------------------------------------------
suite.test("selezionare Verde1 per una sede fuori la imposta come verde livello 1", () => {
  const r = setSedeOpzionePuro(undefined, "Maniago", "V1");
  suite.assert(r.verde.includes("Maniago") && r.verdeLiv.Maniago === 1);
});
suite.test("cambiare da Verde1 a Verde3 sulla stessa sede aggiorna solo il livello", () => {
  const r1 = setSedeOpzionePuro(undefined, "Maniago", "V1");
  const r2 = setSedeOpzionePuro(r1, "Maniago", "V3");
  suite.eq(r2.verdeLiv.Maniago, 3);
  suite.eq(r2.verde.length, 1, "la sede non deve duplicarsi nell'array");
});
suite.test("cambiare da Verde a Blu sulla stessa sede sposta la sede da un elenco all'altro", () => {
  const r1 = setSedeOpzionePuro(undefined, "Maniago", "V2");
  const r2 = setSedeOpzionePuro(r1, "Maniago", "B1");
  suite.assert(!r2.verde.includes("Maniago") && r2.blu.includes("Maniago") && r2.bluLiv.Maniago === 1);
});
suite.test("selezionare \"Non disponibile\" (opzione vuota) rimuove la sede da verde e blu", () => {
  const r1 = setSedeOpzionePuro(undefined, "Maniago", "V1");
  const r2 = setSedeOpzionePuro(r1, "Maniago", "");
  suite.assert(!r2.verde.includes("Maniago") && !r2.blu.includes("Maniago"));
});
suite.test("due sedi diverse si impostano in modo indipendente", () => {
  let r = setSedeOpzionePuro(undefined, "Maniago", "V1");
  r = setSedeOpzionePuro(r, "Spilimbergo", "B2");
  suite.eq(r.verdeLiv.Maniago, 1);
  suite.eq(r.bluLiv.Spilimbergo, 2);
});
suite.test("Blu4 è il livello massimo consentito dal menu (4 opzioni blu, non 5)", () => {
  const r = setSedeOpzionePuro(undefined, "Meduno", "B4");
  suite.eq(r.bluLiv.Meduno, 4);
});

// ---------------------------------------------------------------------------
// SET NO CELLA
// ---------------------------------------------------------------------------
suite.test("setNoCella(true) pulisce verde/blu e imposta no", () => {
  const r = setNoCellaPuro(true);
  suite.assert(r.no === true && r.verde.length === 0 && r.blu.length === 0);
});
suite.test("setNoCella(false) rimuove la cella (torna a \"non specificato\")", () => {
  suite.eq(setNoCellaPuro(false), undefined);
});
// ---------------------------------------------------------------------------
// APPLICA RAPIDO — range fill e protezione NO
// ---------------------------------------------------------------------------
const M = ANNO_TEST + "-08"; // agosto 2026 in formato YYYY-MM per le date del rapido
suite.test("range di disponibilità scrive verde/blu sui giorni feriali richiesti (turno N)", () => {
  const { patch, scrittiDisp } = applicaRapidoPuro({
    anno: ANNO_TEST, mese: MESE_TEST, dispoEsistente: {}, rapMedico: 1,
    rapInizio: `${M}-03`, rapFine: `${M}-05`, rapNotte: true, rapGiorno: false,
    verde: ["Maniago"], blu: [], rapIndisp: [], extras: {},
  });
  suite.eq(scrittiDisp, 3, "3 giorni feriali (3,4,5 agosto), tutti con solo turno N");
  suite.assert(patch[`${dk(ANNO_TEST, MESE_TEST, 3)}|N`].verde.includes("Maniago"));
});

suite.test("NO esplicito preesistente NON viene sovrascritto dal passo disponibilità", () => {
  const slotKey = `${dk(ANNO_TEST, MESE_TEST, 4)}|N`;
  const dispoEsistente = { 1: { [slotKey]: turnoDisp([], [], { no: true }) } };
  const { patch, protetti } = applicaRapidoPuro({
    anno: ANNO_TEST, mese: MESE_TEST, dispoEsistente, rapMedico: 1,
    rapInizio: `${M}-03`, rapFine: `${M}-05`, rapNotte: true, rapGiorno: false,
    verde: ["Maniago"], blu: [], rapIndisp: [], extras: {},
  });
  suite.eq(protetti, 1, "il giorno 4 (già NO) deve risultare protetto, non sovrascritto");
  suite.assert(!patch[slotKey], "nessuna patch di disponibilità deve toccare il giorno protetto");
});

suite.test("un periodo di indisponibilità esplicito nel range vince sempre sul passo disponibilità", () => {
  const { patch, scrittiIndisp, scrittiDisp } = applicaRapidoPuro({
    anno: ANNO_TEST, mese: MESE_TEST, dispoEsistente: {}, rapMedico: 1,
    rapInizio: `${M}-03`, rapFine: `${M}-07`, rapNotte: true, rapGiorno: false,
    verde: ["Maniago"], blu: [], rapIndisp: [{ inizio: `${M}-04`, fine: `${M}-04` }], extras: {},
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
    verde: ["Maniago"], blu: [], rapIndisp: [], extras: {},
  });
  suite.eq(Object.keys(patch).length, 0, "il 3 agosto è feriale semplice: nessun turno G da compilare");
});

suite.test("il rapido può compilare anche solo blu (nessun verde), senza sedi fisiche", () => {
  const { patch, scrittiDisp } = applicaRapidoPuro({
    anno: ANNO_TEST, mese: MESE_TEST, dispoEsistente: {}, rapMedico: 1,
    rapInizio: `${M}-03`, rapFine: `${M}-03`, rapNotte: true, rapGiorno: false,
    verde: [], blu: ["Claut"], rapIndisp: [], extras: {},
  });
  suite.eq(scrittiDisp, 1);
  suite.assert(patch[`${dk(ANNO_TEST, MESE_TEST, 3)}|N`].blu.includes("Claut") && patch[`${dk(ANNO_TEST, MESE_TEST, 3)}|N`].verde.length === 0);
});

suite.finish();
