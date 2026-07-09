// PASSO 2 — distribuzione sopra-tetto con riferimento alla settimana a cavallo (§10 voce 46).
// Verifica il caso costruito: un medico che SUPERA il tetto e ha un turno di luglio → i turni TENUTI ad
// agosto si allontanano da luglio, MA (a) il numero di turni tenuti resta = tetto e (b) chi-vince non
// cambia. + il path di default (nessun dato luglio) resta identico. Il motore cambia (2 righe), quindi
// questo test è la verifica puntuale; la sim 100k è la verifica ampia del path di default.
import { setMediciGlobal, elaboraSchema, dk } from "./engine_test.mjs";
import { makeSuite, turnoDisp, ANNO_TEST, MESE_TEST, GIORNI_FERIALI_SEMPLICI } from "./test_utils.mjs";

const s = makeSuite("Settimana a cavallo — distribuzione sopra-tetto (PASSO 2)");
const J = (x) => JSON.stringify(x);
const A = ANNO_TEST, M = MESE_TEST; // agosto 2026
const N = (g) => `${dk(A, M, g)}|N`;

// Un solo medico senza incarico con Max turni mese = 4: disponibile su TUTTI i feriali (20 notti) → vince
// tutto (unico candidato) e supera il tetto → scatta la distribuzione, che sceglie i 4 da tenere.
const MED = [{ id: 1, nome: "X", grad: 1, cat: "SENZA", sedeContratto: null }];
function dispoTuttiFeriali() {
  const d = { 1: {} };
  GIORNI_FERIALI_SEMPLICI.forEach((g) => { d[1][N(g)] = turnoDisp(["Maniago"], [], { verdeLiv: { Maniago: 1 } }); });
  return d;
}
// Giorni feriali in cui X risulta assegnato a Maniago (indice 0) nel turno N.
function giorniTenuti(schema) {
  const out = [];
  GIORNI_FERIALI_SEMPLICI.forEach((g) => {
    const t = schema.find((x) => x.giorno === g)?.turni.find((tt) => tt.id === "N");
    if (t && t.slots[0] === 1) out.push(g);
  });
  return out;
}

s.test("default (nessun dato luglio): tiene esattamente il tetto, equidistante su agosto (include il 3 ago)", () => {
  setMediciGlobal(MED);
  const { schema } = elaboraSchema(dispoTuttiFeriali(), {}, A, M, {}, {}, { 1: 4 }); // niente 8° argomento
  const tenuti = giorniTenuti(schema);
  s.eq(tenuti.length, 4, "deve tenere esattamente 4 turni (il tetto)");
  s.assert(tenuti.includes(3), "senza dato luglio il primo feriale (3 ago) è tra i tenuti (equidistante)");
});
s.test("con dato luglio (31 lug = offset 0): i turni tenuti si ALLONTANANO da luglio, STESSO numero (tetto invariato)", () => {
  setMediciGlobal(MED);
  const rif = { 1: [0] }; // 31 luglio, adiacente all'1 agosto
  const { schema } = elaboraSchema(dispoTuttiFeriali(), {}, A, M, {}, {}, { 1: 4 }, rif);
  const tenuti = giorniTenuti(schema);
  s.eq(tenuti.length, 4, "(a) il numero di turni tenuti resta 4 = tetto");
  s.assert(!tenuti.includes(3), "col riferimento di luglio il 3 ago (vicino a luglio) NON è più tra i tenuti");
  s.assert(Math.min(...tenuti) > 3, "il primo turno tenuto si è spostato più avanti nel mese (lontano da luglio)");
});
s.test("path di default: riferimentiCavallo={} è IDENTICO a non passarlo affatto", () => {
  setMediciGlobal(MED);
  const a = elaboraSchema(dispoTuttiFeriali(), {}, A, M, {}, {}, { 1: 4 });
  const b = elaboraSchema(dispoTuttiFeriali(), {}, A, M, {}, {}, { 1: 4 }, {});
  s.eq(J(giorniTenuti(a.schema)), J(giorniTenuti(b.schema)), "passare {} deve dare lo stesso risultato di non passarlo");
});
s.test("(b) chi-vince invariato: ogni turno TENUTO resta assegnato a X (il seed non cambia chi vince, solo cosa si tiene)", () => {
  setMediciGlobal(MED);
  const { schema } = elaboraSchema(dispoTuttiFeriali(), {}, A, M, {}, {}, { 1: 4 }, { 1: [0] });
  const tenuti = giorniTenuti(schema);
  s.assert(tenuti.length === 4 && tenuti.every((g) => schema.find((x) => x.giorno === g).turni.find((t) => t.id === "N").slots[0] === 1), "un turno tenuto non risulta di X");
});
s.test("nessun effetto sotto-tetto: se X non supera il tetto (tetto 25 > 20 feriali) il riferimento non cambia nulla", () => {
  setMediciGlobal(MED);
  const senza = giorniTenuti(elaboraSchema(dispoTuttiFeriali(), {}, A, M, {}, {}, { 1: 25 }).schema);
  const con = giorniTenuti(elaboraSchema(dispoTuttiFeriali(), {}, A, M, {}, {}, { 1: 25 }, { 1: [0] }).schema);
  s.eq(J(senza), J(con), "sotto il tetto la distribuzione non gira → il riferimento di luglio è ininfluente");
  s.eq(con.length, 20, "tiene tutti i 20 feriali (nessuna cessione)");
});

s.finish();
