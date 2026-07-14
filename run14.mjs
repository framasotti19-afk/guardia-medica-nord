import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { MEDICI_DEFAULT, CAT_INFO, MESI_IT, SEDI_BREVI, turniDelGiorno, settimanaDi } from "./engine_test.mjs";
import { generaCorpus } from "./test_email_generator.mjs";
// Il banco vive NEL repo (accanto a engine_test/test_email_generator). Percorsi relativi alla cartella di
// questo file (cwd-indipendente). Gli output (run14_out.json, run14_ckpt.jsonl, ...) restano qui e sono in .gitignore.
const DIR = import.meta.dirname;

// carica .env (chiave API) — locale, mai committato
for (const riga of fs.readFileSync(path.join(DIR, ".env"), "utf8").split("\n")) {
  const m = riga.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

// ── PROMPT COME L'APP (voce 78): il REGOLAMENTO statico va nel campo `system` (cache_control), lo
//    STATO ATTUALE volatile (calendario/settimane/medici) va nel messaggio user. run14 prima:
//    (a) infilava il regolamento nel messaggio user, (b) NON mandava affatto lo STATO ATTUALE →
//    testava un prompt che l'app non usa. Qui replico ESATTAMENTE la costruzione dell'app.
const src = fs.readFileSync(path.join(DIR, "turni-guardia-medica.jsx"), "utf8");
const sm = "const sys = `", si = src.indexOf(sm), bodyStart = si + sm.length;
const ei = src.indexOf("`", bodyStart); // la prima backtick chiude il template del regolamento (0 interpolazioni)
const sysBody = src.slice(bodyStart, ei);
const sysTesto = new Function("return `" + sysBody + "`;")(); // regolamento reso (processa gli escape), statico

// STATO ATTUALE fedele all'app (turni-guardia-medica.jsx righe 2158-2210), stato iniziale VUOTO (mese non elaborato).
const anno = 2026, mese = 7; // Agosto 2026
const DOW = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
const nG = new Date(anno, mese + 1, 0).getDate();
const calendario = {};
for (let d = 1; d <= nG; d++) {
  const info = turniDelGiorno(anno, mese, d, {});
  const tipo = info.festivo ? "festivo" : info.prefestivo ? "prefestivo" : info.weekend ? "weekend" : "feriale";
  calendario[`g${d}`] = `${DOW[info.dow]} ${tipo}${info.turni.some((t) => t.id === "G") ? " · diurno+notturno" : " · solo notturno"}`;
}
const seen = new Map();
for (let d = 1; d <= nG; d++) { const wk = settimanaDi(`${anno}-${String(mese + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`); if (!seen.has(wk)) seen.set(wk, d); }
const settimane = [...seen.entries()].map(([lunedi, giornoRappresentativo]) => ({ lunedi, giornoRappresentativo }));
const stato = {
  mese: `${MESI_IT[mese]} ${anno}`,
  calendario, settimane,
  medici: MEDICI_DEFAULT.map((m) => ({ nome: m.nome, categoria: CAT_INFO[m.cat].label, titolare: m.sedeContratto, graduatoria: m.grad, oreExtra: 0, turniExtra: 0, maxTurniMese: null, oreAssegnate: null, oreMancanti: null })),
  mmgAttivi: [], avvisiScenari: [], disponibilita: {},
  disponibilitaPresenti: Object.fromEntries(MEDICI_DEFAULT.map((m) => [m.nome, []])),
  slotObbligatoriPresenti: {}, azioniGiaEseguite: [], tettiSettimanali: {}, finestreSettimanali: {}, preferenzeTurno: {},
  schema: "non ancora elaborato",
};
const statoBlocco = `STATO ATTUALE: ${JSON.stringify(stato)}`;

const casi = [
  // CAT A — deve emettere turno_precedente
  { n: 1, cat: "A", email: "Bertuzzi ha fatto un notturno il 30 luglio", exp: { tp: { medico: "BERTUZZI", giorno: 30, turno: "N" } } },
  { n: 2, cat: "A", email: "segna che Foschiani ha coperto il 28 luglio", exp: { tp: { medico: "FOSCHIANI", giorno: 28, turno: null } } },
  { n: 3, cat: "A", email: "Zurlo ha lavorato la notte del 31 luglio", exp: { tp: { medico: "ZURLO", giorno: 31, turno: "N" } } },
  { n: 4, cat: "A", email: "Trigodko ha fatto il diurno il 27 luglio", exp: { tp: { medico: "TRIGODKO", giorno: 27, turno: "G" } } },
  // CAT B — NON deve MAI emettere turno_precedente
  { n: 5, cat: "B", email: "Sono Bekaeva, per agosto sono disponibile tutte le notti feriali a Maniago", exp: { noTp: true } },
  { n: 6, cat: "B", email: "Ciao, Martinetti. Il mese prossimo posso coprire i weekend a Spilimbergo", exp: { noTp: true } },
  { n: 7, cat: "B", email: "Valeri: a fine luglio ero in ferie, quindi per agosto sono disponibile solo dal 10 in poi", exp: { noTp: true } },
  { n: 8, cat: "B", email: "Pressacco, disponibile il 30 e 31 agosto per i notturni", exp: { noTp: true } },
  { n: 9, cat: "B", email: "Cervesato: come sai il mese scorso ho fatto pochi turni, quindi ad agosto vorrei recuperare, disponibile tutte le notti", exp: { noTp: true } },
  { n: 10, cat: "B", email: "De Candido, l'ultima settimana di luglio ho già lavorato parecchio, per agosto preferirei solo i weekend", exp: { noTp: true } },
  { n: 11, cat: "B", email: "Iengo qui. Confermo disponibilità 5, 12, 19 agosto notturni", exp: { noTp: true } },
  { n: 12, cat: "B", email: "Sono Morano, ho fatto il turno del 3 agosto l'anno scorso, quest'anno sono disponibile lo stesso giorno", exp: { noTp: true } },
  // CAT C — deve CHIEDERE il giorno, non inventarlo
  { n: 13, cat: "C", email: "Bertuzzi ha fatto un turno a luglio", exp: { chiede: true } },
  { n: 14, cat: "C", email: "segna che Merlino ha lavorato nella settimana a cavallo", exp: { chiede: true } },
  // BUG 10 (fedele a MAIL 42) — pin SOLO sui turni dichiarati: FOSCHIANI "solo notturni" + Ferragosto (G+N) → NIENTE pin sul diurno del 15
  { n: 42, cat: "BUG10", email: "Buongiorno, per agosto: Spilimbergo, tutti i notturni. Vorrei fare il Ferragosto, mi porto avanti così a Natale sto a casa. Se possibile anche il prefestivo del giorno prima, ma quello solo se non vi incasina i conti. Grazie, Foschiani", exp: { bug10: { medico: "FOSCHIANI", giorno: 15, turnoVietato: "G" } } },
  // BUG 11 (fedele a MAIL 45) — contraddizione aritmetica (tetto 3 vs minimi 2+2=4): NON deve fare NIENTE, solo segnalare
  { n: 45, cat: "BUG11", email: "Salve, agosto: Maniago, notturni. Massimo 3 turni in tutto il mese. Però la settimana del 10 vorrei farne almeno due, e anche quella del 24 almeno due — sono le settimane in cui mio marito è a casa e mi copre coi bambini. Se non torna, ditemelo che rivedo.", exp: { bug11: { medico: "BEKAEVA" } } },
  // COMBINATI (VOLUTI) — fuori-sede §3.1a + chiusura voce 96 nello STESSO caso: un TITOLARE dichiara una sede fisica
  // ≠ dalla sua titolarità (→ domanda di conferma) coprendo a distanza Claut/Anduins in un notturno FESTIVO (→ sede
  // chiusa quella notte, avviso). Il modello deve fare ENTRAMBE: avviso di chiusura E domanda fuori-sede con l'azione
  // in domande[].seSi (mai inserita in silenzio). Erano i casi 117/119/122/123 spariti con l'accoppiamento coerente.
  { n: 51, cat: "COMBO", email: "Il 8 notte sono a Spilimbergo e copro anche Anduins a distanza.\n\nMORANO", exp: { combo: { medico: "MORANO", sedeFisica: "Spilimbergo", sedeChiusa: "Anduins", giorno: 8 } } },
  { n: 52, cat: "COMBO", email: "Il 16 notte sono a Maniago e copro anche Claut a distanza.\n\nBERTUZZI", exp: { combo: { medico: "BERTUZZI", sedeFisica: "Maniago", sedeChiusa: "Claut", giorno: 16 } } },
  { n: 53, cat: "COMBO", email: "Il 15 notte sono a Maniago e copro anche Claut a distanza.\n\nVALERI", exp: { combo: { medico: "VALERI", sedeFisica: "Maniago", sedeChiusa: "Claut", giorno: 15 } } },
  { n: 54, cat: "COMBO", email: "Il 22 notte sono a Meduno e copro anche Anduins a distanza.\n\nMARTINETTI", exp: { combo: { medico: "MARTINETTI", sedeFisica: "Meduno", sedeChiusa: "Anduins", giorno: 22 } } },
];

// + CHIUSURA Claut/Anduins nei notturni festivi (voce 96/97), caricati dal corpus canonico
for (const c of generaCorpus().filter((x) => x.categoria === "chiusura_notturno")) {
  casi.push({ n: 100 + casi.length, cat: "CHIUSURA", email: c.email, medico: c.medico, exp: { closure: c.atteso } });
}

function parse(t) {
  let s = t.replace(/```json|```/g, "").trim(); let o = null;
  try { o = JSON.parse(s); } catch { const i0 = s.indexOf("{"), i1 = s.lastIndexOf("}"); if (i0 >= 0 && i1 > i0) { try { o = JSON.parse(s.slice(i0, i1 + 1)); } catch { o = null; } } }
  return o;
}
// raccoglitore ricorsivo: ogni slot_obbligatorio, ovunque sia (azioni, domande.seSi, domande.seNo)
function collectPins(obj) {
  const out = []; const walk = (x) => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") { if (x.az === "slot_obbligatorio") out.push(x); for (const k in x) walk(x[k]); } };
  walk(obj); return out;
}
// UNICO builder del body per ENTRAMBE le configurazioni: il campo `system` (regolamento + cache) è
// IDENTICO; l'unica differenza è il messaggio user — VEDENTE antepone lo STATO ATTUALE, BENDATO no.
function buildBody(email, vedente) {
  return {
    model: "claude-sonnet-5", max_tokens: 16000,
    output_config: { effort: "high" },                                              // come l'app (default high)
    system: [{ type: "text", text: sysTesto, cache_control: { type: "ephemeral" } }], // regolamento cacheabile (come l'app, voce 78) — IDENTICO nelle due config
    messages: [{ role: "user", content: vedente ? `${statoBlocco}\n\nRICHIESTA: ${email}` : `RICHIESTA: ${email}` }],
  };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(email, vedente) {
  // Resiliente: un blip di rete o un 429/529/5xx non deve far crollare le 90 chiamate. try/catch + 2 retry.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(buildBody(email, vedente)),
      });
      const data = await resp.json();
      if (resp.ok) return { txt: (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n") };
      if ([429, 500, 502, 503, 529].includes(resp.status) && attempt < 3) { await sleep(2000 * attempt); continue; }
      return { err: `HTTP ${resp.status}: ${data?.error?.message || ""}` };
    } catch (e) {
      if (attempt < 3) { await sleep(2000 * attempt); continue; }
      return { err: `THROW: ${e.message}` };
    }
  }
}
function valuta(caso, obj) {
  const azioni = (obj && obj.azioni) || [];
  const tps = azioni.filter((a) => a.az === "turno_precedente");
  const tipiAzioni = [...new Set(azioni.map((a) => a.az))];
  if (caso.exp.tp) {
    if (tps.length !== 1) return { ok: false, why: `attesa 1 turno_precedente, trovate ${tps.length} (azioni: ${tipiAzioni.join(",") || "nessuna"}; tipo=${obj?.tipo})` };
    const a = tps[0]; const e = caso.exp.tp;
    if ((a.medico || "").toUpperCase() !== e.medico) return { ok: false, why: `medico ${a.medico} ≠ ${e.medico}` };
    if (Number(a.giorno) !== e.giorno) return { ok: false, why: `giorno ${a.giorno} ≠ ${e.giorno}` };
    const turnoA = (a.turno === "N" || a.turno === "G") ? a.turno : null;
    if (turnoA !== e.turno) return { ok: false, why: `turno ${JSON.stringify(a.turno)} ≠ ${JSON.stringify(e.turno)}` };
    const altre = azioni.filter((x) => x.az !== "turno_precedente" && x.az !== "elabora");
    if (altre.length) return { ok: false, why: `azioni extra non attese: ${altre.map((x) => x.az).join(",")}` };
    return { ok: true, why: `turno_precedente ${a.medico} g${a.giorno} ${turnoA ?? "(omesso)"}` };
  }
  if (caso.exp.noTp) {
    if (tps.length) return { ok: false, why: `❌ turno_precedente EMESSO (vietato!): ${JSON.stringify(tps[0])}` };
    return { ok: true, why: `nessun turno_precedente (azioni: ${tipiAzioni.join(",") || "nessuna"}; tipo=${obj?.tipo})` };
  }
  if (caso.exp.chiede) {
    const inventato = tps.filter((a) => a.giorno != null);
    if (inventato.length) return { ok: false, why: `❌ ha inventato un giorno: ${JSON.stringify(inventato[0])}` };
    const haDomanda = (obj?.domande && obj.domande.length) || obj?.tipo === "risposta";
    if (!haDomanda && azioni.length === 0) return { ok: true, why: `nessuna azione, nessun giorno inventato (tipo=${obj?.tipo})` };
    if (haDomanda) return { ok: true, why: `chiede (tipo=${obj?.tipo}${obj?.testo ? ": " + obj.testo.slice(0, 80) : ""})` };
    return { ok: false, why: `non chiede né si astiene: tipo=${obj?.tipo}, azioni=${tipiAzioni.join(",")}` };
  }
  if (caso.exp.bug10) {
    // check: NESSUN slot_obbligatorio sul turno VIETATO (diurno 15) — ovunque compaia (azioni o domande.seSi/seNo)
    const e = caso.exp.bug10;
    const pinsVietati = collectPins(obj).filter((p) => Number(p.giorno) === e.giorno && p.turno === e.turnoVietato && p.presente !== false);
    if (pinsVietati.length) return { ok: false, why: `❌ pin sul giorno ${e.giorno} ${e.turnoVietato === "G" ? "DIURNO" : "notturno"} (slot senza disponibilità dichiarata): ${JSON.stringify(pinsVietati[0])}` };
    const pinsN = collectPins(obj).filter((p) => Number(p.giorno) === e.giorno && p.turno === "N" && p.presente !== false);
    return { ok: true, why: `nessun pin sul diurno del ${e.giorno}${pinsN.length ? " (pin sul notturno presente, corretto)" : " (nessun pin sul 15)"}` };
  }
  if (caso.exp.bug11) {
    // check SEVERO (richiesto): davanti a una mail aritmeticamente contraddittoria il modello NON deve
    // emettere NESSUNA azione — solo segnalare/chiedere. PASS ⟺ zero azioni E la contraddizione è segnalata.
    const avvisi = Array.isArray(obj?.avvisi) ? obj.avvisi : [];
    const rosso = avvisi.some((a) => a && /ross|red/i.test(String(a.livello || "")));
    const scanTxt = `${obj?.spiegazione || ""} ${obj?.testo || ""} ${avvisi.map((a) => a?.testo || "").join(" ")} ${(obj?.domande || []).map((d) => `${d?.domanda || ""} ${d?.situazione || ""}`).join(" ")}`;
    const segnala = rosso || /incompatibil|contraddi|impossibil|non torna|non ho inserito|non inserito|prevale|somma/i.test(scanTxt);
    if (azioni.length > 0) return { ok: false, why: `❌ ha emesso azioni davanti a una contraddizione (deve fare NIENTE): ${tipiAzioni.join(",")}` };
    if (!segnala) return { ok: false, why: `❌ nessuna segnalazione della contraddizione (né avviso rosso né domanda: tipo=${obj?.tipo})` };
    return { ok: true, why: `zero azioni + contraddizione segnalata (${rosso ? "avviso rosso" : "in testo/domanda"})` };
  }
  if (caso.exp.combo) {
    // COMBINATO: pretende ENTRAMBE — (1) avviso di chiusura E (2) domanda fuori-sede con l'azione in domande[].seSi
    // (mai inserita in silenzio nelle azioni). Fallire una sola delle due = FAIL.
    const e = caso.exp.combo;
    const avvisi = Array.isArray(obj?.avvisi) ? obj.avvisi : [];
    const domande = Array.isArray(obj?.domande) ? obj.domande : [];
    const avvTxt = `${obj?.spiegazione || ""} ${obj?.testo || ""} ${avvisi.map((a) => a?.testo || "").join(" ")} ${domande.map((d) => `${d?.domanda || ""} ${d?.situazione || ""}`).join(" ")}`.toLowerCase();
    const chiusuraOk = avvTxt.includes("chius");
    const matchDispo = (a) => (a?.az === "dispo_aggiungi" || a?.az === "dispo_set")
      && (a.medico || "").toUpperCase() === e.medico
      && (a.sedi || []).includes(e.sedeFisica) && (a.blu || []).includes(e.sedeChiusa);
    const dispoInSeSi = domande.some((d) => Array.isArray(d.seSi) && d.seSi.some(matchDispo));
    const azSilente = azioni.some(matchDispo);
    if (!chiusuraOk) return { ok: false, why: `❌ manca l'avviso di CHIUSURA (${e.sedeChiusa} chiusa il notturno del ${e.giorno})` };
    if (!dispoInSeSi) return { ok: false, why: `❌ manca la DOMANDA fuori-sede con l'azione in domande[].seSi${azSilente ? " — inserita in SILENZIO nelle azioni!" : " (azioni: nessuna corrispondente)"}` };
    return { ok: true, why: `ENTRAMBE: avviso chiusura + domanda fuori-sede (azione in seSi)${azSilente ? " ⚠️ ma anche in azioni" : ""}` };
  }
  if (caso.exp.closure) {
    const A = caso.exp.closure, med = caso.exp.medico;
    // Legge le azioni OVUNQUE stiano: `azioni` E `domande[].seSi`. Se il modello CHIEDE conferma invece di
    // inserire in silenzio (es. fuori-sede §3.1a) l'azione proposta vale come emessa — è un successo, non un
    // fallimento. Stesso punto cieco del guard-pin (scandaglia anche le domande).
    const azioniOvunque = [...azioni, ...((obj?.domande) || []).flatMap((d) => Array.isArray(d.seSi) ? d.seSi : [])];
    const has = (spec) => azioniOvunque.some((a) => a.az === spec.az
      && (a.medico || med).toUpperCase() === (spec.match.medico || med).toUpperCase()
      && (spec.match.blu || []).every((s) => (a.blu || []).includes(s))
      && (spec.match.sedi || []).every((s) => (a.sedi || []).includes(s)));
    for (const spec of A.azioniRichieste || []) if (!has(spec)) return { ok: false, why: `azione mancante: ${spec.az} blu=${JSON.stringify(spec.match.blu)} sedi=${JSON.stringify(spec.match.sedi)} (azioni: ${tipiAzioni.join(",") || "nessuna"})` };
    const avvTxt = `${obj?.spiegazione || ""} ${obj?.testo || ""} ${((obj?.avvisi) || []).map((x) => x?.testo || "").join(" ")}`.toLowerCase();
    if (A.avvisoRichiesto && !A.avvisoRichiesto.contiene.every((k) => avvTxt.includes(k.toLowerCase()))) return { ok: false, why: `avviso di chiusura MANCANTE (atteso contiene: ${A.avvisoRichiesto.contiene.join(",")})` };
    if (A.avvisoVietato && A.avvisoVietato.contiene.every((k) => avvTxt.includes(k.toLowerCase()))) return { ok: false, why: `❌ CONTROLLO NEGATIVO: avviso di chiusura PRESENTE su un notturno feriale (avvisa sempre!)` };
    return { ok: true, why: `blu registrata; avviso di chiusura ${A.avvisoRichiesto ? "presente" : "assente"} (corretto)` };
  }
  return { ok: false, why: "spec ignota" };
}

// DRY=1 → nessuna chiamata API: verifica forma del payload + self-test dei check nuovi, poi esce.
if (process.env.DRY) {
  console.log("system[0].text (regolamento) len:", sysTesto.length, "| contiene chiusura+avvisi:", /chius/i.test(sysTesto) && /avvisi/i.test(sysTesto));
  console.log("user msg = STATO ATTUALE + RICHIESTA | statoBlocco len:", statoBlocco.length);
  console.log("  calendario.g15:", stato.calendario.g15, "| settimane:", stato.settimane.length, "| medici:", stato.medici.length);
  console.log("  FOSCHIANI titolare:", stato.medici.find((m) => m.nome === "FOSCHIANI")?.titolare, "| BEKAEVA titolare:", stato.medici.find((m) => m.nome === "BEKAEVA")?.titolare);
  const t = (name, c, o, want) => { const v = valuta(c, o); console.log(v.ok === want ? "  ✓" : "  ✗ ATTESO " + want, name, "→", v.ok, "·", v.why.slice(0, 70)); };
  const c10 = { exp: { bug10: { medico: "FOSCHIANI", giorno: 15, turnoVietato: "G" } } };
  t("bug10 pin su G15 → deve FALLIRE", c10, { azioni: [{ az: "slot_obbligatorio", medico: "FOSCHIANI", giorno: 15, turno: "G" }] }, false);
  t("bug10 pin (in domande.seSi) solo N15 → PASSA", c10, { domande: [{ seSi: [{ az: "slot_obbligatorio", medico: "FOSCHIANI", giorno: 15, turno: "N" }] }] }, true);
  t("bug10 nessun pin → PASSA", c10, { azioni: [] }, true);
  const c11 = { exp: { bug11: { medico: "BEKAEVA" } } };
  t("bug11 emette tetto_mese → deve FALLIRE", c11, { azioni: [{ az: "tetto_mese", maxTurni: 3 }], avvisi: [] }, false);
  t("bug11 zero azioni + avviso rosso → PASSA", c11, { azioni: [], avvisi: [{ livello: "rosso", testo: "numeri incompatibili, non ho inserito nulla" }] }, true);
  t("bug11 zero azioni ma nessun flag → deve FALLIRE", c11, { azioni: [], avvisi: [] }, false);
  const cc = { exp: { combo: { medico: "MORANO", sedeFisica: "Spilimbergo", sedeChiusa: "Anduins", giorno: 8 } } };
  t("combo avviso+domanda(seSi) → PASSA", cc, { avvisi: [{ livello: "info", testo: "Anduins è chiusa quella notte" }], domande: [{ domanda: "MORANO è titolare di Maniago, confermi Spilimbergo?", seSi: [{ az: "dispo_aggiungi", medico: "MORANO", sedi: ["Spilimbergo"], blu: ["Anduins"] }] }] }, true);
  t("combo manca avviso → deve FALLIRE", cc, { domande: [{ seSi: [{ az: "dispo_aggiungi", medico: "MORANO", sedi: ["Spilimbergo"], blu: ["Anduins"] }] }] }, false);
  t("combo inserita in azioni (silenzio) → deve FALLIRE", cc, { avvisi: [{ livello: "info", testo: "chiusa" }], azioni: [{ az: "dispo_aggiungi", medico: "MORANO", sedi: ["Spilimbergo"], blu: ["Anduins"] }] }, false);
  console.log("\ncasi totali:", casi.length, "→", casi.length, "× 3 giri (solo vedente) =", casi.length * 3, "chiamate");
  process.exit(0);
}

// DUMP=<n> → scrive i due payload COMPLETI del caso n (bendato/vedente) e prova che l'unica differenza è STATO ATTUALE.
if (process.env.DUMP) {
  const caso = casi.find((c) => c.n === Number(process.env.DUMP)) || casi[0];
  const b = buildBody(caso.email, false), v = buildBody(caso.email, true);
  const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
  fs.writeFileSync(`${DIR}/payload_bendato.json`, JSON.stringify(b, null, 2));
  fs.writeFileSync(`${DIR}/payload_vedente.json`, JSON.stringify(v, null, 2));
  console.log(`CASO ${caso.n} (${caso.cat})\n`);
  console.log("── campo `system` (regolamento) — deve essere IDENTICO nelle due config ──");
  console.log("  BENDATO  len:", b.system[0].text.length, "sha256:", sha(b.system[0].text).slice(0, 16));
  console.log("  VEDENTE  len:", v.system[0].text.length, "sha256:", sha(v.system[0].text).slice(0, 16));
  console.log("  IDENTICO:", sha(b.system[0].text) === sha(v.system[0].text) ? "✅ sì" : "❌ NO");
  console.log("  cache_control BENDATO:", JSON.stringify(b.system[0].cache_control), "| VEDENTE:", JSON.stringify(v.system[0].cache_control));
  console.log("  model/max_tokens/effort identici:", b.model === v.model && b.max_tokens === v.max_tokens && b.output_config.effort === v.output_config.effort ? "✅ sì" : "❌ NO");
  console.log("\n── messaggio USER — l'UNICA differenza ──");
  console.log("  BENDATO user len:", b.messages[0].content.length, "| VEDENTE user len:", v.messages[0].content.length);
  console.log("\n========= USER MSG · BENDATO (intero) =========\n" + b.messages[0].content);
  console.log("\n========= USER MSG · VEDENTE (intero) =========\n" + v.messages[0].content);
  console.log(`\n(payload completi — regolamento incluso — scritti in payload_bendato.json / payload_vedente.json)`);
  process.exit(0);
}

// SMOKE=<n> → UNA sola chiamata (caso n, VEDENTE) e stampa la risposta grezza + esito parse/valuta, poi esce.
if (process.env.SMOKE) {
  const caso = casi.find((c) => c.n === Number(process.env.SMOKE)) || casi[0];
  console.log(`SMOKE caso ${caso.n} (${caso.cat}) · VEDENTE · 1 chiamata\n`);
  const r = await call(caso.email, true);
  if (r.err) { console.log("❌ ERRORE HTTP:", r.err); process.exit(1); }
  console.log("========= RISPOSTA GREZZA =========\n" + r.txt + "\n===================================");
  const obj = parse(r.txt);
  console.log("\nparse JSON:", obj ? "✅ valido" : "❌ NON parsabile");
  if (obj) { const v = valuta(caso, obj); console.log("valuta:", v.ok ? "✅ PASS" : "❌ FAIL", "·", v.why); console.log("chiavi top-level:", Object.keys(obj).join(", ")); }
  process.exit(0);
}

// Temp=1.0 (non abbassabile): un run solo non prova niente → 3 giri, stabilità per caso.
// SOLO VEDENTE: è la configurazione dell'app; il bendato ha finito il suo lavoro (delta test-artifact spiegato).
const ROUNDS = 3;
const CONFIGS = [{ nome: "VEDENTE", vedente: true }];
const perCaso = new Map();
const ensure = (caso) => { if (!perCaso.has(caso.n)) perCaso.set(caso.n, { caso, cfg: Object.fromEntries(CONFIGS.map((c) => [c.nome, { oks: [], whys: [], raws: [] }])) }); return perCaso.get(caso.n); };
// CHECKPOINT + RESUME: ogni chiamata viene APPESA subito a run14_ckpt.jsonl. Se il processo muore, niente è
// perso; al rilancio (senza cancellare il ckpt) le chiamate già fatte si saltano — non si ri-paga. Per un run
// NUOVO il ckpt va cancellato prima (lo faccio nel comando di lancio).
const CKPT = `${DIR}/run14_ckpt.jsonl`;
const byN = Object.fromEntries(casi.map((c) => [c.n, c]));
const done = new Set();
if (fs.existsSync(CKPT)) {
  for (const line of fs.readFileSync(CKPT, "utf8").split("\n")) {
    if (!line.trim()) continue; let o; try { o = JSON.parse(line); } catch { continue; }
    const caso = byN[o.n]; if (!caso) continue; const e = ensure(caso).cfg[o.cfg]; if (!e) continue;
    e.oks.push(o.ok); e.whys.push(o.why); e.raws.push(o.raw || ""); done.add(`${o.cfg}|${o.round}|${o.n}`);
  }
  console.log(`RESUME: ${done.size} chiamate già nel checkpoint → le salto.`);
}
// ONLY=<n,n,...|CAT> → gira solo un sottoinsieme (per rimisurare un fix mirato senza ripagare tutto).
const onlySet = process.env.ONLY ? new Set(process.env.ONLY.split(",").map((s) => s.trim())) : null;
const casiRun = onlySet ? casi.filter((c) => onlySet.has(String(c.n)) || onlySet.has(c.cat)) : casi;
for (const cfg of CONFIGS) {
  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`\n───────── ${cfg.nome} · ROUND ${round}/${ROUNDS} ─────────`);
    for (const caso of casiRun) {
      const key = `${cfg.nome}|${round}|${caso.n}`;
      if (done.has(key)) { console.log(`[${caso.n}] ${caso.cat} ⏭ (checkpoint)`); continue; }
      const r = await call(caso.email, cfg.vedente);
      const v = r.err ? { ok: false, why: r.err } : valuta(caso, parse(r.txt));
      const e = ensure(caso).cfg[cfg.nome]; e.oks.push(v.ok); e.whys.push(v.why); e.raws.push(r.txt || "");
      fs.appendFileSync(CKPT, JSON.stringify({ cfg: cfg.nome, round, n: caso.n, cat: caso.cat, ok: v.ok, why: v.why, raw: r.txt || r.err || "" }) + "\n"); // SALVA dopo OGNI chiamata
      done.add(key);
      console.log(`[${caso.n}] ${caso.cat} ${v.ok ? "✅" : "❌"} ${v.why}`);
    }
  }
}
const cnt = (a) => a.filter(Boolean).length;
console.log(`\n========== RIEPILOGO (n/${ROUNDS}) — ${CONFIGS.map((c) => c.nome).join(" · ")} ==========`);
console.log(`caso  cat        ${CONFIGS.map((c) => c.nome.padEnd(8)).join("")} instabile`);
const instabili = [];
for (const { caso, cfg } of [...perCaso.values()].sort((a, b) => a.caso.n - b.caso.n)) {
  const ns = CONFIGS.map((c) => cnt(cfg[c.nome].oks));
  const inst = ns.some((n) => n !== 0 && n !== ROUNDS);
  if (inst) instabili.push(caso.n);
  console.log(`[${String(caso.n).padStart(3)}] ${caso.cat.padEnd(9)}  ${ns.map((n) => `${n}/${ROUNDS}    `).join("")} ${inst ? "⚠️" : ""}`);
}
for (const c of CONFIGS) {
  const solidi = [...perCaso.values()].filter((x) => cnt(x.cfg[c.nome].oks) === ROUNDS).length;
  const rossi = [...perCaso.values()].filter((x) => cnt(x.cfg[c.nome].oks) === 0).length;
  console.log(`\n${c.nome}: solidi 3/3 = ${solidi}/${perCaso.size} · sempre-rossi 0/3 = ${rossi}/${perCaso.size}`);
}
console.log(`instabili (≠0 e ≠${ROUNDS}): ${instabili.length ? instabili.join(", ") : "nessuno"}`);
fs.writeFileSync(`${DIR}/run14_out.json`,
  JSON.stringify([...perCaso.values()].map(({ caso, cfg }) => ({ n: caso.n, cat: caso.cat, email: caso.email, vedente: cnt(cfg.VEDENTE.oks), rounds: ROUNDS, whysVedente: cfg.VEDENTE.whys, rawsVedente: cfg.VEDENTE.raws })), null, 2));
