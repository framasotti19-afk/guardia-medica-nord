// Test dell'azione "turno_precedente" (fase 3 AI): il coordinatore in chat dichiara un turno GIÀ SVOLTO
// a fine luglio (settimana a cavallo) → l'app lo registra in turniPrecedenti e ricalcola il tetto EFFETTIVO
// del cavallo (V-A), esattamente come il checkbox N/G del pannellino 📅. L'AI fa solo il linguaggio; il
// MOTORE fa da RETE DI SICUREZZA: avvisa (e NON registra) se il giorno è impossibile o il turno non esiste.
//
// Come i fratelli test_tetto_settimana_ui / test_stato_azzera, qui si RISPECCHIA la logica dell'handler di
// applicaAzioni (glue di componente) appoggiandosi però alle funzioni di CALENDARIO REALI del motore
// (settimanaDi / turniDelGiorno / capSettimanale): il cuore deterministico — cavallo, esistenza del turno,
// effettivo ridotto — è quello vero. NON tocca elaboraSchema.
import { settimanaDi, turniDelGiorno, capSettimanale, dk, MESI_IT } from "./engine_test.mjs";
import { makeSuite } from "./test_utils.mjs";

const s = makeSuite("Azione turno_precedente — registrazione/cancellazione turni di luglio (settimana a cavallo)");
const J = (x) => JSON.stringify(x);

// --- repliche 1:1 delle funzioni di componente coinvolte (usano turniDelGiorno reale) ---
const cavalloDi = (anno, mese) => { const day1 = dk(anno, mese, 1); const lun = settimanaDi(day1); return lun < day1 ? lun : null; };
const giorniLuglioCavallo = (anno, mese) => {
  const lun = cavalloDi(anno, mese); if (!lun) return [];
  const day1 = dk(anno, mese, 1); const out = [];
  for (let d = new Date(lun + "T00:00:00"); dk(d.getFullYear(), d.getMonth(), d.getDate()) < day1; d.setDate(d.getDate() + 1)) {
    const info = turniDelGiorno(d.getFullYear(), d.getMonth(), d.getDate(), {});
    out.push({ dataStr: dk(d.getFullYear(), d.getMonth(), d.getDate()), giorno: d.getDate(), meseBreve: MESI_IT[d.getMonth()].slice(0, 3).toLowerCase(), haG: info.turni.some((t) => t.id === "G") });
  }
  return out;
};
const countLuglio = (perMid) => Object.values(perMid || {}).reduce((acc, d) => acc + (d.N ? 1 : 0) + (d.G ? 1 : 0), 0);

// Replica FEDELE dell'handler `if (a.az === "turno_precedente")` di applicaAzioni: prende lo stato locale
// {dispo, turniPrecedenti} e restituisce lo stato aggiornato + eventuali errori/domande. Immutabile.
function applica(a, anno, mese, stato) {
  const errori = [], domande = [];
  let dispo = { ...stato.dispo }, turniPrecedenti = { ...stato.turniPrecedenti };
  const mid = a.medico; // nel test il medico è già l'id
  const lun = cavalloDi(anno, mese);
  if (!lun) { errori.push(`${MESI_IT[mese]} ${anno} inizia di lunedì, non ha una settimana a cavallo`); return { errori, domande, dispo, turniPrecedenti }; }
  const giorniCav = giorniLuglioCavallo(anno, mese);
  const gRec = giorniCav.find((x) => x.giorno === Number(a.giorno));
  if (!gRec) { errori.push(`${a.giorno} non è nella settimana a cavallo`); return { errori, domande, dispo, turniPrecedenti }; }
  const dataStr = gRec.dataStr;
  const rimuovi = a.presente === false;
  let turno = (a.turno === "N" || a.turno === "G") ? a.turno : null;
  if (turno === "G" && !gRec.haG) { errori.push(`il ${gRec.giorno} ${gRec.meseBreve} è un feriale, non esiste il diurno`); return { errori, domande, dispo, turniPrecedenti }; }
  if (!turno && !rimuovi) {
    if (gRec.haG) {
      domande.push({ domanda: "il turno che ha fatto era il diurno?", seSi: [{ az: "turno_precedente", medico: a.medico, giorno: a.giorno, turno: "G" }], seNo: [{ az: "turno_precedente", medico: a.medico, giorno: a.giorno, turno: "N" }] });
      return { errori, domande, dispo, turniPrecedenti };
    }
    turno = "N";
  }
  const perMid = { ...(turniPrecedenti[mid] || {}) };
  if (rimuovi) {
    if (turno) { const day = { ...(perMid[dataStr] || {}) }; delete day[turno]; if (!day.N && !day.G) delete perMid[dataStr]; else perMid[dataStr] = day; }
    else delete perMid[dataStr];
  } else {
    perMid[dataStr] = { ...(perMid[dataStr] || {}), [turno]: true };
  }
  turniPrecedenti = { ...turniPrecedenti, [mid]: perMid };
  const raw = dispo[mid]?.["SETT:" + lun];
  const dich = raw ? (raw.dichiarato != null ? raw.dichiarato : raw.maxTurni) : null;
  if (typeof dich === "number" && dich >= 0) {
    const nd = { ...(dispo[mid] || {}) };
    nd["SETT:" + lun] = { maxTurni: Math.max(0, dich - countLuglio(perMid)), dichiarato: dich };
    dispo = { ...dispo, [mid]: nd };
  }
  return { errori, domande, dispo, turniPrecedenti };
}

const A = 2026, M = 7; // agosto 2026 (cavallo = 27–31 lug, tutti feriali → solo N)
const LUN = cavalloDi(A, M); // "2026-07-27"
// Stato di partenza: medico 1 con tetto cavallo dichiarato 2 + una notte di agosto e un altro medico intatto.
const statoBase = () => ({
  dispo: {
    1: { ["SETT:" + LUN]: { maxTurni: 2, dichiarato: 2 }, [`${dk(A, M, 5)}|N`]: { verde: ["Maniago"], verdeLiv: { Maniago: 1 }, blu: [], bluLiv: {}, no: false, preferito: null } },
    2: { ["SETT:" + LUN]: { maxTurni: 1, dichiarato: 1 } },
  },
  turniPrecedenti: { 2: { [dk(A, 6, 30)]: { N: true } } }, // medico 2 ha già un turno il 30 lug (deve restare)
});

s.test("registrazione valida (30 lug N): scrive turniPrecedenti e RIDUCE il tetto effettivo del cavallo", () => {
  const r = applica({ az: "turno_precedente", medico: 1, giorno: 30, turno: "N" }, A, M, statoBase());
  s.eq(r.errori.length, 0, "non deve dare errori");
  s.eq(r.turniPrecedenti[1][dk(A, 6, 30)].N, true, "il turno del 30 lug (N) non è stato scritto");
  s.eq(r.dispo[1]["SETT:" + LUN].maxTurni, 1, "il motore deve vedere effettivo 1 (2 − 1 luglio)");
  s.eq(r.dispo[1]["SETT:" + LUN].dichiarato, 2, "il dichiarato 2 deve essere preservato");
  s.eq(capSettimanale(r.dispo, 1, LUN), 1, "capSettimanale del motore deve leggere l'effettivo ridotto");
});
s.test("(#2) NON perde gli altri campi: slot di agosto, altro medico e i suoi turni di luglio intatti", () => {
  const base = statoBase();
  const r = applica({ az: "turno_precedente", medico: 1, giorno: 30, turno: "N" }, A, M, base);
  s.eq(J(r.dispo[1][`${dk(A, M, 5)}|N`]), J(base.dispo[1][`${dk(A, M, 5)}|N`]), "lo slot di agosto del medico 1 è cambiato");
  s.eq(J(r.dispo[2]), J(base.dispo[2]), "il medico 2 (dispo) è stato toccato");
  s.eq(J(r.turniPrecedenti[2]), J(base.turniPrecedenti[2]), "i turni di luglio del medico 2 sono stati toccati");
});
s.test("cancellazione via chat (presente:false): rimuove il turno e RIPRISTINA il tetto effettivo", () => {
  let st = statoBase();
  st = applica({ az: "turno_precedente", medico: 1, giorno: 30, turno: "N" }, A, M, st); // prima registra
  s.eq(st.dispo[1]["SETT:" + LUN].maxTurni, 1, "pre-condizione: effettivo 1 dopo la registrazione");
  const r = applica({ az: "turno_precedente", medico: 1, giorno: 30, turno: "N", presente: false }, A, M, st); // poi toglie
  s.eq(r.turniPrecedenti[1][dk(A, 6, 30)], undefined, "il turno del 30 lug deve sparire");
  s.eq(r.dispo[1]["SETT:" + LUN].maxTurni, 2, "il tetto effettivo deve tornare 2 (nessun turno di luglio)");
  s.eq(r.dispo[1]["SETT:" + LUN].dichiarato, 2, "il dichiarato resta 2");
});
s.test("cancellazione 'toglilo' senza turno: azzera l'INTERO giorno (sia N sia G)", () => {
  let st = statoBase();
  // registra due turni sullo stesso giorno immaginario con entrambi (uso il 30 lug: feriale, solo N; per
  // simulare N+G scrivo direttamente lo stato con entrambi e poi tolgo senza turno)
  st.turniPrecedenti[1] = { [dk(A, 6, 30)]: { N: true, G: true } };
  const r = applica({ az: "turno_precedente", medico: 1, giorno: 30, presente: false }, A, M, st);
  s.eq(r.turniPrecedenti[1][dk(A, 6, 30)], undefined, "senza turno la rimozione deve azzerare tutto il giorno");
});
s.test("(cavolata 1) 'diurno' su un feriale (29 lug): NON registra e avvisa", () => {
  const r = applica({ az: "turno_precedente", medico: 1, giorno: 29, turno: "G" }, A, M, statoBase());
  s.assert(r.errori.length > 0 && /diurno/.test(r.errori[0]), "atteso un avviso sul diurno inesistente");
  s.eq(r.turniPrecedenti[1], undefined, "non deve aver scritto nulla per il medico 1");
});
s.test("(cavolata 2) data fuori dalla settimana a cavallo (15 lug): NON registra e avvisa", () => {
  const r = applica({ az: "turno_precedente", medico: 1, giorno: 15, turno: "N" }, A, M, statoBase());
  s.assert(r.errori.length > 0 && /cavallo/.test(r.errori[0]), "atteso un avviso 'fuori settimana a cavallo'");
  s.eq(r.turniPrecedenti[1], undefined, "non deve aver scritto nulla");
});
s.test("(cavolata 3/4) giorno inesistente / non-cavallo (32, 26 lug): NON registra e avvisa", () => {
  for (const g of [32, 26]) { // 26 lug 2026 = domenica, settimana ISO PRECEDENTE → non nel cavallo
    const r = applica({ az: "turno_precedente", medico: 1, giorno: g, turno: "N" }, A, M, statoBase());
    s.assert(r.errori.length > 0, `giorno ${g}: atteso un avviso`);
    s.eq(r.turniPrecedenti[1], undefined, `giorno ${g}: non deve scrivere`);
  }
});
s.test("turno omesso su un FERIALE (solo N): registra il notturno, nessuna domanda", () => {
  const r = applica({ az: "turno_precedente", medico: 1, giorno: 28 }, A, M, statoBase()); // 28 lug = martedì feriale
  s.eq(r.domande.length, 0, "su un feriale non deve esserci ambiguità");
  s.eq(r.turniPrecedenti[1][dk(A, 6, 28)].N, true, "deve registrare il notturno di default");
});
s.test("mese senza settimana a cavallo (inizia di lunedì): NON registra e avvisa", () => {
  // trova un mese 2026 che inizia di lunedì
  let m0 = -1; for (let k = 0; k < 12; k++) if (settimanaDi(dk(2026, k, 1)) === dk(2026, k, 1)) { m0 = k; break; }
  s.assert(m0 >= 0, "atteso almeno un mese 2026 che inizia di lunedì");
  const r = applica({ az: "turno_precedente", medico: 1, giorno: 30, turno: "N" }, 2026, m0, { dispo: { 1: {} }, turniPrecedenti: {} });
  s.assert(r.errori.length > 0 && /cavallo/.test(r.errori[0]), "atteso un avviso 'nessuna settimana a cavallo'");
});

// --- Q2: giorno con SIA diurno SIA notturno e turno OMESSO → il sistema CHIEDE (non default N) ---
// Serve un mese la cui settimana a cavallo includa un giorno del mese precedente con anche il diurno
// (weekend/festivo). Un mese che inizia di DOMENICA ha il sabato precedente (weekend, G+N) nel cavallo.
s.test("giorno con diurno+notturno e turno omesso: emette la domanda diurno/notturno (nessuna scrittura)", () => {
  let anno = 0, mese = -1, gBoth = null;
  outer: for (let y = 2026; y <= 2036; y++) for (let k = 0; k < 12; k++) {
    if (!cavalloDi(y, k)) continue;
    const rec = giorniLuglioCavallo(y, k).find((x) => x.haG);
    if (rec) { anno = y; mese = k; gBoth = rec; break outer; }
  }
  s.assert(gBoth != null, "atteso un mese con un giorno G+N nel cavallo (es. mese che inizia di domenica)");
  const r = applica({ az: "turno_precedente", medico: 1, giorno: gBoth.giorno }, anno, mese, { dispo: { 1: {} }, turniPrecedenti: {} });
  s.eq(r.domande.length, 1, "deve emettere una domanda diurno/notturno");
  s.eq(r.turniPrecedenti[1], undefined, "finché non risponde, nessuna scrittura");
  s.eq(r.domande[0].seSi[0].turno, "G", "Sì = diurno");
  s.eq(r.domande[0].seNo[0].turno, "N", "No = notturno");
  // rispondere "No" (notturno) registra N
  const r2 = applica(r.domande[0].seNo[0], anno, mese, { dispo: { 1: {} }, turniPrecedenti: {} });
  s.eq(r2.turniPrecedenti[1][gBoth.dataStr].N, true, "rispondendo 'notturno' deve registrare N");
});

s.finish();
