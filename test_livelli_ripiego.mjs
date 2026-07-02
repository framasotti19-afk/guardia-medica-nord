// Test sui livelli di ripiego 1-5 (CONTEXT.md §3.3): ordine di prova, retrocompatibilità,
// e la regola secondo cui il ripiego può competere "a piena forza" contro chi ha quella
// sede come preferenza piena, se il richiedente ha priorità superiore.
import { MEDICI, dk, elaboraSchema, ripiegoPerLivello } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI } from './test_utils.mjs';

const suite = makeSuite("test_livelli_ripiego — livelli di ripiego 1-5");
const N = (g) => `${dk(ANNO_TEST, MESE_TEST, g)}|N`;
const G1 = GIORNI_FERIALI_SEMPLICI[0];
const BERTUZZI = 1, WANG = 12;

function unicoTurno(dispo, extraOre = {}) {
  const { schema } = elaboraSchema(dispo, extraOre, ANNO_TEST, MESE_TEST, {});
  return schema.find((g) => g.giorno === G1).turni.find((t) => t.id === "N");
}

suite.test("ripiegoPerLivello ordina le sedi per livello crescente", () => {
  const out = ripiegoPerLivello(["Meduno", "Spilimbergo", "Claut"], { Meduno: 2, Spilimbergo: 1, Claut: 2 });
  suite.eq(out.join(","), "Spilimbergo,Meduno,Claut", "livello 1 prima, poi livello 2 nell'ordine di inserimento originale");
});

suite.test("livello mancante (non dichiarato) vale di default 1", () => {
  const out = ripiegoPerLivello(["Meduno"], {});
  suite.eq(out.join(","), "Meduno");
});

suite.test("più sedi allo stesso livello mantengono l'ordine di inserimento nell'array", () => {
  const out = ripiegoPerLivello(["Claut", "Anduins", "Meduno"], { Claut: 1, Anduins: 1, Meduno: 1 });
  suite.eq(out.join(","), "Claut,Anduins,Meduno");
});

suite.test("il motore prova i ripieghi nell'ordine di livello per completare lo scenario (livello 1 prima di 2)", () => {
  // BERTUZZI unico fisico su Maniago; WANG dichiara Spilimbergo come ripiego liv.2 e Meduno come ripiego liv.1:
  // a parità di target raggiungibile, deve tentare prima Meduno (liv.1). Ma Meduno non è in target per n=2 →
  // salta a Spilimbergo (liv.2), unica sede del target che può effettivamente coprire.
  const d = dispoBase(MEDICI);
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  d[WANG][N(G1)] = turnoDisp([], ["Meduno", "Spilimbergo"], { ripiegoLiv: { Meduno: 1, Spilimbergo: 2 } });
  const t = unicoTurno(d);
  suite.eq(t.slots[1], WANG, "WANG deve comunque ottenere Spilimbergo, l'unica sede del target che ha dichiarato");
});

suite.test("tra due ripieghi validi nel target, viene scelto quello di livello migliore (numero più basso)", () => {
  const d = dispoBase(MEDICI);
  const PRESSACCO = 4;
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Meduno"]); // fisico su Meduno → n=3, target MA+SP+ME
  d[WANG][N(G1)] = turnoDisp([], ["Meduno", "Spilimbergo"], { ripiegoLiv: { Meduno: 1, Spilimbergo: 2 } });
  const t = unicoTurno(d);
  // Meduno è già occupato da PRESSACCO (priorità superiore su WANG, DET36 vs DET24): WANG deve quindi
  // ottenere Spilimbergo (suo ripiego di livello 2, unica alternativa rimasta nel target).
  suite.eq(t.slots[1], WANG);
});

suite.test("un ripiego di livello migliore viene preferito a un altro ripiego di livello peggiore quando entrambi liberi", () => {
  const d = dispoBase(MEDICI);
  const TRIGODKO = 3, PRESSACCO = 4;
  d[BERTUZZI][N(G1)] = turnoDisp(["Maniago"]);
  d[TRIGODKO][N(G1)] = turnoDisp(["Spilimbergo"]);
  d[PRESSACCO][N(G1)] = turnoDisp(["Meduno"]); // n=3 → target MA+SP+ME, tutti già occupati
  d[WANG][N(G1)] = turnoDisp([], ["Claut", "Meduno"], { ripiegoLiv: { Claut: 2, Meduno: 1 } }); // ma qui n=4 col nuovo candidato
  const t = unicoTurno(d);
  // con 4 candidati totali, target=[0,1,2,3] (MA+SP+ME+CL): Meduno (liv.1, ma occupato da PRESSACCO
  // che ha priorità superiore) non è ottenibile; Claut (liv.2) è libera → WANG la ottiene.
  suite.eq(t.slots[3], WANG, "WANG deve ottenere Claut, il suo ripiego disponibile di livello più permissivo rimasto");
});

suite.test("il ripiego compete a piena forza contro chi ha quella sede come piena, se il richiedente ha priorità superiore", () => {
  const d = dispoBase(MEDICI);
  d[WANG][N(G1)] = turnoDisp(["Spilimbergo"]); // DET24, unica scelta (piena)
  d[BERTUZZI][N(G1)] = turnoDisp(["Meduno"], ["Spilimbergo"], { ripiegoLiv: { Spilimbergo: 1 } }); // IND36, Spilimbergo come ripiego
  const t = unicoTurno(d);
  suite.eq(t.slots[1], BERTUZZI, "il ripiego di BERTUZZI (priorità superiore) deve prevalere sulla piena di WANG");
});

suite.test("il ripiego NON compete a piena forza se il richiedente non ha priorità superiore", () => {
  const d = dispoBase(MEDICI);
  const MICHELI = 17;
  d[WANG][N(G1)] = turnoDisp(["Spilimbergo"]); // DET24, priorità superiore a un senza incarico
  d[MICHELI][N(G1)] = turnoDisp(["Meduno"], ["Spilimbergo"], { ripiegoLiv: { Spilimbergo: 1 } }); // SENZA
  const t = unicoTurno(d);
  suite.eq(t.slots[1], WANG, "WANG deve mantenere la sua piena: MICHELI non ha priorità sufficiente nemmeno arrivandoci in ripiego");
});

suite.test("i livelli di ripiego non influenzano MAI chi vince un conflitto, solo quale sede riceve", () => {
  // WANG (grad124) e FOSCHIANI (grad3), stessa categoria DET24, stesso debito: a parità decide sempre il grad,
  // indipendentemente da quale livello di ripiego ciascuno abbia dichiarato per la sede contesa.
  const FOSCHIANI = 8;
  const d = dispoBase(MEDICI);
  d[FOSCHIANI][N(G1)] = turnoDisp([], ["Maniago"], { ripiegoLiv: { Maniago: 5 } }); // livello peggiore possibile
  d[WANG][N(G1)] = turnoDisp([], ["Maniago"], { ripiegoLiv: { Maniago: 1 } }); // livello migliore possibile
  const t = unicoTurno(d);
  suite.eq(t.slots[0], FOSCHIANI, "FOSCHIANI vince per grad migliore nonostante il livello di ripiego peggiore");
});

suite.finish();
