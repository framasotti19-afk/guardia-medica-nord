// Test del pin del TURNO PREFERITO nella distribuzione §3.11 (§10 voce 61).
// Quando un medico vince sia il diurno (G) sia il notturno (N) dello STESSO giorno e ha dichiarato una
// preferenza di turno (TURNOPREF), il turno preferito diventa un PUNTO FISSO (pin in kept, come un
// obbligatorio): la distribuzione §3.11 gli costruisce attorno invece di cederlo, così nel PASSAGGIO 2
// il medico lavora davvero il turno che voleva. Si attiva SOLO quando vince entrambi i turni del giorno.
// Fix "A": si pinna solo il turno preferito (il non preferito resta candidato ordinario, tipicamente
// ceduto a un backup). Il test verifica l'ESITO nello schema finale, con una controprova senza preferenza.
import { MEDICI_DEFAULT, setMediciGlobal, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST } from './test_utils.mjs';

const s = makeSuite("test_pref_pin_distribuzione — §3.11 pinna il turno preferito (voce 61)");
const BERTUZZI = 9;   // INDET (priorità di categoria: vince su un senza incarico)
const PRESSACCO = 10; // SENZA incarico: raccoglie i turni ceduti da BERTUZZI
const D = 14;         // 14 agosto 2026 = prefestivo → ha SIA il diurno SIA il notturno
const G = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|G`;
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const TURNOPREF = (g) => "TURNOPREF:" + dk(ANNO_TEST, MESE_TEST, g);
setMediciGlobal(MEDICI_DEFAULT);

const elab = (dispo, max) => elaboraSchema(dispo, {}, ANNO_TEST, MESE_TEST, {}, {}, max);
const bertVince = (schema, g, turno) => schema.find((x) => x.giorno === g).turni.find((t) => t.id === turno).slots.includes(BERTUZZI);
const nTurniBert = (schema) => { let n = 0; schema.forEach((g) => g.turni.forEach((t) => { if (t.fis.some((si) => t.slots[si] === BERTUZZI)) n++; })); return n; };

// Scenario condiviso: BERTUZZI vince 7 notti feriali + il diurno e il notturno del 14; tetto 3 → §3.11
// deve ridurre (pool 9 slot > 3). L'equidistante posizionale, senza preferenza, tiene ~3N/12N/19N e
// CEDE il 14. PRESSACCO è disponibile ovunque e raccoglie i ceduti (se BERTUZZI cedesse 14G va a lui).
function scenario(conPreferenza) {
  const d = dispoBase(MEDICI_DEFAULT);
  [3, 5, 7, 10, 12, 17, 19].forEach((g) => { d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]); d[PRESSACCO][N(g)] = turnoDisp(["Maniago"]); });
  d[BERTUZZI][G(D)] = turnoDisp(["Maniago"]); d[BERTUZZI][N(D)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][G(D)] = turnoDisp(["Maniago"]); d[PRESSACCO][N(D)] = turnoDisp(["Maniago"]);
  if (conPreferenza) d[BERTUZZI][TURNOPREF(D)] = "G";
  return d;
}

s.test("controprova SENZA preferenza: §3.11 (equidistante) CEDE il diurno del 14", () => {
  const { schema } = elab(scenario(false), { [BERTUZZI]: 3 });
  s.assert(!bertVince(schema, D, "G"), "senza preferenza BERTUZZI NON mantiene il 14 diurno (ceduto dalla distribuzione)");
});

s.test("CON preferenza ☀️: il diurno del 14 è pinnato → BERTUZZI lo mantiene, tetto rispettato", () => {
  const { schema } = elab(scenario(true), { [BERTUZZI]: 3 });
  s.assert(bertVince(schema, D, "G"), "con preferenza il DIURNO del 14 è tenuto (pin §3.11) — non ceduto");
  s.eq(nTurniBert(schema), 3, "il tetto mensile (3) resta rispettato (nessun turno in più)");
});

s.test("nessun effetto se vince UN SOLO turno del giorno (pin non scatta)", () => {
  // BERTUZZI dichiara/vince solo il NOTTURNO del 14 (niente diurno) ma ha preferenza "G": non avendo
  // vinto entrambi i turni, il pin non deve scattare — comportamento identico a nessuna preferenza.
  const d = dispoBase(MEDICI_DEFAULT);
  [3, 5, 7, 10, 12].forEach((g) => d[BERTUZZI][N(g)] = turnoDisp(["Maniago"]));
  d[BERTUZZI][N(D)] = turnoDisp(["Maniago"]);
  d[BERTUZZI][TURNOPREF(D)] = "G";
  const a = elab(d, { [BERTUZZI]: 3 }).schema;
  delete d[BERTUZZI][TURNOPREF(D)];
  const b = elab(d, { [BERTUZZI]: 3 }).schema;
  s.eq(JSON.stringify(a.map((g) => g.turni.map((t) => t.slots))), JSON.stringify(b.map((g) => g.turni.map((t) => t.slots))), "vincendo un solo turno, la preferenza non cambia lo schema");
});

s.test("deterministico: stesso input → stesso schema", () => {
  const A = JSON.stringify(elab(scenario(true), { [BERTUZZI]: 3 }).schema.map((g) => g.turni.map((t) => t.slots)));
  const B = JSON.stringify(elab(scenario(true), { [BERTUZZI]: 3 }).schema.map((g) => g.turni.map((t) => t.slots)));
  s.eq(A, B, "output deterministico");
});

s.finish();
