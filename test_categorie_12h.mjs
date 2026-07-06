// Test sulle categorie DET12ASAP e DET12 (CONTEXT.md §3.1). Gerarchia completa aggiornata:
// INDET → DET38 → DET24 = DET12ASAP → DET12 → SENZA INCARICO.
// DET24 e DET12ASAP condividono lo STESSO livello di priorità (prio 3): non sono in relazione
// gerarchica tra loro, uno spareggio diretto si risolve con titolarità → debito → graduatoria,
// esattamente come tra due medici della stessa categoria.
// MEDICI_DEFAULT include 1 DET12ASAP nativo (VALERI, tit.Spilimbergo) e 1 DET12 nativo (MORANO,
// tit.Maniago), usati direttamente senza bisogno di override. PRESSACCO (grad57, SENZA di default)
// viene invece temporaneamente "riassunto" come DET24 titolare di Spilimbergo per i test che
// necessitano di un secondo DET24 con grad peggiore di VALERI — nessun DET24 nativo ha oggi un
// grad peggiore di 25 (il peggiore è BEKAEVA, grad17), quindi l'override preserva esattamente il
// confronto originale (grad57 contro grad25).
import { MEDICI_DEFAULT, setMediciGlobal, byId, dk, elaboraSchema, CAT_INFO, isDeterminato } from './engine_test.mjs';
import { makeSuite, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI } from './test_utils.mjs';

const suite = makeSuite("test_categorie_12h — DET12ASAP e DET12");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const G1 = GIORNI_FERIALI_SEMPLICI[0];
const BERTUZZI = 9; // INDET, titolare Spilimbergo
const FOSCHIANI = 6; // DET38, titolare Spilimbergo
const MARTINETTI = 7; // DET24, titolare Spilimbergo
const VALERI = 8; // DET12ASAP nativo, titolare Spilimbergo, grad25
const MORANO = 5; // DET12 nativo, titolare Maniago, grad72
const ZURLO = 1; // DET38 di default, usato come override "senza incarico" in un test
const PRESSACCO = 10; // SENZA di default (grad57), riassunto come DET24 titolare Spilimbergo per i confronti sotto

function resetMedici() { setMediciGlobal(MEDICI_DEFAULT); }
function conPressaccoDet24() {
  return MEDICI_DEFAULT.map((m) => (m.id === PRESSACCO ? { ...m, cat: "DET24", sedeContratto: "Spilimbergo" } : m));
}
function dispoBase() { const d = {}; MEDICI_DEFAULT.forEach((m) => (d[m.id] = {})); return d; }
function unicoTurno(dispo, extraOre = {}, mediciAttuali) {
  const list = mediciAttuali || MEDICI_DEFAULT;
  const d2 = {};
  list.forEach((m) => (d2[m.id] = dispo[m.id] || {}));
  const { schema } = elaboraSchema(d2, extraOre, ANNO_TEST, MESE_TEST, {});
  return schema.find((g) => g.giorno === G1).turni.find((t) => t.id === "N");
}

// ---------------------------------------------------------------------------
// DEFINIZIONE CATEGORIE
// ---------------------------------------------------------------------------
suite.test("DET12ASAP e DET12 hanno monte ore mensile base 52h", () => {
  suite.eq(CAT_INFO.DET12ASAP.ore, 52);
  suite.eq(CAT_INFO.DET12.ore, 52);
});
suite.test("DET24 e DET12ASAP condividono lo stesso prio: non sono in relazione gerarchica tra loro", () => {
  suite.eq(CAT_INFO.DET24.prio, CAT_INFO.DET12ASAP.prio);
});
suite.test("gerarchia completa dei prio: INDET < DET38 < DET24 = DET12ASAP < DET12 < SENZA", () => {
  suite.assert(CAT_INFO.INDET.prio < CAT_INFO.DET38.prio, "INDET prima di DET38");
  suite.assert(CAT_INFO.DET38.prio < CAT_INFO.DET24.prio, "DET38 prima di DET24");
  suite.assert(CAT_INFO.DET24.prio < CAT_INFO.DET12.prio, "DET24 prima di DET12");
  suite.assert(CAT_INFO.DET12ASAP.prio < CAT_INFO.DET12.prio, "DET12ASAP prima di DET12");
  suite.assert(CAT_INFO.DET12.prio < CAT_INFO.SENZA.prio, "DET12 prima di SENZA");
});
suite.test("DET12ASAP e DET12 sono \"determinati\" (isDeterminato) — titolarità di sede si applica anche a loro (VALERI, MORANO nativi)", () => {
  suite.assert(isDeterminato(VALERI), "VALERI (DET12ASAP) è determinato");
  suite.assert(isDeterminato(MORANO), "MORANO (DET12) è determinato");
});

// ---------------------------------------------------------------------------
// DET24 = DET12ASAP: spareggio diretto per debito, non per categoria
// (VALERI e PRESSACCO entrambi titolari di Spilimbergo: contesa su Maniago isola il confronto)
// ---------------------------------------------------------------------------
suite.test("DET24 vs DET12ASAP a parità di categoria (stesso prio): vince chi ha più debito residuo, non chi ha grad migliore", () => {
  const lista = conPressaccoDet24();
  setMediciGlobal(lista);
  const d = dispoBase();
  // VALERI (grad25, DET12ASAP, ~60h di monte ore ad agosto — 52h base +8h aggiustamento mensile
  // §3.11) e PRESSACCO (grad57, DET24, 104h, agosto non è mese aggiustato per DET24): a inizio
  // mese, senza extraOre, PRESSACCO ha più debito residuo puro (104 contro 60): deve vincere
  // PRESSACCO, nonostante il grad nettamente peggiore, perché il prio è identico e decide solo il
  // debito. Contesa su Maniago: nessuno dei due titolare lì (entrambi titolari di Spilimbergo).
  d[VALERI][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, {}, lista);
  suite.eq(t.slots[0], PRESSACCO, "PRESSACCO (DET24, più debito residuo) vince su VALERI (DET12ASAP, grad migliore ma meno debito)");
  resetMedici();
});

suite.test("DET24 vs DET12ASAP: con più debito residuo, il DET12ASAP vince anche su un DET24 di grad migliore", () => {
  const lista = conPressaccoDet24();
  setMediciGlobal(lista);
  const d = dispoBase();
  d[VALERI][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, { [VALERI]: 50 }, lista); // 60+50=110h > 104h di PRESSACCO
  suite.eq(t.slots[0], VALERI, "VALERI (DET12ASAP, con debito maggiorato) vince su PRESSACCO (DET24)");
  resetMedici();
});

suite.test("DET24 vs DET12ASAP a parità di debito residuo: decide la graduatoria, come tra medici della stessa categoria", () => {
  const lista = conPressaccoDet24();
  setMediciGlobal(lista);
  const d = dispoBase();
  d[VALERI][N(G1)] = turnoDisp(["Maniago"]); // grad25, DET12ASAP: 60h (agosto) + extra
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]); // grad57, DET24: 104h
  const t = unicoTurno(d, { [VALERI]: 44 }, lista); // 60+44=104h = 104h di PRESSACCO: debito pari
  suite.eq(t.slots[0], VALERI, "a parità di debito, vince il grad migliore (VALERI, grad25 contro grad57)");
  resetMedici();
});

// ---------------------------------------------------------------------------
// DET12ASAP batte DET12; DET12 batte solo i senza incarico
// (PRESSACCO temporaneamente reso DET12, titolarità Spilimbergo invariata; contesa su Maniago,
// nessuno dei due titolare lì, per isolare il confronto di categoria)
// ---------------------------------------------------------------------------
suite.test("DET12ASAP batte sempre DET12, anche a parità di debito e con grad peggiore", () => {
  const lista = conPressaccoDet24().map((m) => (m.id === PRESSACCO ? { ...m, cat: "DET12" } : m));
  setMediciGlobal(lista);
  const d = dispoBase();
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]); // grad57, ora DET12
  d[VALERI][N(G1)] = turnoDisp(["Maniago"]); // grad25, DET12ASAP — vince comunque per categoria
  const t = unicoTurno(d, {}, lista);
  suite.eq(t.slots[0], VALERI, "DET12ASAP prevale sempre su DET12, indipendentemente da debito/grad");
  resetMedici();
});

suite.test("DET12 perde contro INDET, DET38, DET24 e DET12ASAP", () => {
  const casi = [
    { avversario: BERTUZZI, nome: "INDET" },
    { avversario: FOSCHIANI, nome: "DET38" },
    { avversario: MARTINETTI, nome: "DET24" },
  ];
  casi.forEach(({ avversario, nome }) => {
    const lista = conPressaccoDet24().map((m) => (m.id === PRESSACCO ? { ...m, cat: "DET12" } : m));
    setMediciGlobal(lista);
    const d = dispoBase();
    d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
    d[avversario][N(G1)] = turnoDisp(["Maniago"]);
    const t = unicoTurno(d, {}, lista);
    suite.eq(t.slots[0], avversario, `DET12 (PRESSACCO) deve perdere contro ${nome}`);
    resetMedici();
  });

  // Contro DET12ASAP
  const lista2 = conPressaccoDet24().map((m) => (m.id === PRESSACCO ? { ...m, cat: "DET12" } : m));
  setMediciGlobal(lista2);
  const d2 = dispoBase();
  d2[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]);
  d2[VALERI][N(G1)] = turnoDisp(["Maniago"]);
  const t2 = unicoTurno(d2, {}, lista2);
  suite.eq(t2.slots[0], VALERI, "DET12 (PRESSACCO) deve perdere anche contro DET12ASAP");
  resetMedici();
});

suite.test("DET12 batte i medici senza incarico, anche di graduatoria molto migliore", () => {
  const lista = conPressaccoDet24().map((m) => (m.id === PRESSACCO ? { ...m, cat: "DET12" } : m.id === ZURLO ? { ...m, cat: "SENZA", sedeContratto: null } : m));
  setMediciGlobal(lista);
  const d = dispoBase();
  d[PRESSACCO][N(G1)] = turnoDisp(["Maniago"]); // DET12, grad57
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]); // SENZA, grad2 — il migliore in assoluto
  const t = unicoTurno(d, {}, lista);
  suite.eq(t.slots[0], PRESSACCO, "DET12 batte SENZA incarico anche con grad nettamente peggiore: la categoria decide prima della graduatoria");
  resetMedici();
});

// ---------------------------------------------------------------------------
// TITOLARITÀ ANCHE PER DET12/DET12ASAP (MORANO, nativo DET12 titolare Maniago)
// ---------------------------------------------------------------------------
suite.test("un DET12 titolare di una sede vince anche contro un DET38 non titolare", () => {
  const d = dispoBase();
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]); // DET38, titolare Spilimbergo (non Maniago)
  d[MORANO][N(G1)] = turnoDisp(["Maniago"]); // DET12, titolare di Maniago
  const t = unicoTurno(d);
  suite.eq(t.slots[0], MORANO, "la titolarità di sede vince prima ancora del confronto di categoria, anche per un DET12");
});

suite.finish();
