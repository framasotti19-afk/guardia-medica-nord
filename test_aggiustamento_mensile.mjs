// Test sull'aggiustamento mensile del monte ore per DET38, DET24 e DET12/DET12ASAP (bilanciamento
// turni annui, §3.11): il monte ore BASE resta sempre quello di CAT_INFO, ma viene aggiustato di
// ±8h/±12h in mesi specifici PRIMA di calcolare il debito e il tetto automatico di distribuzione
// (Math.round(debito/12)) — nessuna modifica alla gerarchia, ai conflitti o all'assegnazione.
// DET38 (168h/14 turni base): -12h (→156h/13 turni) a Febbraio, Aprile, Settembre.
// DET24 (104h/9 turni base): -8h (→96h/8 turni) a Febbraio, Aprile, Settembre, Novembre.
// DET12 e DET12ASAP (52h/4 turni base): +8h (→60h/5 turni) a Marzo, Maggio, Agosto, Dicembre.
// Totali annui: DET38 = 9×14 + 3×13 = 165 turni/anno; DET24 = 8×9 + 4×8 = 104 turni/anno;
// DET12(ASAP) = 8×4 + 4×5 = 52 turni/anno.
// Solo INDET non è mai aggiustato (monte ore fisso ogni mese).
import { MEDICI_DEFAULT, setMediciGlobal, dk, elaboraSchema } from './engine_test.mjs';
import { makeSuite, dispoBase, turnoDisp, ANNO_TEST } from './test_utils.mjs';

const suite = makeSuite("test_aggiustamento_mensile — monte ore variabile per mese (DET38/DET24/DET12)");
const BERTUZZI = 14; // INDET, 96h/8 turni fissi
const IENGO = 13; // DET38 di default
const PRESSACCO = 8; // DET24 di default
const MERLINO = 12; // DET12ASAP di default, promosso a DET12 in alcuni test
const ZURLO = 5; // override "senza incarico", backup di riserva sempre disponibile (mai in gara per titolarità)

function resetMedici() { setMediciGlobal(MEDICI_DEFAULT); }
function listaConZurloSenza() {
  return MEDICI_DEFAULT.map((m) => (m.id === ZURLO ? { ...m, cat: "SENZA", sedeContratto: null } : m));
}

// Un solo medico su un'unica sede per TUTTO il mese, con ZURLO (SENZA incarico, per override — mai
// contrattualizzato, quindi mai in gara per titolarità) come unico concorrente di riserva: senza
// alcuna scarsità artificiale, il numero di notti vinte coincide esattamente col tetto implicito
// di distribuzione temporale (§3.11), leggibile direttamente dal risultato — stesso schema già
// usato in test_distribuzione_temporale.mjs.
function nottiVinte(mid, anno, mese) {
  const d = dispoBase(MEDICI_DEFAULT);
  const nGiorni = new Date(anno, mese + 1, 0).getDate();
  for (let g = 1; g <= nGiorni; g++) {
    const slot = `${dk(anno, mese, g)}|N`;
    d[mid][slot] = turnoDisp(["Maniago"]);
    d[ZURLO][slot] = turnoDisp(["Maniago"]);
  }
  const { schema } = elaboraSchema(d, {}, anno, mese, {});
  return schema.filter((g) => g.turni.find((t) => t.id === "N" && t.slots.includes(mid))).length;
}

suite.test("DET38 (IENGO): tetto di 13 turni a Febbraio (168h-12h=156h, mese aggiustato)", () => {
  setMediciGlobal(listaConZurloSenza());
  suite.eq(nottiVinte(IENGO, ANNO_TEST, 1), 13, "Febbraio (indice 1): monte ore aggiustato a 156h → tetto 13 turni");
  resetMedici();
});

suite.test("DET38 (IENGO): tetto di 14 turni a Gennaio (168h, mese NON aggiustato)", () => {
  setMediciGlobal(listaConZurloSenza());
  suite.eq(nottiVinte(IENGO, ANNO_TEST, 0), 14, "Gennaio (indice 0): monte ore invariato a 168h → tetto 14 turni");
  resetMedici();
});

suite.test("DET38 (IENGO): aggiustato anche ad Aprile e Settembre (13 turni)", () => {
  setMediciGlobal(listaConZurloSenza());
  [3, 8].forEach((mese) => {
    suite.eq(nottiVinte(IENGO, ANNO_TEST, mese), 13, `mese indice ${mese}: monte ore aggiustato a 156h → tetto 13 turni`);
  });
  resetMedici();
});

suite.test("DET38 (IENGO): NON aggiustato negli altri 9 mesi (14 turni)", () => {
  setMediciGlobal(listaConZurloSenza());
  [0, 2, 4, 5, 6, 7, 9, 10, 11].forEach((mese) => {
    suite.eq(nottiVinte(IENGO, ANNO_TEST, mese), 14, `mese indice ${mese}: monte ore invariato a 168h → tetto 14 turni`);
  });
  resetMedici();
});

suite.test("DET24 (PRESSACCO): tetto di 8 turni a Febbraio (104h-8h=96h, mese aggiustato)", () => {
  setMediciGlobal(listaConZurloSenza());
  suite.eq(nottiVinte(PRESSACCO, ANNO_TEST, 1), 8, "Febbraio (indice 1): monte ore aggiustato a 96h → tetto 8 turni");
  resetMedici();
});

suite.test("DET24 (PRESSACCO): tetto di 9 turni a Gennaio (104h, mese NON aggiustato)", () => {
  setMediciGlobal(listaConZurloSenza());
  suite.eq(nottiVinte(PRESSACCO, ANNO_TEST, 0), 9, "Gennaio (indice 0): monte ore invariato a 104h → tetto 9 turni");
  resetMedici();
});

suite.test("DET24 (PRESSACCO): aggiustato anche ad Aprile, Settembre, Novembre (8 turni)", () => {
  setMediciGlobal(listaConZurloSenza());
  [3, 8, 10].forEach((mese) => {
    suite.eq(nottiVinte(PRESSACCO, ANNO_TEST, mese), 8, `mese indice ${mese}: monte ore aggiustato a 96h → tetto 8 turni`);
  });
  resetMedici();
});

suite.test("DET24 (PRESSACCO): NON aggiustato negli altri 8 mesi (9 turni)", () => {
  setMediciGlobal(listaConZurloSenza());
  [0, 4, 5, 6, 7, 9, 11].forEach((mese) => {
    suite.eq(nottiVinte(PRESSACCO, ANNO_TEST, mese), 9, `mese indice ${mese}: monte ore invariato a 104h → tetto 9 turni`);
  });
  resetMedici();
});

suite.test("DET12 (MERLINO promosso): tetto di 5 turni a Marzo (52h+8h=60h, mese aggiustato)", () => {
  const lista = listaConZurloSenza().map((m) => (m.id === MERLINO ? { ...m, cat: "DET12" } : m));
  setMediciGlobal(lista);
  suite.eq(nottiVinte(MERLINO, ANNO_TEST, 2), 5, "Marzo (indice 2): monte ore aggiustato a 60h → tetto 5 turni");
  resetMedici();
});

suite.test("DET12 (MERLINO promosso): tetto di 4 turni ad Aprile (52h, mese NON aggiustato)", () => {
  const lista = listaConZurloSenza().map((m) => (m.id === MERLINO ? { ...m, cat: "DET12" } : m));
  setMediciGlobal(lista);
  suite.eq(nottiVinte(MERLINO, ANNO_TEST, 3), 4, "Aprile (indice 3): monte ore invariato a 52h → tetto 4 turni");
  resetMedici();
});

suite.test("DET12ASAP (MERLINO nativo): stesso aggiustamento di DET12 (5 turni ad Agosto, mese aggiustato)", () => {
  setMediciGlobal(listaConZurloSenza());
  suite.eq(nottiVinte(MERLINO, ANNO_TEST, 7), 5, "Agosto (indice 7): monte ore aggiustato a 60h → tetto 5 turni, come DET12");
  resetMedici();
});

suite.test("DET12/DET12ASAP: NON aggiustati negli altri 8 mesi (4 turni)", () => {
  setMediciGlobal(listaConZurloSenza());
  [0, 1, 3, 5, 6, 8, 9, 10].forEach((mese) => {
    suite.eq(nottiVinte(MERLINO, ANNO_TEST, mese), 4, `mese indice ${mese}: monte ore invariato a 52h → tetto 4 turni`);
  });
  resetMedici();
});

suite.test("INDET (BERTUZZI): nessun aggiustamento mensile, monte ore fisso in ogni mese", () => {
  setMediciGlobal(listaConZurloSenza());
  [0, 1, 2, 3, 4, 7, 8, 10, 11].forEach((mese) => {
    suite.eq(nottiVinte(BERTUZZI, ANNO_TEST, mese), 8, `INDET (BERTUZZI): 8 turni fissi anche nel mese indice ${mese}`);
  });
  resetMedici();
});

suite.test("totale annuo DET38: 9 mesi da 14 + 3 da 13 = 165 turni/anno", () => {
  setMediciGlobal(listaConZurloSenza());
  let totale = 0;
  for (let mese = 0; mese < 12; mese++) totale += nottiVinte(IENGO, ANNO_TEST, mese);
  suite.eq(totale, 165, "165 turni/anno per DET38, coerente con 9×14 + 3×13");
  resetMedici();
});

suite.test("totale annuo DET24: 8 mesi da 9 + 4 mesi da 8 = 104 turni/anno", () => {
  setMediciGlobal(listaConZurloSenza());
  let totale = 0;
  for (let mese = 0; mese < 12; mese++) totale += nottiVinte(PRESSACCO, ANNO_TEST, mese);
  suite.eq(totale, 104, "104 turni/anno per DET24, coerente con 8×9 + 4×8");
  resetMedici();
});

suite.test("totale annuo DET12: 8 mesi da 4 + 4 mesi da 5 = 52 turni/anno", () => {
  const lista = listaConZurloSenza().map((m) => (m.id === MERLINO ? { ...m, cat: "DET12" } : m));
  setMediciGlobal(lista);
  let totale = 0;
  for (let mese = 0; mese < 12; mese++) totale += nottiVinte(MERLINO, ANNO_TEST, mese);
  suite.eq(totale, 52, "52 turni/anno per DET12, coerente con 8×4 + 4×5");
  resetMedici();
});

suite.finish();
