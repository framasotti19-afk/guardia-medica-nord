// Esegue il corpus generato da test_email_generator.mjs contro l'API Anthropic reale,
// usando SEMPRE il prompt "sys" attuale estratto direttamente da turni-guardia-medica.jsx
// (nessuna copia incollata a mano: zero rischio di drift quando il prompt cambia).
//
// Richiede ANTHROPIC_API_KEY nell'ambiente (o in un file .env locale, MAI committato — vedi
// .gitignore). Fa chiamate reali e a pagamento: usa --limit durante lo sviluppo per validare
// la pipeline su un sottoinsieme piccolo prima di lanciare l'intero corpus.
//
// Uso:
//   node test_email_runner.mjs [--corpus test_email_corpus.json] [--out test_email_results.json]
//                               [--limit N] [--concurrency N]
//
// Se il file corpus non esiste, viene generato al volo (stessa logica di test_email_generator.mjs).

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
  const args = { corpus: "test_email_corpus.json", out: "test_email_results.json", limit: null, concurrency: 6, dryRun: false, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--corpus") args.corpus = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--limit") args.limit = Number(argv[++i]);
    else if (a === "--concurrency") args.concurrency = Number(argv[++i]);
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--yes") args.yes = true;
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
  let corpus;
  if (fs.existsSync(args.corpus)) {
    corpus = JSON.parse(fs.readFileSync(args.corpus, "utf8"));
    console.log(`Corpus caricato da ${args.corpus}: ${corpus.length} casi.`);
  } else {
    corpus = generaCorpus();
    fs.writeFileSync(args.corpus, JSON.stringify(corpus, null, 2));
    console.log(`Corpus non trovato, generato al volo e salvato in ${args.corpus}: ${corpus.length} casi.`);
  }
  if (args.limit) corpus = corpus.slice(0, args.limit);

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
