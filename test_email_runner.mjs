// Esegue il corpus generato da test_email_generator.mjs contro l'API Anthropic reale,
// usando SEMPRE il prompt "sys" attuale estratto direttamente da turni-guardia-medica.jsx
// (nessuna copia incollata a mano: zero rischio di drift quando il prompt cambia).
//
// Richiede ANTHROPIC_API_KEY nell'ambiente (o in un file .env locale, MAI committato — vedi
// .gitignore). Fa chiamate reali e a pagamento: usa --limit durante lo sviluppo per validare
// la pipeline su un sottoinsieme piccolo prima di lanciare l'intero corpus.
//
// Uso (modalità normale, una chiamata per caso):
//   node test_email_runner.mjs [--corpus test_email_corpus.json] [--out test_email_results.json]
//                               [--limit N] [--concurrency N]
//
// Se il file corpus non esiste, viene generato al volo (stessa logica di test_email_generator.mjs).
//
// Uso (Message Batches API, ~50% più economico — consigliato per corpus grandi):
//   node test_email_runner.mjs --batch-submit [--corpus ...] [--retry-failed test_email_results.json]
//     → invia il batch, salva lo stato in test_email_batch_state.json e stampa il batch id.
//       Con --retry-failed, invia SOLO i casi che in quel file di risultati avevano erroreRete
//       (utile per ripetere a costo ridotto solo i casi falliti per credito esaurito).
//   node test_email_runner.mjs --batch-status <batch_id>
//     → interroga lo stato del batch (in_progress/ended, conteggi per esito). Nessun costo.
//   node test_email_runner.mjs --batch-fetch <batch_id> [--out test_email_results.json]
//     → quando il batch è "ended", scarica i risultati e li UNISCE (upsert per id) nel file
//       risultati indicato, preservando gli esiti già presenti per gli altri casi.
// Il batch è asincrono lato Anthropic (minuti-ore): non blocca questo processo, va interrogato
// periodicamente con --batch-status e poi scaricato con --batch-fetch quando pronto.

import fs from "node:fs";
import { MEDICI_DEFAULT, CAT_INFO, MESI_IT } from "./engine_test.mjs";
import { generaCorpus } from "./test_email_generator.mjs";

function caricaEnvLocale() {
  const path = ".env";
  if (!fs.existsSync(path)) return;
  for (const riga of fs.readFileSync(path, "utf8").split("\n")) {
    const m = riga.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
caricaEnvLocale();

function parseArgs(argv) {
  const args = {
    corpus: "test_email_corpus.json", out: "test_email_results.json", limit: null, concurrency: 6,
    dryRun: false, yes: false, retryFailed: null, state: "test_email_batch_state.json",
    batchSubmit: false, batchStatus: null, batchFetch: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--corpus") args.corpus = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--limit") args.limit = Number(argv[++i]);
    else if (a === "--concurrency") args.concurrency = Number(argv[++i]);
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--yes") args.yes = true;
    else if (a === "--retry-failed") args.retryFailed = argv[++i];
    else if (a === "--state") args.state = argv[++i];
    else if (a === "--batch-submit") args.batchSubmit = true;
    else if (a === "--batch-status") { args.batchStatus = argv[++i]; args.batchStatusRichiesto = true; }
    else if (a === "--batch-fetch") { args.batchFetch = argv[++i]; args.batchFetchRichiesto = true; }
  }
  // Un id mancante o malformato (es. dimenticato, o l'argomento successivo è un altro flag) NON
  // deve mai far ripiegare silenziosamente sul flusso sincrono normale: è già successo durante lo
  // sviluppo che "--batch-status" senza id abbia quasi avviato una run reale da 1200 casi.
  if (args.batchStatusRichiesto && (!args.batchStatus || args.batchStatus.startsWith("--"))) {
    console.error(`ERRORE: --batch-status richiede un batch_id valido come argomento successivo.`);
    process.exit(1);
  }
  if (args.batchFetchRichiesto && (!args.batchFetch || args.batchFetch.startsWith("--"))) {
    console.error(`ERRORE: --batch-fetch richiede un batch_id valido come argomento successivo.`);
    process.exit(1);
  }
  return args;
}
const args = parseArgs(process.argv.slice(2));

// Soglia di sicurezza: oltre questo numero di casi servono chiamate API reali e a pagamento
// in quantità non banale. Senza --yes esplicito ci si ferma qui, per evitare run accidentali
// su tutto il corpus (è successo durante lo sviluppo di questo stesso script).
const SOGLIA_SENZA_CONFERMA = 20;

// ============ Estrazione del prompt "sys" dal sorgente reale (zero drift) ============
function estraiTemplateSys() {
  const src = fs.readFileSync("turni-guardia-medica.jsx", "utf8");
  const startMarker = "const sys = `";
  const startIdx = src.indexOf(startMarker);
  if (startIdx < 0) throw new Error('Marker "const sys = `" non trovato in turni-guardia-medica.jsx');
  const bodyStart = startIdx + startMarker.length;
  const endMarker = "STATO ATTUALE: ${JSON.stringify(stato)}`;";
  const endIdx = src.indexOf(endMarker, bodyStart);
  if (endIdx < 0) throw new Error('Marker di fine prompt non trovato (il testo "STATO ATTUALE: ..." potrebbe essere cambiato)');
  const body = src.slice(bodyStart, endIdx) + "STATO ATTUALE: ${JSON.stringify(stato)}";
  // eslint-disable-next-line no-new-func
  return new Function("stato", "return `" + body + "`;");
}
const renderSys = estraiTemplateSys();

// ============ Costruzione dello "stato" per un caso di test ============
function buildStato(caso) {
  const { statoOverride } = caso;
  return {
    mese: `${MESI_IT[caso.meseIdx]} ${caso.anno}`,
    medici: MEDICI_DEFAULT.map((m) => ({
      nome: m.nome, categoria: CAT_INFO[m.cat].label, graduatoria: m.grad,
      oreExtra: (statoOverride.oreExtraPre || {})[m.nome] || 0,
      turniExtra: (statoOverride.turniExtraPre || {})[m.nome] || 0,
      oreAssegnate: null, oreMancanti: null,
    })),
    mmgAttivi: statoOverride.mmgAttivi || [],
    avvisiScenari: [],
    disponibilita: {},
    disponibilitaPresenti: Object.fromEntries(MEDICI_DEFAULT.map((m) => [m.nome, []])),
    azioniGiaEseguite: [],
    tettiSettimanali: {},
    preferenzeTurno: {},
    schema: "non ancora elaborato",
  };
}

// ============ Parsing della risposta (stessa logica di chiediAI in turni-guardia-medica.jsx) ============
function parseRisposta(testoGrezzo) {
  let testo = testoGrezzo.replace(/```json|```/g, "").trim();
  let obj = null;
  try { obj = JSON.parse(testo); } catch { obj = null; }
  if (!obj) {
    const i0 = testo.indexOf("{"), i1 = testo.lastIndexOf("}");
    if (i0 >= 0 && i1 > i0) { try { obj = JSON.parse(testo.slice(i0, i1 + 1)); } catch { obj = null; } }
  }
  return obj;
}

// ============ Chiamata API con timeout + un retry su errore di rete/5xx ============
async function chiamaAPI(promptTesto) {
  const corpo = {
    model: "claude-sonnet-5", max_tokens: 16000,
    messages: [{ role: "user", content: promptTesto }],
  };
  for (let tentativo = 1; tentativo <= 2; tentativo++) {
    const abortCtrl = new AbortController();
    const timeoutId = setTimeout(() => abortCtrl.abort(), 60000);
    const inizio = Date.now();
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        signal: abortCtrl.signal,
        body: JSON.stringify(corpo),
      });
      clearTimeout(timeoutId);
      const latenzaMs = Date.now() - inizio;
      const data = await resp.json();
      if (!resp.ok) {
        if (resp.status >= 500 && tentativo === 1) continue; // retry su errore server
        return { erroreRete: `HTTP ${resp.status}: ${data?.error?.message || JSON.stringify(data)}`, testoGrezzo: "", stopReason: null, latenzaMs };
      }
      const testoGrezzo = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n") || "";
      return { erroreRete: null, testoGrezzo, stopReason: data.stop_reason, latenzaMs };
    } catch (e) {
      clearTimeout(timeoutId);
      if (tentativo === 1) continue; // retry su timeout/errore di rete
      return { erroreRete: `Eccezione: ${e.message}`, testoGrezzo: "", stopReason: null, latenzaMs: Date.now() - inizio };
    }
  }
}

// ============ Message Batches API (~50% più economico dell'API sincrona) ============
// Header comuni a tutte le chiamate REST del batch (submit, status, download risultati).
const HEADER_ANTHROPIC = () => ({ "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" });

async function batchSubmit(corpus) {
  const requests = corpus.map((caso) => {
    const sysTesto = renderSys(buildStato(caso));
    const promptCompleto = `${sysTesto}\n\nRICHIESTA: ${caso.email}`;
    return { custom_id: caso.id, params: { model: "claude-sonnet-5", max_tokens: 16000, messages: [{ role: "user", content: promptCompleto }] } };
  });
  const resp = await fetch("https://api.anthropic.com/v1/messages/batches", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...HEADER_ANTHROPIC() },
    body: JSON.stringify({ requests }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Invio batch fallito: HTTP ${resp.status}: ${data?.error?.message || JSON.stringify(data)}`);
  // Stato locale: mappa custom_id → dati del caso, necessaria in --batch-fetch per ricostruire
  // i risultati nello stesso formato della modalità sincrona (categoria, medico, atteso, ecc.),
  // dato che l'API batch restituisce solo custom_id + risposta grezza, non il contesto del test.
  const stato = { batchId: data.id, submittedAt: new Date().toISOString(), casi: corpus };
  fs.writeFileSync(args.state, JSON.stringify(stato, null, 2));
  console.log(`Batch inviato: ${data.id} (${corpus.length} richieste, stato "${data.processing_status}").`);
  console.log(`Stato locale salvato in ${args.state}.`);
  console.log(`Controlla l'avanzamento con: node test_email_runner.mjs --batch-status ${data.id}`);
}

async function batchStatus(batchId) {
  const resp = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}`, { headers: HEADER_ANTHROPIC() });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Controllo stato fallito: HTTP ${resp.status}: ${data?.error?.message || JSON.stringify(data)}`);
  console.log(`Batch ${batchId}: stato "${data.processing_status}"`);
  console.log(`Conteggi:`, data.request_counts);
  if (data.processing_status === "ended") {
    console.log(`Pronto per il download: node test_email_runner.mjs --batch-fetch ${batchId}`);
  } else {
    console.log(`Non ancora pronto, riprova tra qualche minuto.`);
  }
}

async function batchFetch(batchId) {
  const respMeta = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}`, { headers: HEADER_ANTHROPIC() });
  const meta = await respMeta.json();
  if (!respMeta.ok) throw new Error(`Lettura metadati batch fallita: HTTP ${respMeta.status}: ${meta?.error?.message || JSON.stringify(meta)}`);
  if (meta.processing_status !== "ended") {
    console.log(`Il batch non è ancora terminato (stato "${meta.processing_status}"). Riprova più tardi con --batch-status.`);
    return;
  }
  if (!fs.existsSync(args.state)) throw new Error(`Stato locale ${args.state} non trovato: necessario per ricostruire i risultati (categoria, atteso, ecc.). Rilancia da --batch-submit.`);
  const statoLocale = JSON.parse(fs.readFileSync(args.state, "utf8"));
  if (statoLocale.batchId !== batchId) throw new Error(`Lo stato locale ${args.state} si riferisce a un batch diverso (${statoLocale.batchId}).`);
  const casiById = Object.fromEntries(statoLocale.casi.map((c) => [c.id, c]));

  const respRisultati = await fetch(meta.results_url, { headers: HEADER_ANTHROPIC() });
  const testoJsonl = await respRisultati.text();
  const nuovi = {};
  for (const riga of testoJsonl.split("\n")) {
    if (!riga.trim()) continue;
    const entry = JSON.parse(riga);
    const caso = casiById[entry.custom_id];
    if (!caso) continue; // non dovrebbe succedere: ogni custom_id inviato ha un caso corrispondente
    const r = entry.result;
    let risultato;
    if (r.type === "succeeded") {
      const testoGrezzo = (r.message.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n") || "";
      risultato = {
        id: caso.id, categoria: caso.categoria, medico: caso.medico, cat: caso.cat,
        giorni: caso.giorni, email: caso.email, atteso: caso.atteso,
        erroreRete: null, stopReason: r.message.stop_reason, latenzaMs: null,
        testoGrezzo, rispostaParsata: parseRisposta(testoGrezzo),
      };
      risultato.erroreParsing = !risultato.rispostaParsata;
    } else {
      // errored / canceled / expired: stesso schema degli errori della modalità sincrona.
      const messaggio = r.type === "errored" ? (r.error?.message || JSON.stringify(r.error)) : r.type;
      risultato = {
        id: caso.id, categoria: caso.categoria, medico: caso.medico, cat: caso.cat,
        giorni: caso.giorni, email: caso.email, atteso: caso.atteso,
        erroreRete: `batch ${r.type}: ${messaggio}`, stopReason: null, latenzaMs: null,
        testoGrezzo: null, rispostaParsata: null, erroreParsing: false,
      };
    }
    nuovi[caso.id] = risultato;
  }

  // Upsert per id nel file risultati esistente: preserva gli esiti già presenti per i casi NON
  // inclusi in questo batch (es. quelli già riusciti in una run sincrona precedente).
  let esistenti = [];
  if (fs.existsSync(args.out)) esistenti = JSON.parse(fs.readFileSync(args.out, "utf8"));
  const per_id = Object.fromEntries(esistenti.map((r) => [r.id, r]));
  Object.assign(per_id, nuovi);
  const finale = Object.values(per_id);
  fs.writeFileSync(args.out, JSON.stringify(finale, null, 2));

  const successi = Object.values(nuovi).filter((r) => !r.erroreRete).length;
  console.log(`Batch ${batchId}: ${successi}/${Object.keys(nuovi).length} richieste riuscite.`);
  console.log(`Risultati uniti in ${args.out} (${finale.length} casi totali). Esegui "node test_email_report.mjs" per il report.`);
}

// ============ Pool di concorrenza semplice ============
async function eseguiConConcorrenza(items, worker, concorrenza) {
  const risultati = new Array(items.length);
  let indice = 0, completati = 0;
  async function runner() {
    while (indice < items.length) {
      const i = indice++;
      risultati[i] = await worker(items[i], i);
      completati++;
      if (completati % 10 === 0 || completati === items.length) {
        process.stdout.write(`\r  ${completati}/${items.length} completati...`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concorrenza, items.length) }, runner));
  process.stdout.write("\n");
  return risultati;
}

// ============ Main ============
async function main() {
  // Le modalità di controllo batch non richiedono il corpus: operano solo su un batch_id remoto.
  if (args.batchStatus) return batchStatus(args.batchStatus);
  if (args.batchFetch) return batchFetch(args.batchFetch);

  let corpus;
  if (fs.existsSync(args.corpus)) {
    corpus = JSON.parse(fs.readFileSync(args.corpus, "utf8"));
    console.log(`Corpus caricato da ${args.corpus}: ${corpus.length} casi.`);
  } else {
    corpus = generaCorpus();
    fs.writeFileSync(args.corpus, JSON.stringify(corpus, null, 2));
    console.log(`Corpus non trovato, generato al volo e salvato in ${args.corpus}: ${corpus.length} casi.`);
  }

  if (args.retryFailed) {
    if (!fs.existsSync(args.retryFailed)) throw new Error(`File --retry-failed non trovato: ${args.retryFailed}`);
    const risultatiPrecedenti = JSON.parse(fs.readFileSync(args.retryFailed, "utf8"));
    const idFalliti = new Set(risultatiPrecedenti.filter((r) => r.erroreRete).map((r) => r.id));
    corpus = corpus.filter((c) => idFalliti.has(c.id));
    console.log(`--retry-failed: selezionati ${corpus.length} casi che avevano erroreRete in ${args.retryFailed}.`);
  }
  if (args.limit) corpus = corpus.slice(0, args.limit);

  if (args.batchSubmit) {
    if (corpus.length > SOGLIA_SENZA_CONFERMA && !args.yes) {
      console.error(`\nATTENZIONE: stai per inviare un batch di ${corpus.length} richieste REALI e A PAGAMENTO (anche se scontate ~50%) all'API Anthropic.`);
      console.error(`Per procedere aggiungi --yes esplicitamente, oppure usa --limit N per un batch di prova più piccolo.`);
      process.exit(1);
    }
    return batchSubmit(corpus);
  }

  if (args.dryRun) {
    console.log(`--dry-run: nessuna chiamata API. Verifico solo che il prompt si renderizzi per ${corpus.length} casi...`);
    for (const caso of corpus) {
      const sysTesto = renderSys(buildStato(caso));
      if (!sysTesto || sysTesto.length < 1000) throw new Error(`Prompt sospetto per il caso ${caso.id} (lunghezza ${sysTesto?.length})`);
    }
    console.log(`OK: tutti i ${corpus.length} prompt si renderizzano correttamente (nessuna chiamata effettuata).`);
    return;
  }

  if (corpus.length > SOGLIA_SENZA_CONFERMA && !args.yes) {
    console.error(`\nATTENZIONE: stai per lanciare ${corpus.length} chiamate REALI e A PAGAMENTO all'API Anthropic.`);
    console.error(`Per procedere aggiungi --yes esplicitamente, oppure usa --limit N per una run di prova più piccola.`);
    process.exit(1);
  }

  console.log(`Esecuzione di ${corpus.length} casi contro l'API Anthropic (concorrenza ${args.concurrency})...`);

  const parziali = [];
  const risultati = await eseguiConConcorrenza(corpus, async (caso) => {
    const stato = buildStato(caso);
    const sysTesto = renderSys(stato);
    const promptCompleto = `${sysTesto}\n\nRICHIESTA: ${caso.email}`;
    const { erroreRete, testoGrezzo, stopReason, latenzaMs } = await chiamaAPI(promptCompleto);
    const rispostaParsata = erroreRete ? null : parseRisposta(testoGrezzo);
    const risultato = {
      id: caso.id, categoria: caso.categoria, medico: caso.medico, cat: caso.cat,
      giorni: caso.giorni, email: caso.email, atteso: caso.atteso,
      erroreRete, stopReason, latenzaMs,
      testoGrezzo: erroreRete ? null : testoGrezzo,
      rispostaParsata,
      erroreParsing: !erroreRete && !rispostaParsata,
    };
    parziali.push(risultato);
    // Salvataggio incrementale ogni 50 casi: se il processo viene interrotto (rete, timeout,
    // Ctrl-C) non si perde il lavoro già fatto e pagato fino a quel momento.
    if (parziali.length % 50 === 0) fs.writeFileSync(args.out, JSON.stringify(parziali, null, 2));
    return risultato;
  }, args.concurrency);

  fs.writeFileSync(args.out, JSON.stringify(risultati, null, 2));
  const errori = risultati.filter((r) => r.erroreRete).length;
  const nonParsati = risultati.filter((r) => r.erroreParsing).length;
  console.log(`\nSalvato in ${args.out}. Errori di rete: ${errori}/${risultati.length}. Risposte non parsabili come JSON: ${nonParsati}/${risultati.length}.`);
  console.log(`Esegui "node test_email_report.mjs" per il report di verifica semantica.`);
}

// Guardia di ingresso: main() parte SOLO se il file è eseguito direttamente da CLI
// (node test_email_runner.mjs), MAI se il modulo viene semplicemente importato — è esattamente
// l'assenza di questa guardia che ha causato una run reale accidentale durante lo sviluppo.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
