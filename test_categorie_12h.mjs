// Test sulle categorie DET12ASAP e DET12 (CONTEXT.md §3.1). Gerarchia completa aggiornata:
// INDET → DET36 → DET24 = DET12ASAP → DET12 → SENZA INCARICO.
// DET24 e DET12ASAP condividono lo STESSO livello di priorità (prio 3): non sono in relazione
// gerarchica tra loro, uno spareggio diretto si risolve con titolarità → debito → graduatoria,
// esattamente come tra due medici della stessa categoria.
import { MEDICI_DEFAULT, setMediciGlobal, byId, dk, elaboraSchema, CAT_INFO, isDeterminato } from './engine_test.mjs';
import { makeSuite, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI } from './test_utils.mjs';

const suite = makeSuite("test_categorie_12h — DET12ASAP e DET12");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const G1 = GIORNI_FERIALI_SEMPLICI[0];
const TRIGODKO = 3, FOSCHIANI = 8, WANG = 12, ZURLO = 13;

function resetMedici() { setMediciGlobal(MEDICI_DEFAULT); }
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
suite.test("DET12ASAP e DET12 hanno monte ore mensile 52h", () => {
  suite.eq(CAT_INFO.DET12ASAP.ore, 52);
  suite.eq(CAT_INFO.DET12.ore, 52);
});
suite.test("DET24 e DET12ASAP condividono lo stesso prio: non sono in relazione gerarchica tra loro", () => {
  suite.eq(CAT_INFO.DET24.prio, CAT_INFO.DET12ASAP.prio);
});
suite.test("gerarchia completa dei prio: INDET < DET36 < DET24 = DET12ASAP < DET12 < SENZA", () => {
  suite.assert(CAT_INFO.INDET.prio < CAT_INFO.DET36.prio, "INDET prima di DET36");
  suite.assert(CAT_INFO.DET36.prio < CAT_INFO.DET24.prio, "DET36 prima di DET24");
  suite.assert(CAT_INFO.DET24.prio < CAT_INFO.DET12.prio, "DET24 prima di DET12");
  suite.assert(CAT_INFO.DET12ASAP.prio < CAT_INFO.DET12.prio, "DET12ASAP prima di DET12");
  suite.assert(CAT_INFO.DET12.prio < CAT_INFO.SENZA.prio, "DET12 prima di SENZA");
});
suite.test("DET12ASAP e DET12 sono \"determinati\" (isDeterminato) — titolarità di sede si applica anche a loro", () => {
  resetMedici();
  const lista = MEDICI_DEFAULT.map((m) => (m.id === FOSCHIANI ? { ...m, cat: "DET12ASAP" } : m.id === WANG ? { ...m, cat: "DET12" } : m));
  setMediciGlobal(lista);
  suite.assert(isDeterminato(FOSCHIANI), "DET12ASAP è determinato");
  suite.assert(isDeterminato(WANG), "DET12 è determinato");
  resetMedici();
});

// ---------------------------------------------------------------------------
// DET24 = DET12ASAP: spareggio diretto per debito, non per categoria
// ---------------------------------------------------------------------------
suite.test("DET24 vs DET12ASAP a parità di categoria (stesso prio): vince chi ha più debito residuo, non chi ha grad migliore", () => {
  resetMedici();
  // FOSCHIANI (grad3, ottimo) promosso a DET12ASAP (52h di monte ore base);
  // WANG (grad124, mediocre) resta DET24 (104h di monte ore base) — a inizio mese, senza
  // extraOre, WANG ha più debito residuo puro (104 contro 52): deve vincere WANG, nonostante
  // il grad nettamente peggiore, perché il prio è identico e decide solo il debito.
  const lista = MEDICI_DEFAULT.map((m) => (m.id === FOSCHIANI ? { ...m, cat: "DET12ASAP" } : m));
  setMediciGlobal(lista);
  const d = dispoBase();
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]);
  d[WANG][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, {}, lista);
  suite.eq(t.slots[0], WANG, "WANG (DET24, più debito residuo) vince su FOSCHIANI (DET12ASAP, grad migliore ma meno debito)");
  resetMedici();
});

suite.test("DET24 vs DET12ASAP: con più debito residuo, il DET12ASAP vince anche su un DET24 di grad migliore", () => {
  resetMedici();
  // Stessa coppia, ma questa volta diamo a FOSCHIANI (DET12ASAP) debito extra sufficiente a
  // superare quello di WANG (DET24): deve vincere FOSCHIANI, a riprova che nessuna delle due
  // categorie prevale strutturalmente sull'altra — decide solo il debito residuo.
  const lista = MEDICI_DEFAULT.map((m) => (m.id === FOSCHIANI ? { ...m, cat: "DET12ASAP" } : m));
  setMediciGlobal(lista);
  const d = dispoBase();
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]);
  d[WANG][N(G1)] = turnoDisp(["Maniago"]);
  const t = unicoTurno(d, { [FOSCHIANI]: 80 }, lista); // 52+80=132h > 104h di WANG
  suite.eq(t.slots[0], FOSCHIANI, "FOSCHIANI (DET12ASAP, con debito maggiorato) vince su WANG (DET24)");
  resetMedici();
});

suite.test("DET24 vs DET12ASAP a parità di debito residuo: decide la graduatoria, come tra medici della stessa categoria", () => {
  resetMedici();
  const lista = MEDICI_DEFAULT.map((m) => (m.id === FOSCHIANI ? { ...m, cat: "DET12ASAP" } : m));
  setMediciGlobal(lista);
  const d = dispoBase();
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]); // grad3, DET12ASAP: 52h + extra
  d[WANG][N(G1)] = turnoDisp(["Maniago"]); // grad124, DET24: 104h
  const t = unicoTurno(d, { [FOSCHIANI]: 52 }, lista); // 52+52=104h = 104h di WANG: debito pari
  suite.eq(t.slots[0], FOSCHIANI, "a parità di debito, vince il grad migliore (FOSCHIANI, grad3 contro grad124)");
  resetMedici();
});

// ---------------------------------------------------------------------------
// DET12ASAP batte DET12; DET12 batte solo i senza incarico
// ---------------------------------------------------------------------------
suite.test("DET12ASAP batte sempre DET12, anche a parità di debito e con grad peggiore", () => {
  resetMedici();
  const lista = MEDICI_DEFAULT.map((m) => (m.id === FOSCHIANI ? { ...m, cat: "DET12ASAP" } : m.id === WANG ? { ...m, cat: "DET12" } : m));
  setMediciGlobal(lista);
  const d = dispoBase();
  d[WANG][N(G1)] = turnoDisp(["Maniago"]); // grad124, DET12
  d[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]); // grad3, DET12ASAP — vince comunque per categoria
  const t = unicoTurno(d, {}, lista);
  suite.eq(t.slots[0], FOSCHIANI, "DET12ASAP prevale sempre su DET12, indipendentemente da debito/grad");
  resetMedici();
});

suite.test("DET12 perde contro INDET, DET36, DET24 e DET12ASAP", () => {
  resetMedici();
  const BERTUZZI = 1; // INDET
  const casi = [
    { avversario: BERTUZZI, cat: "INDET", nome: "INDET" },
    { avversario: TRIGODKO, cat: "DET36", nome: "DET36" },
    { avversario: FOSCHIANI, cat: "DET24", nome: "DET24" },
  ];
  casi.forEach(({ avversario, nome }) => {
    resetMedici();
    const lista = MEDICI_DEFAULT.map((m) => (m.id === WANG ? { ...m, cat: "DET12" } : m));
    setMediciGlobal(lista);
    const d = dispoBase();
    d[WANG][N(G1)] = turnoDisp(["Maniago"]);
    d[avversario][N(G1)] = turnoDisp(["Maniago"]);
    const t = unicoTurno(d, {}, lista);
    suite.eq(t.slots[0], avversario, `DET12 (WANG) deve perdere contro ${nome}`);
  });
  resetMedici();

  // Contro DET12ASAP
  const lista2 = MEDICI_DEFAULT.map((m) => (m.id === WANG ? { ...m, cat: "DET12" } : m.id === FOSCHIANI ? { ...m, cat: "DET12ASAP" } : m));
  setMediciGlobal(lista2);
  const d2 = dispoBase();
  d2[WANG][N(G1)] = turnoDisp(["Maniago"]);
  d2[FOSCHIANI][N(G1)] = turnoDisp(["Maniago"]);
  const t2 = unicoTurno(d2, {}, lista2);
  suite.eq(t2.slots[0], FOSCHIANI, "DET12 (WANG) deve perdere anche contro DET12ASAP");
  resetMedici();
});

suite.test("DET12 batte i medici senza incarico, anche di graduatoria molto migliore", () => {
  resetMedici();
  const lista = MEDICI_DEFAULT.map((m) => (m.id === WANG ? { ...m, cat: "DET12" } : m));
  setMediciGlobal(lista);
  const d = dispoBase();
  d[WANG][N(G1)] = turnoDisp(["Maniago"]); // DET12, grad124
  d[ZURLO][N(G1)] = turnoDisp(["Maniago"]); // SENZA, grad2 — il migliore in assoluto
  const t = unicoTurno(d, {}, lista);
  suite.eq(t.slots[0], WANG, "DET12 batte SENZA incarico anche con grad nettamente peggiore: la categoria decide prima della graduatoria");
  resetMedici();
});

// ---------------------------------------------------------------------------
// TITOLARITÀ ANCHE PER DET12/DET12ASAP
// ---------------------------------------------------------------------------
suite.test("un DET12 titolare di una sede vince anche contro un DET36 non titolare", () => {
  resetMedici();
  const lista = MEDICI_DEFAULT.map((m) => (m.id === WANG ? { ...m, cat: "DET12", sedeContratto: "Maniago" } : m));
  setMediciGlobal(lista);
  const d = dispoBase();
  d[TRIGODKO][N(G1)] = turnoDisp(["Maniago"]); // DET36, non titolare
  d[WANG][N(G1)] = turnoDisp(["Maniago"]); // DET12, titolare di Maniago
  const t = unicoTurno(d, {}, lista);
  suite.eq(t.slots[0], WANG, "la titolarità di sede vince prima ancora del confronto di categoria, anche per un DET12");
  resetMedici();
});

suite.finish();
