// Genera il corpus di email simulate per il test automatico del prompt AI di chiediAI
// (turni-guardia-medica.jsx). Ogni caso è indipendente (un solo turno di conversazione,
// nessuna cronologia pregressa) e porta con sé il risultato "atteso": non un confronto
// esatto sull'intero JSON, ma un elenco di azioni/domande/avvisi che DEVONO comparire e
// un elenco di azioni che NON devono mai comparire (usato soprattutto per verificare le
// regole di protezione, es. senza-incarico + recupero ore/turni extra).
//
// RNG seedato (mulberry32) per riproducibilità totale: la stessa invocazione produce sempre
// lo stesso corpus (stesso ordine, stesse combinazioni), così due run del runner su corpus
// identico sono confrontabili "prima/dopo" una modifica al prompt. La selezione è CON
// reinserimento (pick, non pickN): i pool di medici/giorni sono piccoli (26 medici, ~20-30
// giorni) ma il corpus richiesto supera le 500 combinazioni, quindi le stesse coppie
// giorno+medico si ripetono con valori/frasi diverse — non è un problema per un test di
// robustezza del prompt, anzi verifica che risposte coerenti si ripetano in casi analoghi.
//
// Uso:
//   node test_email_generator.mjs            → scrive test_email_corpus.json + riepilogo a console
//   import { generaCorpus } from "./test_email_generator.mjs" → uso programmatico (es. dal runner)

import { MEDICI_DEFAULT, CAT_INFO } from "./engine_test.mjs";

const SEED = 20260704;
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const randInt = (min, max) => min + Math.floor(rng() * (max - min + 1));
const times = (n, fn) => { for (let i = 0; i < n; i++) fn(i); };

const ANNO = 2026, MESE = 7; // agosto 2026 (stesso mese di test standard, vedi test_utils.mjs)
const MESE_LABEL = "Agosto 2026";
// Feriali "semplici" (solo turno N, nessun G concorrente) — dedotti da turniDelGiorno.
const GIORNI_FERIALI = [3, 4, 5, 6, 7, 10, 11, 12, 13, 17, 18, 19, 20, 21, 24, 25, 26, 27, 28, 31];
// Giorni con sia G che N (weekend/festivo/prefestivo) — dedotti da turniDelGiorno.
const GIORNI_WEEKEND = [1, 2, 8, 9, 15, 16, 22, 23, 29, 30];
const GIORNI_PREFESTIVO = [14]; // ha G+N ma non è weekend puro
const GIORNI_WEEKEND_TUTTI = [...GIORNI_WEEKEND, ...GIORNI_PREFESTIVO];

const SEDI5 = ["Maniago", "Spilimbergo", "Meduno", "Claut", "Anduins"];
const SEDI_BLU = ["Meduno", "Claut", "Anduins"];

const contrattualizzati = MEDICI_DEFAULT.filter((m) => CAT_INFO[m.cat].ore !== null);
const senzaIncarico = MEDICI_DEFAULT.filter((m) => CAT_INFO[m.cat].ore === null);

let seq = 0;
const nextId = (categoria) => `${categoria}_${String(++seq).padStart(4, "0")}`;

function statoBase() {
  return { mmgAttivi: [], oreExtraPre: {}, turniExtraPre: {} };
}

const casi = [];
function aggiungi(categoria, medico, giorni, email, atteso, statoOverride = statoBase(), note = "") {
  casi.push({
    id: nextId(categoria), categoria, medico: medico.nome, medicoId: medico.id, cat: medico.cat,
    giorni: Array.isArray(giorni) ? giorni : [giorni], mese: MESE_LABEL, anno: ANNO, meseIdx: MESE,
    statoOverride, email, atteso, note,
  });
}

// ============ 1. SEDI FISICHE — dichiarazione diretta di 1 o 2 sedi ============
times(40, (i) => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(contrattualizzati);
  const sedi = i % 3 === 0 ? [pick(SEDI5.slice(0, 2))] : [...new Set([pick(SEDI5.slice(0, 2)), pick(SEDI5.slice(0, 2))])];
  const email = sedi.length === 1
    ? `Il giorno ${giorno} posso coprire la notte a ${sedi[0]}.`
    : `Per ${MESE_LABEL} sono disponibile la notte del ${giorno} a ${sedi.join(" e ")}.`;
  aggiungi("sedi_fisiche", m, giorno, email, {
    azioniRichieste: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "N", sedi } }],
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 2. SEDI FISICHE INDIFFERENTE (livelli pari) ============
times(25, (i) => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(contrattualizzati);
  const varianti = [
    `Per il ${giorno} sono disponibile a Maniago o Spilimbergo indifferentemente per la notte.`,
    `Il ${giorno} vado bene sia a Maniago che a Spilimbergo, per me è indifferente.`,
  ];
  aggiungi("sedi_indifferente", m, giorno, pick(varianti), {
    azioniRichieste: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "N", sedi: ["Maniago", "Spilimbergo"], sediLivPari: true } }],
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 3. SEDI FISICHE CON PREFERENZA (★) ============
times(25, (i) => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(contrattualizzati);
  const [preferita, ripiego] = i % 2 === 0 ? ["Maniago", "Spilimbergo"] : ["Spilimbergo", "Maniago"];
  const email = `Il ${giorno} preferirei ${preferita} per la notte, ma se serve va bene anche ${ripiego}.`;
  aggiungi("sedi_preferita", m, giorno, email, {
    azioniRichieste: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "N", sedi: ["Maniago", "Spilimbergo"], preferito: preferita } }],
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 4. COPERTURA A DISTANZA (blu) ============
times(30, () => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(contrattualizzati);
  const sedeVerde = pick(["Maniago", "Spilimbergo"]);
  const sedeBlu = pick(SEDI_BLU);
  const email = `Per il ${giorno} sono disponibile a ${sedeVerde} in presenza, e posso coprire anche ${sedeBlu} a distanza.`;
  aggiungi("copertura_distanza", m, giorno, email, {
    azioniRichieste: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "N", sedi: [sedeVerde], blu: [sedeBlu] } }],
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 5. INDISPONIBILITÀ ESPLICITA ============
times(30, () => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(MEDICI_DEFAULT);
  const varianti = [
    `Il ${giorno} non sono disponibile per la notte, ho un impegno personale.`,
    `Per il ${giorno} non posso fare il turno notturno.`,
    `Il ${giorno} sono indisponibile per la guardia notturna.`,
  ];
  aggiungi("indisponibilita", m, giorno, pick(varianti), {
    azioniRichieste: [{ az: "dispo_no", match: { medico: m.nome, giorno, turno: "N" } }],
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 6. FERIE / PERIODO ESTESO ============
times(20, () => {
  const da = pick(GIORNI_FERIALI.slice(0, 12));
  const a = Math.min(31, da + randInt(2, 5));
  const m = pick(MEDICI_DEFAULT);
  const giorni = []; for (let g = da; g <= a; g++) if (GIORNI_FERIALI.includes(g)) giorni.push(g);
  if (!giorni.length) return;
  const email = `Sarò in ferie dal ${da} al ${a} agosto, non sono disponibile per nessun turno in quel periodo.`;
  aggiungi("ferie_periodo", m, giorni, email, {
    azioniRichieste: giorni.map((giorno) => ({ az: "dispo_no", match: { medico: m.nome, giorno, turno: "N" } })),
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 7. RECUPERO ORE — DIRETTO IN ORE ============
times(30, () => {
  const ore = pick([6, 12, 18, 24, 30, 36, 42, 48, 54, 60]);
  const m = pick(contrattualizzati);
  const varianti = [
    `Ho ${ore} ore da recuperare dal mese scorso.`,
    `Vorrei inserire ${ore} ore di recupero per agosto.`,
    `Il mese scorso ho fatto meno ore, ho un debito di ${ore} ore da recuperare.`,
    `Chiedo di poter recuperare ${ore} ore.`,
  ];
  aggiungi("recupero_ore_diretto", m, [], pick(varianti), {
    azioniRichieste: [{ az: "ore_extra", match: { medico: m.nome, ore } }],
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 8. RECUPERO ORE — ESPRESSO IN TURNI (conversione ×12) ============
times(20, () => {
  const turni = randInt(1, 6);
  const m = pick(contrattualizzati);
  const varianti = [
    `Ho ${turni} turni da recuperare dal mese scorso.`,
    `Mi mancano ${turni} guardie da recuperare.`,
    `Recupero ${turni} turni dal mese di luglio.`,
  ];
  aggiungi("recupero_ore_in_turni", m, [], pick(varianti), {
    azioniRichieste: [{ az: "ore_extra", match: { medico: m.nome, ore: turni * 12 } }],
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 9. TURNI EXTRA — DICHIARAZIONE DIRETTA CON NUMERO ============
times(30, () => {
  const n = randInt(1, 6);
  const m = pick(contrattualizzati);
  const varianti = [
    `Sono disponibile per ${n} turni extra questo mese.`,
    `Aggiungo ${n} turni in più oltre al mio monte ore.`,
    `Mi offro per ${n} turni extra oltre contratto.`,
    `Metto a disposizione ${n} turni in più del distretto.`,
    `Faccio ${n} guardie in più.`,
  ];
  aggiungi("turni_extra_diretto", m, [], pick(varianti), {
    azioniRichieste: [{ az: "turni_extra", match: { medico: m.nome, turni: n } }],
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 10. TURNI EXTRA — CONDIZIONALE CON NUMERO ============
times(20, () => {
  const n = randInt(1, 5);
  const m = pick(contrattualizzati);
  const varianti = [
    `Se serve faccio altri ${n} turni oltre il mio monte ore.`,
    `In caso di necessità faccio ${n} turni extra.`,
    `Se siete a corto di medici posso fare ${n} turni extra.`,
    `Se manca copertura aggiungo ${n} turni.`,
  ];
  aggiungi("turni_extra_condizionale", m, [], pick(varianti), {
    azioniRichieste: [{ az: "turni_extra", match: { medico: m.nome, turni: n } }],
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 11. TURNI EXTRA — GENERICO SENZA NUMERO (avviso, nessuna azione) ============
times(16, () => {
  const m = pick(contrattualizzati);
  const varianti = ["Sono disponibile per turni extra.", "Faccio anche qualche turno in più.", "Mi rendo disponibile per guardie extra.", "Sono disposto a fare turni aggiuntivi.", "Sono flessibile sul numero di turni.", "Posso aggiungere qualche turno."];
  aggiungi("turni_extra_generico", m, [], pick(varianti), {
    azioniRichieste: [], azioniVietate: [{ az: "turni_extra" }], nessunaAzione: false,
    avvisoRichiesto: { contiene: ["ATTENZIONE", m.nome] },
  });
});

// ============ 12. TURNI EXTRA — RIFIUTO ESPLICITO (turni:0) ============
times(15, () => {
  const m = pick(contrattualizzati);
  const varianti = ["Non sono disponibile per turni extra questo mese.", "Faccio solo il mio monte ore, niente turni aggiuntivi.", "Mi limito al monte ore contrattuale.", "Questo mese solo il monte ore obbligatorio."];
  aggiungi("turni_extra_rifiuto", m, [], pick(varianti), {
    azioniRichieste: [{ az: "turni_extra", match: { medico: m.nome, turni: 0 } }],
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 13. MMG/PLS — TURNO ATTIVO (mattina/pomeriggio) ============
times(30, (i) => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(MEDICI_DEFAULT);
  const fascia = i % 2 === 0 ? "M" : "P";
  const parola = fascia === "M" ? "mattina" : "pomeriggio";
  const email = `Per il ${giorno} sono disponibile per la ${parola} MMG.`;
  aggiungi("mmg_attivo", m, giorno, email, {
    azioniRichieste: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: fascia } }],
    azioniVietate: [], nessunaAzione: false,
  }, { mmgAttivi: [`g${giorno}:${fascia}`], oreExtraPre: {}, turniExtraPre: {} });
});

// ============ 14. MMG/PLS — TURNO NON ATTIVO (domanda Sì/No obbligatoria) ============
times(30, (i) => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(MEDICI_DEFAULT);
  const fascia = i % 2 === 0 ? "M" : "P";
  const parola = fascia === "M" ? "mattina" : "pomeriggio";
  const email = `Vorrei fare la ${parola} MMG del ${giorno}.`;
  aggiungi("mmg_non_attivo", m, giorno, email, {
    azioniRichieste: [], azioniVietate: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: fascia } }],
    nessunaAzione: false,
    domandaRichiesta: { medico: m.nome, giorno, testoContiene: ["attivare"] },
  }, statoBase());
});

// ============ 15. WEEKEND AMBIGUO (nessuna precisazione diurno/notturno → domanda) ============
times(25, () => {
  const giorno = pick(GIORNI_WEEKEND);
  const m = pick(MEDICI_DEFAULT);
  const email = `Per il ${giorno} sono disponibile a Maniago.`;
  aggiungi("weekend_ambiguo", m, giorno, email, {
    azioniRichieste: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "N", sedi: ["Maniago"] } }],
    azioniVietate: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "G" } }],
    nessunaAzione: false,
    domandaRichiesta: { medico: m.nome, giorno },
  });
});

// ============ 16. NOTTI ESPLICITE NEL WEEKEND (parola "notti"/"notturni" → niente domanda) ============
times(20, () => {
  const giorno = pick(GIORNI_WEEKEND);
  const m = pick(MEDICI_DEFAULT);
  const varianti = [`Per il ${giorno} sono disponibile a Maniago solo per le notti.`, `Il ${giorno} copro Maniago, ma solo il notturno.`];
  aggiungi("weekend_notti_esplicite", m, giorno, pick(varianti), {
    azioniRichieste: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "N", sedi: ["Maniago"] } }],
    azioniVietate: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "G" } }],
    nessunaAzione: false, domandaVietata: true,
  });
});

// ============ 17. CONDIZIONALI AMBIGUE (nessuna azione turni extra, nessun errore) ============
times(16, () => {
  const m = pick(contrattualizzati);
  const varianti = ["Faccio quello che serve.", "Sono a disposizione.", "Ci sono quando serve.", "Disponibile."];
  aggiungi("condizionali_ambigue", m, [], pick(varianti), {
    azioniRichieste: [], azioniVietate: [{ az: "turni_extra" }], nessunaAzione: false,
  });
});

// ============ 18. CONTRADDIZIONI (stesso giorno/turno: sia disponibile che non disponibile) ============
times(20, () => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(MEDICI_DEFAULT);
  const email = `Per il ${giorno} sono disponibile a Maniago per la notte, anche se in realtà non sono disponibile quella notte.`;
  aggiungi("contraddizioni", m, giorno, email, {
    azioniRichieste: [], azioniVietate: [],
    avvisoRichiesto: { contiene: ["ATTENZIONE", m.nome] },
  });
});

// ============ 19. SENZA INCARICO — RECUPERO ORE IMPROPRIO ============
times(20, () => {
  const ore = pick([6, 12, 18, 24, 36]);
  const m = pick(senzaIncarico);
  const email = `Ho ${ore} ore da recuperare dal mese scorso.`;
  aggiungi("senza_incarico_recupero", m, [], email, {
    azioniRichieste: [], azioniVietate: [{ az: "ore_extra", match: { medico: m.nome } }],
    avvisoRichiesto: { contiene: ["ATTENZIONE", m.nome, "senza incarico"] },
  });
});

// ============ 20. SENZA INCARICO — TURNI EXTRA IMPROPRIO ============
times(20, () => {
  const n = randInt(1, 4);
  const m = pick(senzaIncarico);
  const email = `Sono disponibile per ${n} turni extra oltre il mio monte ore.`;
  aggiungi("senza_incarico_turni_extra", m, [], email, {
    azioniRichieste: [], azioniVietate: [{ az: "turni_extra", match: { medico: m.nome } }],
    avvisoRichiesto: { contiene: ["ATTENZIONE", m.nome, "senza incarico"] },
  });
});

// ============ 21. SEDE NON IDENTIFICABILE (avviso, nessuna azione) ============
times(20, () => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(MEDICI_DEFAULT);
  const varianti = [`Il ${giorno} sono disponibile nella sede più vicina a casa mia.`, `Per il ${giorno} vado bene per una sede comoda.`, `Il ${giorno} disponibile per la sede del distretto.`];
  aggiungi("sede_non_identificabile", m, giorno, pick(varianti), {
    azioniRichieste: [], azioniVietate: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno } }],
    avvisoRichiesto: { contiene: ["ATTENZIONE", m.nome] },
  });
});

// ============ 22. DATE VAGHE (avviso, nessuna azione) ============
times(15, () => {
  const m = pick(MEDICI_DEFAULT);
  const varianti = ["Sono disponibile verso metà mese.", "Nella seconda parte del mese posso fare qualche notte.", "Diciamo negli ultimi giorni del mese sono libero."];
  aggiungi("date_vaghe", m, [], pick(varianti), {
    azioniRichieste: [], azioniVietate: [{ az: "dispo_aggiungi", match: { medico: m.nome } }],
    avvisoRichiesto: { contiene: ["ATTENZIONE", m.nome] },
  });
});

// ============ 23. TETTO SETTIMANALE ============
times(20, () => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(contrattualizzati);
  const email = `Per la settimana del ${giorno} posso fare al massimo 1 turno.`;
  aggiungi("tetto_settimanale", m, giorno, email, {
    azioniRichieste: [{ az: "tetto_settimana", match: { medico: m.nome, maxTurni: 1 } }],
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 24. PREFERENZA TURNO STESSO GIORNO (weekend/festivo) ============
times(20, () => {
  const giorno = pick(GIORNI_WEEKEND_TUTTI);
  const m = pick(MEDICI_DEFAULT);
  const email = `Per il ${giorno}, se dovessi vincere sia il turno diurno che quello notturno, preferisco tenere la notte.`;
  aggiungi("preferenza_turno", m, giorno, email, {
    azioniRichieste: [{ az: "turno_pref", match: { medico: m.nome, giorno, turno: "N" } }],
    azioniVietate: [], nessunaAzione: false,
  });
});

export function generaCorpus() {
  return casi;
}

// Esecuzione diretta: scrive il corpus su file + riepilogo a console.
if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import("node:fs");
  fs.writeFileSync("test_email_corpus.json", JSON.stringify(casi, null, 2));
  const perCategoria = {};
  casi.forEach((c) => (perCategoria[c.categoria] = (perCategoria[c.categoria] || 0) + 1));
  console.log(`\n=== Corpus generato: ${casi.length} casi in test_email_corpus.json ===`);
  Object.entries(perCategoria).sort((a, b) => b[1] - a[1]).forEach(([cat, n]) => console.log(`  ${cat.padEnd(30)} ${n}`));
  console.log(`\nTotale categorie: ${Object.keys(perCategoria).length}`);
}
