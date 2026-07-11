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
// reinserimento (pick, non pickN): i pool di medici/giorni sono piccoli (14 medici, ~20-30
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
// Con la lista attuale (14 medici reali) ci sono 5 medici "senza incarico" (PRESSACCO, CERVESATO,
// DE CANDIDO, MERLINO, IENGO): le 5 categorie che pescano da qui tornano quindi a generare i loro
// casi normalmente. Il controllo senzaIncarico.length resta comunque (times(N, () => {
// if (!senzaIncarico.length) return; ... })) per restare robusto anche se in futuro la lista
// tornasse ad avere 0 medici senza incarico — mai un override sintetico locale a questo file,
// perché test_email_runner.mjs costruisce "stato.medici" per l'AI leggendo le categorie REALI da
// MEDICI_DEFAULT: un override qui non si rifletterebbe là, producendo casi falsati (l'AI vedrebbe
// la categoria vera del medico, non SENZA) invece che semplicemente assenti.
const senzaIncarico = MEDICI_DEFAULT.filter((m) => CAT_INFO[m.cat].ore === null);

let seq = 0;
const nextId = (categoria) => `${categoria}_${String(++seq).padStart(4, "0")}`;

function statoBase() {
  return { mmgAttivi: [], oreExtraPre: {}, turniExtraPre: {}, maxTurniMesePre: {} };
}

const casi = [];
// L'AI non riceve MAI un campo "mittente" separato: nell'app reale il coordinatore incolla
// un'email che identifica il medico da sé (tipicamente con una firma in fondo, come nel caso
// "solo la firma senza contenuto" già gestito dal prompt). Ogni email generata deve quindi
// firmarsi esplicitamente, altrimenti l'AI chiede correttamente "di quale medico si tratta?"
// invece di produrre l'azione attesa — bug di corpus scoperto durante la prima run reale.
function firma(email, medico) {
  return `${email}\n\nSaluti,\n${medico.nome}`;
}
function aggiungi(categoria, medico, giorni, email, atteso, statoOverride = statoBase(), note = "") {
  casi.push({
    id: nextId(categoria), categoria, medico: medico.nome, medicoId: medico.id, cat: medico.cat,
    giorni: Array.isArray(giorni) ? giorni : [giorni], mese: MESE_LABEL, anno: ANNO, meseIdx: MESE,
    statoOverride, email: firma(email, medico), atteso, note,
  });
}

// ============ 1. SEDI FISICHE — dichiarazione diretta di 1 o 2 sedi ============
times(86, (i) => {
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
times(54, (i) => {
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

// ============ 3. SEDI FISICHE "PREFERIBILMENTE X, ALTRIMENTI Y" (livelli 1/2) ============
// Nota: il prompt (sezione dispo_aggiungi) mappa ESPLICITAMENTE questa formulazione su sedi_liv (es. Maniago:1, Spilimbergo:2).
times(54, (i) => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(contrattualizzati);
  const [preferita, ripiego] = i % 2 === 0 ? ["Maniago", "Spilimbergo"] : ["Spilimbergo", "Maniago"];
  const email = `Il ${giorno} preferirei ${preferita} per la notte, ma se serve va bene anche ${ripiego}.`;
  aggiungi("sedi_preferita", m, giorno, email, {
    azioniRichieste: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "N", sedi: ["Maniago", "Spilimbergo"], preferenzaLivelli: [preferita, ripiego] } }],
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 4. COPERTURA A DISTANZA (blu) ============
times(65, () => {
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
times(65, () => {
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
times(43, () => {
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

// ============ 6bis. ECCEZIONI "TRANNE"/"ECCETTO"/... IN DISPONIBILITÀ (regressione bug: i giorni
// dopo il connettivo NON devono mai risultare disponibili — l'AI aveva invertito la logica su una
// frase reale "disponibile tutto il mese tranne dal 1 al 7", inserendo disponibilità invece di NO) ============
times(50, (i) => {
  const connettori = ["tranne", "eccetto", "salvo", "a parte", "escluso", "fuori da"];
  const connettivo = connettori[i % connettori.length];
  const da = pick(GIORNI_FERIALI.slice(0, 12));
  const a = Math.min(31, da + randInt(2, 5));
  const m = pick(contrattualizzati);
  const giorniEsclusi = []; for (let g = da; g <= a; g++) if (GIORNI_FERIALI.includes(g)) giorniEsclusi.push(g);
  if (!giorniEsclusi.length) return;
  const email = `Sono disponibile tutto il mese a Maniago, ${connettivo} dal ${da} al ${a}.`;
  aggiungi("eccezione_tranne_disponibilita", m, giorniEsclusi, email, {
    azioniRichieste: giorniEsclusi.map((giorno) => ({ az: "dispo_no", match: { medico: m.nome, giorno, turno: "N" } })),
    azioniVietate: giorniEsclusi.map((giorno) => ({ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "N" } })),
    nessunaAzione: false,
  });
});

// ============ 7. RECUPERO ORE — DIRETTO IN ORE ============
times(65, () => {
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
times(43, () => {
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
times(65, () => {
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
times(43, () => {
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
times(34, () => {
  const m = pick(contrattualizzati);
  const varianti = ["Sono disponibile per turni extra.", "Faccio anche qualche turno in più.", "Mi rendo disponibile per guardie extra.", "Sono disposto a fare turni aggiuntivi.", "Sono flessibile sul numero di turni.", "Posso aggiungere qualche turno."];
  aggiungi("turni_extra_generico", m, [], pick(varianti), {
    azioniRichieste: [], azioniVietate: [{ az: "turni_extra" }], nessunaAzione: false,
    avvisoRichiesto: { contiene: ["ATTENZIONE", m.nome] },
  });
});

// ============ 12. TURNI EXTRA — RIFIUTO ESPLICITO (turni:0) ============
times(32, () => {
  const m = pick(contrattualizzati);
  const varianti = ["Non sono disponibile per turni extra questo mese.", "Faccio solo il mio monte ore, niente turni aggiuntivi.", "Mi limito al monte ore contrattuale.", "Questo mese solo il monte ore obbligatorio."];
  aggiungi("turni_extra_rifiuto", m, [], pick(varianti), {
    azioniRichieste: [{ az: "turni_extra", match: { medico: m.nome, turni: 0 } }],
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 13. MMG/PLS — TURNO ATTIVO (mattina/pomeriggio) ============
// La sede è sempre indicata esplicitamente: un'email MMG senza sede aveva rivelato un bug reale
// del prompt (l'AI produceva "sedi":[] per il turno MMG, che il motore scarta silenziosamente
// perché richiede almeno una sede dichiarata anche per i turni extra — corretto nel prompt,
// sezione MMG E PLS). L'atteso verifica ora esplicitamente che "sedi" non sia mai vuoto.
times(65, (i) => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(MEDICI_DEFAULT);
  const fascia = i % 2 === 0 ? "M" : "P";
  const parola = fascia === "M" ? "mattina" : "pomeriggio";
  const email = `Per il ${giorno} sono disponibile per la ${parola} MMG a Maniago.`;
  aggiungi("mmg_attivo", m, giorno, email, {
    azioniRichieste: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: fascia, sedi: ["Maniago"] } }],
    azioniVietate: [], nessunaAzione: false,
  }, { mmgAttivi: [`g${giorno}:${fascia}`], oreExtraPre: {}, turniExtraPre: {} });
});

// ============ 14. MMG/PLS — TURNO NON ATTIVO (domanda Sì/No obbligatoria) ============
// La sede è sempre indicata esplicitamente (bug di corpus corretto: senza sede l'AI segnala
// correttamente "sede MMG non specificata" — regola §14bis — invece di porre la domanda di
// attivazione qui attesa, le due ambiguità si sovrappongono se la sede manca).
times(65, (i) => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(MEDICI_DEFAULT);
  const fascia = i % 2 === 0 ? "M" : "P";
  const parola = fascia === "M" ? "mattina" : "pomeriggio";
  const email = `Vorrei fare la ${parola} MMG del ${giorno} a Maniago.`;
  aggiungi("mmg_non_attivo", m, giorno, email, {
    azioniRichieste: [], azioniVietate: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: fascia } }],
    nessunaAzione: false,
    domandaRichiesta: { medico: m.nome, giorno, testoContiene: ["attivare"] },
  }, statoBase());
});

// ============ 14bis. MMG/PLS — TURNO ATTIVO MA SEDE NON SPECIFICATA (avviso, nessuna azione) ============
// Regressione del bug trovato nella prima run reale: prima della regola dedicata, l'AI produceva
// "sedi":[] per queste email (turno attivo, ma nessuna sede indicata) — un'azione apparentemente
// valida ma che il motore scarta silenziosamente (nessuna sede verde/blu dichiarata). Ora deve
// astenersi e segnalare l'ambiguità invece di inserire una disponibilità inerte.
times(20, (i) => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(MEDICI_DEFAULT);
  const fascia = i % 2 === 0 ? "M" : "P";
  const parola = fascia === "M" ? "mattina" : "pomeriggio";
  const email = `Per il ${giorno} sono disponibile per la ${parola} MMG.`; // nessuna sede indicata
  aggiungi("mmg_sede_non_specificata", m, giorno, email, {
    azioniRichieste: [], azioniVietate: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: fascia } }],
    nessunaAzione: false,
    avvisoRichiesto: { contiene: ["ATTENZIONE", "sede MMG", m.nome] },
  }, { mmgAttivi: [`g${giorno}:${fascia}`], oreExtraPre: {}, turniExtraPre: {} });
});

// ============ 15. WEEKEND AMBIGUO (nessuna precisazione diurno/notturno → domanda) ============
// Pool ristretto ai contrattualizzati (bug di corpus corretto): un senza incarico pescato qui,
// senza numero di guardie mensili dichiarato, viene correttamente bloccato dalla regola dedicata
// (§ MEDICO SENZA INCARICO — NUMERO DI GUARDIE MENSILI) invece di generare la domanda qui attesa —
// le due ambiguità si sovrapponevano. Quella regola ha una propria categoria dedicata
// (senza_incarico_no_numero_guardie/senza_incarico_con_numero_guardie), qui non serve rimescolarla.
times(54, () => {
  const giorno = pick(GIORNI_WEEKEND);
  const m = pick(contrattualizzati);
  const email = `Per il ${giorno} sono disponibile a Maniago.`;
  aggiungi("weekend_ambiguo", m, giorno, email, {
    azioniRichieste: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "N", sedi: ["Maniago"] } }],
    azioniVietate: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "G" } }],
    nessunaAzione: false,
    domandaRichiesta: { medico: m.nome, giorno },
  });
});

// ============ 16. NOTTI ESPLICITE NEL WEEKEND (parola "notti"/"notturni" → niente domanda) ============
// Stesso motivo del pool ristretto: categoria gemella di weekend_ambiguo (vedi sopra).
times(43, () => {
  const giorno = pick(GIORNI_WEEKEND);
  const m = pick(contrattualizzati);
  const varianti = [`Per il ${giorno} sono disponibile a Maniago solo per le notti.`, `Il ${giorno} copro Maniago, ma solo il notturno.`];
  aggiungi("weekend_notti_esplicite", m, giorno, pick(varianti), {
    azioniRichieste: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "N", sedi: ["Maniago"] } }],
    azioniVietate: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "G" } }],
    nessunaAzione: false, domandaVietata: true,
  });
});

// ============ 16bis. FERIALE CON FRASE AMBIGUA (nessuna domanda sul diurno: il diurno non esiste) ============
// Regressione di un bug segnalato: l'AI aveva generato la domanda "vuoi aggiungere anche il
// diurno?" per FOSCHIANI il 7 agosto (giovedì, feriale semplice) — nei feriali esiste SOLO il
// notturno, quindi la stessa identica frase che su un weekend genera correttamente una domanda
// (categoria weekend_ambiguo) non deve MAI generarne una su un feriale. Pool ristretto ai
// contrattualizzati per lo stesso motivo di weekend_ambiguo (vedi sopra).
times(30, () => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(contrattualizzati);
  const email = `Per il ${giorno} sono disponibile a Maniago.`;
  aggiungi("feriale_no_domanda_diurno", m, giorno, email, {
    azioniRichieste: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "N", sedi: ["Maniago"] } }],
    azioniVietate: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "G" } }],
    nessunaAzione: false, domandaVietata: true,
  });
});

// ============ 17. CONDIZIONALI AMBIGUE (nessuna azione turni extra, nessun errore) ============
times(34, () => {
  const m = pick(contrattualizzati);
  const varianti = ["Faccio quello che serve.", "Sono a disposizione.", "Ci sono quando serve.", "Disponibile."];
  aggiungi("condizionali_ambigue", m, [], pick(varianti), {
    azioniRichieste: [], azioniVietate: [{ az: "turni_extra" }], nessunaAzione: false,
  });
});

// ============ 18. CONTRADDIZIONI (stesso giorno/turno: sia disponibile che non disponibile) ============
times(43, () => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(MEDICI_DEFAULT);
  const email = `Per il ${giorno} sono disponibile a Maniago per la notte, anche se in realtà non sono disponibile quella notte.`;
  aggiungi("contraddizioni", m, giorno, email, {
    azioniRichieste: [], azioniVietate: [],
    avvisoRichiesto: { contiene: ["ATTENZIONE", m.nome] },
  });
});

// ============ 19. SENZA INCARICO — RECUPERO ORE IMPROPRIO ============
// avvisoRichiesto non pretende più il prefisso letterale "ATTENZIONE" (bug di corpus corretto):
// il comportamento CRITICO — mai ore_extra per un senza incarico — è già verificato da
// azioniVietate; il modello a volte parafrasa l'avviso senza il prefisso esatto pur trasmettendo
// lo stesso significato ("PARRONI è senza incarico, il recupero ore non si applica al suo caso"),
// una differenza di forma non di sostanza che non vale la pena trattare come fallimento.
times(43, () => {
  if (!senzaIncarico.length) return; // nessun medico senza incarico nella lista attuale: categoria saltata, robusto anche a 0
  const ore = pick([6, 12, 18, 24, 36]);
  const m = pick(senzaIncarico);
  const email = `Ho ${ore} ore da recuperare dal mese scorso.`;
  aggiungi("senza_incarico_recupero", m, [], email, {
    azioniRichieste: [], azioniVietate: [{ az: "ore_extra", match: { medico: m.nome } }],
    avvisoRichiesto: { contiene: [m.nome, "senza incarico"] },
  });
});

// ============ 20. SENZA INCARICO — TURNI EXTRA IMPROPRIO ============
// Stesso motivo di senza_incarico_recupero sopra: niente prefisso letterale "ATTENZIONE" richiesto.
times(43, () => {
  if (!senzaIncarico.length) return; // nessun medico senza incarico nella lista attuale: categoria saltata, robusto anche a 0
  const n = randInt(1, 4);
  const m = pick(senzaIncarico);
  const email = `Sono disponibile per ${n} turni extra oltre il mio monte ore.`;
  aggiungi("senza_incarico_turni_extra", m, [], email, {
    azioniRichieste: [], azioniVietate: [{ az: "turni_extra", match: { medico: m.nome } }],
    avvisoRichiesto: { contiene: [m.nome, "senza incarico"] },
  });
});

// ============ 20bis. SENZA INCARICO — DISPONIBILITÀ SENZA NUMERO DI GUARDIE MENSILI (avviso, nessuna azione) ============
times(30, () => {
  if (!senzaIncarico.length) return; // nessun medico senza incarico nella lista attuale: categoria saltata, robusto anche a 0
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(senzaIncarico);
  const varianti = [
    `Il ${giorno} sono disponibile a Maniago per la notte.`,
    `Per il ${giorno} posso coprire Maniago di notte.`,
  ];
  aggiungi("senza_incarico_no_numero_guardie", m, giorno, pick(varianti), {
    azioniRichieste: [], azioniVietate: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "N" } }],
    avvisoRichiesto: { contiene: ["ATTENZIONE", m.nome, "numero massimo di guardie"] },
  });
});

// ============ 20ter. SENZA INCARICO — DISPONIBILITÀ CON NUMERO DI GUARDIE MENSILI (inserimento normale) ============
// Il numero dichiarato sblocca le disponibilità ordinarie E genera SEMPRE anche tetto_mese
// (CONTEXT.md §3.11 punto 1 — vedi anche la categoria dedicata "tetto_mese_senza_incarico").
times(30, () => {
  if (!senzaIncarico.length) return; // nessun medico senza incarico nella lista attuale: categoria saltata, robusto anche a 0
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(senzaIncarico);
  const n = randInt(4, 10);
  const email = `Voglio fare ${n} guardie questo mese. Il ${giorno} sono disponibile a Maniago per la notte.`;
  aggiungi("senza_incarico_con_numero_guardie", m, giorno, email, {
    azioniRichieste: [
      { az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "N", sedi: ["Maniago"] } },
      { az: "tetto_mese", match: { medico: m.nome, maxTurni: n } },
    ],
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 21. SEDE NON IDENTIFICABILE (avviso, nessuna azione) ============
times(43, () => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(MEDICI_DEFAULT);
  const varianti = [`Il ${giorno} sono disponibile nella sede più vicina a casa mia.`, `Per il ${giorno} vado bene per una sede comoda.`, `Il ${giorno} disponibile per la sede del distretto.`];
  aggiungi("sede_non_identificabile", m, giorno, pick(varianti), {
    azioniRichieste: [], azioniVietate: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno } }],
    avvisoRichiesto: { contiene: ["ATTENZIONE", m.nome] },
  });
});

// ============ 22. DATE VAGHE (avviso, nessuna azione) ============
times(32, () => {
  const m = pick(MEDICI_DEFAULT);
  const varianti = ["Sono disponibile verso metà mese.", "Nella seconda parte del mese posso fare qualche notte.", "Diciamo negli ultimi giorni del mese sono libero."];
  aggiungi("date_vaghe", m, [], pick(varianti), {
    azioniRichieste: [], azioniVietate: [{ az: "dispo_aggiungi", match: { medico: m.nome } }],
    avvisoRichiesto: { contiene: ["ATTENZIONE", m.nome] },
  });
});

// ============ 23. TETTO SETTIMANALE ============
times(43, () => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(contrattualizzati);
  const email = `Per la settimana del ${giorno} posso fare al massimo 1 turno.`;
  aggiungi("tetto_settimanale", m, giorno, email, {
    azioniRichieste: [{ az: "tetto_settimana", match: { medico: m.nome, maxTurni: 1 } }],
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 24. PREFERENZA TURNO STESSO GIORNO (weekend/festivo) ============
times(43, () => {
  const giorno = pick(GIORNI_WEEKEND_TUTTI);
  const m = pick(MEDICI_DEFAULT);
  const email = `Per il ${giorno}, se dovessi vincere sia il turno diurno che quello notturno, preferisco tenere la notte.`;
  aggiungi("preferenza_turno", m, giorno, email, {
    azioniRichieste: [{ az: "turno_pref", match: { medico: m.nome, giorno, turno: "N" } }],
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 25. TETTO MENSILE — DICHIARAZIONE DIRETTA CON NUMERO ============
// Vale per QUALSIASI categoria (CONTEXT.md §3.11 punto 1), a differenza dei turni extra.
times(15, () => {
  const n = randInt(2, 12);
  const m = pick(MEDICI_DEFAULT);
  const varianti = [
    `Voglio fare al massimo ${n} turni questo mese.`,
    `Non più di ${n} guardie al mese per me.`,
    `Limitatemi a ${n} turni questo mese, per favore.`,
    `Questo mese faccio solo ${n} guardie.`,
    `Non fatemi fare più di ${n} turni.`,
    `Massimo ${n} guardie per me questo mese.`,
    `Non superate i ${n} turni per me questo mese.`,
    `Per questo mese mi fermo a ${n} turni.`,
    `${n} turni è il mio massimo per questo mese.`,
  ];
  aggiungi("tetto_mese_diretto", m, [], pick(varianti), {
    azioniRichieste: [{ az: "tetto_mese", match: { medico: m.nome, maxTurni: n } }],
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 26. TETTO MENSILE — CONDIZIONALE CON NUMERO ============
times(12, () => {
  const n = randInt(2, 12);
  const m = pick(MEDICI_DEFAULT);
  const varianti = [
    `Se ne avete bisogno faccio fino a ${n} turni questo mese.`,
    `In caso di necessità arrivo fino a ${n} guardie.`,
    `Se serve posso arrivare fino a un massimo di ${n} turni.`,
    `Al bisogno faccio al massimo ${n} guardie questo mese.`,
    `Se il distretto ha bisogno, il mio limite è ${n} turni.`,
  ];
  aggiungi("tetto_mese_condizionale", m, [], pick(varianti), {
    azioniRichieste: [{ az: "tetto_mese", match: { medico: m.nome, maxTurni: n } }],
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 27. TETTO MENSILE — SENZA INCARICO (nessun'altra disponibilità nel messaggio) ============
// Lo stesso numero che soddisfa il controllo obbligatorio (§20ter) genera SEMPRE anche
// tetto_mese, indipendentemente dal fatto che siano presenti altre disponibilità ordinarie.
times(12, () => {
  if (!senzaIncarico.length) return; // nessun medico senza incarico nella lista attuale: categoria saltata, robusto anche a 0
  const n = randInt(2, 10);
  const m = pick(senzaIncarico);
  const varianti = [
    `Questo mese faccio ${n} guardie.`,
    `Sono disponibile per ${n} guardie questo mese.`,
    `Voglio fare ${n} turni ad agosto.`,
  ];
  aggiungi("tetto_mese_senza_incarico", m, [], pick(varianti), {
    azioniRichieste: [{ az: "tetto_mese", match: { medico: m.nome, maxTurni: n } }],
    azioniVietate: [{ az: "dispo_aggiungi", match: { medico: m.nome } }], nessunaAzione: false,
  });
});

// ============ 28. TETTO MENSILE — GENERICO SENZA NUMERO (avviso, nessuna azione) ============
times(12, () => {
  const m = pick(MEDICI_DEFAULT);
  const varianti = [
    "Vorrei fare qualche turno in meno del solito questo mese.",
    "Vorrei lavorare meno questo mese.",
    "Questo mese preferirei limitare i turni.",
    "Vorrei un tetto ma non so ancora quanto.",
    "Fatemi lavorare un po' meno se possibile.",
  ];
  aggiungi("tetto_mese_generico", m, [], pick(varianti), {
    azioniRichieste: [], azioniVietate: [{ az: "tetto_mese" }], nessunaAzione: false,
    avvisoRichiesto: { contiene: ["ATTENZIONE", m.nome] },
  });
});

// ============ 29. TETTO MENSILE — RIFIUTO ESPLICITO (maxTurni:null, mai 0) ============
// Un tetto già impostato (maxTurniMesePre) rende il rifiuto concreto e verificabile: senza un
// tetto preesistente il modello ragiona correttamente "non c'è nulla da rimuovere" e non emette
// alcuna azione (bug di corpus corretto — non un difetto del prompt, un rifiuto ha senso solo
// in presenza di un limite da togliere, esattamente come "controlla prima maxTurniMese in
// stato.medici" istruisce di fare).
times(9, () => {
  const m = pick(MEDICI_DEFAULT);
  const nEsistente = randInt(2, 10);
  const varianti = [
    "Non voglio limiti questo mese.",
    "Fate voi, nessun tetto per me.",
    "Non mettetemi limiti questo mese.",
    "Decidete voi quanti turni farmi.",
    "Non ho un massimo, fate come serve.",
  ];
  aggiungi("tetto_mese_rifiuto", m, [], pick(varianti), {
    azioniRichieste: [{ az: "tetto_mese", match: { medico: m.nome, maxTurni: null } }],
    azioniVietate: [], nessunaAzione: false,
  }, { ...statoBase(), maxTurniMesePre: { [m.nome]: nEsistente } });
});

// ============ 30. DISPONIBILITÀ "ULTIMA RISORSA" — formulazione classica su un solo giorno
// (avviso dedicato, nessuna disponibilità inserita per quel giorno) ============
times(8, (i) => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(contrattualizzati); // evita l'interferenza della regola "senza incarico senza numero guardie" con l'avviso atteso
  const varianti = [
    `Il ${giorno} sono disponibile a Maniago per la notte, solo se non trovate altri.`,
    `Per il ${giorno} posso coprire Maniago di notte, ma solo come ultima risorsa.`,
    `Il ${giorno} ci sarei a Maniago per la notte, se proprio serve.`,
    `Per il ${giorno} in caso di emergenza posso coprire Maniago di notte.`,
    `Il ${giorno} preferirei evitare, ma se siete disperati ci sono a Maniago per la notte.`,
    `Per il ${giorno} se non trovate nessun altro, ci sono a Maniago per la notte.`,
  ];
  const email = varianti[i % varianti.length];
  aggiungi("ultima_risorsa", m, giorno, email, {
    azioniRichieste: [], azioniVietate: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "N" } }],
    avvisoRichiesto: { contiene: ["ATTENZIONE", m.nome, "ultima risorsa"] },
  });
});

// ============ 31. DISPONIBILITÀ "ULTIMA RISORSA" — caso MISTO (disponibilità normale + un
// giorno condizionato nella stessa email): solo il giorno condizionato va segnalato, l'altro va
// inserito regolarmente ============
times(6, () => {
  const giornoNormale = pick(GIORNI_FERIALI.slice(0, 10));
  let giornoUR = pick(GIORNI_FERIALI.slice(10));
  const m = pick(contrattualizzati); // evita l'interferenza della regola "senza incarico senza numero guardie" sul giorno normale
  const varianti = [
    `Il ${giornoNormale} sono disponibile a Maniago per la notte. Il ${giornoUR} potrei esserci ma solo come ultima risorsa.`,
    `Per il ${giornoNormale} posso coprire Maniago di notte. Il ${giornoUR}, se proprio serve, ci sono, ma preferirei evitare.`,
    `Il ${giornoNormale} sono disponibile a Maniago per la notte, mentre il ${giornoUR} solo se non trovate altri.`,
  ];
  const email = pick(varianti);
  aggiungi("ultima_risorsa", m, [giornoNormale, giornoUR], email, {
    azioniRichieste: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno: giornoNormale, turno: "N", sedi: ["Maniago"] } }],
    azioniVietate: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno: giornoUR, turno: "N" } }],
    avvisoRichiesto: { contiene: ["ATTENZIONE", m.nome, "ultima risorsa"] },
  });
});

// ============ 32. DISPONIBILITÀ "ULTIMA RISORSA" — condizione su PIÙ giorni nella stessa
// dichiarazione (entrambi vanno segnalati, nessuno dei due inserito) ============
times(6, () => {
  const g1 = pick(GIORNI_FERIALI.slice(0, 10));
  const g2 = pick(GIORNI_FERIALI.slice(10));
  const m = pick(contrattualizzati); // evita l'interferenza della regola "senza incarico senza numero guardie" con l'avviso atteso
  const varianti = [
    `Il ${g1} e il ${g2} potrei esserci a Maniago per la notte, ma solo come ultima risorsa, se non trovate nessun altro.`,
    `Per il ${g1} e il ${g2} ci sarei a Maniago per la notte solo se proprio serve, preferirei evitare.`,
  ];
  const email = pick(varianti);
  aggiungi("ultima_risorsa", m, [g1, g2], email, {
    azioniRichieste: [],
    azioniVietate: [
      { az: "dispo_aggiungi", match: { medico: m.nome, giorno: g1, turno: "N" } },
      { az: "dispo_aggiungi", match: { medico: m.nome, giorno: g2, turno: "N" } },
    ],
    avvisoRichiesto: { contiene: ["ATTENZIONE", m.nome, "ultima risorsa"] },
  });
});

// ============ 33. FALSO POSITIVO "ULTIMA RISORSA" — condizione sulla SEDE, non sul lavorare quel
// giorno ("se serve vado anche a Meduno"): normale disponibilità alternativa di sede, va inserita
// regolarmente, MAI trattata come ultima risorsa ============
times(5, () => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(contrattualizzati);
  const primaria = pick(["Maniago", "Spilimbergo"]);
  const varianti = [
    `Il ${giorno} sono disponibile a ${primaria} per la notte; se serve vado anche a Meduno.`,
    `Per il ${giorno} preferirei ${primaria}, ma se necessario vado anche a Meduno per la notte.`,
  ];
  const email = pick(varianti);
  aggiungi("ultima_risorsa_falso_positivo", m, giorno, email, {
    azioniRichieste: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "N", sedi: [primaria, "Meduno"] } }],
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 34. FALSO POSITIVO "ULTIMA RISORSA" — condizione sulla copertura A DISTANZA
// ("se necessario copro Meduno a distanza"): normale dichiarazione blu, va inserita regolarmente,
// MAI trattata come ultima risorsa ============
times(5, () => {
  const giorno = pick(GIORNI_FERIALI);
  const m = pick(contrattualizzati);
  const sedeVerde = pick(["Maniago", "Spilimbergo"]);
  const varianti = [
    `Il ${giorno} sono disponibile a ${sedeVerde} in presenza; se necessario copro anche Meduno a distanza.`,
    `Per il ${giorno} ci sono a ${sedeVerde}, e se serve posso coprire Meduno a distanza.`,
  ];
  const email = pick(varianti);
  aggiungi("ultima_risorsa_falso_positivo", m, giorno, email, {
    azioniRichieste: [{ az: "dispo_aggiungi", match: { medico: m.nome, giorno, turno: "N", sedi: [sedeVerde], blu: ["Meduno"] } }],
    azioniVietate: [], nessunaAzione: false,
  });
});

// ============ 35. TURNO PRECEDENTE — REGISTRAZIONE DAL COORDINATORE (fase 3) ============
// Il COORDINATORE in chat dichiara un turno GIÀ SVOLTO a fine luglio (settimana a cavallo): l'AI deve
// emettere turno_precedente coi dati grezzi (chi/giorno/N-G), MAI dispo_*. I giorni 27-31 lug 2026 sono
// feriali → solo notturno. (Il mese di STATO ATTUALE è agosto 2026, che HA una settimana a cavallo.)
times(10, () => {
  const g = randInt(27, 31);
  const m = pick(MEDICI_DEFAULT);
  const varianti = [
    `Segna che ${m.nome} ha fatto un notturno il ${g} luglio.`,
    `${m.nome} ha già coperto la notte del ${g} luglio, registralo.`,
    `Il ${g} luglio ${m.nome} ha fatto il turno di notte, mettilo tra i turni già svolti.`,
    `Annota che ${m.nome} ha lavorato la notte del ${g} luglio.`,
  ];
  aggiungi("turno_precedente_registra", m, [], pick(varianti), {
    azioniRichieste: [{ az: "turno_precedente", match: { medico: m.nome, giorno: g, turno: "N" } }],
    azioniVietate: [{ az: "dispo_aggiungi" }, { az: "dispo_set" }], nessunaAzione: false,
  });
});

// ============ 36. TURNO PRECEDENTE — TEST #1: una MAIL di disponibilità NON deve mai innescarlo ============
// Una normale email di disponibilità FUTURA di un medico (anche se cita date tardive) resta dispo_*, MAI
// turno_precedente (che è passato + solo coordinatore). Distingue passato/futuro (§ regola PASSATO vs FUTURO).
times(10, () => {
  const m = pick(contrattualizzati);
  const varianti = [
    `Confermo che sarò disponibile per le notti dei feriali a Maniago.`,
    `Sono disponibile a Spilimbergo per le notti dal 28 al 31.`,
    `Per questo mese posso fare le notti dei feriali a Maniago.`,
    `Mi rendo disponibile per i notturni del weekend a Meduno.`,
  ];
  aggiungi("turno_precedente_mail_futura", m, [], pick(varianti), {
    azioniRichieste: [], azioniVietate: [{ az: "turno_precedente", match: { medico: m.nome } }], nessunaAzione: false,
  });
});

// ============ 37. TURNO PRECEDENTE — TEST #7: giorno mancante → l'AI CHIEDE, non inventa ============
// Il coordinatore dichiara un turno passato SENZA il giorno preciso: l'AI non deve indovinare né emettere
// turno_precedente con una data inventata; deve chiedere quale giorno (risposta aperta, nessuna azione).
times(8, () => {
  const m = pick(MEDICI_DEFAULT);
  const varianti = [
    `Segna che ${m.nome} ha fatto un turno a fine luglio.`,
    `${m.nome} ha coperto una notte nell'ultima settimana di luglio, registralo.`,
    `Metti tra i turni già svolti che ${m.nome} ha lavorato a fine luglio.`,
  ];
  aggiungi("turno_precedente_giorno_mancante", m, [], pick(varianti), {
    azioniRichieste: [], azioniVietate: [{ az: "turno_precedente", match: { medico: m.nome } }], nessunaAzione: true,
    domandaVietata: true, // il giorno mancante va chiesto come TESTO, MAI con una card Sì/No (seSi/seNo)
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
