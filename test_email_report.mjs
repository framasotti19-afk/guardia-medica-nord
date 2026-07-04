// Legge test_email_results.json (prodotto da test_email_runner.mjs) e verifica SEMANTICAMENTE
// ogni risposta rispetto al risultato "atteso" costruito da test_email_generator.mjs: non solo
// JSON valido, ma azioni giuste/vietate, domande Sì/No attese, avvisi 🔴 ATTENZIONE attesi.
// Produce un report con percentuale di successo, breakdown per categoria, elenco dei
// fallimenti con diagnosi, pattern ricorrenti e suggerimenti per migliorare il prompt.
//
// Uso:
//   node test_email_report.mjs [--in test_email_results.json] [--out test_email_report.md]
//                               [--ai-suggestions]   (richiede ANTHROPIC_API_KEY, opzionale)

import fs from "node:fs";

function parseArgs(argv) {
  const args = { in: "test_email_results.json", out: "test_email_report.md", aiSuggestions: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--in") args.in = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--ai-suggestions") args.aiSuggestions = true;
  }
  return args;
}
const args = parseArgs(process.argv.slice(2));

// ============ Matcher: azioni ============
function azioneCorrisponde(spec, azione, medicoCaso) {
  if (azione.az !== spec.az) return false;
  const match = { medico: medicoCaso, ...(spec.match || {}) }; // "medico" implicito se non specificato
  for (const [chiave, atteso] of Object.entries(match)) {
    if (chiave === "sedi") {
      const attuali = azione.sedi || [];
      if (!atteso.every((s) => attuali.includes(s))) return false;
    } else if (chiave === "blu") {
      const attuali = azione.blu || [];
      if (!atteso.every((s) => attuali.includes(s))) return false;
    } else if (chiave === "sediLivPari") {
      const liv = azione.sedi_liv || {};
      const valori = (azione.sedi || []).map((s) => liv[s] ?? 1);
      if (atteso && new Set(valori).size > 1) return false;
    } else if (chiave === "preferito") {
      if ((azione.preferito || null) !== atteso) return false;
    } else {
      if (azione[chiave] !== atteso) return false;
    }
  }
  return true;
}
function trovaAzione(spec, azioni, medicoCaso) {
  return (azioni || []).some((az) => azioneCorrisponde(spec, az, medicoCaso));
}
function descriviSpec(spec, medicoCaso) {
  const m = spec.match || {};
  const dettagli = Object.entries({ medico: medicoCaso, ...m }).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" ");
  return `${spec.az}(${dettagli})`;
}

// ============ Matcher: domande ============
function domandaCorrisponde(spec, domande) {
  return (domande || []).some((d) => {
    if (spec.medico && d.medico !== spec.medico) return false;
    if (spec.giorno != null && Number(d.giorno) !== Number(spec.giorno)) return false;
    if (spec.testoContiene) {
      const testo = `${d.domanda || ""} ${d.citazione || ""}`.toLowerCase();
      if (!spec.testoContiene.every((k) => testo.includes(k.toLowerCase()))) return false;
    }
    return true;
  });
}

// ============ Matcher: avviso testuale (spiegazione/testo) ============
function avvisoCorrisponde(spec, obj) {
  const testo = `${obj?.spiegazione || ""} ${obj?.testo || ""}`.toLowerCase();
  return (spec.contiene || []).every((k) => testo.includes(k.toLowerCase()));
}

// ============ Valutazione di un singolo caso ============
function valutaCaso(r) {
  if (r.erroreRete) return { esito: false, motivi: [`errore di rete: ${r.erroreRete}`], tipoErrore: "errore_rete" };
  if (r.erroreParsing) return { esito: false, motivi: ["risposta non parsabile come JSON"], tipoErrore: "errore_parsing" };

  const obj = r.rispostaParsata || {};
  const azioni = obj.azioni || [];
  const domande = obj.domande || [];
  const atteso = r.atteso || {};
  const motivi = [];
  let tipoErrore = null;

  for (const spec of atteso.azioniRichieste || []) {
    if (!trovaAzione(spec, azioni, r.medico)) {
      motivi.push(`azione mancante: ${descriviSpec(spec, r.medico)}`);
      tipoErrore = tipoErrore || "azione_mancante";
    }
  }
  for (const spec of atteso.azioniVietate || []) {
    if (trovaAzione(spec, azioni, r.medico)) {
      motivi.push(`azione vietata presente: ${descriviSpec(spec, r.medico)}`);
      tipoErrore = "azione_vietata"; // priorità massima: è la violazione più grave (regola di sicurezza ignorata)
    }
  }
  if (atteso.nessunaAzione === true && azioni.length > 0) {
    motivi.push(`azioni presenti (${azioni.length}) quando non ci si aspettava alcuna azione`);
    tipoErrore = tipoErrore || "azione_inattesa";
  }
  if (atteso.domandaRichiesta) {
    if (!domandaCorrisponde(atteso.domandaRichiesta, domande)) {
      motivi.push(`domanda Sì/No mancante o non corrispondente per ${atteso.domandaRichiesta.medico} giorno ${atteso.domandaRichiesta.giorno}`);
      tipoErrore = tipoErrore || "domanda_mancante";
    }
  }
  if (atteso.domandaVietata === true && domande.length > 0) {
    motivi.push(`domanda Sì/No presente quando non era attesa nessuna ambiguità`);
    tipoErrore = tipoErrore || "domanda_inattesa";
  }
  if (atteso.avvisoRichiesto) {
    if (!avvisoCorrisponde(atteso.avvisoRichiesto, obj)) {
      motivi.push(`avviso mancante (parole attese: ${atteso.avvisoRichiesto.contiene.join(", ")})`);
      tipoErrore = tipoErrore || "avviso_mancante";
    }
  }
  return { esito: motivi.length === 0, motivi, tipoErrore };
}

// ============ Suggerimenti euristici per categoria ============
const SUGGERIMENTI = {
  mmg_non_attivo: "Il prompt richiede di controllare 'mmgAttivi' prima di ogni inserimento MMG: se il modello lo ignora spesso, valuta di aggiungere un esempio JSON completo (email → 'domande' atteso) direttamente nella sezione MMG E PLS, non solo la regola testuale.",
  weekend_ambiguo: "Se il modello inserisce direttamente il notturno senza chiedere, la regola 'weekend ambiguo → domanda' potrebbe essere troppo lontana nel prompt dagli esempi di sedi fisiche: valuta di spostarla più vicino o di aggiungere un esempio negativo esplicito.",
  weekend_notti_esplicite: "Se il modello genera comunque una domanda quando il medico ha scritto esplicitamente 'notti'/'notturni', rinforza con un esempio letterale di questa frase nel prompt, vicino alla regola del weekend ambiguo (rischio di confusione tra le due regole gemelle).",
  senza_incarico_recupero: "Se l'azione ore_extra compare comunque per un medico SENZA, la regola aggiunta in RECUPERO ORE potrebbe non essere abbastanza in evidenza: valuta di anteporla come prima riga della sezione invece che come nota, o di aggiungerla anche nella STATO ATTUALE come commento esplicito per medico.",
  senza_incarico_turni_extra: "Stesso pattern di senza_incarico_recupero ma per turni_extra: se fallisce sistematicamente, valuta un unico blocco 'REGOLE SENZA INCARICO' condiviso invece di due paragrafi separati, per ridurre il rischio che il modello ne applichi solo uno.",
  turni_extra_generico: "Se il modello inventa comunque un numero di turni invece di chiedere, il prompt potrebbe implicare che 'un numero è sempre necessario': aggiungi un esempio negativo esplicito con l'azione VIETATA accanto a quella corretta (solo avviso).",
  contraddizioni: "Se il modello non segnala la contraddizione, valuta di aggiungere alla sezione CASI DA SEGNALARE AL COORDINATORE un esempio con disponibilità e indisponibilità nella stessa frase per lo stesso giorno/turno.",
  sede_non_identificabile: "Se il modello inventa comunque una sede fisica, la lista di frasi vaghe nel prompt potrebbe non coprire abbastanza varianti: aggiungi le formulazioni fallite qui sotto come nuovi esempi letterali.",
  date_vaghe: "Se il modello assegna comunque un giorno specifico a una data vaga, valuta di rendere esplicito nel prompt che 'in assenza di un numero di giorno preciso, non dedurre mai una data arbitraria'.",
  recupero_ore_in_turni: "Se la conversione turni×12 non avviene o è sbagliata, verifica che l'esempio numerico nel prompt (es. '4 turni → 48 ore') sia sufficientemente esplicito e non ambiguo rispetto a un altro turno di durata diversa (es. MMG da 6h).",
  tetto_settimanale: "Se l'azione tetto_settimana non usa il giorno giusto per identificare la settimana, chiarisci nel prompt che 'giorno' può essere un giorno qualsiasi della settimana voluta, non necessariamente il primo.",
  preferenza_turno: "Se turno_pref viene generato con il turno sbagliato (G invece di N o viceversa), verifica che l'esempio nel prompt distingua chiaramente 'tengo la notte' da 'tengo il giorno' con frasi diverse.",
};
const SUGGERIMENTO_GENERICO = "Nessun suggerimento specifico precompilato per questa categoria: rivedi manualmente gli esempi falliti elencati sopra per individuare il pattern.";

// ============ Report AI opzionale (solo se --ai-suggestions e ANTHROPIC_API_KEY presente) ============
async function suggerimentiAI(fallimentiCampione) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("(--ai-suggestions richiesto ma ANTHROPIC_API_KEY non impostata: salto questo passaggio)");
    return null;
  }
  const testoFallimenti = fallimentiCampione.map((f) => `- [${f.categoria}] email: "${f.email}" — motivi: ${f.motivi.join("; ")}`).join("\n");
  const prompt = `Sei un revisore esperto di prompt engineering. Di seguito un elenco di casi di test falliti per il prompt di un assistente AI che gestisce turni di guardia medica. Per ciascun pattern ricorrente, scrivi 2-4 suggerimenti concreti e specifici (in italiano) su come modificare il prompt per correggerli. Sii sintetico e concreto, niente premesse.\n\n${testoFallimenti}`;
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 2000, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await resp.json();
    if (!resp.ok) { console.log(`(chiamata AI per suggerimenti fallita: ${data?.error?.message || resp.status})`); return null; }
    return (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
  } catch (e) {
    console.log(`(chiamata AI per suggerimenti fallita: ${e.message})`);
    return null;
  }
}

// ============ Main ============
async function main() {
  if (!fs.existsSync(args.in)) {
    console.error(`ERRORE: file dei risultati non trovato: ${args.in}. Esegui prima test_email_runner.mjs.`);
    process.exit(1);
  }
  const risultati = JSON.parse(fs.readFileSync(args.in, "utf8"));
  const valutati = risultati.map((r) => ({ ...r, ...valutaCaso(r) }));

  const totale = valutati.length;
  const passati = valutati.filter((v) => v.esito).length;
  const percentuale = totale ? ((passati / totale) * 100).toFixed(1) : "0.0";

  // Breakdown per categoria
  const perCategoria = {};
  valutati.forEach((v) => {
    perCategoria[v.categoria] ??= { totale: 0, passati: 0 };
    perCategoria[v.categoria].totale++;
    if (v.esito) perCategoria[v.categoria].passati++;
  });

  // Pattern ricorrenti: (categoria, tipoErrore) → conteggio
  const pattern = {};
  valutati.filter((v) => !v.esito).forEach((v) => {
    const chiave = `${v.categoria} · ${v.tipoErrore || "sconosciuto"}`;
    pattern[chiave] = (pattern[chiave] || 0) + 1;
  });
  const patternOrdinati = Object.entries(pattern).sort((a, b) => b[1] - a[1]);

  const fallimenti = valutati.filter((v) => !v.esito);

  let suggerimentiAiTesto = null;
  if (args.aiSuggestions && fallimenti.length) {
    console.log("Chiamata AI per suggerimenti mirati sui fallimenti...");
    suggerimentiAiTesto = await suggerimentiAI(fallimenti.slice(0, 40));
  }

  // ============ Output console ============
  console.log(`\n=== REPORT TEST EMAIL AI — ${args.in} ===`);
  console.log(`Successo complessivo: ${passati}/${totale} (${percentuale}%)\n`);
  console.log("Breakdown per categoria:");
  Object.entries(perCategoria).sort((a, b) => (a[1].passati / a[1].totale) - (b[1].passati / b[1].totale)).forEach(([cat, s]) => {
    const pct = ((s.passati / s.totale) * 100).toFixed(0);
    console.log(`  ${cat.padEnd(30)} ${String(s.passati).padStart(3)}/${String(s.totale).padEnd(3)} (${pct}%)`);
  });
  console.log(`\nPattern di errore ricorrenti (categoria · tipo errore):`);
  patternOrdinati.slice(0, 15).forEach(([chiave, n]) => console.log(`  ${n.toString().padStart(3)}×  ${chiave}`));
  console.log(`\n${fallimenti.length} casi falliti su ${totale} (dettaglio completo in ${args.out}).`);

  // ============ Output Markdown ============
  const righe = [];
  righe.push(`# Report test email AI\n`);
  righe.push(`File risultati: \`${args.in}\`  \nGenerato: ${new Date().toISOString()}\n`);
  righe.push(`## Sintesi\n`);
  righe.push(`**Successo complessivo: ${passati}/${totale} (${percentuale}%)**\n`);
  righe.push(`## Breakdown per categoria\n`);
  righe.push(`| Categoria | Passati | Totale | % |`);
  righe.push(`|---|---:|---:|---:|`);
  Object.entries(perCategoria).sort((a, b) => (a[1].passati / a[1].totale) - (b[1].passati / b[1].totale)).forEach(([cat, s]) => {
    righe.push(`| ${cat} | ${s.passati} | ${s.totale} | ${((s.passati / s.totale) * 100).toFixed(0)}% |`);
  });
  righe.push(`\n## Pattern di errore ricorrenti\n`);
  righe.push(`| Categoria · tipo errore | Occorrenze |`);
  righe.push(`|---|---:|`);
  patternOrdinati.forEach(([chiave, n]) => righe.push(`| ${chiave} | ${n} |`));
  righe.push(`\n## Suggerimenti per migliorare il prompt\n`);
  const categorieFallite = [...new Set(fallimenti.map((f) => f.categoria))];
  categorieFallite.forEach((cat) => {
    righe.push(`**${cat}**: ${SUGGERIMENTI[cat] || SUGGERIMENTO_GENERICO}\n`);
  });
  if (suggerimentiAiTesto) {
    righe.push(`\n## Suggerimenti AI (--ai-suggestions)\n`);
    righe.push(suggerimentiAiTesto);
  }
  righe.push(`\n## Dettaglio fallimenti (${fallimenti.length})\n`);
  fallimenti.forEach((f) => {
    righe.push(`### ${f.id} — ${f.categoria}\n`);
    righe.push(`- **Medico**: ${f.medico} (${f.cat})`);
    righe.push(`- **Email**: "${f.email}"`);
    righe.push(`- **Motivi**: ${f.motivi.join("; ")}`);
    if (f.rispostaParsata) righe.push(`- **Risposta AI (spiegazione)**: ${f.rispostaParsata.spiegazione || f.rispostaParsata.testo || "(nessuna)"}`);
    righe.push("");
  });
  fs.writeFileSync(args.out, righe.join("\n"));
  console.log(`Report Markdown scritto in ${args.out}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
