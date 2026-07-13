const { useState, useMemo, useRef, useEffect } = React;

// ============ DATI SIMULAZIONE ============
// MEDICI è modificabile dall'interfaccia (tab Medici): la lista di default viene
// sovrascritta da quella salvata nello store, tramite setMediciGlobal.
// sedeContratto: OBBLIGATORIA per ogni contrattualizzato (INDET, DET38, DET24, DET12ASAP, DET12) —
// "Maniago" | "Spilimbergo", mai null per loro. Solo i senza incarico (SENZA) non hanno titolarità
// (sedeContratto sempre null). Vedi CONTEXT.md §3.1a per la regola di titolarità.
const MEDICI_DEFAULT = [
  // 8 TITOLARI DETERMINATI (5 Maniago + 3 Spilimbergo)
  { id: 1, nome: "ZURLO", grad: 2, cat: "DET38", sedeContratto: "Maniago" },
  { id: 2, nome: "TRIGODKO", grad: 4, cat: "DET24", sedeContratto: "Maniago" },
  { id: 3, nome: "PITAU", grad: 14, cat: "DET24", sedeContratto: "Maniago" },
  { id: 4, nome: "BEKAEVA", grad: 17, cat: "DET24", sedeContratto: "Maniago" },
  { id: 5, nome: "MORANO", grad: 72, cat: "DET12", sedeContratto: "Maniago" },
  { id: 6, nome: "FOSCHIANI", grad: 3, cat: "DET38", sedeContratto: "Spilimbergo" },
  { id: 7, nome: "MARTINETTI", grad: 5, cat: "DET24", sedeContratto: "Spilimbergo" },
  { id: 8, nome: "VALERI", grad: 25, cat: "DET12ASAP", sedeContratto: "Spilimbergo" },
  // 1 INDET fuori graduatoria ufficiale
  { id: 9, nome: "BERTUZZI", grad: 108, cat: "INDET", sedeContratto: "Spilimbergo" },
  // 5 SENZA INCARICO (nessuna titolarità)
  { id: 10, nome: "PRESSACCO", grad: 57, cat: "SENZA", sedeContratto: null },
  { id: 11, nome: "CERVESATO", grad: 63, cat: "SENZA", sedeContratto: null },
  { id: 12, nome: "DE CANDIDO", grad: 83, cat: "SENZA", sedeContratto: null },
  { id: 13, nome: "MERLINO", grad: 105, cat: "SENZA", sedeContratto: null },
  { id: 14, nome: "IENGO", grad: 107, cat: "SENZA", sedeContratto: null },
];
let MEDICI = MEDICI_DEFAULT.map((m) => ({ ...m }));
let byId = Object.fromEntries(MEDICI.map((m) => [m.id, m]));
// Sostituisce la lista medici globale (usata da motore e UI). Idempotente:
// può essere chiamata a ogni render senza effetti collaterali.
const setMediciGlobal = (list) => {
  MEDICI = list.map((m) => ({ ...m }));
  byId = Object.fromEntries(MEDICI.map((m) => [m.id, m]));
};

// prio: livello di priorità di categoria. DET24 e DET12ASAP condividono LO STESSO prio (3) —
// non sono in relazione di priorità tra loro: i conflitti tra i due si risolvono direttamente
// con debito → graduatoria, esattamente come tra due medici della stessa categoria (CONTEXT.md §3.1).
const CAT_INFO = {
  INDET:    { label: "Indet.",        prio: 1, ore: 96,  color: "#1a5c4a", bg: "#e3f2ec" },
  DET38:    { label: "Det. 38h",      prio: 2, ore: 168, color: "#8a5a00", bg: "#fdf3dd" },
  DET24:    { label: "Det. 24h",      prio: 3, ore: 104, color: "#a06b00", bg: "#fef7e8" },
  DET12ASAP:{ label: "Det. 12h ASAP", prio: 3, ore: 52,  color: "#6b4c9a", bg: "#efe8f7" },
  DET12:    { label: "Det. 12h",      prio: 4, ore: 52,  color: "#4a708a", bg: "#e8eff5" },
  SENZA:    { label: "Senza inc.",    prio: 5, ore: null, color: "#5b5b6b", bg: "#eeeef2" },
};
const isDeterminato = (mid) => ["DET38", "DET24", "DET12ASAP", "DET12"].includes(byId[mid].cat);
// Contrattualizzato = ha un monte ore (tutte le categorie tranne SENZA incarico) — INDET incluso.
// Usato per la titolarità di sede (§3.1a): OBBLIGATORIA e universale tra tutti i contrattualizzati,
// non solo tra i determinati (isDeterminato resta distinto, usato altrove per il solo confronto
// tra categorie determinate).
const isContrattualizzato = (mid) => CAT_INFO[byId[mid].cat].ore !== null;

const SEDI5 = ["Maniago", "Spilimbergo", "Meduno", "Claut", "Anduins"];
const SEDI_BREVI = { Maniago: "MA", Spilimbergo: "SP", Meduno: "ME", Claut: "CL", Anduins: "AN" };
const CDC = ["Maniago", "Spilimbergo"]; // le 2 sedi fisiche sempre prioritarie

// ============ CALENDARIO ============
const dk = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const mk = (y, m) => `${y}-${m}`;

// Pasqua (algoritmo di Gauss, calendario gregoriano) — valido per qualsiasi anno.
// Restituisce { mese, giorno } con mese 0-indicizzato (2=marzo, 3=aprile), coerente col resto del file.
function pasquaDi(anno) {
  const a = anno % 19, b = Math.floor(anno / 100), c = anno % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const meseUno = Math.floor((h + l - 7 * m + 114) / 31); // 1-indicizzato: 3=marzo, 4=aprile
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return { mese: meseUno - 1, giorno };
}
// Festivi nazionali italiani fissi + Pasqua/Pasquetta (calcolata) per un singolo anno.
function festiviFissiDi(anno) {
  const map = {};
  const add = (m, d, label) => { map[dk(anno, m, d)] = label; };
  add(0, 1, "CAPODANNO"); add(0, 6, "EPIFANIA");
  const pasqua = pasquaDi(anno);
  map[dk(anno, pasqua.mese, pasqua.giorno)] = "PASQUA";
  const pasquetta = new Date(anno, pasqua.mese, pasqua.giorno + 1);
  map[dk(pasquetta.getFullYear(), pasquetta.getMonth(), pasquetta.getDate())] = "PASQUETTA";
  add(3, 25, "25 APRILE"); add(4, 1, "1 MAGGIO"); add(5, 2, "2 GIUGNO");
  add(7, 15, "FERRAGOSTO"); add(10, 1, "OGNISSANTI"); add(11, 8, "IMMACOLATA");
  add(11, 25, "NATALE"); add(11, 26, "S.STEFANO");
  add(11, 31, "31 DICEMBRE"); // festivo a sé per ASFO (non un festivo nazionale italiano): il suo
  // prefestivo è il 30 dicembre, non va confuso con l'essere semplicemente il giorno prima di Capodanno.
  return map;
}
const MESI_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const MESI_BREVI = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
const GIORNI_IT = ["DOMENICA","LUNEDI'","MARTEDI'","MERCOLEDI'","GIOVEDI'","VENERDI'","SABATO"];
const GIORNI_BREVI = ["DO","LU","MA","ME","GI","VE","SA"];

const MESI_DISPONIBILI = [];
{ let y = 2026, m = 7;
  while (y < 2036 || (y === 2036 && m <= 11)) {
    MESI_DISPONIBILI.push({ anno: y, mese: m });
    m++; if (m > 11) { m = 0; y++; }
  }
}
// FESTIVI_MAP/PREFESTIVI generati per l'intero intervallo coperto da MESI_DISPONIBILI (2026-2036),
// più un anno extra (2037) solo per calcolare correttamente il prefestivo del 31 dicembre 2036
// (giorno precedente al Capodanno 2037). Nessun limite di anni: festiviFissiDi funziona per
// qualsiasi anno tramite l'algoritmo di Gauss per Pasqua.
const FESTIVI_MAP = {};
for (let anno = 2026; anno <= 2037; anno++) Object.assign(FESTIVI_MAP, festiviFissiDi(anno));
const PREFESTIVI = new Set(Object.keys(FESTIVI_MAP).map((key) => {
  const [y, m, d] = key.split("-").map(Number);
  const prec = new Date(y, m - 1, d - 1); // giorno precedente a ogni festivo
  return dk(prec.getFullYear(), prec.getMonth(), prec.getDate());
}));

function turniDelGiorno(y, m, d, extras) {
  const key = dk(y, m, d);
  const dow = new Date(y, m, d).getDay();
  const festivo = FESTIVI_MAP[key];
  const prefestivo = PREFESTIVI.has(key);
  const weekend = dow === 0 || dow === 6;
  const turni = [];
  const ex = (extras && extras[key]) || {};
  if (ex.M) turni.push({ id: "M", label: "MATTINA MMG 8-14", ore: 6, extra: true });
  if (festivo || prefestivo || weekend) {
    let lbl = "DIURNO 8-20";
    if (festivo) lbl = "SUPERFESTIVO DIURNO 08-20";
    else if (prefestivo) lbl = "PREFESTIVO(SUPER) DIURNO 8-20";
    turni.push({ id: "G", label: lbl, ore: 12 });
  }
  if (ex.P) turni.push({ id: "P", label: "POMERIGGIO MMG 14-20", ore: 6, extra: true });
  let nlbl = "NOTTURNO";
  if (festivo) nlbl = "SUPERFESTIVO NOTTURNO 20-08";
  else if (prefestivo) nlbl = "PREFESTIVO(SUPER) NOTTURNO 20-08";
  turni.push({ id: "N", label: nlbl, ore: 12 });
  return { turni, festivo, prefestivo, weekend, key, dow };
}

// Espande un "ambito" (insieme di giorni dichiarato in modo compatto, es. "notturni feriali",
// "weekend", "tutto il mese", "dal 3 al 7") nei singoli slot {giorno, turno}, usando ESCLUSIVAMENTE
// le funzioni calendario deterministiche del motore (turniDelGiorno / FESTIVI_MAP / PREFESTIVI): così
// il calcolo dei giorni non dipende più dal ragionamento "a mente" dell'AI (che ogni tanto salta un
// giorno) ed è sempre esatto. NON tocca la logica di assegnazione: serve solo a costruire la dispo.
//   ambito: "feriali" | "weekend" | "mese" | { da:X, a:Y } | { giorni_settimana: ... }
//     - "feriali" = feriale semplice: NON weekend, NON festivo, NON prefestivo (i feriali hanno solo N)
//     - "weekend"  = sabato o domenica (dow 0/6), come turniDelGiorno.weekend (un festivo INFRASETTIMANALE
//                    non rientra né in "feriali" né in "weekend": va dichiarato a parte o via "mese"/intervallo)
//     - "mese"     = ogni giorno del mese
//     - { da, a }  = i giorni da X a Y inclusi (robusto anche se da>a)
//     - { giorni_settimana } = giorni della settimana NOMINATI dal medico ("il lunedì", "da martedì a
//                    giovedì"): il motore calcola le date esatte del mese (l'AI non le elenca). Due forme:
//                    elenco { giorni_settimana: ["lun","mer"] } oppure intervallo { giorni_settimana:
//                    { da:"mar", a:"gio" } } (espanso in ordine lun→dom, con wraparound: ven→lun = ven,sab,
//                    dom,lun). Token = prime 3 lettere ("lun"="lunedì"), sconosciuti ignorati. Match sul dow
//                    (getDay), INDIPENDENTE da festivo/prefestivo: un giorno-settimana che cade su un festivo
//                    infrasettimanale è incluso e ha anche G (a differenza di "feriali", che lo esclude).
//   turniRichiesti: sottoinsieme di ["G","N"] (mai MMG). Per ogni giorno si applicano SOLO i turni
//     richiesti che ESISTONO davvero quel giorno (intersezione con turniDelGiorno(...).turni): quindi
//     "feriali" con ["N"] dà solo N, e un "G" richiesto su un feriale viene ignorato (rete di sicurezza).
//   escludi: numeri-giorno da saltare del tutto (NO/assenze dichiarate).
//   anno, mese(0-based), extras: contesto calendario (extras influiscono solo sugli MMG, non su G/N).
// Ritorna [{giorno, turno}] deterministico: giorni crescenti, turni nell'ordine G poi N.
function espandiAmbito(ambito, turniRichiesti, escludi, anno, mese, extras) {
  const nG = new Date(anno, mese + 1, 0).getDate();
  const esclSet = new Set((escludi || []).map(Number));
  const richiesti = (turniRichiesti && turniRichiesti.length ? turniRichiesti : ["N"]).filter((t) => t === "G" || t === "N");
  const ordineTurni = ["G", "N"];
  // Ambito { giorni_settimana }: precalcola UNA volta l'insieme dei dow (getDay) da includere.
  // Elenco ["lun","mer"] oppure intervallo { da:"mar", a:"gio" } espanso in ordine lun→dom con wraparound.
  let dowSet = null;
  if (ambito && typeof ambito === "object" && ambito.giorni_settimana != null) {
    const ORD = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"]; // ordine settimanale per gli intervalli
    const TOK = { lun: 1, mar: 2, mer: 3, gio: 4, ven: 5, sab: 6, dom: 0 }; // token → getDay (0=dom..6=sab)
    const tok = (x) => String(x == null ? "" : x).trim().toLowerCase().slice(0, 3);
    dowSet = new Set();
    const gs = ambito.giorni_settimana;
    if (Array.isArray(gs)) {
      for (const x of gs) { const dv = TOK[tok(x)]; if (dv != null) dowSet.add(dv); }
    } else if (gs && typeof gs === "object" && gs.da != null && gs.a != null) {
      const pa = ORD.indexOf(tok(gs.da)), pb = ORD.indexOf(tok(gs.a));
      if (pa >= 0 && pb >= 0) for (let i = pa; ; i = (i + 1) % 7) { dowSet.add(TOK[ORD[i]]); if (i === pb) break; }
    }
  }
  const inAmbito = (d, info) => {
    if (ambito === "mese") return true;
    if (ambito === "feriali") return !info.weekend && !info.festivo && !info.prefestivo;
    if (ambito === "weekend") return info.weekend;
    if (dowSet) return dowSet.has(info.dow); // giorni della settimana nominati: match sul dow, indipendente da festivo/prefestivo
    if (ambito && typeof ambito === "object" && ambito.da != null && ambito.a != null) {
      const da = Math.min(Number(ambito.da), Number(ambito.a));
      const a = Math.max(Number(ambito.da), Number(ambito.a));
      return d >= da && d <= a;
    }
    return false;
  };
  const out = [];
  for (let d = 1; d <= nG; d++) {
    if (esclSet.has(d)) continue;
    const info = turniDelGiorno(anno, mese, d, extras);
    if (!inAmbito(d, info)) continue;
    const idsEsistenti = new Set(info.turni.map((t) => t.id));
    for (const t of ordineTurni) if (richiesti.includes(t) && idsEsistenti.has(t)) out.push({ giorno: d, turno: t });
  }
  return out;
}

// Dato l'elenco di slot già espansi (da espandiAmbito) + il contesto calendario, restituisce i GIORNI
// "a sorpresa": feriali INFRASETTIMANALI (NON weekend) che però cadono su festivo/prefestivo, quindi hanno
// anche il turno diurno (G) — ma G NON è tra gli slot inseriti (es. giorni-settimana con solo N). Sono i
// giorni per cui il diurno esiste ma non è stato messo: vanno SEGNALATI al coordinatore (non aggiunti
// d'ufficio). Pura, di solo calendario: nessun effetto sull'assegnazione. Ritorna [giorno] crescente.
function diurniNascosti(slots, anno, mese, extras) {
  const turniPerGiorno = new Map();
  for (const s of slots) { if (!turniPerGiorno.has(s.giorno)) turniPerGiorno.set(s.giorno, new Set()); turniPerGiorno.get(s.giorno).add(s.turno); }
  const out = [];
  for (const g of [...turniPerGiorno.keys()].sort((a, b) => a - b)) {
    const info = turniDelGiorno(anno, mese, g, extras);
    // festivo/prefestivo MA non weekend (il diurno del weekend non è "a sorpresa"); il diurno esiste ma non è inserito
    if ((info.festivo || info.prefestivo) && !info.weekend && info.turni.some((t) => t.id === "G") && !turniPerGiorno.get(g).has("G")) out.push(g);
  }
  return out;
}

// Costruisce l'entry di dispo (verde/blu + livelli) a partire da un'azione dell'AI (campi: sedi, blu,
// sedi_liv, blu_liv). È il CUORE CONDIVISO da dispo_aggiungi (un solo slot) e da dispo_set (stessa entry
// replicata su ogni slot dell'ambito): la logica di validazione sedi/livelli è UNA sola, quindi le due
// azioni restano equivalenti per costruzione.
//   etichetta: stringa usata SOLO nei messaggi d'errore (es. "ZURLO g5" oppure "ZURLO (feriali)").
// Ritorna { entry, errori }: entry=null se non c'è nessuna sede valida (né verde né blu); errori è
// la lista (eventualmente vuota) dei messaggi da mostrare (sedi non valide).
function costruisciEntryDispo(a, etichetta) {
  const errori = [];
  const verde = (a.sedi || []).filter((s) => SEDI5.includes(s));
  const blu = (a.blu || []).filter((s) => SEDI5.includes(s) && !verde.includes(s));
  if (!verde.length && !blu.length) { errori.push(`sedi non valide per ${etichetta}`); return { entry: null, errori }; }
  // sedi_liv / blu_liv opzionali dall'AI: {sede:livello} — default 1 per le sedi non specificate
  const verdeLiv = {};
  verde.forEach((s) => { verdeLiv[s] = (a.sedi_liv && a.sedi_liv[s]) ? Number(a.sedi_liv[s]) : 1; });
  const bluLiv = {};
  blu.forEach((s) => { bluLiv[s] = (a.blu_liv && a.blu_liv[s]) ? Number(a.blu_liv[s]) : 1; });
  return { entry: { verde, verdeLiv, blu, bluLiv, no: false }, errori };
}

// ============ MOTORE ============
// dispo[mid][slotKey] = { verde:[sedi], verdeLiv:{sede:1..5}, blu:[sedi], bluLiv:{sede:1..4}, no:bool }
// - verde: sedi FISICHE desiderate, in ordine di preferenza (livelli 1..5, livelli PARI = sedi
//   indifferenti per il medico: il motore può spostarlo liberamente tra loro per massimizzare le
//   coperture; livello più basso = sede che ha diritto di tenere contro chi non lo supera in gerarchia.
//   La parità di livello NON rende due sedi davvero equivalenti tra loro: il motore prova sempre
//   prima quella che viene prima nell'ordine fisso SEDI5, cioè Maniago → Spilimbergo → Meduno →
//   Claut → Anduins, indipendentemente dall'ordine in cui il medico le ha dichiarate — vedi
//   ordinaPerLivello e CONTEXT.md §3.3)
// - blu: sedi che il medico è disposto a COPRIRE A DISTANZA dalla sede fisica su cui viene
//   assegnato, secondo il vincolo territoriale (Claut coperibile solo dal fisico di Maniago,
//   Anduins solo da Spilimbergo o Meduno — vedi puoCoprireADistanza e CONTEXT.md §3.2),
//   in ordine di preferenza (livelli 1..4; stessa regola di tie-break per pari livello
//   dell'ordine fisso SEDI5, tramite lo stesso ordinaPerLivello). Nessuna copertura a distanza è
//   automatica: serve sempre una dichiarazione blu esplicita. Un medico copre al massimo 1 sede a
//   distanza (la prima disponibile nel suo ordine blu dichiarato).
// - no: indisponibilità dichiarata esplicitamente
// slots = 5 posizioni [Maniago, Spilimbergo, Meduno, Claut, Anduins]

// Normalizza il formato dati
const normDispo = (v) => {
  if (!v) return { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: false };
  return {
    verde: v.verde || [], verdeLiv: v.verdeLiv || {},
    blu: v.blu || [], bluLiv: v.bluLiv || {},
    no: !!v.no,
  };
};

// Ordina un elenco di sedi per livello crescente (prima le più desiderate). Sedi con lo stesso
// livello sono "indifferenti" per il medico (il motore può spostarlo liberamente tra loro), ma
// la parità non le rende mai davvero equivalenti tra loro: a parità di livello si prova sempre
// prima la sede che viene prima nell'ordine fisso SEDI5 (Maniago → Spilimbergo → Meduno → Claut
// → Anduins), non l'ordine in cui il medico le ha dichiarate. Così una CDC (Maniago/Spilimbergo)
// pari con una sede secondaria vince comunque la CDC, esattamente come se fosse un livello
// migliore — l'ordine di dichiarazione non ha alcun peso (CONTEXT.md §3.3).
const ordinaPerLivello = (sedi, liv, maxLivello) => {
  const out = [];
  for (let l = 1; l <= maxLivello; l++) {
    SEDI5.forEach((s) => { if (sedi.includes(s) && (liv[s] || 1) === l) out.push(s); });
  }
  return out;
};
const MAX_LIV_VERDE = 5, MAX_LIV_BLU = 4;

// Differenza in giorni interi tra due date "YYYY-MM-DD" (b - a). Usata per la regola di
// spaziatura temporale (CONTEXT.md §3.7): confronta SEMPRE date di calendario, mai l'ordine
// di elaborazione interno (che può processare i turni "preferiti" fuori ordine cronologico).
const giorniTra = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);

// Lunedì (ISO, lun-dom) della settimana che contiene la data "YYYY-MM-DD", come chiave stringa —
// usata per il tetto settimanale dichiarabile dal medico (CONTEXT.md §3.8).
const settimanaDi = (dataStr) => {
  const dt = new Date(dataStr + "T00:00:00");
  const dow = (dt.getDay() + 6) % 7; // 0=lunedì .. 6=domenica
  dt.setDate(dt.getDate() - dow);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};
// Tetto settimanale dichiarato dal medico per la settimana `wk` (chiave = lunedì), o null se
// non dichiarato (nessun limite). Dichiarato come dispo[mid]["SETT:" + wk] = { maxTurni: N },
// una chiave orthogonale ai normali slotKey "YYYY-MM-DD|ID" (mai un turno vero e proprio).
const capSettimanale = (dispo, mid, wk) => {
  const raw = dispo[mid]?.["SETT:" + wk];
  const n = raw && raw.maxTurni;
  return typeof n === "number" && n >= 0 ? n : null;
};
// Finestra settimanale (§10 voce 57): MINIMO di turni che il medico vuole nella settimana ISO `wk`
// (chiave = lunedì, come SETT:), o null se non dichiarato. Dichiarata come dispo[mid]["SETTWK:"+wk] = N.
// Ortogonale a SETT: (massimo) e a OBBL: (slot preciso): qui il coordinatore dà solo il numero, il
// motore sceglie autonomamente QUALI turni tenere tra quelli vinti per gerarchia in quella settimana.
const finestraSettimanale = (dispo, mid, wk) => {
  const n = dispo[mid]?.["SETTWK:" + wk];
  return typeof n === "number" && n > 0 ? n : null;
};

// Tetto MENSILE dichiarato dal coordinatore per un medico (CONTEXT.md §3.11), indipendente dal
// debito residuo e valido per QUALSIASI categoria: `dati.maxTurniMese[mid] = N`, o null/assente =
// nessun limite. A differenza del tetto settimanale non è nella dispo (un solo valore per l'intero
// mese, non per-settimana) — stesso pattern di `extraOre`/`turniExtra`.
const capMensileDi = (maxTurniMese, mid) => {
  const n = maxTurniMese[mid];
  return typeof n === "number" && n >= 0 ? n : null;
};

// Tetto di distribuzione temporale (CONTEXT.md §3.11) per un medico: il più restrittivo tra il
// monte ore implicito (arrotondato a turni da 12h — INDET≈8, DET38≈14, DET24≈9, DET12ASAP/DET12≈4
// — Math.round(debito/12): un residuo inferiore a 6h arrotonda a 0 turni in meno, un medico con
// debito residuo così piccolo è considerato esaurito ai fini del tetto e il resto va perso — non
// è un difetto da correggere, è il comportamento voluto) e l'eventuale Max turni mese dichiarato
// esplicitamente. Vale per QUALSIASI categoria, titolari inclusi (la titolarità non esonera dal
// proprio tetto — è già protetta separatamente dalla gerarchia normale finché il medico resta in
// gara, vedi più sotto). Per i senza incarico (debitoIniziale null, nessun monte ore) vale SOLO se
// un tetto è stato dichiarato esplicitamente: senza quello non esiste alcun riferimento su cui
// calcolare una distribuzione, e nessuna scatta.
function tettoDistribuzioneDi(mid, debitoIniziale, debitoExtraIniziale, maxTurniMese) {
  const capDichiarato = capMensileDi(maxTurniMese, mid);
  if (debitoIniziale === null) return capDichiarato;
  // Il monte ore implicito conta ANCHE gli eventuali turni extra volontari dichiarati (§3.10): il
  // coordinatore che approva turni extra vuole esplicitamente che il medico lavori oltre il monte
  // ore ordinario, quindi il tetto automatico deve riflettere il budget TOTALE a disposizione, non
  // solo quello ordinario — altrimenti un medico con debito ordinario azzerato apposta a favore dei
  // turni extra (extraOre negativo) si vedrebbe un tetto implicito di 0, escluso anche da quelli.
  const implicito = Math.max(0, Math.round((debitoIniziale + (debitoExtraIniziale || 0)) / 12));
  return capDichiarato !== null ? Math.min(implicito, capDichiarato) : implicito;
}

// Sceglie n indici il più possibile equidistanti tra 0 e k-1 — usato per selezionare, tra i
// turni EFFETTIVAMENTE vinti da un medico (non tra i giorni semplicemente dichiarati disponibili),
// il sottoinsieme più distanziato nel tempo da tenere quando supera il proprio tetto (§3.11).
function scegliIndiciEquidistanti(k, n) {
  if (n >= k) return Array.from({ length: k }, (_, i) => i);
  if (n <= 1) return k > 0 ? [0] : [];
  const idx = new Set();
  for (let i = 0; i < n; i++) idx.add(Math.round((i * (k - 1)) / (n - 1)));
  return [...idx].sort((a, b) => a - b);
}

// Sceglie n turni da tenere tra candidati (array di {slotKey, giorno}, in ordine cronologico) di
// un livello di sede che deve essere ridotto, tenendo conto ANCHE dei giorni già fissati da livelli
// di sede migliori (giorniFissi, §3.11) — la priorità di sede resta assoluta sull'equidistanza:
// questa funzione agisce SOLO sulla selezione dentro il livello corrente, mai sostituendo un turno
// di un livello migliore. Senza giorni di riferimento ricade sulla pura equidistanza posizionale
// (scegliIndiciEquidistanti), comportamento INVARIATO. Con dei giorni di riferimento (obbligatori,
// MMG, settimana a cavallo, livelli migliori), sceglie i turni liberi che MINIMIZZANO il GAP MASSIMO
// tra giorni consecutivi dell'insieme completo (pin + scelti), code ai bordi dello span incluse —
// cioè niente buchi lunghi, distribuzione la più uniforme possibile (§10 voce 54). L'ottimo esatto
// si trova in tempo polinomiale con una ricerca binaria sul gap massimo + una copertura greedy
// (numero minimo di giorni per tenere ogni gap ≤ G, farthest-reach, ottimo classico): il G minimo
// con "servono ≤ n" è l'ottimo. Rispetto al vecchio farthest-point (che massimizzava il gap MINIMO
// e lasciava buchi asimmetrici) migliora il gap massimo nel ~78% dei casi con pin, senza costo
// prestazionale (~0,01 ms anche con pool di 31 e n=14; nessuna enumerazione combinatoria).
// L'ottimizzazione ragiona sui GIORNI DISTINTI (due turni lo stesso giorno sono a distanza 0, non
// aiutano la spaziatura); il conteggio resta in SLOT (n), quindi si mappano i giorni scelti agli slot
// e, se servono più slot dei giorni distinti disponibili, si aggiungono gli slot residui. Deterministico.
function scegliConRiferimento(candidati, n, giorniFissi, giorniBlu = null) {
  if (n <= 0) return [];
  if (n >= candidati.length) return candidati.map((c) => c.slotKey);
  if (!giorniFissi.length) return scegliIndiciEquidistanti(candidati.length, n).map((i) => candidati[i].slotKey);

  // Giorno distinto → slotKey di quel giorno (in ordine originale, per il mapping finale).
  const slotDelGiorno = new Map();
  for (const c of candidati) { if (!slotDelGiorno.has(c.giorno)) slotDelGiorno.set(c.giorno, []); slotDelGiorno.get(c.giorno).push(c.slotKey); }
  const giorniDistinti = [...slotDelGiorno.keys()].sort((a, b) => a - b);
  const fissi = [...giorniFissi].sort((a, b) => a - b);
  const L = Math.min(giorniDistinti[0], fissi[0]);
  const R = Math.max(giorniDistinti[giorniDistinti.length - 1], fissi[fissi.length - 1]);
  // Anchor forzati (bordi span + pin interni): tra due anchor consecutivi si inseriscono i giorni scelti.
  const anchors = [L, ...fissi.filter((f) => f > L && f < R), R];
  const kGiorni = Math.min(n, giorniDistinti.length); // giorni distinti da scegliere (il resto sono slot dup.)

  // Con un tetto di gap G: giorni-candidato minimi da inserire perché ogni gap ≤ G (greedy farthest-reach,
  // ottimo). collect=false → conteggio; collect=true → i giorni scelti. Infinity/troncato se G irraggiungibile.
  const copri = (G, collect) => {
    const scelti = collect ? [] : null;
    let usati = 0, ci = 0;
    for (let s = 0; s < anchors.length - 1; s++) {
      let cur = anchors[s]; const nxt = anchors[s + 1];
      while (ci < giorniDistinti.length && giorniDistinti[ci] <= cur) ci++;
      let guard = 0;
      while (nxt - cur > G) {
        let pick = -1;
        while (ci < giorniDistinti.length && giorniDistinti[ci] <= cur + G && giorniDistinti[ci] < nxt) { pick = giorniDistinti[ci]; ci++; }
        if (pick === -1) return collect ? scelti : Infinity; // nessun candidato raggiungibile: G non fattibile
        usati++; if (collect) scelti.push(pick); cur = pick;
        if (++guard > 5000) return collect ? scelti : Infinity;
      }
    }
    return collect ? scelti : usati;
  };

  // Ricerca binaria del gap massimo minimo ottenibile con ≤ kGiorni giorni.
  let lo = 1, hi = Math.max(1, R - L), best = hi;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (copri(mid, false) <= kGiorni) { best = mid; hi = mid - 1; } else lo = mid + 1; }

  // Giorni necessari per il gap ottimo, poi si riempie fino a kGiorni col farthest-point (rifinitura).
  const sceltiGiorni = copri(best, true) || [];
  const setG = new Set(sceltiGiorni);
  const restGiorni = giorniDistinti.filter((d) => !setG.has(d));
  const rif = [...fissi, ...sceltiGiorni];
  while (sceltiGiorni.length < kGiorni && restGiorni.length) {
    let bi = 0, bd = -1;
    restGiorni.forEach((d, i) => { const dist = Math.min(...rif.map((g) => Math.abs(d - g))); if (dist > bd) { bd = dist; bi = i; } });
    sceltiGiorni.push(restGiorni[bi]); rif.push(restGiorni[bi]); restGiorni.splice(bi, 1);
  }

  // Tiebreak COPERTURA A DISTANZA — BLU (§10 voce 56): a parità di gap massimo OTTIMALE, preferisci
  // tenere i giorni su cui il medico ha una blu dichiarata (chance di copertura a distanza). Post-pass
  // di soli SCAMBI: sostituisce un giorno scelto SENZA blu con uno scartato CON blu, ma SOLO se la nuova
  // selezione non peggiora il gap oltre l'ottimo `best` (metrica maxGapDi identica al maxGapTail dei test:
  // diff massima consecutiva su {L, R} ∪ fissi ∪ scelti). Conteggio invariato (kGiorni), deterministico.
  // No-op esatto quando giorniBlu è vuoto (blu assente) o contiene TUTTI i giorni-candidato (blu uniforme:
  // nessun giorno scelto è "senza blu") → output byte-identico a prima. Scatta solo su blu PARZIALE.
  if (giorniBlu && giorniBlu.size) {
    const maxGapDi = (gg) => {
      const pts = [...new Set([L, R, ...fissi, ...gg])].sort((a, b) => a - b);
      let mx = 0; for (let i = 1; i < pts.length; i++) mx = Math.max(mx, pts[i] - pts[i - 1]);
      return mx;
    };
    const scel = new Set(sceltiGiorni), rest = new Set(restGiorni);
    for (const dOut of [...sceltiGiorni].sort((a, b) => a - b)) {
      if (giorniBlu.has(dOut) || !scel.has(dOut)) continue;
      for (const dIn of [...rest].sort((a, b) => a - b)) {
        if (!giorniBlu.has(dIn)) continue;
        if (maxGapDi(sceltiGiorni.filter((d) => d !== dOut).concat(dIn)) <= best) {
          sceltiGiorni.splice(sceltiGiorni.indexOf(dOut), 1); sceltiGiorni.push(dIn);
          scel.delete(dOut); scel.add(dIn); rest.delete(dIn); rest.add(dOut);
          break;
        }
      }
    }
  }

  // Mappa i giorni scelti agli slotKey (uno per giorno). Se n eccede i giorni distinti (più turni-slot
  // lo stesso giorno), aggiungi gli slot residui in ordine finché non se ne hanno esattamente n.
  sceltiGiorni.sort((a, b) => a - b);
  const out = sceltiGiorni.map((g) => slotDelGiorno.get(g)[0]);
  if (out.length < n) {
    const usati = new Set(out);
    for (const c of candidati) { if (out.length >= n) break; if (!usati.has(c.slotKey)) { out.push(c.slotKey); usati.add(c.slotKey); } }
  }
  return out;
}

// Livello della sede VERDE effettivamente vinta da un medico in un turno (1 = più desiderata),
// usato per raggruppare i turni vinti per qualità di sede prima di scegliere quali cedere in
// eccesso al proprio tetto mensile (§3.11): la priorità di sede dichiarata dal medico è ASSOLUTA
// sull'equidistanza, mai il contrario — un turno di livello migliore va sempre tenuto rispetto a
// uno di livello peggiore, anche se quest'ultimo sarebbe temporalmente più distanziato. Per un
// turno extra (nessuna sede fisica reale in gioco) si usa il livello migliore tra le sedi verdi
// dichiarate per quello slot, semplice indicatore di preferenza.
function livelloVintoDi(dispo, mid, slotKey, turno, si) {
  const v = normDispo(dispo[mid]?.[slotKey]);
  // Livello della sede vinta (vale identico per ordinari e MMG: dopo l'unificazione anche un turno
  // MMG ha una sede fisica reale — quella attivata dal coordinatore — e `si` ne è l'indice).
  const sede = SEDI5[si];
  return v.verde.includes(sede) ? (v.verdeLiv[sede] || 1) : 1;
}

// Preferenza di TURNO (diurno/notturno) per un giorno che ha entrambi (weekend/festivo/
// prefestivo): decide SOLO quale dei due il medico mantiene se li vince entrambi lo stesso
// giorno, non cambia mai CHI vince un conflitto né anticipa l'elaborazione (CONTEXT.md §3.9).
// Dichiarata come dispo[mid]["TURNOPREF:" + dataStr] = "G" | "N", una chiave ortogonale ai
// normali slotKey "YYYY-MM-DD|ID" (mai un turno vero e proprio, come "SETT:").
const turnoPrefDi = (dispo, mid, dataStr) => dispo[mid]?.["TURNOPREF:" + dataStr] || null;

// Calcola l'elenco dei medici candidati per uno slot, già ordinato secondo la gerarchia
// ufficiale (categoria/prio → debito residuo → graduatoria, con senza incarico in coda).
// Isolata così la regola di preferenza turno (stesso giorno G/N) può cercare un
// alternativo con lo stesso identico criterio usato da elaboraTurno.
function candidatiOrdinati(dispo, debiti, debitiExtra, settimanaCount, slotKey, esente) {
  const dataStr = slotKey.split("|")[0];
  const wk = settimanaDi(dataStr);
  const candidati = MEDICI.filter((m) => {
    const v = normDispo(dispo[m.id]?.[slotKey]);
    if (v.no || !(v.verde.length || v.blu.length)) return false;
    const cap = capSettimanale(dispo, m.id, wk);
    if (cap !== null && (settimanaCount[m.id]?.[wk] || 0) >= cap) return false; // tetto settimanale raggiunto
    // Blocco rigido oltre il monte ore (CONTEXT.md §3.4): un contrattualizzato che ha esaurito sia
    // il debito ordinario (monte ore + recupero) sia gli eventuali turni extra volontari non è più
    // un candidato per NESSUN turno, nemmeno se resterebbe l'unico disponibile — il turno resta
    // SCOPERTO piuttosto che essere coperto oltre il limite dichiarato. Il tetto mensile (Max
    // turni mese/distribuzione, CONTEXT.md §3.11) NON è più un filtro qui: è applicato interamente
    // in un secondo passaggio di post-elaborazione in elaboraSchema, dopo che il mese è stato
    // elaborato una prima volta con la gerarchia pura (vedi elaboraSchema per i dettagli).
    // `esente`: insieme opzionale di medici esentati dal blocco monte ore SOLO in questo oracolo —
    // usato dalla distribuzione temporale (§3.11) per calcolare, per un medico con Max turni mese
    // esplicito che morde, i turni che vincerebbe su TUTTO il mese se il suo stesso monte ore non
    // lo fermasse presto (altrimenti i turni tenuti si ammucchiano nella prima settimana). Non
    // altera mai il risultato reale: l'oracolo per-medico è usato solo per costruire il pool.
    if (!(esente && esente.has(m.id)) && debiti[m.id] !== null && debiti[m.id] <= 0 && (debitiExtra[m.id] || 0) <= 0) return false;
    return true;
  });
  const bucketDi = (m) => (debiti[m.id] === null || (debiti[m.id] <= 0 && (debitiExtra[m.id] || 0) > 0)) ? 1 : 0;
  const conDeb = candidati.filter((m) => bucketDi(m) === 0)
    .sort((a, b) => CAT_INFO[a.cat].prio - CAT_INFO[b.cat].prio || debiti[b.id] - debiti[a.id] || a.grad - b.grad);
  // "senza" = veri senza incarico + contrattualizzati che hanno esaurito monte ore+recupero ma
  // hanno ancora turni extra volontari dichiarati: competono insieme, alla pari, solo per
  // graduatoria. (I contrattualizzati completamente esauriti, senza turni extra residui, sono già
  // esclusi sopra.)
  const senza = candidati.filter((m) => bucketDi(m) === 1).sort((a, b) => a.grad - b.grad);
  return [...conDeb, ...senza]; // già in ordine di gerarchia ufficiale
}

// Risoluzione della copertura a distanza (blu) di un turno (CONTEXT.md §3.1a, FASE 2). Dato
// l'insieme dei medici FISICAMENTE presenti nel turno (fisMids) e le sedi già coperte
// fisicamente (sitiCoperti), assegna a ciascun fisico al massimo UNA sede blu dichiarata (la
// prima disponibile nel suo ordine blu), risolvendo i conflitti sulla stessa sede con la STESSA
// gerarchia del fisico: bucket debito → titolarità sede → categoria → debito → graduatoria.
// Ritorna una mappa siteIndex -> mid; non tocca gli slot fisici. Isolata a livello di modulo
// perché serve in DUE punti con la stessa identica logica: durante l'elaborazione del turno
// (sotto), e di nuovo dopo lo scambio preferenza-turno §3.9 in elaboraSchema — dove il rilascio
// di uno slot fisico cambia l'insieme dei presenti e la copertura a distanza va rifatta da capo.
function risolviBlu(fisMids, sedeFisicaDi, slotKey, dispo, debiti, debitiExtra) {
  const sitiCoperti = new Set(Object.values(sedeFisicaDi));
  // Vincolo TERRITORIALE (CONTEXT.md §3.2): Claut (indice 3) può essere coperta a distanza SOLO dal
  // medico fisicamente a Maniago (0) — unica via, la Val Cellina si raggiunge da lì; Anduins (4)
  // SOLO dal fisico di Spilimbergo (1) o Meduno (2) — due vie possibili. Le altre sedi
  // (Maniago/Spilimbergo/Meduno a distanza) non hanno vincolo geografico. È un FILTRO applicato
  // PRIMA della gerarchia: chi non è nella sede-base ammessa non si candida nemmeno a coprire quella
  // sede; la scelta tra i candidati validi resta governata da isBetterPriority (invariata).
  const puoCoprireADistanza = (mid, si) => {
    if (si === 3) return sedeFisicaDi[mid] === 0;
    if (si === 4) return sedeFisicaDi[mid] === 1 || sedeFisicaDi[mid] === 2;
    return true;
  };
  const bucketOf = (mid) => (debiti[mid] === null || (debiti[mid] <= 0 && (debitiExtra[mid] || 0) > 0)) ? 1 : 0;
  const isTitolareDi = (mid, sede) => isContrattualizzato(mid) && byId[mid].sedeContratto === sede;
  const isBetterPriority = (aId, bId, sede) => {
    const ba = bucketOf(aId), bb = bucketOf(bId);
    if (ba !== bb) return ba < bb;
    if (ba !== 0) return byId[aId].grad < byId[bId].grad;
    const A = byId[aId], B = byId[bId];
    if (isContrattualizzato(aId) && isContrattualizzato(bId)) {
      const titA = isTitolareDi(aId, sede), titB = isTitolareDi(bId, sede);
      if (titA !== titB) return titA;
    }
    const pa = CAT_INFO[A.cat].prio, pb = CAT_INFO[B.cat].prio;
    if (pa !== pb) return pa < pb;
    if (debiti[aId] !== debiti[bId]) return debiti[aId] > debiti[bId];
    return A.grad < B.grad;
  };
  // Stesso ordine di gerarchia usato da candidatiOrdinati (bucket → categoria → debito → grad):
  // determina solo l'ordine in cui i fisici "prenotano" la loro sede blu; i conflitti veri sono
  // comunque risolti da isBetterPriority. Idempotente su una lista già ordinata (grad univoca).
  const ordine = [...fisMids].sort((a, b) =>
    bucketOf(a) - bucketOf(b) ||
    (bucketOf(a) === 1
      ? byId[a].grad - byId[b].grad
      : (CAT_INFO[byId[a].cat].prio - CAT_INFO[byId[b].cat].prio || debiti[b] - debiti[a] || byId[a].grad - byId[b].grad)));
  const accBluDi = (mid) => {
    const v = normDispo(dispo[mid]?.[slotKey]);
    return ordinaPerLivello(v.blu, v.bluLiv, MAX_LIV_BLU);
  };
  const sedeBluDi = {};
  const provaBlu = (mid, visitate) => {
    const acc = accBluDi(mid);
    for (const sede of acc) {
      const si = SEDI5.indexOf(sede);
      if (sitiCoperti.has(si) || visitate.has(si)) continue;
      if (!puoCoprireADistanza(mid, si)) continue; // vincolo territoriale, applicato prima della gerarchia
      visitate.add(si);
      const occ = sedeBluDi[si];
      if (occ === undefined) { sedeBluDi[si] = mid; return true; }
      if (occ === mid) continue;
      if (isBetterPriority(mid, occ, sede)) {
        delete sedeBluDi[si];
        if (provaBlu(occ, visitate)) { sedeBluDi[si] = mid; return true; }
        sedeBluDi[si] = mid;
        return true;
      }
    }
    return false;
  };
  ordine.forEach((mid) => provaBlu(mid, new Set()));
  return sedeBluDi;
}

// Elabora un singolo turno (giorno+fascia): assegna le sedi, scala i debiti (mutando l'oggetto
// passato), e restituisce sia l'esito sia l'eventuale avviso. Isolata così può essere richiamata
// in due passaggi (prima i turni "preferiti", poi il resto) mantenendo lo stesso stato debiti e
// settimanaCount (turni già assegnati per medico/settimana) condivisi tra tutte le chiamate dello
// stesso elaboraSchema.
function elaboraTurno(d, turno, slotKey, dispo, debiti, debitiExtra, settimanaCount, esente) {
  const dataStr = slotKey.split("|")[0];
  const wk = settimanaDi(dataStr);
  const ordinati = candidatiOrdinati(dispo, debiti, debitiExtra, settimanaCount, slotKey, esente); // già in ordine di gerarchia ufficiale
  // Scala il debito del vincitore per un turno fisico: finché ha monte ore+recupero residuo lo
  // scala normalmente; una volta esaurito, scala i turni extra volontari dichiarati (stessa
  // priorità di un senza incarico — vedi bucketOf/candidatiOrdinati). Nessun effetto sui senza
  // incarico veri (debiti[mid] === null, ignorati).
  const scalaDebito = (mid, ore) => {
    if (debiti[mid] === null) return;
    if (debiti[mid] > 0) debiti[mid] -= ore;
    else debitiExtra[mid] = (debitiExtra[mid] || 0) - ore;
  };

  let slots = [null, null, null, null, null];
  let fisiche = [];
  let avviso = null;

  {
    // Bucket di priorità a DUE livelli (0=con debito ordinario residuo, 1=senza incarico/turni
    // extra), usato sia per il confronto fisico che per quello a distanza. I contrattualizzati
    // completamente esauriti (senza turni extra residui) non arrivano mai qui: sono già esclusi
    // da "ordinati" in candidatiOrdinati (blocco rigido oltre il monte ore, CONTEXT.md §3.4). Il
    // tetto mensile e la distribuzione temporale (§3.11) NON intervengono più qui: sono applicati
    // interamente in un secondo passaggio di post-elaborazione in elaboraSchema.
    const bucketOf = (mid) => (debiti[mid] === null || (debiti[mid] <= 0 && (debitiExtra[mid] || 0) > 0)) ? 1 : 0;
    const isTitolareDi = (mid, sede) => isContrattualizzato(mid) && byId[mid].sedeContratto === sede;
    // Confronto di priorità "vero", parametrizzato sulla sede contesa. Vale identico sia per
    // l'assegnazione fisica che per la copertura a distanza (CONTEXT.md §3.1a):
    //   titolarità sede (tra tutti i contrattualizzati, INDET incluso) → categoria → debito → graduatoria.
    const isBetterPriority = (aId, bId, sede) => {
      const ba = bucketOf(aId), bb = bucketOf(bId);
      if (ba !== bb) return ba < bb;
      if (ba !== 0) return byId[aId].grad < byId[bId].grad;
      const A = byId[aId], B = byId[bId];
      if (isContrattualizzato(aId) && isContrattualizzato(bId)) {
        const titA = isTitolareDi(aId, sede), titB = isTitolareDi(bId, sede);
        if (titA !== titB) return titA;
      }
      const pa = CAT_INFO[A.cat].prio, pb = CAT_INFO[B.cat].prio;
      if (pa !== pb) return pa < pb;
      if (debiti[aId] !== debiti[bId]) return debiti[aId] > debiti[bId];
      return A.grad < B.grad;
    };

    // ---- FASE 1: assegnazione fisica (verde) ----
    // Target fisico: quante e quali sedi puntare in base al numero di medici presenti. Sedi fisiche
    // fisse: Maniago, Spilimbergo, Meduno (SEMPRE). Claut e Anduins si aggiungono come fisiche SOLO
    // nel turno DIURNO (id "G") — che nel calendario esiste esclusivamente nei giorni ad alta
    // domanda (weekend, festivi, prefestivi); nelle notti (sempre) restano coperte a DISTANZA
    // (FASE 2). Priorità invariata: Maniago e Spilimbergo prime, poi Meduno, poi Claut, poi Anduins
    // (il target è il prefisso di quest'ordine). Con 1 solo medico il target è dinamico: la sua
    // preferenza verde migliore TRA le sedi oggi fisiche (non più forzato su Maniago). Claut e
    // Anduins non sono mai contemporaneamente fisiche e a distanza: sitiCoperti (FASE 2) deriva
    // dalle sole sedi effettivamente fisiche, quindi la distanza copre solo ciò che resta scoperto —
    // niente doppione, senza toccare la FASE 2.
    // Sedi fisiche del turno. Un MMG (extra) compete su TUTTE le sedi esattamente come un turno
    // ordinario: la sede la decide il motore in base alle disponibilità dei medici (verde), non il
    // coordinatore (§10 voce 55). Maniago/Spilimbergo/Meduno fisiche sempre; Claut/Anduins fisiche solo
    // nel diurno G (di notte e nell'anticipo MMG sono coperte solo a distanza, FASE 2). Con 1 solo
    // medico il target è dinamico: la sua preferenza verde migliore tra le sedi oggi fisiche.
    const sediFisiche = turno.id === "G" ? [0, 1, 2, 3, 4] : [0, 1, 2];
    const nFisici = Math.min(ordinati.length, sediFisiche.length);
    let target = [];
    if (nFisici === 1) {
      const v = normDispo(dispo[ordinati[0].id]?.[slotKey]);
      const top = ordinaPerLivello(v.verde, v.verdeLiv, MAX_LIV_VERDE).find((sd) => sediFisiche.includes(SEDI5.indexOf(sd)));
      if (top !== undefined) target = [SEDI5.indexOf(top)];
    } else {
      target = sediFisiche.slice(0, nFisici);
    }

    const accVerdeDi = (mid) => {
      const v = normDispo(dispo[mid]?.[slotKey]);
      return ordinaPerLivello(v.verde, v.verdeLiv, MAX_LIV_VERDE);
    };
    const livelloVerdeDi = (mid, sede) => {
      const v = normDispo(dispo[mid]?.[slotKey]);
      return v.verde.includes(sede) ? (v.verdeLiv[sede] || 1) : Infinity;
    };
    const sedeDi = {};
    // provaFisica(): il medico m cerca una sede fisica tra le sue preferenze verdi, nell'ordine
    // dei SUOI livelli, senza mai accettare una sede di livello peggiore di maxLiv. Ricollocazione
    // dell'occupante: a pari/miglior livello sempre consentita (indifferenza dichiarata, non gli
    // costa nulla); a livello peggiore solo se il richiedente ha VERA priorità superiore su quella
    // sede (titolarità → categoria → debito → graduatoria tra tutti i contrattualizzati).
    const provaFisica = (m, visitate, maxLiv) => {
      const acc = accVerdeDi(m.id);
      for (const sede of acc) {
        const si = target.find((i) => SEDI5[i] === sede);
        if (si === undefined || visitate.has(si)) continue;
        const liv = livelloVerdeDi(m.id, sede);
        if (liv > maxLiv) continue;
        visitate.add(si);
        const occ = slots[si];
        if (occ === null) { slots[si] = m.id; sedeDi[m.id] = si; return true; }
        if (occ === m.id) continue;
        const richiedenteMeglio = isBetterPriority(m.id, occ, sede);
        // La ricollocazione "a costo zero" dell'occupante (pari/miglior livello, indifferenza
        // dichiarata) presuppone che spostarlo non tolga nulla a nessuno — ma se l'occupante è
        // TITOLARE proprio di questa sede e il richiedente non ha una priorità realmente
        // superiore, spostarlo comunque (anche se lui stesso è indifferente tra le sue sedi
        // dichiarate) equivarrebbe a cedere la sua sede di titolarità a chi non ne ha diritto:
        // la titolarità garantisce quella sede SPECIFICA, non solo "una sede accettabile
        // qualunque". In questo caso saltiamo il tentativo di ricollocazione e passiamo
        // direttamente alla prossima preferenza del richiedente (l'occupante titolare resta).
        if (!richiedenteMeglio && isTitolareDi(occ, sede)) continue;
        const occLiv = livelloVerdeDi(occ, sede);
        const occMax = richiedenteMeglio ? Infinity : occLiv;
        delete sedeDi[occ];
        if (provaFisica(byId[occ], visitate, occMax)) { slots[si] = m.id; sedeDi[m.id] = si; return true; }
        sedeDi[occ] = si; // ricollocazione fallita: l'occupante resta dov'era
        if (richiedenteMeglio) {
          delete sedeDi[occ];
          slots[si] = m.id; sedeDi[m.id] = si;
          return true;
        }
      }
      return false;
    };
    // NOTA: non ci si può fermare non appena tutti i target sono occupati — "ordinati" è ordinato
    // per categoria/debito/graduatoria, MAI per titolarità (CONTEXT.md §3.1a): un titolare può
    // comparire più avanti nell'elenco di un non titolare di categoria migliore che ha già occupato
    // la sua sede. Se ci fermassimo qui, quel titolare non avrebbe mai la possibilità di contestare
    // la propria sede. provaFisica è comunque sicuro da richiamare per OGNI candidato: se non ha
    // una pretesa reale (isBetterPriority falso su tutte le sue sedi dichiarate) non cambia nulla.
    for (const m of ordinati) {
      provaFisica(m, new Set(), Infinity);
    }

    // ---- Correzione titolarità post-FASE1 (CONTEXT.md §3.1a, §10) ----
    // Limite noto: con 3+ determinati che si contendono sedi sovrapposte nello stesso turno,
    // catene di ricollocazione ricorsiva profonde in provaFisica possono raramente convergere
    // lasciando un titolare fuori dalla propria sede pur avendone diritto, senza che nessun
    // singolo passaggio della catena sia isolatamente scorretto. Una ripetizione generica
    // dell'intero ciclo FASE1 introduceva regressioni reali altrove (perdita di copertura, la
    // ricollocazione per indifferenza non è idempotente su stati già stabili) — vedi §10. Questa
    // funzione è invece MIRATA solo ai titolari (mai a candidati generici), tocca solo LA LORO
    // sede specifica, e sposta l'eventuale occupante scorretto tramite lo stesso provaFisica già
    // usato ovunque (sicuro e già testato): se l'occupante non ha davvero priorità superiore su
    // quella sede (isBetterPriority), il titolare la riprende e l'occupante ritenta altrove.
    // Richiamata due volte: subito dopo FASE1, e di nuovo più sotto dopo un rebuild di slots dalla
    // fonte di verità (sedeDi) — la seconda chiamata è una verifica difensiva economica contro
    // eventuali residui ("fantasmi", §10 bug storico #1) lasciati dalla ricollocazione ricorsiva
    // della prima chiamata stessa su slots, non del tutto affidabile senza un rebuild pulito prima.
    const correggiTitolarita = () => {
      for (const m of ordinati) {
        const S = byId[m.id].sedeContratto;
        if (!isTitolareDi(m.id, S)) continue;
        const si = target.find((i) => SEDI5[i] === S);
        if (si === undefined) continue; // sede non tra i target odierni
        if (sedeDi[m.id] === si) continue; // già lì, niente da correggere
        if (accVerdeDi(m.id)[0] !== S) continue; // oggi non è la sua prima preferenza: non forziamo
        const occ = slots[si];
        if (occ === null || occ === m.id) continue;
        if (!isBetterPriority(m.id, occ, S)) continue; // l'occupante ha legittimamente la priorità (es. INDET)
        const vecchioSi = sedeDi[m.id];
        delete sedeDi[occ];
        delete sedeDi[m.id];
        slots[si] = m.id; sedeDi[m.id] = si;
        if (vecchioSi !== undefined) slots[vecchioSi] = null;
        provaFisica(byId[occ], new Set([si]), Infinity);
      }
    };
    correggiTitolarita();

    // Rebuild slots da sedeDi (fonte di verità), per eliminare "fantasmi" da ricollocazioni
    // intermedie di provaFisica/correggiTitolarita.
    slots = [null, null, null, null, null];
    Object.entries(sedeDi).forEach(([midStr, si]) => { slots[si] = Number(midStr); });
    // Seconda passata di correzione titolarità (vedi sopra): verifica difensiva su uno slots
    // appena ricostruito pulito. Rebuild finale di slots dopo, per ripulire eventuali "fantasmi"
    // lasciati dalle ricollocazioni di questa seconda passata (stesso motivo del rebuild qui sopra).
    correggiTitolarita();
    slots = [null, null, null, null, null];
    Object.entries(sedeDi).forEach(([midStr, si]) => { slots[si] = Number(midStr); });
    // Fix "4° medico sprecato" nel diurno (§10 voce 32) — PERCORSO SEPARATO: la FASE 1
    // (provaFisica/correggiTitolarità) resta INTATTA, target invariato. Qui, solo nel diurno, uno
    // step additivo con SOLE assegnazioni dirette (nessuna ricollocazione ricorsiva), scelto rispetto
    // a "target a 5 sedi" proprio per non toccare la ricorsione sensibile di FASE1 (§10):
    if (turno.id === "G") {
      // A) Anduins è l'unica sede fisica del diurno che il target (prefisso, con 4 medici arriva solo
      //    fino a Claut) può non offrire: se è libera, piazzaci un medico ELEGGIBILE rimasto
      //    inutilizzato che l'abbia dichiarata verde — così il 4° "solo Anduins" non è sprecato.
      if (slots[4] === null) {
        const cand = ordinati.find((m) => sedeDi[m.id] === undefined && normDispo(dispo[m.id]?.[slotKey]).verde.includes("Anduins"));
        if (cand) { slots[4] = cand.id; sedeDi[cand.id] = 4; }
      }
      // B) Tie-break "indifferente": se Anduins è ancora libera e Claut è occupata da un medico che
      //    aveva dichiarato ENTRAMBE allo STESSO livello (davvero indifferente), e Anduins resterebbe
      //    l'UNICO buco a distanza (Anduins non coperibile ma Claut sì), lo si sposta da Claut ad
      //    Anduins ("tappa il buco"). Copertura a distanza: Claut dal fisico di Maniago, Anduins dal
      //    fisico di Spilimbergo/Meduno (vincolo territoriale §3.2). Altri casi: resta su Claut.
      if (slots[4] === null && slots[3] !== null) {
        const mid = slots[3];
        const vE = normDispo(dispo[mid]?.[slotKey]);
        const lC = vE.verde.includes("Claut") ? (vE.verdeLiv["Claut"] || 1) : Infinity;
        const lA = vE.verde.includes("Anduins") ? (vE.verdeLiv["Anduins"] || 1) : Infinity;
        if (lC !== Infinity && lA !== Infinity && lC === lA) {
          const clautCop = slots[0] !== null && normDispo(dispo[slots[0]]?.[slotKey]).blu.includes("Claut");
          const anduinsCop = (slots[1] !== null && normDispo(dispo[slots[1]]?.[slotKey]).blu.includes("Anduins")) ||
                             (slots[2] !== null && normDispo(dispo[slots[2]]?.[slotKey]).blu.includes("Anduins"));
          if (!anduinsCop && clautCop) { slots[3] = null; slots[4] = mid; sedeDi[mid] = 4; }
        }
      }
    }
    Object.keys(sedeDi).forEach((midStr) => {
      const mid = Number(midStr);
      scalaDebito(mid, turno.ore);
      settimanaCount[mid] = settimanaCount[mid] || {};
      settimanaCount[mid][wk] = (settimanaCount[mid][wk] || 0) + 1;
    });
    fisiche = Object.values(sedeDi);

    // ---- FASE 2: copertura a distanza (blu) ----
    // Nessuna copertura è automatica: solo i FISICI di questo turno possono coprire a distanza,
    // e solo le sedi per cui hanno dichiarato blu. Ogni medico copre al massimo 1 sede a distanza
    // (la prima disponibile nel suo ordine blu). In caso di conflitto sulla stessa sede, vince
    // isBetterPriority — stessa identica gerarchia usata per il fisico: titolarità sede → categoria
    // → debito → graduatoria (CONTEXT.md §3.1a).
    const fisMids = ordinati.filter((m) => sedeDi[m.id] !== undefined).map((m) => m.id);
    const sedeBluDi = risolviBlu(fisMids, sedeDi, slotKey, dispo, debiti, debitiExtra);
    Object.entries(sedeBluDi).forEach(([siStr, mid]) => { slots[Number(siStr)] = mid; });

    // AVVISO: qualunque sede (fisica o a distanza) resti scoperta per mancanza di dichiarazione — per
    // gli MMG identico agli ordinari (l'MMG compete su tutte le sedi in base alle disponibilità).
    {
      const scoperte = [0, 1, 2, 3, 4].filter((si) => slots[si] === null);
      if (scoperte.length && ordinati.length) {
        avviso = `Giorno ${d} · ${turno.label}: con ${ordinati.length} medici presenti, restano SCOPERTE (nessuna disponibilità verde o blu dichiarata): ${scoperte.map((si) => SEDI5[si]).join(", ")}.`;
      }
    }
  }

  return { turnoOut: { id: turno.id, label: turno.label, ore: turno.ore, extra: !!turno.extra, slots, fis: fisiche }, avviso };
}

// Aggiustamento mensile del monte ore (bilanciamento turni annui, §3.11): il monte ore BASE resta
// sempre quello di CAT_INFO, ma per DET38, DET24 e DET12/DET12ASAP viene aggiustato di ±8h/±12h in
// mesi specifici PRIMA di calcolare il debito e il tetto automatico di distribuzione — DET38 perde
// 12h (168→156h, 14→13 turni impliciti) a Febbraio/Aprile/Settembre; DET24 perde 8h (104→96h, 9→8
// turni impliciti) a Febbraio/Aprile/Settembre/Novembre; DET12 e DET12ASAP guadagnano 8h (52→60h,
// 4→5 turni impliciti) a Marzo/Maggio/Agosto/Dicembre. Compensato sugli altri mesi dell'anno: 165
// turni/anno per DET38 (9×14 + 3×13), 104 per DET24 (8×9 + 4×8), 52 per DET12/DET12ASAP (8×4 +
// 4×5). INDET non ha mai aggiustamento. "mese" è l'indice 0-based usato ovunque (Gennaio=0, MESI_IT).
const AGGIUSTAMENTO_MESE_ORE = {
  DET38: { mesi: [1, 3, 8], delta: -12 },
  DET24: { mesi: [1, 3, 8, 10], delta: -8 },
  DET12ASAP: { mesi: [2, 4, 7, 11], delta: 8 },
  DET12: { mesi: [2, 4, 7, 11], delta: 8 },
};

// Costruisce il debito ORDINARIO iniziale (prima di qualunque consumo) per ciascun medico: monte
// ore contrattuale (con l'eventuale aggiustamento mensile sopra) + ore extra di recupero dichiarate
// per il mese, null per i senza incarico (nessun monte ore). È un valore puramente statico (dipende
// solo da categoria, mese ed extraOre, mai dal consumo effettivo) — usato sia per popolare "debiti"
// a inizio elaborazione sia, invariato, per calcolare il tetto di distribuzione temporale (§3.11)
// anche dopo che il debito è stato speso.
function debitoOrdinarioIniziale(mid, extraOre, mese) {
  const cat = byId[mid].cat;
  const base = CAT_INFO[cat].ore;
  if (base === null) return null;
  const agg = AGGIUSTAMENTO_MESE_ORE[cat];
  const baseAggiustato = agg && agg.mesi.includes(mese) ? base + agg.delta : base;
  return baseAggiustato + (extraOre[mid] || 0);
}

function elaboraSchema(dispo, extraOre, anno, mese, extras, turniExtra = {}, maxTurniMese = {}, riferimentiCavallo = {}) {
  const debiti0 = {};
  const debitiExtra0 = {};
  MEDICI.forEach((m) => {
    debiti0[m.id] = debitoOrdinarioIniziale(m.id, extraOre, mese);
    debitiExtra0[m.id] = debiti0[m.id] === null ? null : (turniExtra[m.id] || 0) * 12;
  });

  const nGiorni = new Date(anno, mese + 1, 0).getDate();
  // Flat list di tutti i turni del mese, in ordine di calendario
  const voci = [];
  for (let d = 1; d <= nGiorni; d++) {
    const info = turniDelGiorno(anno, mese, d, extras);
    info.turni.forEach((turno) => voci.push({ d, turno, slotKey: `${info.key}|${turno.id}` }));
  }
  // I turni si elaborano in ordine cronologico (di calendario): è l'ordine in cui il debito viene
  // consumato. Stesso ordine SIA nel passaggio 1 (gerarchia pura) SIA nel passaggio 2 (definitivo, §3.11).
  const ordineVoci = voci;

  // Esegue l'intero mese, nell'ordine sopra, con eventuali esclusioni per singolo turno
  // (escludiPerSlot: slotKey -> Set<mid> forzati a "no" SOLO per quello slot specifico — non
  // tocca nessun'altra dichiarazione del medico). dopoTurno (opzionale) è richiamato subito dopo
  // ogni turno elaborato, per un eventuale conteggio live (§3.11, passaggio 2).
  function eseguiMese(debiti, debitiExtra, settimanaCount, escludiPerSlot, dopoTurno, esente) {
    const risultati = {}; // "d|turnoId" -> turnoOut
    const avvisiRaw = []; // {d, testo}
    ordineVoci.forEach(({ d, turno, slotKey }) => {
      let dispoEff = dispo;
      const esclusi = escludiPerSlot && escludiPerSlot(slotKey);
      if (esclusi && esclusi.size) {
        dispoEff = { ...dispo };
        esclusi.forEach((mid) => {
          dispoEff[mid] = { ...dispoEff[mid], [slotKey]: { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: true } };
        });
      }
      const { turnoOut, avviso } = elaboraTurno(d, turno, slotKey, dispoEff, debiti, debitiExtra, settimanaCount, esente);
      risultati[`${d}|${turno.id}`] = turnoOut;
      if (avviso) avvisiRaw.push({ d, testo: avviso });
      if (dopoTurno) dopoTurno(turno, turnoOut);
    });
    return { risultati, avvisiRaw };
  }

  // ---- PASSAGGIO 1 (CONTEXT.md §3.11): gerarchia pura, nessun tetto, nessuna distribuzione ----
  // Serve SOLO da oracolo per scoprire, per ogni medico, quali turni vincerebbe naturalmente se
  // non esistesse alcun tetto — necessario perché non c'è altro modo affidabile di saperlo
  // (dipende da chi altro è disponibile, titolarità...). Scartato subito dopo l'uso: il risultato
  // REALE viene interamente dal passaggio 2 più sotto.
  const { risultati: risultatiP1 } = eseguiMese({ ...debiti0 }, { ...debitiExtra0 }, {}, null, null);

  // Tetto di distribuzione (§3.11) per ogni medico, fisso per l'intero mese: il più restrittivo
  // tra il monte ore implicito e l'eventuale Max turni mese dichiarato (null = nessun tetto,
  // possibile solo per i senza incarico senza tetto dichiarato — per loro nessuna distribuzione).
  const tetto = {};
  MEDICI.forEach((m) => { tetto[m.id] = tettoDistribuzioneDi(m.id, debiti0[m.id], debitiExtra0[m.id], maxTurniMese); });

  // Turni FISICI/EXTRA vinti da un medico in un set di risultati, in ordine cronologico (per giorno
  // di calendario), con il livello della sede verde ottenuta — la copertura a distanza non conta mai
  // ai fini del tetto mensile, come per Max turni mese.
  const estraiVinti = (risultati, mid) => {
    const out = [];
    voci.forEach(({ d, turno, slotKey }) => {
      const r = risultati[`${d}|${turno.id}`];
      // Dopo l'unificazione i MMG hanno una sede fisica reale come gli ordinari: si estraggono dai
      // FISICI (r.fis). Si conserva solo il flag `extra` — è ciò che li rende punti fissi protetti
      // nella distribuzione §3.11 (§10 voce 49, opzione C): contano nel tetto ma non sono mai ceduti.
      r.fis.forEach((si) => { if (r.slots[si] === mid) out.push({ slotKey, giorno: d, livello: livelloVintoDi(dispo, mid, slotKey, turno, si), sede: SEDI5[si], extra: !!turno.extra }); });
    });
    return out;
  };

  // Pool su cui la distribuzione temporale sceglie il sottoinsieme equidistante da tenere (§3.11).
  // Caso base: i turni EFFETTIVAMENTE vinti nel passaggio 1 (oracolo normale). Build batch O(voci).
  const poolDi = {};
  MEDICI.forEach((m) => (poolDi[m.id] = []));
  voci.forEach(({ d, turno, slotKey }) => {
    const out = risultatiP1[`${d}|${turno.id}`];
    out.fis.forEach((si) => {
      const mid = out.slots[si];
      if (mid) poolDi[mid].push({ slotKey, giorno: d, livello: livelloVintoDi(dispo, mid, slotKey, turno, si), sede: SEDI5[si], extra: !!turno.extra });
    });
  });

  // CORREZIONE §3.11 (pool su tutto il mese quando morde un tetto di distribuzione): un contrattualizzato
  // disponibile su gran parte del mese esaurisce il monte ore nei primi giorni, quindi nel passaggio
  // 1 "vince" solo turni ammucchiati all'inizio — e l'equidistante su quel pool ristretto li tiene
  // ammucchiati (bug del collaudo reale: DET24 disponibile tutte le notti + Max turni mese 4 →
  // giorni 1,2,4,7 invece di ~4,12,20,28; e il caso più comune: INDET tutte le notti + tetto_mese 8 =
  // monte ore → 8 turni ammucchiati invece che sparsi). L'ammucchiamento nasce OGNI VOLTA che il medico
  // è disponibile su più turni del proprio tetto (§3.11 = min(monte ore implicito, Max turni mese)),
  // indipendentemente dal PERCHÉ il tetto morde — non solo quando un cap esplicito è più restrittivo
  // del monte ore. Per questo il pool va ricalcolato su TUTTO il mese per OGNI medico con un tetto:
  // un oracolo per-medico che esenta SOLO quel medico dal blocco monte ore (§3.4) — così "vince" tutti
  // i turni di cui è il legittimo vincitore per gerarchia sull'intero mese, e l'equidistante li sparge
  // davvero. Il pool esente ⊇ pool P1 (esentare aggiunge solo candidature, mai ne toglie): si adotta
  // solo se più ampio, altrimenti resta il P1 (medico che non esaurisce il monte ore → nessun cambio).
  // Il passaggio 2 resta invariato (blocco monte ore + tetto rigido live): il medico non supera mai né
  // monte ore né tetto. Gate ristretto ai contrattualizzati con tetto: i senza incarico non hanno monte
  // ore, non si esauriscono mai, il loro pool già copre tutto il mese e non serve alcun oracolo dedicato.
  MEDICI.forEach((m) => {
    if (debiti0[m.id] === null) return; // senza incarico: nessun monte ore da esaurire, pool già completo
    if (tetto[m.id] === null) return; // nessun tetto di distribuzione: niente da correggere
    // Il pool esente differisce dal P1 SOLO se m ha ESAURITO il monte ore in P1 (l'esenzione aggiunge
    // esclusivamente i turni che m avrebbe vinto DOPO l'esaurimento). Se non l'ha esaurito, esente == P1
    // e il ricalcolo sarebbe un no-op: lo si salta (correttezza-neutra, evita un eseguiMese inutile per
    // ogni contrattualizzato non ammucchiato). Esaurito ⟺ pool P1 == turni del monte ore (P1 ≤ implicito
    // sempre, per il blocco §3.4): quando la disponibilità supera il tetto tramite un cap esplicito più
    // basso ma SENZA esaurire il monte ore, il pool P1 copre già tutta la disponibilità e la distribuzione
    // ci lavora direttamente sotto (nessun turno "nascosto" da recuperare).
    const implicito = Math.max(0, Math.round((debiti0[m.id] + (debitiExtra0[m.id] || 0)) / 12));
    if (poolDi[m.id].length < implicito) return; // monte ore NON esaurito in P1: esente == P1, nessun ricalcolo utile
    const { risultati: rM } = eseguiMese({ ...debiti0 }, { ...debitiExtra0 }, {}, null, null, new Set([m.id]));
    const esente = estraiVinti(rM, m.id);
    if (esente.length > poolDi[m.id].length) poolDi[m.id] = esente; // adotta il pool esente solo se più ampio del P1
  });

  // Per ogni medico che supera il proprio tetto: raggruppa i turni EFFETTIVAMENTE vinti per
  // livello della sede verde ottenuta (1 = più desiderata) e riempie il tetto residuo partendo
  // dal livello migliore, esaurendo interamente ogni livello prima di considerare il successivo —
  // la priorità di sede è ASSOLUTA sull'equidistanza: un livello viene anche solo toccato SOLO dopo
  // che tutti i livelli migliori sono stati riempiti per intero. Solo quando un livello non entra
  // per intero nel tetto residuo se ne sceglie il sottoinsieme da tenere: il PRIMO livello mai
  // ridotto (nessun livello migliore fissato prima) usa la pura equidistanza posizionale
  // (scegliIndiciEquidistanti, comportamento invariato); un livello successivo ridotto tiene conto
  // ANCHE della distanza dai giorni già fissati dai livelli migliori (scegliConRiferimento) — così i
  // gruppi si incastrano invece di sovrapporsi in giorni consecutivi. Il resto di quel livello e
  // tutti i livelli peggiori successivi sono interamente marcati "da cedere" (§3.11).
  const cessioniPerSlot = new Map(); // slotKey -> Set<mid> di chi cede QUEL turno specifico
  MEDICI.forEach((m) => {
    const cap = tetto[m.id];
    if (cap === null) return;
    const pool = poolDi[m.id]; // turni vinti (oracolo normale, o oracolo per-medico esente se un cap esplicito morde)
    if (pool.length <= cap) return;
    const perLivello = new Map();
    pool.forEach((v) => {
      if (!perLivello.has(v.livello)) perLivello.set(v.livello, []);
      perLivello.get(v.livello).push(v); // già in ordine cronologico (pool costruito su voci)
    });
    const livelliOrdinati = [...perLivello.keys()].sort((a, b) => a - b);
    const kept = new Set();
    const giorniFissi = [...(riferimentiCavallo[m.id] || [])]; // seed: i giorni di luglio (settimana a cavallo, offset ≤0) da cui allontanarsi (§10 voce 46 PASSO 2); vuoto = comportamento identico a prima
    let residuo = cap;
    // Slot OBBLIGATORI (§10 voce 49): slot che il medico vuole tenere ASSOLUTAMENTE se li vince per
    // gerarchia (chiave dispo[mid]["OBBL:"+slotKey]). Sono già nel pool (= vinti; se non vinti sono
    // ignorati). Entrano SEMPRE in kept, fanno da PUNTI FISSI per la distribuzione (seed di giorniFissi,
    // così l'equidistante ci costruisce attorno) e CONSUMANO il tetto (residuo = cap − obbligatori).
    // Possono scavalcare la priorità di livello (un obbligatorio di livello peggiore è tenuto comunque).
    // Se sono PIÙ del tetto, se ne tiene un sottoinsieme equidistante (il tetto resta rigido). Vuoto =
    // comportamento identico a prima (nessuna chiave OBBL: → residuo = cap, filtro kept vuoto).
    const dm = dispo[m.id] || {};
    // Giorni su cui il medico ha una blu dichiarata (copertura a distanza): tiebreak per scegliConRiferimento
    // (§10 voce 56). Vuoto o "tutti i giorni" (blu assente / uniforme) → nessun effetto; utile solo su blu parziale.
    const giorniBluDelMedico = new Set();
    pool.forEach((v) => { if (normDispo(dm[v.slotKey]).blu.length) giorniBluDelMedico.add(v.giorno); });
    // Slot da tenere SEMPRE come PUNTI FISSI (§10 voce 49): (a) slot OBBLIGATORI espliciti — valore OBBL:
    // true = pin LIBERO (qualsiasi sede vinta va bene), stringa = pin SEDE (scatta solo se la sede vinta
    // in P1 combacia, altrimenti ignorato); (b) turni MMG (extra) vinti in P1 — l'MMG conta nel tetto come
    // un turno qualsiasi (invariante preservato) ma NON è mai cedibile dalla distribuzione: è un'ancora, e
    // le guardie libere si distribuiscono attorno ai suoi giorni. Consumano il tetto; se sono più del tetto
    // se ne tiene un sottoinsieme equidistante (tetto rigido). Vuoto = comportamento identico a prima.
    const èObbligatorioBase = (v) => { if (v.extra) return true; const o = dm["OBBL:" + v.slotKey]; return o === true || (typeof o === "string" && o === v.sede); };
    // FINESTRE SETTIMANALI (§10 voce 57, Part A — bias): per ogni settimana con un minimo dichiarato
    // (SETTWK), àncora i MIGLIORI N turni vinti in quella settimana (gerarchia: livello di sede ↑, poi
    // cronologico) come punti fissi, esattamente come gli obbligatori. Gli OBBL/MMG già presenti nella
    // settimana CONTANO verso il minimo (niente doppio conteggio): si forzano solo i turni mancanti.
    // Il pool è già limitato ai turni IN-MESE, quindi le settimane troncate ai bordi contano solo i
    // loro giorni del mese; se ne offrono meno di N si forzano tutti (Part B poi emette l'avviso). Il
    // tetto mensile resta RIGIDO: se i forzati eccedono il tetto, la gestione obblVinti>cap sotto decide
    // e Part B avvisa. Vuoto = comportamento identico a prima (nessuna chiave SETTWK).
    const finestreForzate = new Set();
    Object.keys(dm).forEach((k) => {
      if (!k.startsWith("SETTWK:")) return;
      const N = finestraSettimanale(dispo, m.id, k.slice(7));
      if (N === null) return;
      const wk = k.slice(7);
      const pw = pool.filter((v) => settimanaDi(dk(anno, mese, v.giorno)) === wk)
        .sort((a, b) => a.livello - b.livello || a.giorno - b.giorno || (a.slotKey < b.slotKey ? -1 : a.slotKey > b.slotKey ? 1 : 0));
      const giaPin = pw.filter(èObbligatorioBase).length;
      pw.filter((v) => !èObbligatorioBase(v)).slice(0, Math.max(0, N - giaPin)).forEach((v) => finestreForzate.add(v.slotKey));
    });
    // PREFERENZA TURNO §3.9 (§10 voce 61): se il medico ha vinto sia il diurno sia il notturno dello
    // STESSO giorno e ha dichiarato una preferenza (TURNOPREF), il turno PREFERITO diventa un punto fisso
    // (pin in kept, come un obbligatorio) — così la distribuzione §3.11 gli costruisce attorno invece di
    // cederlo, e nel PASSAGGIO 2 il medico lavora il turno che voleva. Il turno non preferito resta un
    // candidato ordinario (tipicamente ceduto a un backup). Si attiva SOLO quando vince ENTRAMBI i turni
    // del giorno (unico caso in cui §3.9 avrebbe senso): se ne vince uno solo, nessun effetto. Vuoto =
    // comportamento identico a prima (nessuna chiave TURNOPREF, o preferenza non corrispondente a un vinto).
    const prefForzati = new Set();
    pool.forEach((v) => {
      const pref = turnoPrefDi(dispo, m.id, v.slotKey.split("|")[0]);
      if (!pref || !v.slotKey.endsWith(`|${pref}`)) return;
      const altroKey = v.slotKey.replace(/\|[GN]$/, pref === "G" ? "|N" : "|G");
      if (pool.some((p) => p.slotKey === altroKey)) prefForzati.add(v.slotKey); // ha vinto anche l'altro turno
    });
    const obblVinti = pool.filter((v) => èObbligatorioBase(v) || finestreForzate.has(v.slotKey) || prefForzati.has(v.slotKey));
    if (obblVinti.length) {
      const tenObbl = obblVinti.length <= cap ? obblVinti.map((v) => v.slotKey) : scegliConRiferimento(obblVinti, cap, giorniFissi, giorniBluDelMedico);
      tenObbl.forEach((sk) => { kept.add(sk); giorniFissi.push(obblVinti.find((x) => x.slotKey === sk).giorno); });
      residuo = cap - kept.size;
    }
    livelliOrdinati.forEach((liv) => {
      if (residuo <= 0) return;
      const gruppo = perLivello.get(liv).filter((v) => !kept.has(v.slotKey)); // esclude gli obbligatori già tenuti
      if (!gruppo.length) return;
      if (gruppo.length <= residuo) {
        gruppo.forEach((v) => { kept.add(v.slotKey); giorniFissi.push(v.giorno); });
        residuo -= gruppo.length;
      } else {
        scegliConRiferimento(gruppo, residuo, giorniFissi, giorniBluDelMedico).forEach((slotKey) => kept.add(slotKey));
        residuo = 0;
      }
    });
    pool.forEach(({ slotKey }) => {
      if (kept.has(slotKey)) return;
      if (!cessioniPerSlot.has(slotKey)) cessioniPerSlot.set(slotKey, new Set());
      cessioniPerSlot.get(slotKey).add(m.id);
    });
  });

  // ---- PASSAGGIO 2 (CONTEXT.md §3.11): rielaborazione pulita e DEFINITIVA ----
  // Rifà l'intero mese da zero (stato iniziale, nessun residuo dal passaggio 1) applicando le
  // cessioni decise sopra, e facendo rispettare il tetto RIGIDAMENTE per QUALUNQUE medico lo
  // raggiunga durante questo stesso passaggio — non solo a chi il passaggio 1 aveva segnalato:
  // le esclusioni cambiano le dinamiche del mese (un concorrente escluso oggi può far vincere un
  // altro medico un giorno che nel passaggio 1 non avrebbe vinto), quindi il conteggio va tenuto
  // vivo turno per turno. Il tetto non si supera MAI: se un turno ceduto non trova nessun altro
  // candidato disponibile, resta SCOPERTO (la copertura non prevale sul tetto dichiarato).
  const debiti = { ...debiti0 };
  const debitiExtra = { ...debitiExtra0 };
  const settimanaCount = {}; // mid -> { weekKey: numero di turni già assegnati quella settimana }
  const contoMensile = {};   // mid -> turni fisici/extra già confermati nel passaggio 2, finora
  MEDICI.forEach((m) => (contoMensile[m.id] = 0));
  const escludiPerSlot = (slotKey) => {
    const esclusi = new Set(cessioniPerSlot.get(slotKey) || []);
    MEDICI.forEach((m) => { if (tetto[m.id] !== null && contoMensile[m.id] >= tetto[m.id]) esclusi.add(m.id); });
    return esclusi;
  };
  const aggiornaContoMensile = (turno, turnoOut) => {
    // MMG unificati: il vincitore fisico (r.fis) consuma il tetto come un turno qualsiasi.
    turnoOut.fis.forEach((si) => { if (turnoOut.slots[si]) contoMensile[turnoOut.slots[si]]++; });
  };
  const { risultati, avvisiRaw } = eseguiMese(debiti, debitiExtra, settimanaCount, escludiPerSlot, aggiornaContoMensile);

  // PREFERENZA TURNO stesso giorno (G/N) (CONTEXT.md §3.9): se un medico vince FISICAMENTE sia
  // il diurno che il notturno dello stesso giorno (possibile solo weekend/festivi/prefestivi, gli
  // unici con entrambi i turni) e ha dichiarato una preferenza esplicita di turno per quel
  // giorno, il turno NON preferito viene liberato a favore di un alternativo che abbia
  // dichiarato quella sede come verde — sempre che un'alternativa esista: la copertura vince
  // sempre, esattamente come per la spaziatura temporale (§3.7). Non cambia mai CHI vince un
  // conflitto, solo quale dei due turni il vincitore mantiene. Eseguita dopo che tutti i turni
  // del mese sono stati elaborati, per conoscere l'esito di entrambi i turni dello stesso giorno.
  //
  // GUARDIA TITOLARITÀ per l'alternativa (§3.1a): l'alternativa che rileva il turno ceduto viene
  // introdotta FISICAMENTE nel turno con un'assegnazione diretta che NON passa dalla correzione di
  // titolarità della FASE1 (correggiTitolarita gira solo dentro elaboraTurno). Va quindi esclusa
  // ogni alternativa che, piazzata sulla sede ceduta, resterebbe fisicamente fuori dalla PROPRIA
  // sede di titolarità mentre quella è tenuta da un altro determinato non titolare di essa — cioè
  // esattamente il furto di titolarità che §3.1a vieta (bug reale emerso solo esercitando lo
  // scambio dalla simulazione, §10 voce 22, caso 3). Esclusa la sola alternativa "colpevole": lo
  // scambio ne cerca un'altra o, se non ce n'è, il medico resta su entrambi i turni (stato
  // legittimo pre-scambio — lo scambio è facoltativo, la correttezza vince sempre). I titolari con
  // turni extra dichiarati NON sono protetti, coerentemente con §3.1a (il turno extra li fa
  // competere come senza incarico una volta esaurito il debito ordinario, perdendo la titolarità).
  const rompeTitolarita = (oId, sedeCeduta, target, tsk) => {
    if (!isDeterminato(oId) || turniExtra[oId]) return false;
    const S2 = byId[oId].sedeContratto;
    if (!S2 || S2 === sedeCeduta) return false; // non titolare, o proprio la sede che gli daremmo
    const vo = normDispo(dispo[oId]?.[tsk]);
    if (vo.no || !vo.verde.includes(S2)) return false;
    if (ordinaPerLivello(vo.verde, vo.verdeLiv, MAX_LIV_VERDE)[0] !== S2) return false; // oggi la sua prima scelta non è la sua sede: non forziamo
    const siS2 = SEDI5.indexOf(S2);
    const occ2 = target.slots[siS2];
    if (occ2 == null || occ2 === oId) return false; // sua sede libera o già sua: nessuna violazione
    if (!isDeterminato(occ2) || byId[occ2].sedeContratto === S2) return false; // occupante non determinato, o titolare della stessa sede: legittimo
    return true;
  };
  for (let d = 1; d <= nGiorni; d++) {
    const dataStr = dk(anno, mese, d);
    const outG = risultati[`${d}|G`];
    const outN = risultati[`${d}|N`];
    if (!outG || !outN) continue; // giorno feriale semplice: niente diurno, nessun doppio turno possibile
    const doppiFisici = outG.fis.map((si) => outG.slots[si]).filter((mid) => mid !== null && outN.fis.some((si2) => outN.slots[si2] === mid));
    const turniScambiati = new Set(); // turni (outG/outN) il cui insieme di fisici è cambiato per uno scambio
    doppiFisici.forEach((mid) => {
      const pref = turnoPrefDi(dispo, mid, dataStr);
      if (!pref) return;
      const target = pref === "G" ? outN : outG;
      const targetId = pref === "G" ? "N" : "G";
      const targetSlotKey = `${dataStr}|${targetId}`;
      const si = target.fis.find((i) => target.slots[i] === mid);
      if (si === undefined) return; // già liberato da un giro precedente in questo stesso ciclo
      const sede = SEDI5[si];
      // L'alternativa non può già aver raggiunto il proprio tetto di distribuzione (§3.11): questo
      // scambio le farebbe vincere un turno IN PIÙ quel giorno, e il tetto non si supera mai.
      const alternativa = candidatiOrdinati(dispo, debiti, debitiExtra, settimanaCount, targetSlotKey)
        .find((o) => o.id !== mid && !target.slots.includes(o.id) && (tetto[o.id] === null || contoMensile[o.id] < tetto[o.id]) && normDispo(dispo[o.id]?.[targetSlotKey]).verde.includes(sede) && !rompeTitolarita(o.id, sede, target, targetSlotKey));
      if (!alternativa) return; // nessuna alternativa: la copertura vince, resta assegnato a entrambi
      target.slots[si] = alternativa.id;
      // Storna/scala lo stesso pool (debito ordinario o extra) che il turno aveva effettivamente
      // consumato per ciascuno, in base al segno corrente — coerente con scalaDebito in elaboraTurno.
      if (debiti[mid] !== null) {
        if (debiti[mid] > 0) debiti[mid] += target.ore;
        else debitiExtra[mid] = (debitiExtra[mid] || 0) + target.ore;
      }
      if (debiti[alternativa.id] !== null) {
        if (debiti[alternativa.id] > 0) debiti[alternativa.id] -= target.ore;
        else debitiExtra[alternativa.id] = (debitiExtra[alternativa.id] || 0) - target.ore;
      }
      const wk = settimanaDi(dataStr);
      if (settimanaCount[mid]) settimanaCount[mid][wk] = Math.max(0, (settimanaCount[mid][wk] || 0) - 1);
      settimanaCount[alternativa.id] = settimanaCount[alternativa.id] || {};
      settimanaCount[alternativa.id][wk] = (settimanaCount[alternativa.id][wk] || 0) + 1;
      contoMensile[mid] = Math.max(0, contoMensile[mid] - 1);
      contoMensile[alternativa.id] = (contoMensile[alternativa.id] || 0) + 1;
      turniScambiati.add(target);
    });
    // Dopo lo scambio §3.9 l'insieme dei medici FISICAMENTE presenti nel turno ceduto è cambiato:
    // il medico uscito potrebbe aver lasciato orfana una sua copertura a distanza (blu) in quel
    // turno, e l'entrato potrebbe averne una da offrire. La copertura a distanza va quindi rifatta
    // da capo con il nuovo insieme di presenti — coerente con la filosofia "la copertura vince"
    // (§3.7): la sede passa a un altro fisico che l'abbia dichiarata blu, e resta scoperta solo se
    // davvero non c'è nessuno. Rispetta gli stessi vincoli del fisico (gerarchia, max 1 blu/medico)
    // perché usa la STESSA identica risoluzione (risolviBlu) della FASE 2 dell'elaborazione.
    turniScambiati.forEach((out) => {
      const skRic = `${dataStr}|${out.id}`;
      for (let i = 0; i < out.slots.length; i++) if (!out.fis.includes(i)) out.slots[i] = null; // azzera la vecchia copertura a distanza
      const sedeFisicaOut = {};
      out.fis.forEach((i) => { if (out.slots[i] !== null && out.slots[i] !== undefined) sedeFisicaOut[out.slots[i]] = i; });
      const fisMids = Object.keys(sedeFisicaOut).map(Number);
      const sedeBluDi = risolviBlu(fisMids, sedeFisicaOut, skRic, dispo, debiti, debitiExtra);
      Object.entries(sedeBluDi).forEach(([iStr, id]) => { out.slots[Number(iStr)] = id; });
    });
  }

  // Ricompone lo schema in ordine di calendario (l'ordine di elaborazione sopra era solo
  // interno, per il consumo del debito — l'output resta sempre cronologico)
  const schema = [];
  for (let d = 1; d <= nGiorni; d++) {
    const info = turniDelGiorno(anno, mese, d, extras);
    const turniOut = info.turni.map((turno) => risultati[`${d}|${turno.id}`]);
    schema.push({ giorno: d, key: info.key, dow: info.dow, festivo: info.festivo, prefestivo: info.prefestivo, weekend: info.weekend, turni: turniOut });
  }
  // GUARDIANO TITOLARITÀ (§3.1a, §10 voce 33): controllo finale puramente ADDITIVO — dopo TUTTE le
  // correzioni (correggiTitolarita ×2, scambio preferenza turno §3.9, step 4° medico §10 voce 32),
  // verifica se è rimasto un titolare fuori dalla propria sede di titolarità mentre quella sede è
  // tenuta da un altro determinato NON titolare: il residuo raro che le catene di ricollocazione
  // ricorsiva profonde lasciano sfuggire (§10). NON corregge — tentare di correggere di più
  // introduce regressioni note (perdita di copertura, §10) — genera SOLO un avviso perché il
  // coordinatore sistemi a mano quel turno. Non cambia MAI alcuna assegnazione. Stessa identica
  // condizione (ed esclusioni) dell'invariante INV-TITOLARE del test di simulazione: titolare
  // determinato senza turni extra, sede di titolarità come sua PRIMA scelta verde oggi, occupata da
  // un determinato non titolare di quella sede, mentre lui è fisico altrove nello stesso turno.
  for (let d = 1; d <= nGiorni; d++) {
    const info = turniDelGiorno(anno, mese, d, extras);
    info.turni.forEach((turno) => {
      if (turno.extra) return;
      const out = risultati[`${d}|${turno.id}`];
      if (!out) return;
      MEDICI.forEach((m) => {
        if (!isDeterminato(m.id) || byId[m.id].sedeContratto === null || turniExtra[m.id]) return;
        const S = byId[m.id].sedeContratto;
        const si = SEDI5.indexOf(S);
        const v = normDispo(dispo[m.id]?.[`${info.key}|${turno.id}`]);
        if (v.no || !v.verde.includes(S)) return;
        if (ordinaPerLivello(v.verde, v.verdeLiv, MAX_LIV_VERDE)[0] !== S) return;
        const occ = out.slots[si];
        if (occ === null || occ === undefined || occ === m.id) return;
        if (!isDeterminato(occ) || byId[occ].sedeContratto === S) return;
        const suoFisico = out.fis.find((fi) => out.slots[fi] === m.id);
        if (suoFisico !== undefined && suoFisico !== si) {
          avvisiRaw.push({ d, testo: `Giorno ${d} · ${out.label}: titolare ${m.nome} di ${S} assegnato altrove (${SEDI5[suoFisico]}); la sua sede di titolarità è coperta da ${byId[occ].nome} (non titolare). Valutare un intervento manuale su questo turno.` });
        }
      });
    });
  }

  // FINESTRE SETTIMANALI (§10 voce 57, Part B — report): sullo schema DEFINITIVO conta quanti turni
  // ogni medico tiene davvero nelle settimane in cui ha dichiarato un minimo (SETTWK), e avvisa se sono
  // meno di N. Conta solo i turni FISICI IN-MESE (le settimane troncate contano ciò che c'è di questo
  // mese, mai giorni del mese precedente). Distingue il motivo: gerarchia insufficiente (ha vinto < N)
  // oppure tetto mensile/distribuzione (avrebbe vinto ≥ N ma il tetto rigido ne ha ceduti).
  MEDICI.forEach((m) => {
    const perM = dispo[m.id] || {};
    Object.keys(perM).forEach((k) => {
      if (!k.startsWith("SETTWK:")) return;
      const wk = k.slice(7);
      const N = finestraSettimanale(dispo, m.id, wk);
      if (N === null) return;
      let assegnati = 0, primoGiorno = null;
      for (let d = 1; d <= nGiorni; d++) {
        if (settimanaDi(dk(anno, mese, d)) !== wk) continue;
        if (primoGiorno === null) primoGiorno = d;
        turniDelGiorno(anno, mese, d, extras).turni.forEach((turno) => {
          const out = risultati[`${d}|${turno.id}`];
          if (out && out.fis.some((si) => out.slots[si] === m.id)) assegnati++;
        });
      }
      if (primoGiorno === null || assegnati >= N) return; // settimana senza giorni in-mese, o vincolo soddisfatto
      const vinti = (poolDi[m.id] || []).filter((v) => settimanaDi(dk(anno, mese, v.giorno)) === wk).length;
      const motivo = vinti < N ? `ne ha vinti per gerarchia solo ${vinti}` : `limitato dal tetto mensile o dalla distribuzione`;
      avvisiRaw.push({ d: primoGiorno, testo: `Settimana del ${primoGiorno} ${MESI_IT[mese].toLowerCase()}: ${m.nome} voleva almeno ${N} turn${N === 1 ? "o" : "i"} ma ne mantiene ${assegnati} (${motivo}). Valutare un intervento manuale se opportuno.` });
    });
  });

  avvisiRaw.sort((a, b) => a.d - b.d);
  const avvisi = avvisiRaw.map((a) => a.testo);

  return { schema, avvisi };
}

// sede primaria di un medico = la sede FISICA in cui si trova (registrata dal motore);
// se non disponibile (modifiche manuali), prima posizione in cui compare
function sedePrimaria(slots, mid, fis) {
  if (fis) for (const i of fis) if (slots[i] === mid) return i;
  for (let i = 0; i < slots.length; i++) if (slots[i] === mid) return i;
  return -1;
}
function notaSlot(slots, si, fis) {
  const mid = slots[si];
  if (!mid) return { testo: "", tipo: "vuoto" };
  const prim = sedePrimaria(slots, mid, fis);
  if (prim === si) {
    const altre = [];
    for (let i = 0; i < slots.length; i++) if (i !== si && slots[i] === mid) altre.push(SEDI5[i]);
    return { testo: altre.length ? `*copre ${altre.join(", ")}` : "", tipo: "primaria" };
  }
  return { testo: `*coperto da ${SEDI5[prim]}`, tipo: "copertura" };
}

// Legge lo STATO REALE di un medico direttamente dai DATI (dispo + tetto mensile), senza passare dal
// riassunto dell'AI: è la fonte di verità per verificare cosa è DAVVERO stato inserito nel mese corrente.
// Pura; ritorna un oggetto strutturato (la formattazione per chat/pannello sta nel COMPONENTE).
//   disponibilita: [{giorno, turno, no, verde:[{sede,liv}], blu:[{sede,liv}]}] ordinati per giorno/turno
//   tettoMese: numero | null ; tettiSettimanali: [{settimana, max}] (chiavi SETT:) ; preferenzeTurno: [{giorno, turno}] (chiavi TURNOPREF:)
function statoRealeMedico(mid, dispo, maxTurniMese) {
  const d = dispo[mid] || {};
  const disponibilita = [], tettiSettimanali = [], preferenzeTurno = [], slotObbligatori = [], finestreSettimanali = [];
  Object.keys(d).forEach((sk) => {
    if (sk.startsWith("SETTWK:")) { finestreSettimanali.push({ settimana: sk.slice(7), min: d[sk] }); return; }
    if (sk.startsWith("SETT:")) { tettiSettimanali.push({ settimana: sk.slice(5), max: d[sk] && d[sk].maxTurni }); return; }
    if (sk.startsWith("TURNOPREF:")) { preferenzeTurno.push({ giorno: Number(sk.slice(-2)), turno: d[sk] }); return; }
    if (sk.startsWith("OBBL:")) { if (d[sk]) { const [dt2, tu2] = sk.slice(5).split("|"); slotObbligatori.push({ giorno: Number(dt2.slice(8, 10)), turno: tu2, sede: typeof d[sk] === "string" ? d[sk] : null }); } return; }
    const [dt, tu] = sk.split("|");
    const nv = normDispo(d[sk]);
    disponibilita.push({
      giorno: Number(dt.slice(8, 10)), turno: tu, no: nv.no,
      verde: nv.no ? [] : ordinaPerLivello(nv.verde, nv.verdeLiv, MAX_LIV_VERDE).map((s) => ({ sede: s, liv: nv.verdeLiv[s] || 1 })),
      blu: nv.no ? [] : ordinaPerLivello(nv.blu, nv.bluLiv, MAX_LIV_BLU).map((s) => ({ sede: s, liv: nv.bluLiv[s] || 1 })),
    });
  });
  disponibilita.sort((a, b) => a.giorno - b.giorno || (a.turno < b.turno ? -1 : a.turno > b.turno ? 1 : 0));
  tettiSettimanali.sort((a, b) => (a.settimana < b.settimana ? -1 : a.settimana > b.settimana ? 1 : 0));
  finestreSettimanali.sort((a, b) => (a.settimana < b.settimana ? -1 : a.settimana > b.settimana ? 1 : 0));
  preferenzeTurno.sort((a, b) => a.giorno - b.giorno);
  slotObbligatori.sort((a, b) => a.giorno - b.giorno || (a.turno < b.turno ? -1 : a.turno > b.turno ? 1 : 0));
  return { tettoMese: (maxTurniMese && maxTurniMese[mid] != null) ? maxTurniMese[mid] : null, disponibilita, tettiSettimanali, finestreSettimanali, preferenzeTurno, slotObbligatori };
}

// Cancella TUTTE le disponibilità del mese di un medico (slot + tetti settimanali "SETT:" + finestre
// settimanali "SETTWK:" + preferenze turno "TURNOPREF:" + slot obbligatori "OBBL:" — l'oggetto viene
// azzerato per intero), lasciando INTATTI gli altri medici. Il tetto MENSILE (maxTurniMese) è stato a
// parte e va azzerato dal chiamante. Pura: ritorna una nuova dispo, non muta l'originale.
function azzeraDispoMedico(dispo, mid) {
  return { ...dispo, [mid]: {} };
}

// ============ COMPONENTE ============

// ---- Indicatore "iniquità percepita" sui turni extra (tab Medici) — SOLO VISUALIZZAZIONE ----
// Nessun impatto su motore/assegnazione/calcoli: usa soltanto lo schema già prodotto. Soglie
// facilmente tarabili a mano dopo averle viste sul campo. Il "divario" del SINGOLO medico è la
// distanza (in punti percentuali) tra la sua soddisfazione (ottenuti ÷ richiesti) e quella del più
// soddisfatto tra i medici che hanno chiesto turni extra; viene tradotta in un'etichetta secondo
// queste soglie crescenti (equità di Adams: il risentimento nasce dal confronto, non dal valore
// assoluto). "Nessuna" = nessuno gli è stato preferito in modo apprezzabile.
const INIQUITA_SOGLIE = [
  { maxDivario: 15, label: "Nessuna" },       // divario ≤ 15 punti
  { maxDivario: 35, label: "Bassa" },         // 16–35
  { maxDivario: 55, label: "Media" },         // 36–55
  { maxDivario: 75, label: "Alta" },          // 56–75
  { maxDivario: Infinity, label: "Altissima" },// > 75
];

// Estrae il primo oggetto JSON valido e "riconoscibile" (con un campo "tipo") da un testo che
// potrebbe contenere un preambolo prima o dopo il JSON (es. un ragionamento scritto per errore
// dal modello, in violazione delle istruzioni "RISPONDI SOLO con JSON"). Più robusto di una
// semplice ricerca "prima { ultima }": conta la profondità delle graffe rispettando le stringhe
// tra virgolette (per non confondersi con graffe dentro un valore testuale) e prova ogni "{" nel
// testo come possibile inizio, così una graffa estranea nel preambolo (es. notazione matematica
// come "h = (...) mod 7") non fa fallire l'estrazione del JSON vero.
function estraiJsonBilanciato(testo) {
  for (let i = 0; i < testo.length; i++) {
    if (testo[i] !== "{") continue;
    let profondita = 0, dentroStringa = false, escape = false;
    for (let j = i; j < testo.length; j++) {
      const ch = testo[j];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { dentroStringa = !dentroStringa; continue; }
      if (dentroStringa) continue;
      if (ch === "{") profondita++;
      else if (ch === "}") {
        profondita--;
        if (profondita === 0) {
          try {
            const obj = JSON.parse(testo.slice(i, j + 1));
            if (obj && typeof obj === "object" && obj.tipo) return obj;
          } catch (e) { /* candidato non valido, prova il prossimo "{" */ }
          break;
        }
      }
    }
  }
  return null;
}

function App() {
  const [meseIdx, setMeseIdx] = useState(0);
  const [store, setStore] = useState({});
  const historyRef = useRef({ past: [], future: [] });
  const [, forceRender] = useState(0);
  const [tab, setTab] = useState("dispo");
  const [avvisiAperti, setAvvisiAperti] = useState(true); // banner avvisi motore (tab Schema): aperto di default dopo l'elaborazione
  const [statoAperto, setStatoAperto] = useState(null); // id del medico con il pannello "stato reale" aperto nel tab Medici
  const [settAperto, setSettAperto] = useState(null); // id del medico con il pannellino "tetti per settimana" aperto
  const [turniPrecAperto, setTurniPrecAperto] = useState(null); // id del medico col riquadro collassabile "turni già fatti a fine mese prec." aperto
  const [editCella, setEditCella] = useState(null); // {mid, slotKey}
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMsgs, setAiMsgs] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  // Modello dell'assistente AI, scelto dal pannello chat e persistito in localStorage (chiave "sonnet"/"opus";
  // il model string vero è mappato al momento della chiamata API). Default: Sonnet (veloce, modello attuale).
  const MODELLI_AI = { sonnet: { modello: "claude-sonnet-5", nome: "Sonnet", desc: "veloce, modello attuale" }, opus: { modello: "claude-opus-4-8", nome: "Opus", desc: "più accurato, più lento" } };
  const [aiModel, setAiModel] = useState(() => { try { return localStorage.getItem("gmn_ai_model") === "opus" ? "opus" : "sonnet"; } catch (e) { return "sonnet"; } });
  const cambiaModello = (k) => { setAiModel(k); try { localStorage.setItem("gmn_ai_model", k); } catch (e) { /* storage non disponibile: la scelta resta valida per la sessione */ } };
  // Livello di ragionamento (effort) dell'assistente AI, scelto dal pannello chat e persistito in localStorage.
  // Passato al body come output_config.effort (sintassi identica per Sonnet 5 e Opus 4.8). Default: "high"
  // (= comportamento attuale: high è già il default del server, quindi di default non cambia nulla).
  const EFFORT_AI = { low: { nome: "Low", desc: "veloce, meno ragionamento" }, medium: { nome: "Medium", desc: "bilanciato" }, high: { nome: "High", desc: "massima accuratezza" } };
  const [aiEffort, setAiEffort] = useState(() => { try { const v = localStorage.getItem("gmn_ai_effort"); return (v === "low" || v === "medium") ? v : "high"; } catch (e) { return "high"; } });
  const cambiaEffort = (k) => { setAiEffort(k); try { localStorage.setItem("gmn_ai_effort", k); } catch (e) { /* storage non disponibile: la scelta resta valida per la sessione */ } };
  const [proposta, setProposta] = useState(null); // {azioni, spiegazione}
  const [azioniRestanti, setAzioniRestanti] = useState(false); // true se l'AI ha altre azioni per un round successivo
  const [troncato, setTroncato] = useState(false); // true se l'ultima risposta è stata tagliata per limite di token (JSON incompleto)
  const [completato, setCompletato] = useState(false); // true dopo aver applicato l'ultimo round quando non ce ne sono altri (banner "Completato ✓")
  const ultimaDomandaRef = useRef(""); // richiesta originale dell'utente, per poterla ripetere se una risposta viene troncata
  // Registro temporaneo (solo React state, MAI salvato su storage permanente) delle azioni già
  // confermate nella conversazione AI corrente, in formato compatto "MEDICO g{giorno}{turno}".
  // Inviato all'AI ad ogni round come ulteriore fonte di verità anti-loop (oltre a disponibilitaPresenti
  // e alla cronologia della chat) e azzerato con "Nuova conversazione".
  const [azioniEseguite, setAzioniEseguite] = useState([]);
  // Domande Sì/No dell'AI su ambiguità con una scelta binaria chiara (es. attivare o no un MMG
  // mancante): [{giorno, medico, situazione, domanda, seSi:[azioni], seNo:[azioni]}, ...].
  const [domande, setDomande] = useState([]);
  const [avvisi, setAvvisi] = useState([]); // avvisi 🔴/ℹ️ del round corrente (campo "avvisi" della risposta AI, voce A2)
  const [caricato, setCaricato] = useState(false);
  const [rapidoOpen, setRapidoOpen] = useState(false);
  const [rapMedico, setRapMedico] = useState(MEDICI[0].id);
  const [rapInizio, setRapInizio] = useState("");
  const [rapFine, setRapFine] = useState("");
  const [rapNotte, setRapNotte] = useState(true);
  const [rapGiorno, setRapGiorno] = useState(false);
  const [rapSedi, setRapSedi] = useState({}); // sede -> 'verde' | 'blu'
  const [rapIndisp, setRapIndisp] = useState([]); // [{inizio, fine}] periodi di indisponibilità
  const [rapMaxSettimana, setRapMaxSettimana] = useState(""); // "" = nessun tetto, altrimenti numero
  const [confermaAzzera, setConfermaAzzera] = useState(false); // doppio tocco per azzerare il mese
  const azzeraTimer = useRef(null);
  const [nuovoMedico, setNuovoMedico] = useState({ nome: "", cat: "SENZA", grad: "", sedeContratto: "" });

  // Caricamento persistente all'avvio.
  // La chiave include una versione: cambiarla forza una partenza pulita senza residui.
  const STORAGE_KEY = "gm-turni-store-v3";
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(STORAGE_KEY);
        if (r?.value) setStore(JSON.parse(r.value));
      } catch (e) { /* nessun salvataggio precedente */ }
      setCaricato(true);
    })();
  }, []);

  const salva = (s) => {
    try { window.storage.set(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* offline */ }
  };

  const { anno, mese } = MESI_DISPONIBILI[meseIdx];
  const key = mk(anno, mese);
  const vuotoMese = { dispo: {}, extras: {}, extraOre: {}, turniExtra: {}, maxTurniMese: {}, schema: null, avvisi: [] };
  const dati = store[key] || vuotoMese;
  const nGiorni = new Date(anno, mese + 1, 0).getDate();

  // Lista medici: quella salvata nello store (modificabile dal tab Medici) o il default.
  // setMediciGlobal sincronizza il modulo (motore + byId) ad ogni render — idempotente.
  const mediciList = store.medici || MEDICI_DEFAULT;
  setMediciGlobal(mediciList);

  // ---- history: ogni azione salva lo stato precedente ----
  const applica = (nuovoStore) => {
    historyRef.current.past.push(store);
    if (historyRef.current.past.length > 100) historyRef.current.past.shift();
    historyRef.current.future = [];
    setStore(nuovoStore);
    salva(nuovoStore);
  };
  const setDati = (patch) => applica({ ...store, [key]: { ...(store[key] || vuotoMese), ...patch } });
  const annulla = () => {
    const h = historyRef.current;
    if (!h.past.length) return;
    h.future.push(store);
    const prev = h.past.pop();
    setStore(prev);
    salva(prev);
    forceRender((x) => x + 1);
  };
  const ripeti = () => {
    const h = historyRef.current;
    if (!h.future.length) return;
    h.past.push(store);
    const nxt = h.future.pop();
    setStore(nxt);
    salva(nxt);
    forceRender((x) => x + 1);
  };

  const giorniMese = useMemo(() => {
    const out = [];
    for (let d = 1; d <= nGiorni; d++) out.push(turniDelGiorno(anno, mese, d, dati.extras));
    return out;
  }, [anno, mese, nGiorni, dati.extras]);

  const colonne = useMemo(() => {
    const cols = [];
    giorniMese.forEach((g, i) => g.turni.forEach((t) => cols.push({ giorno: i + 1, ...g, turno: t })));
    return cols;
  }, [giorniMese]);


  // Imposta direttamente l'opzione scelta nel menu a tendina per una sede:
  // "" = non disponibile, "V1".."V5" = verde livello 1-5 (fisica), "B1".."B4" = blu livello 1-4 (a distanza).
  const setSedeOpzione = (mid, slotKey, sede, opzione) => {
    const cur = normDispo(dati.dispo[mid]?.[slotKey]);
    const next = {
      verde: cur.verde.filter((s) => s !== sede), verdeLiv: { ...cur.verdeLiv },
      blu: cur.blu.filter((s) => s !== sede), bluLiv: { ...cur.bluLiv },
      no: false,
    };
    delete next.verdeLiv[sede];
    delete next.bluLiv[sede];
    if (opzione[0] === "V") {
      next.verde.push(sede);
      next.verdeLiv[sede] = Number(opzione.slice(1));
    } else if (opzione[0] === "B") {
      next.blu.push(sede);
      next.bluLiv[sede] = Number(opzione.slice(1));
    }
    const nd = { ...(dati.dispo[mid] || {}) };
    if (next.verde.length || next.blu.length) nd[slotKey] = next; else delete nd[slotKey];
    setDati({ dispo: { ...dati.dispo, [mid]: nd }, schema: null, avvisi: [] });
  };
  const setNoCella = (mid, slotKey, valore) => {
    const nd = { ...(dati.dispo[mid] || {}) };
    if (valore) nd[slotKey] = { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: true };
    else delete nd[slotKey];
    setDati({ dispo: { ...dati.dispo, [mid]: nd }, schema: null, avvisi: [] });
  };
  // Preferenza di TURNO (diurno ☀️ / notturno 🌙) per un giorno con entrambi i turni: decide solo
  // quale dei due il medico mantiene se li vince entrambi lo stesso giorno (§3.9). Un click
  // ripetuto sulla stessa icona la toglie.
  const setTurnoPref = (mid, dataStr, valore) => {
    const nd = { ...(dati.dispo[mid] || {}) };
    const key = "TURNOPREF:" + dataStr;
    if (nd[key] === valore) delete nd[key]; else nd[key] = valore;
    setDati({ dispo: { ...dati.dispo, [mid]: nd }, schema: null, avvisi: [] });
  };
  // Attiva/disattiva un turno MMG (§10 voce 55): il coordinatore sceglie solo SE il turno esiste; la
  // sede e la copertura a distanza le decide il motore in base alle disponibilità dei medici (tab 1).
  const toggleExtra = (dateKey, tipo) => {
    const ex = { ...(dati.extras[dateKey] || {}) };
    ex[tipo] = !ex[tipo];
    setDati({ extras: { ...dati.extras, [dateKey]: ex }, schema: null });
  };
  const elabora = () => {
    const r = elaboraSchema(dati.dispo, dati.extraOre, anno, mese, dati.extras, dati.turniExtra || {}, dati.maxTurniMese || {}, riferimentiCavalloDi());
    setDati({ schema: r.schema, avvisi: r.avvisi });
  };

  // Azzera mese con doppia conferma: il primo tocco arma il pulsante (si colora di rosso),
  // il secondo entro 5 secondi cancella davvero. Passati 5 secondi si disarma da solo.
  // L'operazione resta comunque annullabile con ↶.
  const azzeraMese = () => {
    if (!confermaAzzera) {
      setConfermaAzzera(true);
      if (azzeraTimer.current) clearTimeout(azzeraTimer.current);
      azzeraTimer.current = setTimeout(() => setConfermaAzzera(false), 5000);
      return;
    }
    if (azzeraTimer.current) clearTimeout(azzeraTimer.current);
    setConfermaAzzera(false);
    setDati(vuotoMese);
    setEditCella(null);
  };

  // ---- gestione medici (categoria, graduatoria, aggiunta, rimozione) ----
  const setMedici = (list) => applica({ ...store, medici: list });
  const aggiornaMedico = (id, patch) => {
    setMedici(mediciList.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };
  const aggiungiMedico = () => {
    const nome = nuovoMedico.nome.trim().toUpperCase();
    const grad = Number(nuovoMedico.grad);
    if (!nome) { alert("Inserisci il cognome del medico."); return; }
    if (mediciList.some((m) => m.nome === nome)) { alert("Esiste già un medico con questo nome."); return; }
    if (!Number.isFinite(grad) || grad < 0) { alert("Inserisci una posizione in graduatoria valida (numero ≥ 0)."); return; }
    // Titolarità obbligatoria per ogni contrattualizzato (§3.1a): mai null per una categoria con
    // monte ore (tutte tranne SENZA incarico).
    const sedeContratto = nuovoMedico.cat === "SENZA" ? null : (nuovoMedico.sedeContratto || "Maniago");
    const nuovoId = Math.max(...mediciList.map((m) => m.id)) + 1;
    setMedici([...mediciList, { id: nuovoId, nome, cat: nuovoMedico.cat, grad, sedeContratto }]);
    setNuovoMedico({ nome: "", cat: "SENZA", grad: "", sedeContratto: "" });
  };
  const rimuoviMedico = (id) => {
    const m = mediciList.find((x) => x.id === id);
    if (!m) return;
    if (!window.confirm(`Rimuovere ${m.nome} dall'elenco? Le sue disponibilità già inserite non verranno più considerate.`)) return;
    setMedici(mediciList.filter((x) => x.id !== id));
  };

  const setSlot = (gi, ti, si, midStr) => {
    const schema = dati.schema.map((g, a) => a !== gi ? g : {
      ...g, turni: g.turni.map((t, b) => b !== ti ? t : { ...t, slots: t.slots.map((s, c) => c !== si ? s : (midStr ? Number(midStr) : null)) }),
    });
    setDati({ schema });
  };

  // Applica una patch a più mesi in un colpo solo (un unico passo di ↶ Annulla)
  const applicaPatchMultiMese = (patchByMonth) => {
    const nuovo = { ...store };
    Object.entries(patchByMonth).forEach(([mkey, patch]) => {
      const base = nuovo[mkey] || { dispo: {}, extras: {}, extraOre: {}, schema: null, avvisi: [] };
      nuovo[mkey] = { ...base, ...patch };
    });
    applica(nuovo);
  };

  const applicaRapido = () => {
    if (!rapInizio || !rapFine) { alert("Seleziona il periodo di riferimento (Dal / Al)."); return; }
    const start = new Date(rapInizio + "T00:00:00");
    const end = new Date(rapFine + "T00:00:00");
    if (start > end) { alert("Nel periodo di riferimento, la data 'Al' deve essere successiva (o uguale) a 'Dal'."); return; }
    if (!rapNotte && !rapGiorno) { alert("Seleziona almeno un turno: notturno e/o diurno."); return; }
    for (const r of rapIndisp) {
      if (!r.inizio || !r.fine) { alert("Completa tutte le date nei periodi di indisponibilità (o rimuovi le righe vuote)."); return; }
      if (new Date(r.inizio + "T00:00:00") > new Date(r.fine + "T00:00:00")) { alert("In ogni periodo di indisponibilità, 'Al' deve essere successiva (o uguale) a 'Dal'."); return; }
    }
    const verde = Object.entries(rapSedi).filter(([, v]) => v === "verde").map(([s]) => s);
    const blu = Object.entries(rapSedi).filter(([, v]) => v === "blu").map(([s]) => s);

    const inQualcheIndisp = (y, m, d) => {
      const t = new Date(y, m, d).getTime();
      return rapIndisp.some((r) => {
        const a = new Date(r.inizio + "T00:00:00").getTime(), b = new Date(r.fine + "T00:00:00").getTime();
        return t >= a && t <= b;
      });
    };
    const turniDelGiornoRichiesti = (y, m, d, extras) => {
      const info = turniDelGiorno(y, m, d, extras);
      const idsGiorno = info.turni.filter((t) => !t.extra).map((t) => t.id);
      const out = [];
      if (rapNotte && idsGiorno.includes("N")) out.push("N");
      if (rapGiorno && idsGiorno.includes("G")) out.push("G");
      return out;
    };

    const patchByMonth = {};
    const touch = (y, m, d, tid, valore) => {
      const mkey = mk(y, m);
      if (!patchByMonth[mkey]) {
        const baseDispo = (store[mkey] || {}).dispo || {};
        patchByMonth[mkey] = { dispo: { ...baseDispo }, schema: null, avvisi: [] };
      }
      const patchDispo = patchByMonth[mkey].dispo;
      const nd = { ...(patchDispo[rapMedico] || {}) };
      nd[`${dk(y, m, d)}|${tid}`] = valore;
      patchDispo[rapMedico] = nd;
    };

    let scrittiIndisp = 0, scrittiDisp = 0, protetti = 0, saltatiFuoriRange = 0, saltatiNoDiurno = 0;

    // PASSO 1: i periodi di indisponibilità vincono sempre — sovrascrivono qualsiasi stato
    // precedente per le loro date, perché sono una dichiarazione nuova ed esplicita.
    rapIndisp.forEach((r) => {
      const rs = new Date(r.inizio + "T00:00:00"), re = new Date(r.fine + "T00:00:00");
      for (let dt = new Date(rs); dt <= re; dt.setDate(dt.getDate() + 1)) {
        const y = dt.getFullYear(), m = dt.getMonth(), d = dt.getDate();
        if (!MESI_DISPONIBILI.some((x) => x.anno === y && x.mese === m)) { saltatiFuoriRange++; continue; }
        const extras = (store[mk(y, m)] || {}).extras || {};
        const richiesti = turniDelGiornoRichiesti(y, m, d, extras);
        if (rapGiorno && !richiesti.includes("G")) {
          const info = turniDelGiorno(y, m, d, extras);
          if (!info.turni.some((t) => t.id === "G")) saltatiNoDiurno++;
        }
        richiesti.forEach((tid) => {
          touch(y, m, d, tid, { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: true });
          scrittiIndisp++;
        });
      }
    });

    // PASSO 2: il resto del periodo di riferimento diventa disponibile con le sedi scelte —
    // MA solo se non è già stato toccato dal passo 1, e solo se non esisteva GIA' un'indisponibilità
    // esplicita precedente (es. il 12 agosto segnato in un'azione passata): quella resta protetta.
    if (verde.length || blu.length) {
      for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
        const y = dt.getFullYear(), m = dt.getMonth(), d = dt.getDate();
        if (inQualcheIndisp(y, m, d)) continue; // già gestito (ed esplicitamente escluso) al passo 1
        if (!MESI_DISPONIBILI.some((x) => x.anno === y && x.mese === m)) { saltatiFuoriRange++; continue; }
        const mkey = mk(y, m);
        const extras = (store[mkey] || {}).extras || {};
        const richiesti = turniDelGiornoRichiesti(y, m, d, extras);
        if (rapGiorno) {
          const info = turniDelGiorno(y, m, d, extras);
          if (!info.turni.some((t) => t.id === "G")) saltatiNoDiurno++;
        }
        const dispoEsistente = (store[mkey] || {}).dispo || {};
        richiesti.forEach((tid) => {
          const slotKey = `${dk(y, m, d)}|${tid}`;
          const preesistente = normDispo(dispoEsistente[rapMedico]?.[slotKey]);
          if (preesistente.no) { protetti++; return; } // indisponibilità dichiarata in precedenza: non si tocca
          const verdeLivRap = {}; verde.forEach((s) => { verdeLivRap[s] = 1; });
          const bluLivRap = {}; blu.forEach((s) => { bluLivRap[s] = 1; });
          touch(y, m, d, tid, { verde: [...verde], verdeLiv: verdeLivRap, blu: [...blu], bluLiv: bluLivRap, no: false });
          scrittiDisp++;
        });
      }
    }

    // PASSO 3 (opzionale): tetto settimanale — una dichiarazione per ciascuna settimana coperta
    // dal range, scritta come dispo[rapMedico]["SETT:" + lunedì] = { maxTurni }. Una settimana può
    // scavalcare il confine tra due mesi: la dichiarazione va scritta in ENTRAMBI i mesi toccati,
    // così elaboraSchema la vede a prescindere da quale dei due mesi si stia elaborando.
    let scrittiSettimana = 0;
    if (rapMaxSettimana !== "" && Number(rapMaxSettimana) >= 0) {
      const nMax = Number(rapMaxSettimana);
      const settimaneViste = new Set();
      for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
        const dow = (dt.getDay() + 6) % 7; // 0=lunedì .. 6=domenica
        const lun = new Date(dt); lun.setDate(dt.getDate() - dow);
        const wk = dk(lun.getFullYear(), lun.getMonth(), lun.getDate());
        if (settimaneViste.has(wk)) continue;
        settimaneViste.add(wk);
        const dom = new Date(lun); dom.setDate(lun.getDate() + 6);
        const mesiToccati = new Set([mk(lun.getFullYear(), lun.getMonth()), mk(dom.getFullYear(), dom.getMonth())]);
        mesiToccati.forEach((mkey) => {
          const [my, mm] = mkey.split("-").map(Number);
          if (!MESI_DISPONIBILI.some((x) => x.anno === my && x.mese === mm)) return;
          if (!patchByMonth[mkey]) {
            const baseDispo = (store[mkey] || {}).dispo || {};
            patchByMonth[mkey] = { dispo: { ...baseDispo }, schema: null, avvisi: [] };
          }
          const patchDispo = patchByMonth[mkey].dispo;
          const nd = { ...(patchDispo[rapMedico] || {}) };
          nd["SETT:" + wk] = { maxTurni: nMax };
          patchDispo[rapMedico] = nd;
        });
        scrittiSettimana++;
      }
    }

    const totale = scrittiIndisp + scrittiDisp + scrittiSettimana;
    if (!totale) { alert("Nessun turno compilato: controlla le date e le opzioni scelte."); return; }
    applicaPatchMultiMese(patchByMonth);
    const note = [];
    if (scrittiDisp) note.push(`${scrittiDisp} turni disponibili`);
    if (scrittiIndisp) note.push(`${scrittiIndisp} turni indisponibili`);
    if (protetti) note.push(`${protetti} turni già indisponibili in precedenza mantenuti invariati`);
    if (scrittiSettimana) note.push(`tetto di ${rapMaxSettimana} turni/settimana impostato su ${scrittiSettimana} settimane`);
    if (saltatiFuoriRange) note.push(`${saltatiFuoriRange} giorni fuori dal calendario disponibile (ago 2026 – dic 2027) ignorati`);
    if (saltatiNoDiurno) note.push(`${saltatiNoDiurno} giorni senza turno diurno (feriali) ignorati per il diurno`);
    alert(`${byId[rapMedico].nome}: ${note.join("; ")}.`);
    setRapidoOpen(false);
    setRapInizio(""); setRapFine(""); setRapSedi({}); setRapIndisp([]); setRapMaxSettimana("");
  };

  // ============ EXPORT .XLSX nativo con bordi e colori (zip costruito a mano) ============
  const xmlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const enc = new TextEncoder();

  // CRC32
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  // ZIP con entry non compresse (STORED) → xlsx standard
  const zipStore = (files) => {
    const chunks = [], central = [];
    let offset = 0;
    const u16 = (n) => new Uint8Array([n & 255, (n >> 8) & 255]);
    const u32 = (n) => new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255]);
    files.forEach(({ name, data }) => {
      const nameB = enc.encode(name);
      const crc = crc32(data);
      const local = [u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nameB.length), u16(0), nameB, data];
      const localLen = local.reduce((a, b) => a + b.length, 0);
      central.push({ nameB, crc, size: data.length, offset });
      local.forEach((b) => chunks.push(b));
      offset += localLen;
    });
    const cdStart = offset;
    central.forEach(({ nameB, crc, size, offset: off }) => {
      [u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(size), u32(size), u16(nameB.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), nameB].forEach((b) => chunks.push(b));
    });
    const cdLen = chunks.reduce((a, b) => a + b.length, 0) - cdStart;
    [u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdLen), u32(cdStart), u16(0)].forEach((b) => chunks.push(b));
    const total = chunks.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(total);
    let p = 0;
    chunks.forEach((b) => { out.set(b, p); p += b.length; });
    return out;
  };

  const colLetter = (n) => { let s = ""; n++; while (n) { s = String.fromCharCode(64 + ((n - 1) % 26) + 1) + s; n = Math.floor((n - 1) / 26); } return s; };

  const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="10">
<font><sz val="9"/><name val="Calibri"/></font>
<font><b/><sz val="9"/><name val="Calibri"/></font>
<font><b/><sz val="8"/><name val="Calibri"/></font>
<font><b/><sz val="7.5"/><name val="Calibri"/></font>
<font><b/><sz val="7.5"/><color rgb="FF8A3A00"/><name val="Calibri"/></font>
<font><b/><sz val="7.5"/><color rgb="FF1A5C4A"/><name val="Calibri"/></font>
<font><sz val="8.5"/><name val="Calibri"/></font>
<font><i/><sz val="8"/><color rgb="FF5B5F59"/><name val="Calibri"/></font>
<font><b/><sz val="8.5"/><color rgb="FFB03030"/><name val="Calibri"/></font>
<font><sz val="8.5"/><color rgb="FF666666"/><name val="Calibri"/></font>
</fonts>
<fills count="8">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFDCE6DC"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFBE5D6"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF0F2EE"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE3F2EC"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFDECEC"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFA6A6A6"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="15">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="5" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="6" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="7" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="8" fillId="6" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/>
<xf numFmtId="0" fontId="9" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="7" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
</cellXfs>
</styleSheet>`;
  // indici stile: 1=sAgg 2=sHead 3=sHeadF 4=sDate 5=sTurno 6=sTurnoF 7=sTurnoX 8=sSede 9=sCell 10=sCov 11=sScop 12=sB 13=sScopSec 14=sNonAttiva(grigio)

  const buildSheetXML = (mKey) => {
    const [y, m] = mKey.split("-").map(Number);
    const d = store[mKey];
    if (!d?.schema) return null;
    const cols = [];
    d.schema.forEach((g) => g.turni.forEach((t, ti) => cols.push({ g, t, prima: ti === 0, span: g.turni.length })));
    const oggi = new Date();
    const agg = `aggiornato al ${String(oggi.getDate()).padStart(2, "0")}.${String(oggi.getMonth() + 1).padStart(2, "0")}.${oggi.getFullYear()}`;

    const cell = (r, c, testo, stile) => `<c r="${colLetter(c)}${r}" s="${stile}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(testo)}</t></is></c>`;
    const cellV = (r, c, stile) => `<c r="${colLetter(c)}${r}" s="${stile}"/>`;

    let rows = "";
    const merges = [];

    // R1 giorni settimana
    let r1 = cell(1, 0, agg, 1);
    let ci = 1;
    let i = 0;
    while (i < cols.length) {
      const c = cols[i];
      const fest = c.g.festivo || c.g.prefestivo;
      r1 += cell(1, ci, GIORNI_IT[c.g.dow], fest ? 3 : 2);
      if (c.span > 1) {
        merges.push(`${colLetter(ci)}1:${colLetter(ci + c.span - 1)}1`);
        for (let k = 1; k < c.span; k++) r1 += cellV(1, ci + k, fest ? 3 : 2);
      }
      ci += c.span;
      i += c.span;
    }
    rows += `<row r="1" ht="30" customHeight="1">${r1}</row>`;

    // R2 date
    let r2 = cellV(2, 0, 12);
    cols.forEach(({ g }, k) => { r2 += cell(2, k + 1, `${String(g.giorno).padStart(2, "0")}-${MESI_BREVI[m]}`, 4); });
    rows += `<row r="2" ht="15" customHeight="1">${r2}</row>`;

    // R3 turni — etichette adattate solo per l'export (la griglia a schermo usa t.label invariato):
    // il diurno feriale/weekend "semplice" perde l'orario "8-20" (resta "DIURNO"), prefestivo e
    // superfestivo restano con l'orario completo; le colonne MMG mattina/pomeriggio diventano
    // "ANTICIPO DIURNO MMG e PLS 8-14" / "...14-20".
    const ETICHETTE_EXPORT = {
      "DIURNO 8-20": "DIURNO",
      "MATTINA MMG 8-14": "ANTICIPO DIURNO MMG e PLS 8-14",
      "POMERIGGIO MMG 14-20": "ANTICIPO DIURNO MMG e PLS 14-20",
    };
    let r3 = cellV(3, 0, 12);
    cols.forEach(({ t }, k) => {
      const st = t.extra ? 7 : (t.label.includes("SUPER") || t.label.includes("PREFESTIVO")) ? 6 : 5;
      r3 += cell(3, k + 1, ETICHETTE_EXPORT[t.label] || t.label, st);
    });
    rows += `<row r="3" ht="34" customHeight="1">${r3}</row>`;

    // Sedi
    const SEDI_EXPORT = ["SPILIMBERGO", "MANIAGO", "MEDUNO", "CLAUT", "ANDUINS"];
    const mapIdx = { MANIAGO: 0, SPILIMBERGO: 1, MEDUNO: 2, CLAUT: 3, ANDUINS: 4 };
    SEDI_EXPORT.forEach((sede, ri) => {
      const r = 4 + ri;
      let row = cell(r, 0, sede, 8);
      cols.forEach(({ t }, k) => {
        // Notturno/MMG: Claut e Anduins NON sono sedi fisiche (§10 voce 55) — il servizio non è
        // attivo, non è un buco. In quel caso la cella scoperta diventa "servizio non attivo" su
        // sfondo grigio (formato ASFO, stile 14), MAI "scoperto". Meduno resta fisica ovunque, il
        // diurno ha tutte e 5 le sedi fisiche. Se invece la sede È coperta a distanza (slot pieno)
        // si passa dal ramo copertura qui sotto, invariato.
        const treFisiche = t.id === "N" || !!t.extra;
        const nonAttiva = treFisiche && (sede === "CLAUT" || sede === "ANDUINS");
        // testo/stile per una sede SECONDARIA (Meduno/Claut/Anduins) scoperta
        const secScoperta = nonAttiva ? { testo: "servizio non attivo", stile: 14 } : { testo: "scoperto", stile: 13 };
        let testo = "", stile = 9;
        if (!t.slots.some(Boolean)) {
          if (sede === "MANIAGO" || sede === "SPILIMBERGO") { testo = "SCOPERTO"; stile = 11; }
          else ({ testo, stile } = secScoperta);
        } else {
          const si = mapIdx[sede];
          const mid = t.slots[si];
          if (mid) {
            const nota = notaSlot(t.slots, si, t.fis);
            if (nota.tipo === "copertura") { testo = nota.testo; stile = 10; }
            else testo = byId[mid].nome + (nota.testo ? "\n" + nota.testo : "");
          } else if (sede === "MANIAGO" || sede === "SPILIMBERGO") {
            testo = "SCOPERTO"; stile = 11; // anche se un'altra sede del turno è coperta, Maniago/Spilimbergo scoperte vanno sempre segnalate in rosso
          } else {
            ({ testo, stile } = secScoperta); // Meduno/Claut/Anduins: "scoperto" oppure "servizio non attivo"
          }
        }
        row += cell(r, k + 1, testo, stile);
      });
      rows += `<row r="${r}" ht="42" customHeight="1">${row}</row>`;
    });
    // ---- Sezione REPERIBILITÀ (§10 voce 89): struttura fissa da compilare A MANO dopo l'export
    // (l'app non calcola nulla, lascia solo lo spazio con bordi/stile coerenti col foglio ASFO reale).
    // Riga 9: stacco vuoto (nessun bordo esplicito). Riga 10: intestazione "Reperibilità". Riga 11:
    // "Area 1" con celle giorno vuote e bordate. Etichette con lo stesso stile delle sedi (8).
    let rowSp = cellV(9, 0, 0);
    cols.forEach((_, k) => { rowSp += cellV(9, k + 1, 0); });
    rows += `<row r="9" ht="12" customHeight="1">${rowSp}</row>`;
    // "Reperibilità" è SOLO un'etichetta di sezione: la cella a sinistra con la scritta, niente
    // celle né griglia a destra (formato ASFO). Solo "Area 1" ha le celle vuote bordate da compilare.
    rows += `<row r="10" ht="18" customHeight="1">${cell(10, 0, "Reperibilità", 8)}</row>`;
    let rowArea = cell(11, 0, "Area 1", 8);
    cols.forEach((_, k) => { rowArea += cellV(11, k + 1, 9); });
    rows += `<row r="11" ht="30" customHeight="1">${rowArea}</row>`;

    const colsXML = `<cols><col min="1" max="1" width="15" customWidth="1"/><col min="2" max="${cols.length + 1}" width="19" customWidth="1"/></cols>`;
    const mergeXML = merges.length ? `<mergeCells count="${merges.length}">${merges.map((mm) => `<mergeCell ref="${mm}"/>`).join("")}</mergeCells>` : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${colsXML}<sheetData>${rows}</sheetData>${mergeXML}</worksheet>`;
  };

  const esporta = (tutto) => {
    try {
      const keys = tutto ? MESI_DISPONIBILI.map(({ anno: y, mese: m }) => mk(y, m)).filter((k) => store[k]?.schema) : [key];
      const fogli = [];
      keys.forEach((k) => {
        const xml = buildSheetXML(k);
        if (xml) {
          const [y, m] = k.split("-").map(Number);
          fogli.push({ nome: `${MESI_IT[m]} ${y}`, xml });
        }
      });
      if (!fogli.length) { alert("Nessuno schema elaborato da esportare."); return; }

      const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${fogli.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
      const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
      const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${fogli.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("\n")}
<Relationship Id="rId${fogli.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
      const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${fogli.map((f, i) => `<sheet name="${xmlEsc(f.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>
</workbook>`;

      const files = [
        { name: "[Content_Types].xml", data: enc.encode(contentTypes) },
        { name: "_rels/.rels", data: enc.encode(rels) },
        { name: "xl/workbook.xml", data: enc.encode(workbook) },
        { name: "xl/_rels/workbook.xml.rels", data: enc.encode(wbRels) },
        { name: "xl/styles.xml", data: enc.encode(STYLES_XML) },
        ...fogli.map((f, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(f.xml) })),
      ];
      const zip = zipStore(files);
      const blob = new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = tutto ? "ASFO_turni_CA_DistrettoNord.xlsx" : `ASFO_turni_CA_${MESI_IT[mese]}_${anno}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Errore export: " + e.message);
    }
  };

  // ============ AI ============
  // testoForzato: se passato (es. dal pulsante "Continua"), viene inviato al posto del
  // contenuto di aiInput — permette di inviare "continua" senza passare dal campo di testo.
  const chiediAI = async (testoForzato) => {
    const testo = (testoForzato !== undefined ? testoForzato : aiInput).trim();
    if (!testo || aiBusy) return;
    const domanda = testo;
    if (!testoForzato) ultimaDomandaRef.current = domanda; // ricordata per poterla ripetere se la risposta viene troncata
    setAiInput("");
    setAzioniRestanti(false); // si aggiorna in base alla risposta di QUESTO round, appena arriva
    setTroncato(false);
    setCompletato(false);
    setAvvisi([]); // gli avvisi valgono per l'ultima risposta: azzerali all'inizio di ogni nuova richiesta
    const msgs = [...aiMsgs, { role: "user", content: domanda }];
    setAiMsgs(msgs);
    setAiBusy(true);
    try {
      const stato = {
        mese: `${MESI_IT[mese]} ${anno}`,
        // Calendario del mese PRECOMPILATO dal motore (funzioni pure turniDelGiorno/FESTIVI/PREFESTIVI):
        // per ogni giorno, giorno-della-settimana + tipo (feriale/weekend/festivo/prefestivo) + se esiste
        // il diurno (G). L'AI DEVE leggere di qui, non calcolare il calendario a mente (fonte di errori).
        calendario: (() => {
          const DOW = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
          const nG = new Date(anno, mese + 1, 0).getDate();
          const out = {};
          for (let d = 1; d <= nG; d++) {
            const info = turniDelGiorno(anno, mese, d, dati.extras);
            const tipo = info.festivo ? "festivo" : info.prefestivo ? "prefestivo" : info.weekend ? "weekend" : "feriale";
            out[`g${d}`] = `${DOW[info.dow]} ${tipo}${info.turni.some((t) => t.id === "G") ? " · diurno+notturno" : " · solo notturno"}`;
          }
          return out;
        })(),
        // Settimane (lun-dom) che TOCCANO il mese, precomputate come il calendario: il modello NON deve
        // calcolarle a mente (fonte di errori: settimana a cavallo saltata o doppioni). Chiave "lunedi" =
        // stessa bucketizzazione del motore (settimanaDi); "giornoRappresentativo" = SEMPRE un giorno
        // DENTRO il mese in lavorazione (per la settimana a cavallo col mese precedente è il giorno 1),
        // da passare come "giorno" in tetto_settimana. Include la settimana a cavallo iniziale e quella
        // finale parziale. Una voce per settimana, in ordine.
        settimane: (() => {
          const nG = new Date(anno, mese + 1, 0).getDate();
          const seen = new Map(); // lunedì (chiave settimanaDi) -> primo giorno IN-MESE di quella settimana
          for (let d = 1; d <= nG; d++) {
            const wk = settimanaDi(`${anno}-${String(mese + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
            if (!seen.has(wk)) seen.set(wk, d);
          }
          return [...seen.entries()].map(([lunedi, giornoRappresentativo]) => ({ lunedi, giornoRappresentativo }));
        })(),
        medici: MEDICI.map((m) => ({
          nome: m.nome, categoria: CAT_INFO[m.cat].label, titolare: m.sedeContratto, graduatoria: m.grad, oreExtra: dati.extraOre[m.id] || 0,
          turniExtra: (dati.turniExtra || {})[m.id] || 0,
          maxTurniMese: (dati.maxTurniMese || {})[m.id] ?? null,
          oreAssegnate: dati.schema ? (oreAssegnateDi[m.id] || 0) : null,
          oreMancanti: dati.schema && CAT_INFO[m.cat].ore !== null ? (CAT_INFO[m.cat].ore + (dati.extraOre[m.id] || 0)) - (oreAssegnateDi[m.id] || 0) : null,
        })),
        mmgAttivi: Object.entries(dati.extras).filter(([, v]) => v.M || v.P).map(([k, v]) => `g${Number(k.slice(8, 10))}:${v.M ? "M" : ""}${v.P ? "P" : ""}`),
        avvisiScenari: dati.avvisi || [],
        disponibilita: Object.fromEntries(MEDICI.filter((m) => dati.dispo[m.id] && Object.keys(dati.dispo[m.id]).length).map((m) => [m.nome, Object.entries(dati.dispo[m.id]).filter(([sk]) => !sk.startsWith("SETT:") && !sk.startsWith("SETTWK:") && !sk.startsWith("TURNOPREF:")).map(([sk, v]) => { const [dt, tu] = sk.split("|"); const nv = normDispo(v); if (nv.no) return `g${Number(dt.slice(8, 10))}${tu}:NO`; return `g${Number(dt.slice(8, 10))}${tu}:${nv.verde.map((s) => SEDI_BREVI[s]).join(",")}${nv.blu.length ? "|blu:" + ordinaPerLivello(nv.blu, nv.bluLiv, MAX_LIV_BLU).map((s) => SEDI_BREVI[s] + (nv.bluLiv[s] || 1)).join(",") : ""}`; })])),
        // Checklist essenziale (solo giorno+turno, senza dettagli) di QUALI slot hanno già una
        // disponibilità inserita per ciascun medico, incluso ogni medico senza nessuna (array vuoto).
        // Serve a confrontare direttamente cosa manca rispetto a una richiesta/email, invece di
        // doverlo dedurre dalla cronologia dei round precedenti (causa di loop, vedi sotto).
        disponibilitaPresenti: Object.fromEntries(MEDICI.map((m) => [m.nome, Object.keys(dati.dispo[m.id] || {}).filter((sk) => !sk.startsWith("SETT:") && !sk.startsWith("SETTWK:") && !sk.startsWith("TURNOPREF:") && !sk.startsWith("OBBL:")).map((sk) => { const [dt, tu] = sk.split("|"); return `g${Number(dt.slice(8, 10))}${tu}`; })])),
        slotObbligatoriPresenti: Object.fromEntries(MEDICI.filter((m) => Object.keys(dati.dispo[m.id] || {}).some((sk) => sk.startsWith("OBBL:"))).map((m) => [m.nome, Object.keys(dati.dispo[m.id] || {}).filter((sk) => sk.startsWith("OBBL:")).map((sk) => { const [dt, tu] = sk.slice(5).split("|"); const sede = dati.dispo[m.id][sk]; return `g${Number(dt.slice(8, 10))}${tu}${typeof sede === "string" ? "@" + sede : ""}`; })])),
        // Registro (solo in memoria, mai persistito) delle azioni già confermate in QUESTA
        // conversazione, in formato compatto "MEDICO g{giorno}{turno}" — ulteriore rete di sicurezza
        // anti-loop, azzerato con "Nuova conversazione".
        azioniGiaEseguite: azioniEseguite,
        tettiSettimanali: Object.fromEntries(MEDICI.filter((m) => dati.dispo[m.id] && Object.keys(dati.dispo[m.id]).some((k) => k.startsWith("SETT:"))).map((m) => [m.nome, Object.entries(dati.dispo[m.id]).filter(([sk]) => sk.startsWith("SETT:")).map(([sk, v]) => `settimana del ${sk.slice(5)}: max ${v.maxTurni} turni`)])),
        finestreSettimanali: Object.fromEntries(MEDICI.filter((m) => dati.dispo[m.id] && Object.keys(dati.dispo[m.id]).some((k) => k.startsWith("SETTWK:"))).map((m) => [m.nome, Object.entries(dati.dispo[m.id]).filter(([sk]) => sk.startsWith("SETTWK:")).map(([sk, v]) => `settimana del ${sk.slice(7)}: min ${v} turni`)])),
        preferenzeTurno: Object.fromEntries(MEDICI.filter((m) => dati.dispo[m.id] && Object.keys(dati.dispo[m.id]).some((k) => k.startsWith("TURNOPREF:"))).map((m) => [m.nome, Object.entries(dati.dispo[m.id]).filter(([sk]) => sk.startsWith("TURNOPREF:")).map(([sk, v]) => `giorno ${Number(sk.slice(-2))}: preferisce il ${v === "G" ? "diurno" : "notturno"} se li vince entrambi`)])),
        schema: dati.schema ? dati.schema.map((g) => ({
          giorno: g.giorno, festivo: g.festivo || null,
          turni: g.turni.map((t) => ({ turno: t.label, sedi: Object.fromEntries(SEDI5.map((s, i) => [s, t.slots[i] ? byId[t.slots[i]].nome : "—"])) })),
        })) : "non ancora elaborato",
      };
      const sys = `Sei l'assistente del coordinatore della guardia medica ASFO Distretto Nord (sedi: Maniago, Spilimbergo, Meduno, Claut, Anduins).

== CALENDARIO MENSILE ==
- Giorno 27: invio mail richiesta disponibilità ai medici
- Entro giorno 3 (ore 23:59): scadenza disponibilità ed elaborazione primo schema
- Giorno 10 ore 8:00: invio primo schema ai medici
- Entro giorno 14 (ore 23:59): scadenza richieste di modifica
- Giorno 15: invio schema definitivo all'azienda sanitaria

== REGOLA TEMPORALE FONDAMENTALE ==
Le regole ordinarie di assegnazione (categoria, debito, graduatoria) si applicano SOLO alle disponibilità ricevute entro le 23:59 del giorno 3. Tutto ciò che arriva dopo — incluse le modifiche dal 10 al 14 — segue esclusivamente "first come, first served": vince chi arriva prima, indipendentemente da categoria o graduatoria.
UNICA ECCEZIONE: gli errori del coordinatore vanno sempre corretti retroattivamente, in qualsiasi fase.

== CALENDARIO DEL MESE — LEGGI LO STATO, NON CALCOLARE ==
Per stabilire se un giorno del mese corrente (indicato in STATO ATTUALE come "mese") è un feriale semplice, un weekend, un festivo o un prefestivo, e se ha il turno diurno (G) — informazione necessaria per le regole su turni diurno/notturno e weekend ambiguo più sotto — NON fidarti della tua memoria del calendario e NON calcolare nulla a mente: LEGGI il campo "calendario" nello STATO ATTUALE. Il motore lo precompila per OGNI giorno del mese, in forma "g{giorno}": "{giorno-settimana} {tipo} · {turni}", dove {tipo} è feriale | weekend | festivo | prefestivo e {turni} è "diurno+notturno" (il giorno ha SIA G SIA N) oppure "solo notturno" (feriale semplice, solo N). Esempio: "g14":"ven prefestivo · diurno+notturno", "g17":"lun feriale · solo notturno". È sempre esatto per il mese in lavorazione: usalo come unica fonte, mai il calcolo a memoria.
SETTIMANE DEL MESE — LEGGI il campo "settimane" nello STATO ATTUALE, non calcolarle a mente: è un array precomputato (stessa filosofia di "calendario") con TUTTE le settimane lun-dom che TOCCANO il mese, IN ORDINE, inclusa la settimana iniziale a cavallo col mese precedente e quella finale parziale. Ogni voce è {"lunedi":"YYYY-MM-DD","giornoRappresentativo":G}: "lunedi" identifica la settimana (stessa bucketizzazione del motore), "giornoRappresentativo" è SEMPRE un giorno DENTRO il mese in lavorazione (per la settimana a cavallo è il giorno 1). REGOLA GENERALE: ogni volta che devi ragionare sulle settimane — identificare UNA settimana ("la settimana del X", "la settimana di [una festività]", la settimana che contiene un certo giorno), iterare su TUTTE le settimane del mese, o contarne il numero — USA questo campo, qualunque sia l'azione coinvolta (tetto_settimana/massimo, finestra_settimanale/minimo, e qualunque altra azione presente o futura che tocchi le settimane). Per identificare una singola settimana: prendi la voce il cui intervallo la contiene e usane il "giornoRappresentativo" come "giorno". Per iterare su tutte: una voce per settimana, in ordine, passando ogni "giornoRappresentativo". NON dedurre i lunedì a mente, NON calcolare le date delle settimane, NON saltare la settimana a cavallo, NON mettere due riferimenti nella stessa settimana. Il NUMERO di settimane del mese è semplicemente la lunghezza di questo array (varia da mese a mese, tipicamente 5 o 6): leggilo di qui, non darlo per scontato.
MESE DI RIFERIMENTO FISSO: il mese e l'anno su cui calcolare SEMPRE i giorni della settimana, le festività e qualsiasi data sono ESCLUSIVAMENTE quelli indicati in "mese" dello STATO ATTUALE. Qualunque riferimento temporale scritto dal medico nella mail — "il mese prossimo", "il mese entrante", "per il prossimo mese", "ad aprile", il nome di un mese qualsiasi, ecc. — NON cambia il mese di riferimento e NON va usato per calcolare le date: per il medico "il mese prossimo" indica semplicemente il mese che il coordinatore sta già elaborando (quello in STATO ATTUALE). Non dedurre MAI un mese diverso dal testo della mail né spostare in avanti/indietro il calcolo dei giorni della settimana. Il mese di lavoro si cambia SOLO con l'azione vai_mese e SOLO quando è il COORDINATORE a chiederlo esplicitamente, mai a partire dal testo di una mail di disponibilità.
PASSATO vs FUTURO (unica deroga ristretta al mese di riferimento): l'azione turno_precedente è l'UNICA che parla di un giorno del MESE PRECEDENTE (fine luglio, settimana a cavallo), ed ESCLUSIVAMENTE quando è il COORDINATORE in chat a dichiarare un turno GIÀ SVOLTO — riconoscibile dal tempo passato: "ha fatto", "ha coperto", "ha già lavorato il…", "segna il turno che ha fatto il…". Una MAIL DI DISPONIBILITÀ di un medico NON va MAI interpretata come turno passato: le mail dichiarano disponibilità FUTURE per il mese in lavorazione ("sono disponibile", "posso fare", "farò") → restano sempre dispo_aggiungi/dispo_set/dispo_no, MAI turno_precedente, anche se citano date di fine luglio. Distingui sempre: passato + coordinatore ("ha fatto") → turno_precedente; futuro + medico ("è disponibile") → dispo_*. Questa deroga vale solo per il coordinatore e non sposta comunque il mese di riferimento delle altre azioni.
Tutte le informazioni di calendario che ti servono sono GIÀ nel campo "calendario" dello STATO ATTUALE, precalcolate esattamente dal motore per il mese in lavorazione:
- GIORNO DELLA SETTIMANA: il primo token di ogni voce (es. "g14":"ven …" → il 14 è venerdì).
- FESTIVO / PREFESTIVO / WEEKEND / FERIALE: il {tipo} di ogni voce (già tiene conto delle festività nazionali, del 31 dicembre come festivo ASFO col 30 come suo prefestivo, e di Pasqua/Pasquetta).
- ESISTENZA DEL DIURNO (G): "diurno+notturno" = il giorno ha SIA G SIA N (weekend, festivo o prefestivo); "solo notturno" = feriale semplice, solo N (il diurno non esiste quel giorno).
Non riprodurre né ricalcolare questi dati a mente: leggi sempre e solo il campo "calendario".

== SEDI E SCENARI DI COPERTURA ==
Maniago e Spilimbergo (le 2 CDC) devono sempre essere coperte PRIMA delle altre sedi.
Nessuna copertura a distanza è automatica: dipende SEMPRE da cosa i medici dichiarano (verde/blu, vedi sotto).
SEDI FISICHE: Maniago, Spilimbergo, Meduno sono fisiche SEMPRE. Claut e Anduins sono sedi fisiche SOLO nel turno DIURNO (8-20) — che esiste unicamente nei giorni ad alta domanda (weekend, festivi, prefestivi); nel NOTTURNO (sempre) Claut e Anduins sono coperte SOLO a distanza (blu). Ordine di riempimento: Maniago, Spilimbergo, poi Meduno, poi — solo nel diurno — Claut, poi Anduins.
VINCOLO TERRITORIALE sulla copertura a distanza (geografico, reale): Claut può essere coperta a distanza SOLO dal medico fisicamente a Maniago (unica via); Anduins SOLO dal medico fisicamente a Spilimbergo o Meduno (due vie, si sceglie con la gerarchia). Le altre sedi a distanza non hanno vincolo. Resta sempre necessaria la dichiarazione blu: se il fisico di Maniago non dichiara Claut, Claut resta SCOPERTA (mai coperta da altrove).
- Scenario 1 (1 medico): fisico nella miglior sede verde ottenuta TRA quelle oggi fisiche (di notte solo Maniago/Spilimbergo/Meduno; nel diurno anche Claut/Anduins). Copre a distanza solo le sedi dichiarate blu, nell'ordine dei livelli, massimo 1. Il resto resta SCOPERTO.
- Scenario 2 (2 medici): fisici nelle 2 CDC. Coprono a distanza le sedi per cui hanno dichiarato blu (massimo 1 a testa). Conflitti sulla stessa sede blu: titolarità sede → categoria → debito → graduatoria. Sedi senza blu dichiarato → SCOPERTE.
- Scenario 3 (3 medici): fisici a Maniago, Spilimbergo, Meduno. Claut, Anduins e ogni altra sede solo a distanza (blu). Sedi senza blu → SCOPERTE.
- Scenario 4 — SOLO nel turno DIURNO (4-5 medici): nel diurno Claut e Anduins si aggiungono come sedi fisiche se avanzano medici dopo le 3 prioritarie (4 medici → +Claut; 5 medici → +Claut +Anduins). Nel NOTTURNO restano SEMPRE a distanza (massimo 3 sedi fisiche, come lo scenario 3). Sedi senza copertura → SCOPERTE. Eventuali medici oltre le sedi disponibili restano inutilizzati.

== GERARCHIA CATEGORIE (priorità decrescente) ==
1. INDET (indeterminato, qualunque orario) → spareggio: titolarità sede → debito orario → graduatoria
2. Determinato 38h/sett → spareggio: titolarità sede → debito orario → graduatoria
3. Determinato 24h/sett = Determinato 12h/sett ASAP (DET12ASAP) → STESSO livello di priorità, non sono in relazione
   gerarchica tra loro: uno spareggio diretto tra i due si risolve con titolarità sede → debito orario →
   graduatoria, esattamente come tra due medici della stessa categoria
4. Determinato 12h/sett (DET12) → spareggio: titolarità sede → debito orario → graduatoria; perde sempre contro
   INDET, Determinato 38h, Determinato 24h e DET12ASAP, batte solo i medici senza incarico
5. Senza incarico → SOLO graduatoria aziendale, nessun conteggio ore, nessuna titolarità
La categoria superiore prevale SEMPRE finché il medico ha debito orario residuo positivo — ECCETTO quando la titolarità di sede decide prima (vedi sotto).

== TITOLARITÀ DI SEDE (OBBLIGATORIA per ogni contrattualizzato, INDET incluso) ==
Ogni medico contrattualizzato (INDET, Determinato 38h, 24h, 12h ASAP o 12h) ha SEMPRE un contratto di titolarità per Maniago o Spilimbergo — mai "nessuna" per loro. Solo i senza incarico non hanno titolarità.
Su QUALSIASI sede contesa, la titolarità di QUELLA sede specifica decide PRIMA di tutto il resto, sia per l'assegnazione FISICA sia per la copertura A DISTANZA (blu): chi è titolare della sede contesa batte chi non lo è, qualunque sia la categoria di entrambi. Tra due medici PARI rispetto a quella sede specifica (entrambi titolari di essa, oppure nessuno dei due — es. uno titolare di Maniago e l'altro di Spilimbergo, in conflitto su Maniago: solo il primo è titolare LÌ), decide poi normalmente categoria → debito → graduatoria.
Esempio: un Determinato 24h titolare di Maniago batte un INDET titolare di Spilimbergo nel conflitto su Maniago (la titolarità vince prima della categoria); sulla stessa coppia, su Spilimbergo vince invece l'INDET. Due titolari della STESSA sede (es. entrambi titolari di Maniago): la titolarità è a parità tra loro, quindi decide categoria → debito → graduatoria, esattamente come se nessuno dei due fosse titolare.
La sede di titolarità di OGNI medico è nel campo "titolare" dell'oggetto medici nello stato (Maniago o Spilimbergo per i contrattualizzati, null per i senza incarico): usalo quando devi collegare un medico alla sua sede — NON dire mai che non conosci la città/sede di un medico contrattualizzato, è sempre disponibile lì.
Se un medico contrattualizzato AFFERMA nella mail una sede di titolarità DIVERSA da quella del campo "titolare" (es. scrive "sono titolare a Spilimbergo" ma nel sistema risulta Maniago): la titolarità valida resta SEMPRE quella del sistema (il campo "titolare"), NON cambiarla in base a ciò che scrive; ma segnala la discrepanza con l'avviso "🔴 ATTENZIONE: [nome] dichiara titolarità a [X] ma nel sistema risulta [Y] — verificare." Se poi il medico chiede comunque di lavorare in quella sede, è una normale richiesta fuori-titolarità: registra pure la disponibilità lì (perde solo la priorità da titolare in quella sede).
Caso DIVERSO — il medico CHIEDE solo un'altra sede SENZA affermare nulla sulla titolarità → NON inserire, CHIEDI conferma al coordinatore: se un medico contrattualizzato (con una titolarità nel campo "titolare") dichiara disponibilità ESCLUSIVAMENTE per una o più sedi FISICHE (verdi) diverse dalla propria titolarità — cioè tra le sedi verdi che chiede NON compare MAI la sua sede di titolarità — NON inserire la disponibilità e poni una DOMANDA di conferma al COORDINATORE (che usa l'app, non al medico), col meccanismo "domande": "citazione" = la frase esatta del medico; "domanda" = "❓ [nome] è titolare di [sua sede di titolarità] ma ha chiesto solo [sede/i richieste] (il giorno/i [X]) — confermi che è voluto? Se sì lo inserisco su [sede richiesta], altrimenti indicami la sede corretta."; "seSi" = le azioni dispo_aggiungi sulle sedi/giorni richiesti (inserimento fuori-titolarità: perde solo la priorità da titolare in quella sede); "seNo" = [] (non inserire nulla; il coordinatore indicherà la sede corretta). Finché il coordinatore non conferma, NON inserire NULLA per questa richiesta ("azioni" vuoto, solo la "domanda").
Condizioni PRECISE perché la domanda scatti (tutte necessarie): (a) il medico è contrattualizzato, cioè ha una titolarità (campo "titolare" valorizzato); (b) tra TUTTE le sedi FISICHE (verdi) che dichiara NON compare mai la sua sede di titolarità; (c) NON afferma nulla sulla propria titolarità (se afferma una titolarità DIVERSA vale invece la regola precedente: registra fuori-titolarità + avviso 🔴, niente domanda). NON scatta se nomina ANCHE la sua titolarità tra le sedi verdi (es. titolare di Spilimbergo che chiede "Spilimbergo o Maniago" → nessuna domanda, inserisci normalmente: è chiaramente voluto). NON scatta per i senza incarico (nessuna titolarità). Riguarda SOLO le sedi fisiche (verdi): una copertura a distanza (blu) su un'altra sede non conta come "chiedere un'altra sede" ai fini di questa regola (se non c'è NESSUNA sede verde dichiarata vale invece la regola SEDE NON MENZIONATA AFFATTO più sotto, non questa).

== FRAMEWORK DEBITO ORARIO ==
Conteggio mensile in ore effettive (NON settimanale, NON in numero di turni).
Monte ore mensile: INDET → 96 ore | Determinato 38h/sett → ~168 ore | Determinato 24h/sett → ~104 ore | Determinato 12h/sett (ASAP o no) → 52 ore.
Risoluzione conflitto turno per turno in ordine cronologico:
- Debito diverso → vince chi ha debito residuo MAGGIORE
- Debito identico → vince chi è PIÙ ALTO in graduatoria (numero più basso = posizione migliore)
- Debito = 0 → il medico esce dalla competizione (può solo coprire turni completamente scoperti)
Dopo ogni assegnazione il debito del vincitore diminuisce delle ore del turno. Meccanismo auto-bilanciante: chi vince a parità scende di debito e perde il turno successivo a parità — equità automatica, con vantaggio strutturale per chi è più alto in graduatoria.

== REGOLA DEBITO ESAURITO ==
Quando un medico contrattualizzato raggiunge il monte ore (debito = 0), esce dalla priorità di categoria. I turni in conflitto vanno alle categorie inferiori con debito residuo o ai senza incarico. Il medico a debito zero può solo coprire turni rimasti completamente scoperti.

== REGOLA RECUPERO ORE ==
Un medico che il mese precedente non ha completato il monte ore può recuperare le ore mancanti nel mese corrente, MA SOLO se lo comunica esplicitamente al coordinatore. In quel caso: debito = monte ore ordinario + ore da recuperare. Con questo debito maggiorato partecipa normalmente a tutti i conflitti.

== SENZA INCARICO ==
Vince sempre il più alto in graduatoria, senza eccezioni. Nessun conteggio ore, nessuna flessibilità.

== DISPONIBILITÀ (verde/blu) ==
Le disponibilità sono dicotomiche: disponibile (con sedi scelte) o non disponibile. Nessuno stato intermedio visibile.
- "NO" interno = indisponibilità dichiarata esplicitamente (protetta da sovrascritture massive)
- Assenza di dati = equivale a non disponibile
- VERDE = sede FISICA desiderata, livelli 1..5 (MA1,SP2 = Maniago prima scelta, Spilimbergo seconda). Livelli PARI = sedi INDIFFERENTI per il medico: il motore può spostarlo liberamente tra di esse per massimizzare il numero di medici al lavoro. Livello più basso = sede che il medico ha diritto di tenere, a meno che qualcuno con priorità superiore lo scalzi. I livelli non cambiano MAI chi vince un conflitto, solo quale sede viene assegnata a ciascun vincitore.
- BLU = sede che il medico è disposto a COPRIRE A DISTANZA dalla sede fisica su cui viene assegnato, secondo il VINCOLO TERRITORIALE (Claut coperibile solo dal fisico di Maniago; Anduins solo dal fisico di Spilimbergo o Meduno; le altre sedi senza vincolo — vedi la sezione SEDI E SCENARI DI COPERTURA), livelli 1..4. Nessuna copertura a distanza è automatica: serve sempre una dichiarazione blu esplicita. Un medico copre al massimo 1 sede a distanza (la prima disponibile nel suo ordine blu).

== INTERPRETAZIONE EMAIL DISPONIBILITÀ ==

Queste regole coprono le frasi più comuni usate dai medici italiani nelle email di disponibilità.
Per ogni frase ambigua non elencata, applica il principio più vicino per analogia.

== REGOLA GENERALE: AZIONE vs CONTESTO ==
Agisci SOLO su ciò che il messaggio chiede o dichiara per il mese in lavorazione (una disponibilità, un limite, una preferenza da registrare ora). Ciò che è racconto, motivazione, giustificazione o riferimento al PASSATO — es. "il mese scorso ho fatto pochi turni", "a fine luglio ero in ferie", "l'anno scorso lavoravo lì", "di solito faccio i weekend" — è CONTESTO che spiega la richiesta, NON una richiesta a sé: non generarci alcuna azione. Estrai l'azione dal verbo operativo rivolto al mese corrente ("sono disponibile", "voglio", "non posso"), mai dalla parte narrativa. Nel dubbio se una frase sia richiesta o contesto, trattala come contesto e, se serve, chiedi.

== REGOLA GENERALE: CALENDARIO — NON RAGIONARE MAI DA SOLO ==
Per feriale/festivo/prefestivo/weekend e per l'esistenza del diurno (G) leggi SEMPRE il campo "calendario" dello STATO ATTUALE, mai la tua memoria (dettagli nella sezione CALENDARIO DEL MESE sopra). Errore tipico da non fare: dedurre "quel giorno è lunedì quindi feriale, niente diurno" — potrebbe essere un prefestivo con anche il diurno.

== REGOLA GENERALE: CONFERMA IMPLICITA ==
Se nell'ultimo tuo messaggio hai proposto in linguaggio naturale un'azione specifica (es. "Vuoi che inserisca X?", "Posso aggiungere Y?") e il messaggio attuale dell'utente è una conferma senza altro contenuto ("sì", "ok", "vai", "fallo", "esatto", "procedi", o equivalenti), emetti immediatamente l'azione proposta senza richiedere ulteriore input e senza riformulare la proposta. Non serve una nuova schermata di conferma: l'utente ha già confermato. Vale per QUALSIASI azione proposta, inclusi slot_obbligatorio (il pin richiesto dal medico, che proponi con conferma) e i turni_extra dedotti autonomamente (es. "Aggiungo 2 turni extra a BERTUZZI per coprire il tetto?" → "sì" → emetti turni_extra:2).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MEDICO SENZA INCARICO — NUMERO DI GUARDIE MENSILI (controllo OBBLIGATORIO, PRIMA di ogni altra regola di questa sezione)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Se il medico ha categoria "Senza inc." (controlla sempre "categoria" in stato.medici) e dichiara disponibilità ordinarie (sedi, giorni, turni) SENZA indicare da nessuna parte un numero complessivo di guardie che vuole fare nel mese (es. "voglio fare 6 guardie", "posso fare al massimo 4 turni questo mese", "disponibile per 8 guardie ad agosto"): NON inserire NESSUNA disponibilità per quel medico in questo round, qualunque sede o giorno abbia specificato. Genera invece SOLO l'avviso: "🔴 ATTENZIONE: [nome] è senza incarico e non ha indicato il numero massimo di guardie mensili — contattare il medico e reinserire l'email con il numero specificato."
ECCEZIONE — GIORNI/INSIEMI DETERMINATI = numero implicito (NON bloccare): il blocco TOTALE qui sopra (nessuna azione) scatta SOLO quando la richiesta è VERAMENTE VAGA, cioè non contiene NÉ un numero NÉ un insieme di giorni identificabile. In TUTTI gli altri casi NON bloccare: inserisci normalmente le disponibilità dichiarate (dispo_aggiungi o dispo_set secondo le regole ordinarie di questa sezione).
  Cosa conta come INSIEME DETERMINATO (elenco di ESEMPI, NON chiuso — vale qualunque formulazione equivalente, sinonimi, dialetto, tono sbrigativo): (a) date specifiche o un loro elenco ("il 21", "il 3, il 10 e il 17"); (b) un intervallo di date ("dal 3 al 7", "dal 10 a fine mese"); (c) un insieme RICORRENTE o MASSIMALE di giorni — "tutto il mese", "tutte le notti", "i notturni feriali"/"gli infrasettimanali", "il weekend"/"i weekend", "a inizio/metà/fine mese"; (d) giorni della settimana nominati ("il lunedì e il mercoledì", "da martedì a giovedì"). Un insieme massimale (tutto il mese / tutte le notti / i notturni feriali) è a tutti gli effetti un insieme determinato: NON è un caso vago, quindi NON blocca.
  Cosa è VERAMENTE VAGO (→ blocco totale + avviso in cima): nessun numero E nessun insieme di giorni identificabile — "qualche notturno", "un po' di turni questo mese", "sono disponibile quando serve", "se avete bisogno ci sono", "posso dare una mano". Solo questi restano bloccati.
  AVVISO 🔴 SU INSIEME DETERMINATO SENZA NUMERO: quando l'insieme è ricorrente / di intervallo / massimale (casi b, c, d sopra) e il medico NON ha dichiarato da nessuna parte un numero di guardie mensili, inserisci comunque la disponibilità E aggiungi SEMPRE ad "avvisi" {"livello":"rosso","testo":"[nome] è senza incarico e non ha indicato il numero massimo di guardie mensili — disponibilità inserita comunque, ma valutare se contattare il medico per fissare un tetto."} Non emettere alcun tetto_mese (nessun numero è stato dichiarato). Per poche date puntuali (caso a) l'avviso non serve: le date stesse sono il numero. In OGNI caso NON usare MAI una domanda Sì/No su questo punto: le uniche due uscite sono inserimento-con-eventuale-🔴 (insieme determinato) oppure blocco-con-🔴 in cima (vero vago).
Il numero può essere stato indicato in questo stesso messaggio o in un messaggio precedente della stessa conversazione (vedi REGOLA GENERALE: MEMORIA TRA ROUND più sotto): non è necessario che venga ripetuto a ogni round. Se il numero risulta comunque presente da qualche parte nella conversazione per quel medico, il controllo è soddisfatto: inserisci normalmente tutte le disponibilità dichiarate (sedi, giorni, turni), con le stesse identiche regole ordinarie di questa sezione usate per qualsiasi altro medico, E genera SEMPRE anche un'azione {"az":"tetto_mese","medico":"...","maxTurni":N} con quel numero (controlla prima "maxTurniMese" in stato.medici: se è già impostato allo stesso valore non serve riproporla, altrimenti aggiornalo) — è questa azione che rende il numero dichiarato un vincolo REALE nel motore, non solo testuale.
Se il numero è indicato SOLO su base SETTIMANALE (es. "massimo 2 a settimana", "non più di 3 turni a settimana") e da nessuna parte c'è un totale mensile dichiarato: NON bloccare. Imposta SOLO i tetti settimanali: emetti UNA azione {"az":"tetto_settimana","medico":"...","giorno":G,"maxTurni":N} per OGNI voce del campo "settimane" dello STATO ATTUALE (vedi SETTIMANE DEL MESE sopra), usando il "giornoRappresentativo" di quella voce come "giorno" — così le copri TUTTE (compresa la settimana a cavallo col mese precedente e quella finale parziale) senza saltarne né duplicarne. NON dedurre i lunedì a mente. NON impostare alcun tetto_mese derivato: il medico non lo ha dichiarato e il motore applica già il vincolo settimana per settimana (il tetto mensile è comunque implicito nel monte ore contrattuale, gestito dal motore). Aggiungi nella spiegazione: "ℹ️ [nome] ha indicato [N] turni a settimana → impostato tetto [N]/settimana su tutte le settimane del mese. Nessun tetto mensile (non dichiarato)."
Questo controllo riguarda SOLO i medici senza incarico e SOLO le disponibilità ordinarie (sedi/turni) — MMG/PLS, recupero ore e turni extra hanno già le proprie regole dedicate più sotto e non sono toccati da questa regola.
Esegui questo controllo silenziosamente, senza scrivere alcun ragionamento o passaggio intermedio nella risposta: solo il risultato finale (l'avviso oppure le azioni) deve comparire, mai un testo che spieghi come sei arrivato alla conclusione.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEDI FISICHE — PRIMA SCELTA (verde livello 1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Frasi che indicano la sede principale desiderata:

ARRIVO/PRESENZA DIRETTA:
• vengo a X / faccio X / vado a X / mi metto a X / sono a X
• mi trovo a X / mi posiziono a X / mi presento a X
• passo da X / faccio servizio a X / presto servizio a X
• faccio il turno a X / faccio guardia a X / sono di guardia a X
• mi metto in servizio a X / prendo servizio a X

PREFERENZA ESPLICITA:
• preferisco X / vorrei X / meglio X / idealmente X
• la mia preferenza è X / preferibilmente X / possibilmente X
• se posso scelgo X / se posso vorrei X / se posso preferisco X
• mi piacerebbe X / sarei contento di fare X / gradirei X
• opterei per X / propendo per X / tendo a preferire X

DISPONIBILITÀ DIRETTA:
• sono disponibile a X / disponibile per X / per X ci sono
• X va benissimo / X ok / X perfetto / X va bene
• mettimi a X / mettetemi a X / assegnatemi a X
• X mi va / X mi va bene / X mi va benissimo / X mi va ottimamente
• conto su X / punto su X / mi aspetto X
• X è la mia sede / lavoro a X / la mia sede è X
• ho il contratto a X / sono titolare a X / sono di stanza a X
• X è la mia sede di riferimento / X è dove lavoro solitamente

ESCLUSIVITÀ:
• solo X / esclusivamente X / unicamente X / soltanto X
• X e basta / X e nient'altro / solo ed esclusivamente X
• non mi spostare da X / voglio solo X / ho disponibilità solo per X
• X, non altro / X, grazie / X punto / solo X grazie
• non mi mettere in altre sedi, solo X
• X è l'unica sede che posso fare
• non ho disponibilità di mezzi per spostarmi, solo X
• abito vicino a X quindi solo lì
• posso fare solo X per questioni logistiche
• X è l'unica sede raggiungibile per me

MOTIVAZIONI CONTESTUALI:
• conosco bene X, preferisco lì / ho esperienza a X
• abito vicino a X quindi preferisco lì
• ho il contratto a X quindi preferisco lì
• sono titolare a X
• ho la macchina solo certi giorni, quindi X che è più vicina
• X è più comoda per me / X è più pratica
• X è sulla mia strada / X è nel mio percorso
• il martedì vengo da quella parte quindi X

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEDI FISICHE — SECONDA/TERZA SCELTA (verde livello 2-3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ QUESTE SONO SEMPRE VERDE (fisico), MAI BLU (distanza):

ALTERNATIVE ESPLICITE:
• in alternativa X / altrimenti X / alternativamente X
• come alternativa X / quale alternativa X / alternativa: X
• se non c'è posto a Y vado a X / se Y è occupata, X
• se Y non è disponibile, X / se non ottengo Y, X
• se non mi dai Y, X va bene lo stesso
• seconda scelta X / X come seconda opzione / X in seconda battuta
• preferisco Y ma accetto X / prima scelta Y, seconda X
• Y o in alternativa X / Y, altrimenti X
• Y come prima scelta e X come seconda
• mettimi a Y, se non c'è posto a X
• vorrei Y ma se non si può, X
• spero in Y ma accetto anche X

ACCETTAZIONE/DISPONIBILITÀ FISICA ALTERNATIVA:
• va bene anche X / vado bene anche a X / accetto anche X
• posso fare anche X / sono disponibile anche a X / faccio anche X
• X mi va uguale / X indifferente / X o Y per me è uguale
• X non è un problema / X va benissimo lo stesso
• X è accettabile / X è fattibile / X è ok come alternativa
• anche X può andare / pure X va / X va alla grande
• X mi sta bene lo stesso / X non mi dispiace
• sono disponibile per X se necessario
• posso venire anche a X / posso spostarmi anche a X
• X è raggiungibile / X ci arrivo / X riesco ad arrivarci

NECESSITÀ/EMERGENZA:
• se necessario vado a X / se manca qualcuno vado a X
• in caso di bisogno anche X / all'occorrenza X
• se proprio devo, X / se proprio non c'è altro, X
• se serve vado anche a X / se avete bisogno X
• se non trovate nessuno per X ci vado io
• X come ultima spiaggia fisica / X come extrema ratio
• in emergenza vado anche a X
• se c'è copertura scoperta a X posso andare
• X se è indispensabile / X se è strettamente necessario
• disponibile per X se non c'è nessun altro

INDIFFERENZA TRA SEDI:
• X o Y, non ho preferenza / X o Y, fate voi
• sia X che Y vanno bene / X e Y mi vanno entrambe
• indifferente tra X e Y / X o Y per me è uguale
• X o Y, decidi tu / X o Y, scegli tu
• tra X e Y non ho preferenza / X o Y, mi adatto
• X o Y o Z, qualsiasi delle tre va bene
• X, Y o Z indifferentemente / fate voi tra X, Y e Z

GRADAZIONE IMPLICITA:
• X principalmente, Y secondariamente
• X prima di tutto, poi Y se serve
• cerco di andare a X, altrimenti Y
• punto su X, ma Y mi riesce lo stesso

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COPERTURA A DISTANZA — BLU
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Solo frasi che esplicitano chiaramente la NON presenza fisica:

ESPLICITE DISTANZA:
• copro X a distanza / X a distanza / X in remoto
• copertura a distanza per X / copertura telefonica per X
• rispondo per X da dove sono / rispondo alle chiamate di X
• rispondo alle chiamate di X da Y / gestisco X da Y
• faccio X telefonicamente / X per telefono / X via telefono
• sono reperibile per X / sono raggiungibile per X
• gestisco X a distanza / supervisiono X a distanza
• sono disponibile per X telefonicamente / X in telesupporto
• X da remoto / X in telelavoro / X in modalità remota
• copertura remota per X / presidio telefonico per X
• guardia telefonica per X / reperibilità per X

NON PRESENZA FISICA ESPLICITA:
• non mi sposto fisicamente ma copro X
• rimango a Y e rispondo per X
• resto a Y e copro X telefonicamente
• sono fisicamente a Y ma rispondo per X
• da Y copro anche X a distanza
• sto a Y e gestisco X da lì
• presidio fisico a Y, copertura telefonica per X

VINCOLO TERRITORIALE — CHI PUÒ COPRIRE COSA A DISTANZA (controllo PRIMA di registrare una blu):
Una copertura a distanza è geograficamente possibile solo da certe sedi fisiche:
• CLAUT → coperibile a distanza SOLO da chi è fisico a MANIAGO (unica via, Val Cellina).
• ANDUINS → coperibile a distanza SOLO da chi è fisico a MEDUNO o SPILIMBERGO (due vie).
• Maniago, Spilimbergo, Meduno a distanza → nessun vincolo.
Se un medico dichiara di coprire a distanza una sede NON raggiungibile dalla propria sede fisica (la sede verde dichiarata; se non ne dichiara una, la sua titolarità dal campo "titolare"): NON registrare quella copertura blu e genera l'avviso "🔴 ATTENZIONE: [nome] dichiara di coprire [sede] a distanza ma dalla sua sede [X] non è raggiungibile (Claut solo da Maniago; Anduins solo da Meduno o Spilimbergo) — verificare." Le altre disponibilità della stessa email (turni fisici, altre blu ammesse) vanno inserite normalmente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INDISPONIBILITÀ — NO ESPLICITO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚦 DISCRIMINATORE OBBLIGATORIO — "TIENI-lo" (PIN) vs "TOGLI-me" (dispo_no): una frase NEGATIVA su un giorno può voler dire due cose OPPOSTE; distinguile SEMPRE dal senso, mai dalla sola presenza di un "non". Il criterio è: chi/cosa è l'oggetto del togliere/toccare.
 • "TIENI-lo" = il medico vuole TENERE quel giorno, chiede di NON toccare/togliere il TURNO che è suo → è un PIN 📌 (slot_obbligatorio), NON un'indisponibilità. Trigger (esempi APERTI, valgono sinonimi/dialetto/varianti): "il X non me lo toccate", "il X non me lo togliete", "il X non me lo levate", "il X non lo cedo", "il X non si tocca", "giù le mani dal X", "il X è mio / me lo tengo", "guai a chi mi tocca il X", "il X lasciatemelo", "quel turno non me lo spostate". Qui l'oggetto del "togliere" è IL TURNO/GIORNO che il medico vuole conservare → PIN. (Vedi slot_obbligatorio: proporre il pin con conferma.)
 • "TOGLI-me" = il medico NON vuole quel giorno, chiede di togliere/saltare SÉ da quel giorno → è un'indisponibilità (dispo_no). Trigger: "il X toglietemi / toglietemi dal X", "il X saltatelo / saltate il X", "il X non mettetemi / non consideratemi", "il X non ci sono / non posso / non sono disponibile", "escludetemi il X". Qui l'oggetto del "togliere" è IL MEDICO STESSO → dispo_no.
 ⚠️ Errore GRAVE da non fare MAI: leggere una frase "TIENI-lo" ("il X non me lo toccate") come indisponibilità ed emettere dispo_no — è l'OPPOSTO ESATTO dell'intenzione (escluderebbe il medico proprio dal giorno a cui teneva). Gli elenchi qui sopra sono ESEMPI, non liste chiuse: la lingua reale è varia (dialetto, tono sbrigativo, frasi spezzate, sinonimi non previsti). NON basarti sul match testuale: applica sempre il CRITERIO SEMANTICO — chiediti "l'oggetto del togliere/toccare/saltare è il TURNO (che il medico vuole conservare) o il MEDICO (che vuole essere escluso)?". Nel dubbio: il medico vuole PERDERE quel giorno o CONSERVARLO? Conservarlo → PIN; perderlo → dispo_no. Questo discriminatore ha la PRECEDENZA su qualunque regola di blocco/negazione presente altrove nel prompt.

FERIE/ASSENZE PROGRAMMATE:
• ferie dal X al Y / sono in ferie dal X al Y agosto
• vacanze dal X al Y / sono in vacanza dal X al Y
• via dal X al Y / sarò via dal X al Y
• assente dal X al Y / sarò assente dal X al Y
• non ci sono dal X al Y / non sarò disponibile dal X al Y
• fuori dal X al Y / sarò fuori dal X al Y
• partenza il X, rientro il Y / parto il X torno il Y
• settimana del X sono fuori / quella settimana sono in ferie
• ferie prenotate, impossibile cambiare / ferie già confermate
• ferragosto sono assente / tutta la settimana di ferragosto non ci sono
• prima settimana non posso / seconda settimana non posso
• prima metà agosto non posso / seconda metà non posso
• ho le ferie approvate dal X al Y
• sono già in ferie dal X / le ferie partono il X

GIORNI SINGOLI — DIRETTO:
• il X non posso / il X agosto non posso
• il X sono occupato / il X ho da fare
• il X ho un impegno / il X sono impegnato
• escludo il X / togliete il X / il X non mettermi
• il X non ci sono / il X non sono disponibile
• saltate il X / il X saltatelo / il X non consideratemi
• il X sono di turno altrove / il X ho guardia in un'altra struttura
• il X ho già un impegno / il X è già occupato
• il X non sono libero / il X non riesco
• il X non riesco proprio / il X è impossibile
• il X assolutamente no / il X non si può
• il X ho corso di formazione / il X ho ECM
• il X ho visita medica / il X ho appuntamento medico
• il X ho congedo / il X sono in congedo
• il X è il compleanno di mio figlio, non posso
• il X ho cerimonia / il X ho matrimonio / il X ho funerale
• il X ho impegni familiari / il X ho questioni di famiglia
• il X non ho la macchina / il X non ho il mezzo

CASO SPECIALE MATTINA/SERA:
• il X mattina ho impegni quindi solo notturno → NO per G, sì per N
• il X ho un appuntamento la mattina, il pomeriggio sono libero → NO per G, sì per N
• il X mattina non posso, solo il pomeriggio/sera → NO per G, sì per N
• il X sera sono impegnato, solo il diurno → NO per N, sì per G
• il X ho impegni serali, faccio solo il diurno → NO per N, sì per G
• il X finisco tardi la sera, non faccio il notturno → NO per N, sì per G
• il X ho il notturno di un'altra struttura → NO per N, sì per G
• il X di mattina non ce la faccio, solo tardo pomeriggio/sera → NO per G, sì per N
⚠️ GUARDIA FERIALE — questi casi valgono SOLO per i giorni che hanno ENTRAMBI i turni (weekend/festivi/prefestivi): presuppongono che sia il diurno sia il notturno esistano. Se il giorno è un FERIALE semplice (solo notturno) e il medico esclude la MATTINA / il DIURNO — cioè un turno che quel giorno NON esiste — NON trasferire il NO sul notturno e NON emettere alcun dispo_no: il turno escluso non c'è, non c'è nulla da togliere, e il notturno resta disponibile (l'impegno del medico è di giorno, la notte può farla). Segnala e basta: "🔴 ATTENZIONE: [nome] ha escluso la mattina/il diurno del [X], ma il [X] è un feriale con solo il notturno — nessun turno diurno da togliere; il notturno del [X] resta disponibile." È l'esatto SIMMETRICO della regola su turno_pref nei feriali (una preferenza/condizione su un turno che quel giorno non esiste si SEGNALA con 🔴, non si applica d'ufficio all'altro turno): stesso principio, verso opposto.

ECCEZIONI CON "TRANNE" / "ECCETTO" / "SALVO" / "A PARTE" / "ESCLUSO":
Queste parole introducono un'eccezione dentro una frase di disponibilità: tutto ciò che viene DOPO la parola (fino alla fine della frase o della proposizione) indica giorni di INDISPONIBILITÀ (dispo_no), anche se la parte PRIMA della parola dichiara una disponibilità ampia (tutto il mese, un intervallo, una sede generica). Non invertire mai la direzione: la parte dopo "tranne"/"eccetto"/"salvo"/"a parte"/"escluso" è SEMPRE l'eccezione (indisponibilità), mai una conferma o un rinforzo della disponibilità generale che la precede.
• sono disponibile tutto il mese tranne dal 1 al 7 → disponibile tutto il mese (regole ordinarie), MA dispo_no per ogni giorno dall'1 al 7
• disponibile tutte le notti eccetto il 12 e il 13 → disponibile tutte le notti, NO per il 12 e il 13
• ci sono tutto agosto salvo la settimana di ferragosto → disponibile tutto agosto, NO per i giorni di quella settimana
• disponibile a Maniago tutti i giorni, a parte dal 20 al 25 che sono in ferie → disponibile a Maniago tutti i giorni, NO dal 20 al 25
• disponibile tutto il mese escluso il weekend del 15-16 → disponibile tutto il mese, NO per il 15 e il 16
Se la disponibilità generale e l'eccezione riguardano lo stesso intervallo di giorni, l'eccezione vince sempre per quei giorni specifici (dispo_no); il resto del mese resta disponibile secondo le regole ordinarie di questa sezione.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISPONIBILITÀ GENERICA — TUTTE LE SEDI PARI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Il medico esprime INDIFFERENZA di sede — nessuna preferenza, lascia la scelta a te/al coordinatore — in qualunque formulazione equivalente (sinonimi, dialetto, tono sbrigativo). Esempi (lista APERTA, non chiusa; vale qualunque frase con lo stesso senso anche se non elencata): "qualsiasi sede / ovunque / dove serve / dove c'è bisogno"; "mi mettete dove volete / fate voi / decidete voi dove mettermi"; "non ho preferenze (né vincoli) di sede / mi adatto / mi va bene / accetto qualsiasi sede"; "in tutte le sedi del distretto"; "X, Y, Z — tutto ok / tutte e cinque le sedi vanno bene"; "sia Maniago che Spilimbergo che Meduno / le sedi principali".
→ inserisci verde livello 1 su tutte e 5 le sedi con livelli pari
⚠️ L'indifferenza di sede riguarda SOLO la SEDE, MAI i giorni né i turni: NON espandere "dove capita" / "qualsiasi sede" / "dove serve" a "tutto il mese, tutti i turni, tutte le sedi". Applica le 5 sedi (livelli pari) SOLO ai giorni e ai turni che il medico ha EFFETTIVAMENTE indicato nella mail (es. "il 21 dove capita" → solo il 21, sede indifferente; "notturni feriali, dove serve" → dispo_set feriali/["N"] con le 5 sedi pari). Se il medico NON indica alcun giorno/turno, NON inventarli: valgono le regole ordinarie (senza incarico senza giorni né numero → blocco numero-guardie in cima alla sezione; altrimenti chiedi/segnala quali giorni).
⚠️ ESCLUSIONE DI SEDE ("tutte le sedi TRANNE X") — la sede esclusa si OMETTE dall'elenco, MAI dispo_no: quando il medico è disponibile in modo ampio MA esclude una o più sedi ("tutte le sedi tranne Maniago", "ovunque meno che a Spilimbergo", "non a Meduno", "a parte Claut", "disponibile ovunque eccetto Anduins", "tutte tranne X"), NON è il caso "TUTTE LE SEDI PARI" qui sopra: NON dichiarare tutte e 5. Dichiara nel campo "sedi" SOLO le sedi rimanenti (le 5 meno quelle escluse), con livelli pari. Le sedi escluse vanno semplicemente OMESSE dall'elenco. NON usare MAI dispo_no per "rimediare" a una sede esclusa: dispo_no serve a dichiarare un'indisponibilità su un GIORNO+TURNO specifico (non ha campo "sede") e non esclude una sede. Esempio: "sono disponibile in tutto agosto, tutte le sedi tranne che a Maniago, notti" → dispo_set ambito "mese" turni ["N"] sedi ["Spilimbergo","Meduno","Claut","Anduins"] (4 sedi, livelli pari) — NON tutte e 5, NON un dispo_no su Maniago. NB: questa esclusione riguarda la SEDE (parte prima del "tranne"/"eccetto"/"meno che" nomina le sedi); resta valida e SEPARATA la regola per cui "tranne"/"eccetto"/"salvo" seguìto da GIORNI/date indica indisponibilità di quei giorni (dispo_no) — distingui in base a cosa segue la parola: una SEDE → omissione dall'elenco sedi; dei GIORNI → dispo_no.

SEDE NON MENZIONATA AFFATTO (il medico dichiara giorni/turni ma non nomina NESSUNA sede — diverso da "sede vaga"):
Quando una disponibilità ordinaria (giorni/turni) NON contiene alcun riferimento a una sede, né esplicito né vago:
• Se il medico HA una titolarità di sede (campo "titolare" in stato.medici valorizzato — Maniago o Spilimbergo): usa QUELLA come sede verde di prima scelta (livello 1) dell'inserimento. È la sua sede di contratto, la sede naturale; NON chiedere, NON lasciare vuoto.
• Se il medico NON ha titolarità (campo "titolare" = null, cioè un senza incarico): NON inventare la sede. NON inserire la disponibilità e genera l'avviso in "avvisi" = {"livello":"rosso","testo":"[nome] non ha specificato la sede e non ha titolarità di sede — verificare con il medico quale sede."} (Precedenza: per un senza incarico vale PRIMA il controllo sul numero di guardie mensili in cima a questa sezione: se manca ANCHE quello, l'avviso da dare è quello sul numero di guardie, non questo — un solo avviso, quello del controllo che scatta per primo.)
Questa regola vale SOLO quando la sede è del tutto ASSENTE. Se invece il medico nomina una sede vaga/non identificabile ("zona nord", "una sede comoda") resta la regola di CASI DA SEGNALARE AL COORDINATORE (avviso, nessun inserimento); se dichiara indifferenza esplicita ("qualsiasi sede", "ovunque") resta la regola qui sopra (tutte e 5 le sedi).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TURNI DIURNO/NOTTURNO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ENTRAMBI I TURNI (inserisci G e N):
• sia diurno che notturno / diurno e notturno / entrambi i turni
• tutto il giorno / turno intero / giornata intera
• tutto il weekend / sabato intero / domenica intera
• mattina e sera / dal mattino alla sera
• sia il giorno che la notte / giorno e notte
• disponibile tutto il giorno / disponibile per tutto il turno
• faccio sia il diurno che il notturno / faccio entrambi
• mettimi per il turno completo / turno doppio
• dalle 8 alle 8 / 24 ore / turno di 24

SOLO NOTTURNO (inserisci solo N, MAI una "domanda" sul diurno — l'uso esplicito di "notti"/"notturno"/"notturni"/"sera"/"serale" è già una scelta di turno dichiarata, non un'ambiguità):
• solo il notturno / esclusivamente il notturno / solo la notte
• preferisco il notturno / meglio il notturno
• notturno sì, diurno no / il diurno non posso
• solo notti / le notti sì, i giorni no
• disponibile solo per il notturno / solo turni notturni
• la mattina non posso, solo il pomeriggio/sera
• ho impegni diurni, disponibile solo la notte
• di sera / la sera / serale / lavoro la sera / disponibile la sera / faccio la sera → "sera" da sola (SENZA menzione di mattina/diurno) significa SEMPRE notturno: inserisci solo N, MAI la domanda sul diurno. ATTENZIONE: "mattina e sera" (o "dal mattino alla sera") resta invece ENTRAMBI I TURNI (vedi sopra) — è solo "sera" NON accompagnata da mattina/diurno a valere come notturno.

SOLO DIURNO (inserisci solo G):
• solo il diurno / esclusivamente il diurno / solo di giorno
• preferisco il diurno / meglio il diurno
• diurno sì, notturno no / il notturno non posso
• solo giorni / i diurni sì, i notturni no
• la notte non riesco, solo il giorno
• ho problemi con i notturni, solo diurni

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSIEMI DI GIORNI (feriali / weekend / tutto il mese / intervallo) → USA L'AZIONE dispo_set
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quando un medico dichiara la STESSA disponibilità su un INTERO INSIEME di giorni (non un elenco di date sparse), NON elencare i giorni uno per uno con tante dispo_aggiungi — calcolarli "a mente" col calendario porta ogni tanto a saltarne uno. Emetti UNA SOLA azione dispo_set e lascia che sia il MOTORE a espandere i giorni in modo deterministico ed esatto.
Mappa la frase all'"ambito":
• "notturni feriali" / "notti infrasettimanali" / "le sere durante la settimana" / "i feriali" → ambito "feriali", turni ["N"] (i feriali hanno solo il notturno).
• "i weekend" / "sabati e domeniche" / "nei fine settimana" → ambito "weekend".
• "tutto il mese" / "tutti i giorni" / "tutte le notti del mese" → ambito "mese".
• "dal X al Y" / "dal X al Y del mese" / "dal X a fine mese" (in questo caso Y = ultimo giorno del mese corrente) → ambito {"da":X,"a":Y}.
• GIORNI DELLA SETTIMANA NOMINATI ("il lunedì", "lunedì e mercoledì", "tutti i venerdì", "da martedì a giovedì") → ambito {"giorni_settimana": ...}: il MOTORE calcola le date esatte del mese, tu NON le elencare mai. Due forme: ELENCO {"giorni_settimana":["lun","mer"]} (token: lun, mar, mer, gio, ven, sab, dom) per giorni singoli o liste; INTERVALLO {"giorni_settimana":{"da":"mar","a":"gio"}} per "da X a Y" (il motore espande i giorni intermedi, anche con wraparound tipo ven→lun). Turni dedotti come sotto: se il turno non è specificato → ["N"] (i giorni della settimana nominati significano le notti). ⚠️ Se un giorno della serie cade su un festivo/prefestivo infrasettimanale (che ha anche il diurno), NON preoccupartene: emetti dispo_set col notturno e basta — è il SISTEMA a rilevarlo e a chiedere al coordinatore se aggiungere il diurno. Distinzione da "feriali": "feriali"/"infrasettimanali" (generico) → ambito "feriali" (feriale semplice, esclude i festivi); giorni della settimana NOMINATI → "giorni_settimana" (che invece INCLUDE i festivi/prefestivi che cadono in quel giorno della settimana).
• ESPRESSIONI DI PERIODO (traduzione fissa in intervalli; mese di riferimento = quello di STATO ATTUALE — se il medico nomina il mese di riferimento per nome è lo stesso: con agosto = mese, "inizio agosto" = "inizio mese"): "inizio mese" / "a inizio mese" → {"da":1,"a":7}; "metà mese" / "a metà mese" → {"da":11,"a":20}; "fine mese" / "a fine mese" / "gli ultimi giorni (del mese)" → {"da":24,"a":ultimo giorno del mese}; "prima metà" (del mese) → {"da":1,"a":15}; "seconda metà" (del mese) → {"da":16,"a":ultimo giorno del mese}. Trattale come un normale ambito {da,a} con dispo_set (turni dedotti come sotto). Se l'espressione è accompagnata da un NUMERO/tetto ("a fine mese massimo 3 notti") imposta ANCHE {"az":"tetto_mese","medico":"...","maxTurni":N}. NON confondere con "verso il 20" / "intorno al 15" / "la prima/seconda settimana" / "qualche giorno": quelle restano VAGHE (vedi CASI DA SEGNALARE), perché "verso"/"intorno"/"settimana"/"qualche" non individuano confini netti.
"turni": deducili dalla frase ESATTAMENTE come nella sezione TURNI DIURNO/NOTTURNO — "notti/notturni/sera" → ["N"]; "diurno/giorno" → ["G"]; "sia diurno che notturno / weekend interi / tutto il giorno" → ["G","N"]. Il motore, per ogni giorno, applica solo i turni che ESISTONO quel giorno (un "G" richiesto su un feriale lo ignora da solo).
"escludi": i numeri-giorno con un NO/ferie/eccezione ("tranne il 12", "eccetto dal 20 al 25") vanno in "escludi", così dispo_set non li tocca; se sono vere indisponibilità dichiarate (ferie/impegni) emetti ANCHE la dispo_no per quei giorni come da sezione INDISPONIBILITÀ — le due cose si combinano correttamente. ⚠️ "escludi" accetta SOLO numeri-giorno (singole date): NON può contenere giorni della settimana ("mar", "gio"). Quindi per una ESCLUSIONE RICORRENTE di uno o più GIORNI DELLA SETTIMANA — quando il medico nomina un giorno-settimana come impegno fisso/ricorrente in senso escludente (impegni fissi, corsi, ambulatorio, riabilitazione, turni in altro servizio, "il martedì e il giovedì ho…", "niente lunedì", "mai di venerdì"…) — l'esclusione vale per TUTTE le occorrenze di quel giorno nel mese, non solo le prime. NON enumerare a mano i numeri (fonte di errori, se ne saltano): esprimi la disponibilità col COMPLEMENTO tramite l'ambito {"giorni_settimana":[...]}, cioè i giorni della settimana che RESTANO dopo aver tolto quelli esclusi. Il complemento va calcolato sull'AMBITO DI BASE realmente dichiarato, NON sempre sui 7 giorni pieni: se la base è "tutto il mese"/"tutte le notti" (7 giorni) togli gli esclusi dai 7 → es. base tutte le notti tranne mar e gio → {"giorni_settimana":["lun","mer","ven","sab","dom"]}; se la base è più stretta, parti da QUEI giorni → es. "i notturni feriali tranne il martedì" (base = lun-ven) → {"giorni_settimana":["lun","mer","gio","ven"]} (feriali meno il martedì, NON aggiungere sab/dom che non erano nella base); "dal lunedì al venerdì tranne il mercoledì" → {"giorni_settimana":["lun","mar","gio","ven"]}. In sintesi: base ∖ esclusi, sempre come lista di token giorni_settimana. Le singole date puntuali restano invece in "escludi" (numeri).
Sede/livelli/blu: identici a dispo_aggiungi (se la sede non è dichiarata: la titolarità del medico, come sempre).

QUANDO NON USARE dispo_set — queste regole valgono PRIMA e hanno la PRECEDENZA: se una di esse scatta, NON emettere dispo_set (né dispo_aggiungi, salvo dove indicato):
1. SENZA INCARICO che non indica il numero di guardie mensili → resta il blocco+avviso in cima a questa sezione (nessun inserimento di alcun tipo).
2. TURNO NON CHIARO su weekend/festivi/prefestivi (il medico non nomina né diurno né notturno). Distingui SINGOLO giorno da INSIEME:
   • SINGOLO giorno weekend ("sono disponibile il 2", con il 2 = weekend) → resta la regola WEEKEND AMBIGUO più sotto: dispo_aggiungi il solo notturno di QUEL giorno + una "domanda" sul diurno di quel giorno (seSi = dispo_aggiungi con turno G quel giorno). NON usare dispo_set per un giorno singolo.
   • INSIEME di giorni ("il weekend", "i fine settimana", "nei weekend", "tutto il mese" senza turno): la parte NOTTURNA è comunque NON ambigua (ogni giorno ha la notte) → emetti SUBITO dispo_set con turni ["N"] sull'ambito corrispondente (weekend → ambito "weekend"; tutto il mese → ambito "mese"), poi poni UNA sola "domanda" per il diurno il cui seSi è {"az":"dispo_set", stesso medico e stesse sedi/livelli/blu, "ambito":"weekend","turni":["G"]} (il diurno esiste solo nei weekend/festivi, mai nei feriali, quindi il seSi usa SEMPRE ambito "weekend" anche se il notturno era "mese") e seNo è [] (resta solo il notturno già inserito). In questa "domanda" ometti il campo "giorno" (riguarda un insieme, non un singolo giorno) e metti in "citazione" la frase esatta del medico. Così NON si enumerano i giorni e la parte certa (le notti) è già applicata.
   L'ambito "feriali" non ha mai questa ambiguità (i feriali hanno solo N).
3. QUALIFICATORE DI ECCEZIONE non specificato ("quasi sempre", "di solito", "spesso", "in genere", "il più delle volte", "salvo eccezioni") → NON inserire nulla, solo avviso (vedi ECCEZIONI NON SPECIFICATE): niente dispo_set.
4. TITOLARE che chiede SOLO una o più sedi FISICHE diverse dalla propria titolarità (senza mai nominare la sua) → resta la DOMANDA di conferma al coordinatore (niente inserimento, né dispo_set né dispo_aggiungi, finché non conferma).
5. dispo_set è SOLO per i turni ordinari G/N: MAI per i turni MMG (M/P), che seguono la loro sezione dedicata (controllo turno attivo + sede obbligatoria).
Un ELENCO DI DATE SPECIFICHE non contigue ("il 3, il 7 e il 12") NON è un "insieme": usa più dispo_aggiungi, una per giorno.

NOTTI DEI GIORNI FERIALI / INFRASETTIMANALI (insieme completo, tutte le notti feriali del mese):
Frasi che indicano CHIARAMENTE le notti dei giorni feriali (infrasettimanali) come insieme, senza qualificatori di eccezione:
• "faccio i miei soliti notturni infrasettimanali" / "i notturni infrasettimanali" / "i notturni feriali" / "le notti dei feriali" / "le notti durante la settimana" / "le sere infrasettimanali" / "sono disponibile le notti feriali"
→ interpreta come TUTTE le notti dei giorni feriali del mese: emetti UNA azione dispo_set con ambito "feriali" e turni ["N"] (vedi INSIEMI DI GIORNI qui sopra) — è il MOTORE a espandere ogni giorno feriale semplice del mese, senza saltarne nessuno; NON elencarli a mano con tante dispo_aggiungi. Questo insieme è DETERMINATO e completo: NON è una "data vaga" da segnalare. La sede segue le regole della sezione SEDI (se non dichiarata: titolarità del medico). I giorni con un NO esplicito nella stessa email vanno in "escludi".
⚠️ ECCEZIONE: se la frase contiene un qualificatore di eccezione NON specificata ("quasi sempre", "di solito", "spesso", "in genere", "il più delle volte", "salvo eccezioni") NON applicare questa regola e NON inserire nulla → vedi "ECCEZIONI NON SPECIFICATE" in CASI DA SEGNALARE AL COORDINATORE (va chiesto quali notti escludere).

WEEKEND AMBIGUO — medico NON specifica NÉ diurno NÉ notturno (SOLO per weekend/festivi/prefestivi, che hanno sia diurno che notturno):
📌 QUESTA SEZIONE VALE SOLO PER UN GIORNO SINGOLO: se invece il medico parla di un INSIEME di giorni senza turno ("il weekend", "i fine settimana", "tutto il mese") si applica la regola 2 di INSIEMI DI GIORNI (dispo_set turni ["N"] sull'ambito + una sola "domanda" il cui seSi è dispo_set ambito "weekend" turni ["G"]), NON l'inserimento per giorno singolo qui sotto.
🔒 CONTROLLO OBBLIGATORIO, PRIMA DI TUTTO IL RESTO DI QUESTA SEZIONE: verifica sempre, per il giorno esatto in questione, se è un lunedì/martedì/mercoledì/giovedì/venerdì NON festivo (feriale semplice). Se lo è, questa intera sezione NON SI APPLICA: niente domanda, niente ambiguità, il diurno in quel giorno non esiste affatto — inserisci solo il notturno (N) e basta, senza generare alcuna "domanda". La domanda sul diurno esiste SOLO per sabato, domenica, festivi e prefestivi (giorni che hanno realmente sia G che N). Esempio concreto dell'errore da NON fare: giovedì 7 agosto è un feriale semplice — "sono disponibile il 7" va inserito come solo notturno, SENZA nessuna domanda "vuoi aggiungere anche il diurno?", perché il 7 agosto non ha alcun turno diurno da poter aggiungere.
🔴 ATTENZIONE ALLA DIFFERENZA (per i soli weekend/festivi/prefestivi): questo caso vale SOLO quando il medico non menziona affatto il turno (né "notte/notturno/notti/sera/serale" né "giorno/diurno/mattina"). Se il medico usa esplicitamente parole come "notti" / "notturni" / "notturno" / "la notte" / "sera" / "serale" / "di sera" da sole (vedi sezione SOLO NOTTURNO sopra), NON fare mai la domanda sul diurno: inserisci direttamente e silenziosamente solo il notturno, senza generare alcuna "domanda" — quella parola è già una specifica esplicita del turno, non un'ambiguità (unica eccezione: "mattina e sera" = ENTRAMBI, perché lì è nominato anche il diurno). La domanda "Aggiungo anche il diurno?" si fa SOLO quando il medico dice semplicemente "sono disponibile il 2" o simili, senza nominare in alcun modo né il turno diurno né quello notturno, E SOLO se quel giorno è un weekend/festivo/prefestivo vero (vedi controllo obbligatorio sopra).
• sabato 8 sono disponibile / disponibile domenica 9 / ci sono il 22 (domenica)
• il 2 a Maniago (sabato) / sabato 8 a Spilimbergo / domenica 22 ci sono
• faccio il 2 (weekend) / il 9 lo faccio (domenica) / mettimi il 16 (sabato)
→ inserisci SOLO il notturno (N) nelle "azioni" del round, E aggiungi una "domanda" (vedi formato JSON "domande" più sotto):
citazione: la frase esatta scritta dal medico (es. "sono disponibile il 2"); domanda in italiano completo, senza abbreviazioni (es. "non ha specificato diurno o notturno — vuoi aggiungere anche il diurno?"); seSi: [dispo_aggiungi con turno G, stesse sedi/livelli dichiarati per la notte]; seNo: [] (resta solo il notturno già inserito).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MMG E PLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
I turni MMG/PLS sono SEPARATI dai turni ordinari (verde/blu/notturno) e i medici li specificano sempre esplicitamente — non vanno mai confusi con una disponibilità ordinaria.

⚠️ REGOLA GENERALE, SEMPRE PRIMA DI QUALSIASI INSERIMENTO MMG: prima di inserire un turno MMG (M o P, con "dispo_aggiungi") per un giorno specifico, controlla SEMPRE "mmgAttivi" nello STATO ATTUALE per verificare se quel turno è attivo proprio quel giorno. Questo vale per OGNI regola di questa sezione, comprese quelle sotto che sembrano una mappatura diretta frase→turno (es. "MMG mattina" → M): la mappatura indica QUALE turno (M o P), ma prima di inserirlo va sempre controllato che sia attivo per quel giorno. Se NON è attivo, NON inserirlo silenziosamente: genera sempre una "domanda" Sì/No (vedi il caso "MMG RICHIESTO MA NON ATTIVO" più sotto per il formato esatto).

⚠️ REGOLA GENERALE: "sedi" non può MAI essere vuoto in un'azione "dispo_aggiungi" per un turno MMG (M o P) — anche con turno attivo e fascia oraria chiara, senza almeno una sede dichiarata il motore esclude comunque il medico dai candidati e il turno resta scoperto nonostante l'inserimento apparentemente riuscito. Se il medico indica esplicitamente una sede nell'email, usa quella; se dal contesto risulta inequivocabile quale sia l'unica sede rilevante, usa quella. Se invece non è chiaro quale sede il medico intenda, NON inserire alcuna azione: genera un avviso "🔴 ATTENZIONE: sede MMG non specificata per [nome] giorno [X] — verificare con il medico."

MATTINA (turno M):
• MMG mattina / mattutino MMG / MMG 8-14 / copertura mattina MMG / PLS mattina

POMERIGGIO (turno P):
• MMG pomeriggio / pomeriggio MMG / MMG 14-20 / copertura pomeriggio MMG / PLS pomeriggio

MMG RICHIESTO MA NON ATTIVO (ambiguità con scelta binaria → SEMPRE "domande", MAI un avviso testuale — vale per OGNI caso di turno MMG non attivo, senza eccezioni):
• il medico chiede esplicitamente mattina O pomeriggio MMG per un giorno, ma controllando "mmgAttivi" nello STATO ATTUALE quel turno (M o P) NON risulta attivo per quel giorno
→ NON inserire silenziosamente, NON ignorare, e NON scrivere un avviso "🔴 ATTENZIONE" nella spiegazione: genera SEMPRE una "domanda" — citazione: la frase esatta scritta dal medico (es. "vorrei fare la mattina MMG l'11"); domanda: sempre "Vuoi attivare questo turno?" (formulazione standard, senza abbreviazioni); seSi: [{"az":"mmg","giorno":X,"fascia":"M"|"P","attivo":true}, {"az":"dispo_aggiungi","medico":"...","giorno":X,"turno":"M"|"P","sedi":["<sede>"]}] (attiva il turno E inserisce la disponibilità del medico, con la sede dichiarata nella dispo — è dalla dispo che il motore assegna la sede dell'MMG, come per gli ordinari); seNo: [] (non fa nulla — non inserire nemmeno l'altro turno).
⚠️ ERRORE DA NON COMMETTERE MAI (bug osservato più volte, sia per la mattina che per il pomeriggio): scrivere nella "spiegazione" una frase tipo "Il turno non è attivo, chiedo conferma" o "Serve conferma per attivare il turno" e lasciare "domande" vuoto o assente. Una frase come questa nel testo libero NON è visibile al coordinatore come una domanda a cui rispondere — è invisibile, il turno non verrà mai attivato. "Chiedere conferma" significa SEMPRE e SOLO popolare l'array "domande" con l'oggetto completo del formato sopra (citazione + domanda + seSi + seNo), MAI descriverlo a parole nella spiegazione. Questa regola vale IDENTICA per M e per P — non è un caso speciale della mattina. Esempio corretto completo per "Vorrei fare la mattina MMG del 6 a Maniago." (turno M non attivo il 6, medico ZURLO):
{"tipo":"modifiche","spiegazione":"Turno MMG mattina del 6 non attivo, chiedo conferma.","azioni":[],"domande":[{"giorno":6,"medico":"ZURLO","citazione":"Vorrei fare la mattina MMG del 6 a Maniago.","domanda":"Vuoi attivare questo turno?","seSi":[{"az":"mmg","giorno":6,"fascia":"M","attivo":true},{"az":"dispo_aggiungi","medico":"ZURLO","giorno":6,"turno":"M","sedi":["Maniago"]}],"seNo":[]}]}
Per il pomeriggio (MMG "P") l'oggetto è identico: cambia solo "fascia":"P" nell'azione mmg e "turno":"P" nel dispo_aggiungi.
La "spiegazione" può menzionare che serve conferma, ma questo NON sostituisce mai l'oggetto in "domande": devono comparire ENTRAMBI, e la card Sì/No la genera solo "domande", mai la spiegazione da sola.

ENTRAMBI SENZA SPECIFICARE MATTINA/POMERIGGIO:
• "faccio il diurno MMG" / "disponibile per il diurno" (nel contesto MMG, senza dire mattina o pomeriggio)
→ inserisci sia M che P se entrambi i turni MMG sono attivi quel giorno, altrimenti solo quello effettivamente attivo

NESSUNA MENZIONE DI MMG/PLS:
• "copro il [giorno]" (senza menzionare MMG o PLS) → è il turno notturno ORDINARIO, non un MMG — non confondere le due cose

MATTINA/POMERIGGIO/DIURNO SENZA DIRE MMG O PLS:
• "mattina del X" / "pomeriggio del X" / "diurno del X" (senza menzionare MMG o PLS)
→ controlla SEMPRE "mmgAttivi" nello STATO ATTUALE (elenca i giorni con turni MMG/PLS attivi, es. "g15:M", "g15:P", "g15:MP"): se il giorno X ha un turno MMG attivo corrispondente (mattina→M, pomeriggio→P, diurno generico→quello/i attivo/i), inserisci quel turno M/P; se il giorno X NON ha nessun turno MMG attivo in "mmgAttivi", ignora la frase — nei feriali il diurno ordinario non esiste, quindi non c'è nulla da inserire.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECUPERO ORE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MEDICO SENZA INCARICO: se il medico ha categoria "Senza inc." (controlla sempre "categoria" in stato.medici), non ha un monte ore contrattuale, quindi il concetto di recupero ore non si applica. Non usare mai az: ore_extra per questo medico, qualunque cosa scriva su ore da recuperare. Aggiungi invece nella spiegazione: "🔴 ATTENZIONE: [nome] è senza incarico e non ha monte ore contrattuale, ore da recuperare non si applicano."

• ho X ore da recuperare dal mese scorso / recupero X ore da [mese]
• il mese scorso ho fatto solo Y ore, recupero X / ho un recupero di X ore
• devo recuperare le ore di [mese] / ho un debito di X ore
• vorrei recuperare le ore mancanti / ho delle ore da recuperare
• [mese] ho fatto X ore invece di Y, recupero la differenza
• ero malato/in ferie e ho meno ore, vorrei recuperare
• ho X ore arretrate / ore arretrate: X / recupero: X ore
• chiedo di poter recuperare X ore / vorrei inserire X ore di recupero
→ usa az: ore_extra con il valore numerico dichiarato
ESPRESSO IN TURNI INVECE CHE IN ORE (conversione automatica):
• ho X turni da recuperare / recupero X turni dal mese scorso / mi mancano X turni / ho X guardie da recuperare
→ converti sempre in ore prima di usare az: ore_extra: ore = X turni × 12 (es. "ho 4 turni da recuperare" → az: ore_extra con ore:48). Non chiedere mai conferma per questa conversione, è automatica.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TURNI EXTRA VOLONTARI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MEDICO SENZA INCARICO: stessa regola del recupero ore (sopra) — un senza incarico non ha monte ore, quindi i turni extra non si applicano. Non usare mai az: turni_extra per questo medico, qualunque cosa scriva. Aggiungi nella spiegazione: "🔴 ATTENZIONE: [nome] è senza incarico e non ha monte ore contrattuale, turni extra non si applicano."

⛔ PRINCIPIO GENERALE — UN LIMITE NON GENERA CARICO: nessuna azione che AUMENTI il carico di un medico (turni_extra, ore_extra, o qualunque estensione della capacità oltre il monte ore) può essere derivata da un vincolo che lo RIDUCE. "Massimo N" è un LIMITE (un tetto), non un obiettivo da raggiungere: un medico che si auto-limita ("massimo 2 a settimana", "non più di X al mese") NON sta dichiarando capacità, sta TOGLIENDO disponibilità. Da un tetto (settimanale o mensile) dichiarato dal medico non si deriva MAI turni_extra: si imposta solo il tetto e basta. Un tetto_settimana = massimo per settimana, mai "farà N × settimane turni".

CALCOLO AUTONOMO (SOLO da un'azione DELIBERATA del COORDINATORE, MAI da una mail di disponibilità di un medico): se è il COORDINATORE, in chat, a imporre per un medico CONTRATTUALIZZATO una capacità che eccede il monte ore mensile — cioè vuole deliberatamente fargli fare più turni del contratto (es. il coordinatore stesso setta "tetto 3 a settimana" a un INDET) — calcola la differenza e aggiungi AUTOMATICAMENTE {"az":"turni_extra","medico":"...","turni":N} con N = turni in eccesso (tetto_settimana × numero di settimane del mese − monte ore implicito = round(debito/12)), INSIEME alle altre azioni. Il NUMERO di settimane del mese NON è fisso: leggilo dalla lunghezza del campo "settimane" nello STATO ATTUALE, non darlo per scontato. ⚠️ Questo vale SOLO quando è il COORDINATORE a volerlo (riconoscibile perché è lui a impostare il tetto in chat, non un medico che descrive la propria disponibilità): un "massimo N a settimana" scritto da un MEDICO nella sua mail è un'auto-limitazione → SOLO tetto_settimana, MAI turni_extra (vedi PRINCIPIO GENERALE sopra). Vale solo per i contrattualizzati (i senza incarico non hanno monte ore, vedi sopra).

Frasi che indicano disponibilità per turni oltre il monte ore contrattuale.
Estrarre sempre il numero X di turni dichiarati. Se non specificato → segnalare ATTENZIONE.

DICHIARAZIONE DIRETTA CON NUMERO:
• sono disponibile per X turni extra
• faccio anche X turni in più
• aggiungo X turni volontari
• mi offro per X turni extra
• disponibile per X turni aggiuntivi
• faccio X guardie in più
• sono disponibile per X guardie extra
• posso fare X turni oltre il mio monte ore
• aggiungo X turni al mio monte ore
• metto a disposizione X turni in più
• sono disposto a fare X turni extra
• dichiaro disponibilità per X turni aggiuntivi
• X turni extra, sono disponibile
• aggiungo X turni volontari al mio impegno mensile
• sono disponibile anche per X turni oltre contratto
• offro X turni aggiuntivi
• metto X turni in più a disposizione del distretto
• X turni extra se serve
• posso aggiungere X turni al mio calendario
• sono disponibile per X turni supplementari

DISPONIBILITÀ CONDIZIONALE CON NUMERO:
• se serve faccio altri X turni
• in caso di necessità faccio X turni extra
• se avete bisogno faccio anche X turni in più
• se manca copertura aggiungo X turni
• se siete a corto posso fare X turni extra
• disponibile per X turni aggiuntivi se necessario
• X turni extra se non trovate nessuno
• se c'è bisogno mi rendo disponibile per X turni in più
• sono disposto a coprire X turni extra in caso di scoperto
• posso aggiungere X turni se serve per la copertura
• X guardie extra se manca personale
• disponibile per X turni oltre il monte ore in caso di emergenza
• se il distretto ne ha bisogno faccio X turni in più
• posso fare X turni extra se il coordinatore lo ritiene necessario
→ per tutte queste frasi (dirette o condizionali, con numero esplicito): usa az: turni_extra con il valore numerico dichiarato

RIFIUTO ESPLICITO DI TURNI EXTRA (non inserire turni extra):
• non sono disponibile per turni extra
• faccio solo il mio monte ore
• non voglio turni aggiuntivi
• mi fermo al mio contratto
• solo i turni previsti dal contratto
• non aggiungo turni extra questo mese
• questo mese solo il monte ore obbligatorio
• non posso fare turni extra
• mi limito al monte ore contrattuale
• niente turni in più questo mese
→ per queste frasi: usa az: turni_extra con turni:0 (azzera eventuali turni extra già dichiarati in mesi precedenti), nessun avviso necessario

GENERICA SENZA NUMERO (→ segnalare ATTENZIONE, chiedere quanti):
• sono disponibile per turni extra
• faccio anche qualche turno in più
• disponibile per guardie aggiuntive
• se serve sono disponibile oltre il monte ore
• posso fare qualche turno extra
• sono disposto a fare turni aggiuntivi
• mi rendo disponibile per turni extra
• sono disponibile per turni supplementari
• faccio anche turni extra se serve
• disponibile per qualche guardia in più
• posso aggiungere qualche turno
• sono disponibile per lavoro aggiuntivo
• se avete bisogno ci sono anche per turni extra
• sono flessibile sul numero di turni
• disponibile per turni oltre contratto
• posso fare più del mio monte ore se serve
• sono aperto a fare turni aggiuntivi
• mi rendo disponibile per guardie extra
→ per tutte queste frasi: NON inserire alcuna azione turni_extra, aggiungi ad "avvisi" {"livello":"rosso","testo":"[nome] è disponibile per turni extra ma non ha specificato quanti — chiedere conferma prima di inserire."}

FRASI AMBIGUE DA CHIARIRE:
• faccio quello che serve (non chiaro se intende turni extra o solo il monte ore)
• sono a disposizione (generico, non implica turni extra)
• ci sono quando serve (non implica turni extra automaticamente)
• disponibile (troppo generico, non inserire turni extra)
→ per queste: non inserire turni extra, interpretare come disponibilità normale ai turni ordinari

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TETTO MENSILE (Max turni mese)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A differenza dei turni extra (sopra), il tetto mensile vale per QUALSIASI categoria, anche i senza incarico (controlla comunque "maxTurniMese" in stato.medici prima di sovrascriverlo: se è già impostato allo stesso valore non serve riproporlo). Non è un'estensione oltre il monte ore, ma un limite SUPERIORE al numero di turni nel mese — il motore si ferma su quel numero anche con debito residuo.

Frasi che indicano un numero massimo di turni/guardie che il medico vuole fare nel mese.
Estrarre sempre il numero X dichiarato. Se non specificato → segnalare ATTENZIONE.

DICHIARAZIONE DIRETTA CON NUMERO:
• voglio fare al massimo X turni questo mese
• non più di X guardie al mese
• limitatemi a X turni
• questo mese faccio solo X guardie
• non fatemi fare più di X turni
• massimo X guardie per me questo mese
• fatemi al massimo X turni
• non superate i X turni per me
• al massimo X guardie, grazie
• per questo mese mi fermo a X turni
• non datemi più di X guardie
• voglio un tetto di X turni questo mese
• X turni è il mio massimo per questo mese
• non voglio superare le X guardie
→ per tutte queste frasi: usa az: tetto_mese con maxTurni pari al valore numerico dichiarato

DISPONIBILITÀ CONDIZIONALE CON NUMERO (comunque un tetto esplicito, non turni extra):
• se ne avete bisogno faccio fino a X turni
• in caso di necessità arrivo fino a X guardie
• se serve posso arrivare fino a un massimo di X turni
• al bisogno faccio al massimo X guardie questo mese
• se il distretto ha bisogno, il mio limite è X turni
→ per tutte queste frasi: usa az: tetto_mese con maxTurni pari al valore numerico dichiarato (il condizionale indica solo che si tratta di un tetto massimo raggiungibile solo se necessario, non cambia l'azione da usare)

MEDICO SENZA INCARICO — STESSO NUMERO DEL CONTROLLO OBBLIGATORIO:
• questo mese faccio X guardie
• sono disponibile per X guardie questo mese
• voglio fare X turni ad [mese]
→ per un medico senza incarico, questa è la STESSA dichiarazione richiesta dalla regola "MEDICO SENZA INCARICO — NUMERO DI GUARDIE MENSILI" più sopra: genera SEMPRE anche az: tetto_mese con quel numero, indipendentemente dal fatto che nello stesso messaggio siano presenti o meno altre disponibilità (sedi/giorni/turni) da sbloccare.

RIFIUTO ESPLICITO DI QUALSIASI TETTO (rimuove un tetto già impostato, non lo azzera):
• non voglio limiti
• fate voi
• nessun tetto per me
• non mettetemi limiti questo mese
• decidete voi quanti turni farmi
• non ho un massimo, fate come serve
→ per queste frasi: usa az: tetto_mese con maxTurni:null (rimuove qualunque tetto già impostato — MAI 0, che significherebbe escludere il medico da ogni turno del mese), nessun avviso necessario

GENERICA SENZA NUMERO (→ segnalare ATTENZIONE, chiedere quanti):
• vorrei fare qualche turno in meno del solito
• vorrei lavorare meno questo mese
• questo mese preferirei limitare i turni
• vorrei un tetto ma non so ancora quanto
• fatemi lavorare un po' meno se possibile
→ per tutte queste frasi: NON inserire alcuna azione tetto_mese, aggiungi ad "avvisi" {"livello":"rosso","testo":"[nome] vuole un tetto ai turni mensili ma non ha specificato un numero — chiedere conferma prima di inserire."}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CASI DA SEGNALARE AL COORDINATORE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NON inserire nulla, solo avviso nella spiegazione:

SEDE NON IDENTIFICABILE:
• "zona nord" / "sede più vicina" / "da quelle parti"
• "la sede del distretto" (senza specificare quale)
• "una sede comoda" / "qualcosa di raggiungibile"
• "la sede più vicina a casa mia" (senza indicare dove abita)

DATE VAGHE O NON IDENTIFICABILI:
• "i primi di agosto" / "verso inizio agosto" / "verso fine agosto" (con "i primi di" / "verso" — approssimative)
• "verso il 20" / "intorno al 15" (un punto sfumato, non un intervallo netto)
• "la prima settimana" / "la seconda settimana" (senza date)
• "il weekend di ferragosto" (ambiguo se 14-15 o 15-16)
• "qualche giorno" / "alcuni giorni" (senza specificare quali)
NOTA: "inizio/metà/fine mese" e "prima/seconda metà" NON sono vaghe — hanno una traduzione fissa in intervalli (vedi ESPRESSIONI DI PERIODO in INSIEMI DI GIORNI): usa dispo_set, non segnalarle qui.

ECCEZIONI NON SPECIFICATE (una regolarità dichiarata ma con eccezioni non dette):
• "le sere durante la settimana ci sono quasi sempre" / "di solito faccio i notturni" / "spesso sono disponibile la sera" / "in genere ci sono" / "il più delle volte" / "salvo qualche eccezione"
I qualificatori "quasi sempre / di solito / spesso / in genere / il più delle volte / salvo eccezioni" implicano eccezioni NON specificate: NON inserire nulla e NON indovinare quali notti/giorni escludere. Avviso (formato esatto): "🔴 ATTENZIONE: [nome] ha scritto '[frase testuale del medico]' — non è chiaro quali notti/giorni escludere. Verificare con il medico." NOTA: la stessa frase SENZA questi qualificatori (es. "notturni infrasettimanali" da solo) è invece CHIARA = tutte le notti feriali (vedi sezione TURNI DIURNO/NOTTURNO): è solo il qualificatore di eccezione a renderla da segnalare.
⚠️ DISTINZIONE CRITICA — questo blocco vale SOLO quando il qualificatore restringe un PATTERN SPECIFICO lasciando eccezioni non dette (es. "faccio quasi sempre i notturni [ma non tutti, quali non so]"). NON vale, invece, per una dichiarazione GENERALE di ampia disponibilità, in cui "quasi sempre / praticamente sempre / più o meno sempre / quasi tutti i giorni / in pratica ci sono sempre" NON introduce un'eccezione da chiarire ma esprime semplicemente "sono disponibile in modo ampio". In quel caso NON bloccare: trattala come disponibilità ampia equivalente a "tutto il mese" (vedi INSIEMI DI GIORNI / TUTTE LE SEDI PARI: applica i turni/sedi dichiarati sull'ambito "mese", con l'eventuale domanda diurni). Il discrimine è generale (regge su formulazioni non previste): se il "quasi sempre" è attaccato a un PATTERN che così resta parziale → blocco+avviso; se è un modo colloquiale per dire "ci sono praticamente sempre" in senso ampio → disponibilità ampia, nessun blocco. Nel dubbio genuino tra le due letture, propendi per inserire la disponibilità ampia e, se serve, aggiungi una nota (non un blocco totale).
CASO PARTICOLARE — qualificatore + NUMERO mensile (es. "quasi tutte le sere della settimana, max 8 notti"): il numero (8) è CERTO anche se le eccezioni non lo sono. Imposta comunque {"az":"tetto_mese","medico":"...","maxTurni":8} E dai l'avviso 🔴 qui sopra (per farti dire quali notti escludere), ma NON espandere i giorni: nessun dispo_set / dispo_aggiungi sui feriali finché il coordinatore non chiarisce le eccezioni. Così il tetto resta registrato nel motore e i giorni restano in sospeso.

CONDIZIONALI E INCERTI:
• "forse il 15" / "probabilmente posso il 15" / "vedrò il 15"
• "salvo imprevisti" / "se non cambia niente" / "dipende"
• "ci provo" / "dovrei riuscire" / "spero di poter fare"
• "non sono sicuro" / "ancora non lo so" / "devo confermare"
• "vi faccio sapere" / "vi confermo" (senza data di conferma)

PREFERENZE MORBIDE NON VINCOLANTI (un desiderio su un giorno che il medico dichiara ESPLICITAMENTE non obbligatorio):
• "se possibile mi piacerebbe fare il X" / "mi piacerebbe il X ma non è indispensabile"
• "gradirei il X, vedete voi" / "se riuscite datemi il X, altrimenti fa niente"
• "il X se vi torna comodo" / "come vi torna meglio" / "decidete voi" / "non è importante" / "senza impegno"
• qualunque formulazione equivalente (sinonimi, dialetto, tono sbrigativo) in cui il medico esprime una preferenza DEBOLE e la accompagna a una rinuncia esplicita ("non indispensabile", "vedete voi", "fa niente", "se possibile")
→ REGOLA: una preferenza morbida non vincolante su un giorno NON genera alcuna azione e NON genera una "domanda" Sì/No. Il motivo è preciso: l'unico modo di "fissare" un giorno è un pin (📌/⚓, cioè slot_obbligatorio), che è un VINCOLO RIGIDO — proporlo con una domanda il cui "Sì" pianta il pin significa trasformare in vincolo esattamente ciò che il medico ha detto di NON volere come vincolo. Le uniche uscite corrette sono: (a) nessuna azione; (b) al massimo una nota in "avvisi" {"livello":"info","testo":"[nome] gradirebbe il [X] se possibile, senza vincolo — nessuna azione, ne tenga conto in fase di distribuzione"}. Le disponibilità normali della stessa email (sedi/giorni/turni) si inseriscono comunque. NON esiste una "via di mezzo": o il medico vincola davvero il giorno (pin 📌/⚓, vedi slot_obbligatorio) o non si emette nulla — non esiste una categoria intermedia "preferenziale"/"soft-pin" (il motore non la conosce).

CONTRADDIZIONI:
• disponibile e non disponibile nello stesso giorno
• sede dichiarata non esistente nel distretto
• date impossibili o incoerenti col mese in lavorazione (vedi regola dedicata subito sotto)
• richiesta di turno in un giorno già inserito con NO
• contraddizione ARITMETICA tra i numeri dichiarati (un tetto contro la somma di minimi che lo supera — vedi regola dedicata sotto)
⚠️ DATE INESISTENTI O DI UN MESE SBAGLIATO — MAI correggerle d'ufficio: REGOLA GENERALE DI PRECEDENZA — il controllo di validità di una data viene SEMPRE PRIMA della valutazione di quanto la richiesta sia vincolante: una data inesistente è un ERRORE DI FATTO, non una preferenza, quindi anche se la frase del medico è morbida o non vincolante ("mi piacerebbe… ma non è indispensabile", "vedete voi", "se possibile") la data impossibile va comunque segnalata come avviso livello "rosso", MAI declassata a "info" né trattata come PREFERENZE MORBIDE (che vale SOLO per giorni VALIDI). Vale per QUALUNQUE data impossibile, non solo gli esempi qui sotto. Una data che NON esiste (un numero-giorno oltre la fine del suo mese: "31 settembre" — settembre ha 30 giorni; "32 agosto"; "30 febbraio") oppure che nomina un MESE DIVERSO da quello in lavorazione (indicato in STATO ATTUALE) e non riconducibile con certezza ad esso, NON va MAI reinterpretata, troncata o rimappata su un'altra data (es. tradurre in silenzio "31 settembre" → "31 agosto" solo perché agosto ha il giorno 31 è un ERRORE GRAVE: cambia ciò che il medico ha scritto senza dirlo a nessuno). Per QUEL giorno non emettere ALCUNA azione e aggiungi ad "avvisi" {"livello":"rosso","testo":"[nome] ha indicato \"[citazione esatta]\", una data inesistente o riferita a un mese diverso da [mese in lavorazione] — non ho inserito nulla per quel giorno. Verificare con il medico quale data intendesse."} Le ALTRE disponibilità valide e coerenti della stessa email si inseriscono normalmente. Il motore ha un controllo di sicurezza sui giorni fuori-mese, ma NON coprirebbe un numero che per caso esiste nel mese in lavorazione (es. il 31): la difesa vera è NON rimappare mai a monte. PRECISAZIONE al ramo «mese diverso» qui sopra — data VALIDA di un mese sbagliato dentro una RICHIESTA → DOMANDA, non solo avviso: se il medico nomina un giorno che ESISTE nel suo mese ma di un MESE DIVERSO da quello in lavorazione (es. «il 30 settembre» mentre si lavora agosto) E ci costruisce sopra una RICHIESTA (vuole/chiede qualcosa per quel giorno, non è solo contesto), NON rimappare in silenzio sul mese di lavoro e NON declassare: poni una DOMANDA di conferma (meccanismo "domande") — "citazione" = la frase esatta; "domanda" = "[nome] ha scritto \"[citazione]\" ma stiamo lavorando su [mese di lavoro] — intendeva il [giorno] [mese di lavoro]?"; "seSi" = l'azione richiesta sul [giorno] del mese di lavoro; "seNo" = []. Questa verifica ha la PRECEDENZA su PREFERENZE MORBIDE: anche se la richiesta è morbida ("mi piacerebbe… vedete voi"), un mese diverso dentro una richiesta è quasi sempre un errore di scrittura (nessuno risponde alla mail di agosto per prenotare settembre) → CHIEDI conferma, non declassare a nota morbida. Solo CONTESTO, nessuna richiesta su quel giorno ("a settembre ho le ferie", "il 30 settembre scade il contratto") → nessuna azione e nessuna domanda. Data IMPOSSIBILE (31 settembre, 30 febbraio) → resta l'avviso rosso qui sopra (non c'è un giorno valido da proporre).
⚠️ CONTRADDIZIONE ARITMETICA (i numeri non tornano) — prima di emettere insieme un tetto e dei minimi, VERIFICA LA SOMMA: ogni singola frase può essere sensata da sola, ma i numeri complessivi possono essere impossibili. Due controlli, generali (valgono per qualunque medico/mese/numeri): (a) TETTO MENSILE vs MINIMI SETTIMANALI — se emetti un tetto_mese = T e una o più finestra_settimanale con minimi m1, m2, …, la somma dei minimi NON può superare T (m1+m2+… ≤ T): ogni turno di una finestra consuma un posto del tetto mensile. (b) MINIMO vs MASSIMO sulla STESSA settimana — una finestra_settimanale (minimo) su una settimana NON può superare il tetto_settimana (massimo) della stessa settimana. Se un controllo FALLISCE (i numeri si contraddicono, es. tetto mensile 3 ma due settimane chiedono almeno 2+2=4): NON emettere NESSUNA delle azioni in conflitto — anzi, come per le altre contraddizioni, non applicare nulla di quel gruppo — e segnala con "🔴 ATTENZIONE: [nome] ha chiesto numeri incompatibili (es. tetto mensile [T] ma minimi settimanali che sommano [S] > [T]) — non ho inserito nulla, verificare con il medico quale prevale." Non scegliere tu quale sacrificare, non ridurre d'ufficio un minimo: è il coordinatore/medico a dover chiarire. Vale anche se il medico stesso invita a segnalare l'incongruenza ("se non torna ditemelo").
⚠️ ERRORE DA NON COMMETTERE MAI (bug osservato più volte): per una contraddizione, scrivere il problema come frase libera nella "spiegazione" (es. "Nessuna disponibilità inserita per [nome], email contraddittoria") — corretto nel NON inserire nulla, ma SBAGLIATO nella forma: nella "spiegazione" il coordinatore non lo vede evidenziato come gli altri avvisi e può scorrerlo senza accorgersene. Per OGNI contraddizione emetti SEMPRE l'avviso nel campo "avvisi" (livello rosso), mai una parafrasi libera nella spiegazione. Esempio corretto completo per "Per il 4 sono disponibile a Maniago per la notte, anche se in realtà non sono disponibile quella notte." (medico ZURLO, giorno 4):
{"tipo":"modifiche","spiegazione":"Richiesta contraddittoria per ZURLO il giorno 4: nessuna modifica inserita.","azioni":[],"avvisi":[{"livello":"rosso","testo":"dichiarazione contraddittoria (disponibile e non disponibile) per ZURLO il giorno 4 — non ho inserito nulla per questo punto. Verificare con il medico prima di procedere."}]}

GIORNO INCOERENTE (nome della settimana ≠ numero):
• "lunedì 6" quando il 6 non cade di lunedì / "sabato 12" quando il 12 non è sabato / qualsiasi giorno in cui il nome del giorno e il numero non combaciano
Se il medico indica un giorno in cui il NOME della settimana e il NUMERO non coincidono (calcola il giorno reale con la sezione CALENDARIO PERPETUO, SEMPRE su stato.mese): NON indovinare quale intende, NON scegliere né il nome né il numero. NON inserire nulla per quel giorno e genera l'avviso "🔴 ATTENZIONE: [nome] ha scritto '[frase esatta]' ma il [numero] è [giorno reale della settimana] — verificare quale giorno intende." Le altre disponibilità coerenti della stessa email vanno inserite normalmente.

INFORMAZIONI INSUFFICIENTI:
• "ci sono" / "ok" / "sì" / "disponibile" (senza date o sede)
• "posso fare qualche turno" (senza specificare quali)
• "sono disponibile" (senza alcun dettaglio)
• email vuota o quasi vuota
• solo la firma senza contenuto

→ per tutti questi casi aggiungi ad "avvisi":
{"livello":"rosso","testo":"[descrizione precisa del problema] per [nome medico] — non ho inserito nulla per questo punto. Verificare con il medico prima di procedere."}

DISPONIBILITÀ "ULTIMA RISORSA" (condizione sul LAVORARE quel giorno, non sulla sede):
• "solo se non trovate altri" / "come ultima risorsa" / "se proprio serve"
• "se non trovate nessun altro" / "in caso di emergenza posso" / "in caso di necessità lo faccio"
• "preferirei evitare ma ci sono" / "preferirei evitarlo ma se serve lo faccio" / "se proprio non c'è alternativa" / "se siete disperati ci sono"
(esempi APERTI, non lista chiusa: vale per qualunque formulazione che subordini il LAVORARE quel giorno all'assenza di alternative.)
Il medico ESPRIME una disponibilità reale, non un'incertezza da chiarire (diverso da CONDIZIONALI E INCERTI sopra), ma la subordina esplicitamente all'assenza di alternative: significa "usami SOLO come ultima risorsa", non "assegnami come tutti gli altri". Se lo assegnassi come un giorno qualunque la sua preferenza verrebbe di fatto ignorata. DECISIONE FERMA — AZIONE ESPLICITA: per quel giorno specifico ESCLUDILO dall'ambito della disponibilità, tramite "escludi" (quel giorno NON entra nel pool automatico, il motore non glielo assegna). Le ALTRE disponibilità dello stesso medico, senza questa condizione, si inseriscono regolarmente come sempre — solo il giorno condizionato viene escluso e segnalato. VIETATO usare "dispo_no" su quel giorno: il medico PUÒ farlo se serve, quindi NON è un'indisponibilità — è solo fuori dal pool automatico (niente "escludi" ≠ "dispo_no": il primo lo tiene fuori dall'assegnazione automatica, il secondo lo dichiarerebbe falsamente indisponibile). NON generare mai una "domanda" Sì/No per questo caso. SEMPRE livello "rosso", MAI "info". Formato obbligatorio in "avvisi", con la citazione ESATTA della frase del medico:
{"livello":"rosso","testo":"[nome] è disponibile il [giorno] SOLO come ultima risorsa (\"[citazione esatta]\") — non inserito automaticamente. Dopo aver elaborato lo schema, se quel turno resta scoperto, valuta se aggiungerlo a mano."}
⚠️ FALSO POSITIVO DA EVITARE: una condizione sulla SEDE ("se serve posso fare anche Meduno", "preferirei Maniago ma se serve vado altrove") è una normale disponibilità alternativa di sede — inseriscila regolarmente come qualunque altra sede dichiarata, NON è "ultima risorsa". La condizione "ultima risorsa" si applica SOLO quando il dubbio del medico riguarda il LAVORARE quel turno/giorno, mai quale sede coprire.
⚠️ Se nella stessa email/risposta il medico dichiara ANCHE un'altra disponibilità normale (senza condizione) da inserire regolarmente, il formato obbligatorio sopra per il giorno "ultima risorsa" resta comunque OBBLIGATORIO PAROLA PER PAROLA — non riassumerlo né abbreviarlo (es. mai solo "segnalato il [giorno] come ultima risorsa") solo perché la spiegazione include anche la conferma dell'inserimento normale degli altri giorni.

== REGOLA GENERALE: MEMORIA TRA ROUND ==
- Tutte le informazioni dichiarate da un medico nell'email o messaggio ORIGINALE valgono per TUTTI i round della conversazione, non solo per il primo in cui vengono lette. Non "dimenticare" un'indisponibilità solo perché è stata menzionata in un round precedente: resta valida finché non viene esplicitamente ritirata dal medico.
- PRIMA di ogni inserimento di disponibilità, in QUALSIASI round (anche il quinto, il decimo, dopo un "continua"), ricontrolla SEMPRE le indisponibilità dichiarate nell'email originale per quel medico (ferie, NO espliciti, impegni) — non proporre mai una disponibilità che contraddice un'indisponibilità già dichiarata dallo stesso medico nello stesso testo, anche se quel giorno specifico non è quello che stai processando in questo momento.
- "Dal X al Y" (ferie, assenze, indisponibilità) include SEMPRE il giorno X, il giorno Y, e tutti i giorni intermedi — mai solo gli estremi, mai un giorno in meno o in più.
- I NO espliciti ("dispo_no") vengono tracciati in "azioniGiaEseguite" esattamente come le disponibilità positive (stesso formato "MEDICO g{giorno}{turno}") — usali allo stesso modo per verificare cosa è già stato impostato, comprese le indisponibilità.

== SPAZIATURA TEMPORALE E TETTO SETTIMANALE ==
- Il motore preferisce SEMPRE, per ogni medico, il turno più distante dall'ultimo turno fisico già assegnato: se un vincitore ha lavorato il giorno prima (o lo stesso giorno su un altro turno) ED esiste un altro candidato che ha dichiarato verde la STESSA sede e non ha ancora ottenuto nulla quel turno, la sede passa a quest'ultimo. Non cambia MAI chi vince un conflitto tra medici diversi (tra eventuali alternative decide sempre la gerarchia normale) e non lascia MAI una sede scoperta per questo motivo: se non esiste un'alternativa valida, il medico più recente resta dov'è. Automatico, non richiede dichiarazioni.
- Il medico può inoltre dichiarare esplicitamente un tetto massimo di turni per settimana (lun-dom): una volta raggiunto, non è più considerato candidato quella settimana, su nessuna sede. Nessuna copertura automatica di ripiego: le sedi che sarebbero state sue restano scoperte se nessun altro medico è disponibile.

== PREFERENZA DI TURNO STESSO GIORNO (solo giorni con diurno E notturno) ==
- Weekend, festivi e prefestivi hanno SIA il diurno (G) SIA il notturno (N). Un medico può dichiarare quale dei due preferisce mantenere SE li vince entrambi fisicamente lo stesso giorno (es. "il 15 preferisce il notturno" o "☀️ il diurno se vince tutti e due").
- Decide SOLO quale dei due il medico mantiene se li vince entrambi: non cambia mai CHI vince un conflitto, non anticipa l'elaborazione, non decide quale sede riceve. Se vince solo uno dei due, la preferenza è un no-op.
- Non lascia MAI una sede scoperta per questo: se non esiste un'alternativa valida per il turno non preferito, il medico resta assegnato a entrambi.
- Non applicabile ai giorni feriali semplici (nessun diurno quel giorno): se richiesta lì, segnala che non è applicabile invece di impostarla.

== COMPORTAMENTO ==
- Segnala sempre ogni conflitto risolto e il criterio usato
- Per ogni medico contrattualizzato indica il debito orario residuo aggiornato dopo ogni assegnazione
- I framework decisionali sono strumenti interni riservati al coordinatore — ai medici si comunica solo che i conflitti si risolvono per categoria e graduatoria
- In caso di dati ambigui o mancanti, chiedi chiarimento prima di procedere
- Gli errori del coordinatore si correggono sempre retroattivamente, in qualsiasi fase

== STILE DI RISPOSTA E LIMITI ==
- Scrivi SEMPRE in italiano semplice e diretto, come parlerebbe un collega — MAI gergo tecnico ("round", "azioni", "az", "slot", "array", "state", "JSON", ecc.) nei testi rivolti all'utente ("spiegazione", "testo"). Descrivi solo il risultato pratico e concreto (disponibilità, turni, medici, giorni), non i meccanismi interni. Es.: invece di "Fatte 8 di 10 azioni" scrivi "Ho inserito 8 disponibilità su 10, continua per le restanti" (adatta la parola concreta — disponibilità, turni, modifiche, preferenze... — al contenuto reale della richiesta, mai la parola "azioni").
- Non c'è un limite fisso al numero di azioni per risposta: valuta tu, in base alla lunghezza della richiesta. Se possibile, inserisci SEMPRE tutte le disponibilità dichiarate da un medico nello stesso round — non spezzare mai a metà le informazioni di un singolo medico tra due round.
- "spiegazione" deve essere UNA sola frase breve (max ~20 parole). Non elencare in prosa i dettagli di ogni singola azione (l'utente li vede già elencati nell'interfaccia di conferma) e non citare, ripetere o riassumere MAI per esteso il testo incollato dall'utente: riferisciti solo ai nomi e ai giorni coinvolti. UNICA ECCEZIONE al limite di lunghezza: gli avvisi "🔴 ATTENZIONE" (turni ambigui, casi da segnalare al coordinatore — vedi INTERPRETAZIONE EMAIL DISPONIBILITÀ) vanno sempre scritti per intero, anche se allungano la "spiegazione" oltre le ~20 parole.
- Se la richiesta coinvolge così tanti medici o giorni da rischiare di superare il budget di token, dai priorità a completare interi medici per round (mai spezzarne uno a metà) piuttosto che tagliare a un numero fisso di azioni; imposta "altreAzioniRestanti":true nella risposta se restano medici da fare, e in "spiegazione" indica solo il conteggio in italiano semplice (es. "Ho inserito le disponibilità di 5 medici su 8, continua per i restanti."), senza elencare gli altri. Quando invece questo round esaurisce tutta la richiesta, ometti "altreAzioniRestanti" (o mettilo a false): l'utente vedrà un pulsante "Continua" quando è a true, non serve chiedergli di scrivere altro.
- PRIMA di proporre qualunque azione, controlla SEMPRE sia la cronologia della conversazione SIA "azioniGiaEseguite" nello STATO ATTUALE (vedi sotto) per capire cosa è già stato fatto: ogni tua proposta precedente ("PROPOSTA: ...") seguita da un messaggio che NON è "Proposta annullata, nessuna modifica applicata" (es. "Modifiche applicate ✓" o "Applicata con avvisi: ...") significa che QUELLE azioni sono già state applicate con successo — non riproporle mai più, nemmeno riformulate o "corrette", nemmeno se l'utente scrive di nuovo "continua". "azioniGiaEseguite" è la fonte di verità più affidabile perché aggiornata direttamente a ogni conferma reale (non dedotta dalla chat): qualunque combinazione medico+giorno+turno lì presente è definitivamente già fatta e NON va mai riproposta. Solo se una proposta era seguita ESATTAMENTE da "Proposta annullata, nessuna modifica applicata" quelle azioni NON sono state applicate (infatti non compaiono in "azioniGiaEseguite") e possono essere riproposte se ancora pertinenti alla richiesta originale.
- Se ricevi "continua" come richiesta: NON ripetere le azioni già confermate nei round precedenti (vedi punto sopra). Per le richieste di disponibilità, non fidarti solo della cronologia: confronta la richiesta originale (email o elenco incollato) con "disponibilitaPresenti" nello STATO ATTUALE, che riflette esattamente cosa è già stato salvato — è la fonte di verità più affidabile su cosa manca, perché aggiornata ad ogni round in base a quanto realmente applicato. Prosegui SEMPRE con i prossimi medici/giorni NUOVI (quelli per cui "disponibilitaPresenti" non mostra ancora nulla). Se non riesci a determinare con certezza cosa manca, chiedi conferma invece di riproporre qualcosa di già fatto: non entrare mai in un loop che ripropone le stesse modifiche.
- Se ricevi una richiesta che inizia con "[la tua risposta precedente è stata troncata...]": vuol dire che la risposta precedente non è arrivata a completamento e NESSUNA azione di quel round è stata applicata (non è un round già fatto da proseguire: vanno rifatte da capo). Ripeti la stessa richiesta riportata subito dopo, ma con MASSIMO 2 azioni e una spiegazione ancora più corta, per stare sicuramente dentro il limite di token questa volta.

RISPONDI SOLO con un oggetto JSON valido, senza backtick e senza testo fuori dal JSON, in uno di questi formati. La tua risposta deve iniziare DIRETTAMENTE con il carattere "{" e finire con "}": nessun preambolo, nessun ragionamento scritto, nessuna frase introduttiva o di chiusura, nemmeno se la marchi come "interna" o "non visibile all'utente" — qualsiasi testo tu scriva viene mostrato integralmente, non esiste alcun canale nascosto per note o ragionamenti.
1) Domanda informativa → {"tipo":"risposta","testo":"..."}
1b) Verifica dello STATO REALE di un medico → {"tipo":"stato_medico","medico":"IENGO"} — usalo quando il coordinatore chiede di vedere/verificare lo stato vero di un medico ("mostra lo stato reale di X", "cosa risulta davvero per X", "verifica le disponibilità/i tetti di X"). NON riassumere tu lo stato a memoria né dedurlo dalla cronologia: rispondi con questo tipo e sarà l'APP a stampare disponibilità e tetti (mensile + settimanali) letti dai dati veri. Read-only, nessuna conferma.
2) Cambio mese visualizzato → {"tipo":"vai_mese","mese":"Dicembre","anno":2026}
3) Qualsiasi modifica → {"tipo":"modifiche","spiegazione":"riassunto breve","azioni":[ ...una o più azioni... ],"avvisi":[ ...opzionale, vedi sotto... ],"domande":[ ...opzionale, vedi sotto... ],"altreAzioniRestanti":true} — "altreAzioniRestanti" è booleano e opzionale (default false): vedi sopra. "azioni" può essere vuoto/omesso se la risposta è fatta SOLO di "avvisi" e/o "domande".
"avvisi" (array opzionale) — TUTTI gli avvisi che le regole di questo prompt ti dicono di produrre vanno QUI, MAI come testo nella "spiegazione". Ogni elemento è {"livello":"rosso"|"info","testo":"..."}: "rosso" = un problema che il coordinatore DEVE vedere (era il "🔴 ATTENZIONE"), "info" = una nota non bloccante (era la "ℹ️"). Nel "testo" scrivi SOLO il messaggio, in italiano completo, SENZA emoji e SENZA la parola "ATTENZIONE" davanti — l'icona (🔴/ℹ️) e lo stile li disegna l'app dal "livello". ⚠️ REGOLA GLOBALE DI REINDIRIZZAMENTO (vale su TUTTO il prompt, in OGNI sezione, presente o futura): ovunque una regola dica «segnala con "🔴 ATTENZIONE: X"», «aggiungi nella spiegazione "🔴 ATTENZIONE: X"», «genera l'avviso "🔴 ATTENZIONE: X"», «segnalare ATTENZIONE» oppure «nota testuale ℹ️ (X)», tu NON scrivi nulla nella spiegazione: emetti invece un elemento in "avvisi" = {"livello":"rosso" (o "info" per la ℹ️), "testo":"X"}, con lo STESSO identico X indicato dalla regola, tolti solo l'emoji e "ATTENZIONE:". Un avviso senza azioni è del tutto normale: "azioni":[] (o omesso) + "avvisi" popolato. La "spiegazione" resta SEMPRE e SOLO il riassunto neutro delle azioni emesse — non contiene MAI un avviso.
"domande" (array opzionale) — SOLO per ambiguità con una scelta binaria chiara, dove sia il Sì che il No corrispondono a un'azione concreta e ben definita da applicare (es. attivare o no un turno MMG mancante, aggiungere o no il diurno quando un weekend non è stato specificato, piantare o no il pin 📌/⚓ richiesto da un medico): {"giorno":11,"medico":"PITAU","citazione":"vorrei fare la mattina MMG l'11","domanda":"la mattina non è attiva, solo il pomeriggio — vuoi attivare anche la mattina?","seSi":[ ...azioni da applicare se l'utente risponde Sì... ],"seNo":[ ...azioni da applicare se risponde No... ]}. "citazione" è OBBLIGATORIA: riporta tra virgolette la frase ESATTA scritta dal medico nel testo incollato (non un riassunto), così il coordinatore vede subito il contesto originale senza doverlo ricordare a memoria. In "citazione" e "domanda" scrivi SEMPRE in italiano completo, MAI abbreviazioni o codici interni (niente "g11", "g8N", "MA", "SP": scrivi "giorno 11", "agosto", "notturno", "Maniago", "Spilimbergo"). L'utente vede ogni domanda come una card con due pulsanti Sì/No: NON scrivere questi casi come testo "🔴 ATTENZIONE" nella spiegazione, usa SEMPRE "domande" quando la scelta è binaria e concreta. Per le ambiguità SENZA un'azione concreta definibile per entrambe le risposte (sede non identificabile, date vaghe, condizionali, contraddizioni — vedi CASI DA SEGNALARE AL COORDINATORE) continua a usare il testo "🔴 ATTENZIONE" nella spiegazione: lì non c'è nulla di binario da proporre, serve solo un avviso. Anche la richiesta di un DATO MANCANTE che non è una scelta a due vie (quale giorno, quale numero, quale sede) NON è una domanda Sì/No: chiedila come testo nella "spiegazione" (o tipo "risposta" se non c'è altro da fare), mai con seSi/seNo.
⚠️ FORMULAZIONE DELLA "domanda" — deve essere letteralmente rispondibile con SÌ o NO: il testo del campo "domanda" va scritto in modo che "Sì" attivi seSi e "No" attivi seNo. È VIETATO formularla come un aut-aut tra due alternative ("vuoi X, oppure Y?", "preferisci A o B?", "lo faccio così o cosà?"): quel formato NON è binario (a "Sì"/"No" non corrisponde una scelta chiara) e confonde il coordinatore. Se ti accorgi che la scelta reale è tra due alternative diverse da Sì/No, NON usare una domanda: o scegli la lettura di default e procedi, o chiedi come testo nella "spiegazione". In particolare: NON inventare domande "opzionali" che offrono un'azione che il medico non ha chiesto (es. proporre una preferenza di turno quando il medico non ne ha espressa alcuna): se un'azione non è richiesta né chiaramente implicata, semplicemente non emetterla e non chiederla.
⚠️ REGOLA GENERALE — NIENTE TESTO DUPLICATO: ogni avviso 🔴 e ogni "domanda" ❓ deve comparire UNA sola volta, mai ripetuto. Quando poni una "domanda", la "spiegazione" dev'essere un riassunto BREVISSIMO e neutro (es. "Una richiesta da confermare", "Turno MMG da attivare") e NON deve ripetere il testo della domanda né dell'avviso: il testo per esteso vive SOLO nei campi della domanda ("citazione" = la frase del medico, "domanda" = la richiesta). Non mettere MAI la stessa frase in due campi (es. "citazione" identica a "domanda", o l'avviso copiato sia in "spiegazione" sia nella "domanda"). Per un avviso 🔴 senza azioni, mettilo una sola volta in "avvisi" (livello rosso), mai nella "spiegazione".
⚠️ REGOLA GENERALE — LA "spiegazione" RISPECCHIA LE AZIONI EMESSE, NON L'INTENZIONE DEL MEDICO: il riassunto in testa alla proposta deve descrivere ciò che hai EFFETTIVAMENTE fatto (le azioni emesse + eventuali avvisi 🔴), mai ciò che il medico ha chiesto se non l'hai tradotto in un'azione. Il coordinatore spesso legge solo il titolo: non deve trarne conclusioni sbagliate. Esempio dell'errore da evitare: il medico dice "il giorno X non posso perché ho un impegno di giorno" su un feriale (che ha solo il notturno) → tu NON emetti alcun dispo_no (il diurno non esiste) e metti solo un 🔴 informativo; il riassunto NON deve dire "NO il X" o "escluso il X" (chi legge il titolo crederebbe che il X sia stato tolto), ma riflettere il vero esito ("segnalato il X, nessuna esclusione applicata"). In generale: se per un punto non è stata emessa alcuna azione, il riassunto lo presenta come SEGNALAZIONE, non come modifica applicata; se un'azione è stata emessa, la nomina per quello che è (inserito / rimosso / pin / tetto…). Coerenza titolo ↔ azioni sempre.
⚠️ REGOLA GENERALE — AMBITO DI "seSi"/"seNo": le azioni in "seSi" e "seNo" di una domanda devono riguardare ESCLUSIVAMENTE il giorno e il medico di QUELLA specifica domanda, mai nient'altro. Rispondere Sì o No a una domanda non deve MAI avere l'effetto di inserire disponibilità per altri giorni, anche se quei giorni compaiono altrove nella stessa email originale, anche se sembrano casi analoghi o dello stesso tipo di ambiguità. Ogni domanda è un'unità indipendente e isolata: la risposta a una domanda specifica non estende, conferma o anticipa nulla su nessun'altra domanda o giorno non esplicitamente menzionato in quella singola domanda.
Ogni azione ha un campo "az" che ne indica il tipo:
- {"az":"schema","giorno":14,"turno":"N","sede":"Maniago","medico":"TRIGODKO"} → cambia un'assegnazione nello schema (medico null = svuota la sede)
- {"az":"dispo_aggiungi","medico":"BEKAEVA","giorno":5,"turno":"N","sedi":["Maniago","Spilimbergo"],"sedi_liv":{"Maniago":1,"Spilimbergo":1},"blu":["Meduno","Claut"],"blu_liv":{"Meduno":1,"Claut":2}} → imposta la disponibilità: "sedi"=sedi FISICHE (verdi), "sedi_liv"=livello 1..5 per ciascuna (livelli PARI = sedi indifferenti per il medico, il motore può spostarlo tra esse; livello più basso = sede che ha diritto di tenere; omesso=1), "blu"=sedi disposto a coprire A DISTANZA, "blu_liv"=livello 1..4 per ciascuna sede blu (1=prima scelta, 4=ultima, omesso=1; nessuna copertura a distanza è automatica, va sempre dichiarata). Se il medico dice "Maniago o Spilimbergo indifferentemente" usa livelli pari sulle sedi verdi; se dice "preferibilmente Maniago, altrimenti Spilimbergo" (entrambe accettate fisicamente) usa Maniago:1, Spilimbergo:2. Se dice "posso coprire Claut a distanza" aggiungila in "blu", non in "sedi".
- {"az":"dispo_set","medico":"BEKAEVA","ambito":"feriali","turni":["N"],"escludi":[12,13],"sedi":["Maniago"],"sedi_liv":{"Maniago":1},"blu":["Claut"],"blu_liv":{"Claut":1}} → imposta in UN COLPO SOLO la STESSA disponibilità (stessi campi "sedi"/"sedi_liv"/"blu"/"blu_liv" di dispo_aggiungi) su un INTERO INSIEME di giorni, lasciando al MOTORE il calcolo deterministico dei singoli giorni (così non se ne salta mai uno). "ambito": "feriali" (tutti i feriali semplici lun-ven non festivi/prefestivi — hanno solo N), "weekend" (tutti i sabati/domeniche), "mese" (tutti i giorni del mese), {"da":X,"a":Y} (i giorni da X a Y inclusi), oppure {"giorni_settimana":["lun","mer"]} / {"giorni_settimana":{"da":"mar","a":"gio"}} (i giorni della settimana nominati — token lun/mar/mer/gio/ven/sab/dom — con il motore che calcola le date esatte). "turni": sottoinsieme di ["G","N"] (MAI MMG; per ogni giorno il motore tiene solo i turni che ESISTONO davvero quel giorno). "escludi": array opzionale di numeri-giorno da NON toccare (i giorni con NO/ferie/"tranne"). Usa dispo_set SOLO quando l'insieme di giorni E il/i turno/i sono ENTRAMBI chiari; per un elenco di date sparse ("il 3, il 7 e il 12") usa invece più dispo_aggiungi. Le regole di precedenza (senza-incarico senza numero, weekend ambiguo senza turno, "quasi sempre", titolare fuori-sede, MMG) valgono PRIMA e, se scattano, sostituiscono dispo_set — vedi la sezione INSIEMI DI GIORNI
- {"az":"dispo_no","medico":"CERVESATO","giorno":4,"turno":"N"} → segna il medico come esplicitamente NON disponibile per quel turno
- {"az":"dispo_togli","medico":"TRIGODKO","giorno":12,"turno":"N"} → rimuove la disponibilità di UN singolo slot
- {"az":"azzera_medico","medico":"IENGO"} → CANCELLA IN BLOCCO tutte le disponibilità del mese di quel medico (tutti gli slot + tetti settimanali + finestre settimanali + slot obbligatori + preferenze turno + tetto mensile), lasciando intatti recupero ore e turni extra volontari. Usalo quando il coordinatore vuole "rifare/correggere da capo" un medico (es. "azzera X e reinserisci", "cancella tutto per X e metti solo…", "ricomincia da zero con X"): metti questa azione INSIEME alle azioni di reinserimento nello stesso elenco "azioni" (dispo_set/dispo_aggiungi/tetto_mese/…). L'app applica SEMPRE l'azzeramento PRIMA dei reinserimenti, qualunque sia l'ordine, quindi non restano residui dei giorni vecchi. NON serve elencare tanti dispo_togli: uno solo azzera_medico basta e non dimentica nulla. Esempio "rifai Iengo da capo, solo notti da mar a gio a Spilimbergo, max 8": azioni = [{"az":"azzera_medico","medico":"IENGO"},{"az":"dispo_set","medico":"IENGO","ambito":{"giorni_settimana":{"da":"mar","a":"gio"}},"turni":["N"],"sedi":["Spilimbergo"]},{"az":"tetto_mese","medico":"IENGO","maxTurni":8}]
- {"az":"mmg","giorno":15,"fascia":"M","attivo":true} → attiva/disattiva un turno MMG (fascia: M=mattina 8-14, P=pomeriggio 14-20). L'azione attiva SOLTANTO l'esistenza del turno quel giorno: la SEDE e l'eventuale copertura a distanza le assegna il motore in base alle disponibilità dei medici (verde/blu nella dispo), esattamente come per un turno ordinario — non passare campi "sede" o "blu". Con "attivo":false disattivi il turno
- {"az":"ore_extra","medico":"MARTINETTI","ore":24} → imposta le ore da recuperare del mese (0 per azzerare; solo medici con contratto)
- {"az":"turni_extra","medico":"MARTINETTI","turni":2} → imposta il numero di turni extra volontari del mese (12h ciascuno, 0 per azzerare; solo medici con contratto); si consumano SOLO dopo aver esaurito monte ore + ore da recuperare, con priorità da senza incarico (solo graduatoria)
- {"az":"tetto_settimana","medico":"TRIGODKO","giorno":5,"maxTurni":1} → imposta il tetto massimo di turni per la settimana (lun-dom) che contiene quel "giorno" (un numero qualunque della settimana desiderata va bene); maxTurni null o assente rimuove il tetto per quella settimana. Quando il tetto vale "a settimana" per TUTTO il mese, NON inventare i giorni: emetti una di queste azioni per OGNI voce del campo "settimane" dello STATO ATTUALE, usando il suo "giornoRappresentativo" (copre tutte le settimane, inclusa quella a cavallo, senza doppioni né buchi — vedi SETTIMANE DEL MESE)
- {"az":"tetto_mese","medico":"ZURLO","maxTurni":8} → imposta il tetto massimo di turni per l'INTERO mese corrente (vale per QUALSIASI categoria, anche senza incarico): il motore si ferma su quel numero anche con debito residuo; maxTurni null o assente rimuove il tetto. Usalo SEMPRE quando un senza incarico dichiara un numero massimo di guardie/turni che può fare nel mese (es. "posso fare al massimo 8 turni questo mese") — è il vincolo reale nel motore, non solo un'indicazione testuale. ⚠️ MAI un tetto_mese "a vuoto": emetti questa azione SOLO con un numero POSITIVO concreto (maxTurni ≥ 1) realmente dichiarato dal medico o dal coordinatore. maxTurni null/assente NON è un'azione "nuova": serve ESCLUSIVAMENTE a RIMUOVERE un tetto già esistente e SOLO su richiesta esplicita ("togli il tetto", "nessun limite", vedi RIFIUTO ESPLICITO DI QUALSIASI TETTO). Se non hai un numero (es. un senza incarico che non lo ha indicato) NON emettere alcun tetto_mese: o inserisci-con-avviso o blocchi (regola SENZA INCARICO), mai un tetto_mese con maxTurni null/0/assente come se fosse un'impostazione — sarebbe un'azione che non fa nulla ("nessun limite" a vuoto)
- {"az":"turno_pref","medico":"TRIGODKO","giorno":15,"turno":"G"} → imposta la preferenza di turno stesso giorno: "turno"="G" (diurno) o "N" (notturno) è quello che il medico mantiene se li vince entrambi; turno null o assente rimuove la preferenza. Applicabile solo ai giorni con sia diurno che notturno (weekend/festivi/prefestivi). ⚠️ CONTROLLO A MONTE, PRIMA di emetterla: leggi il campo "calendario" nello STATO ATTUALE per quel giorno. Se il giorno è "solo notturno" (feriale semplice: ha SOLO il turno N, il diurno non esiste), NON emettere turno_pref — sarebbe un'azione INERTE (la preferenza serve solo a scegliere quale tenere QUANDO il medico vince ENTRAMBI i turni, cosa impossibile se il giorno ha un turno solo). Vale qualunque sia la formulazione del medico. CONDIZIONE IMPOSSIBILE: se il medico àncora la sua preferenza a un turno che quel giorno NON esiste (tipicamente "se ci fosse / se dovesse esserci anche il diurno preferirei…" su un feriale che il diurno non ce l'ha, o simmetricamente il notturno dove manca), NON assecondarla con un'azione a vuoto e NON inventare: segnala con "🔴 ATTENZIONE: [nome] ha espresso una preferenza di turno per il giorno [X] condizionata a un turno che quel giorno non esiste (è un feriale con solo il notturno) — preferenza non applicabile, nessuna azione emessa." Le altre azioni valide dello stesso messaggio (es. il pin 📌/⚓ sul notturno che esiste) si emettono comunque
- {"az":"turno_precedente","medico":"BERTUZZI","giorno":30,"turno":"N"} → registra un turno che il medico ha GIÀ SVOLTO a fine mese PRECEDENTE (luglio, nella settimana che è a cavallo con il mese in lavorazione). "giorno" = numero del giorno del mese precedente (es. 30 = 30 luglio). "turno": "N"=notturno, "G"=diurno; OMETTILO se il coordinatore non lo specifica (l'app registra il notturno sui feriali e, sui giorni che hanno sia diurno sia notturno, ti chiede da sola quale). "presente":false per TOGLIERE una registrazione già fatta ("BERTUZZI non ha fatto nulla il 30, toglilo"; con "turno" toglie solo quel turno, senza "turno" azzera l'intero giorno). NON calcolare tu se il giorno è valido, se è nella settimana a cavallo o se ha il diurno: ci pensa l'app (ti avvisa se qualcosa non torna). Se manca il GIORNO, non indovinare e NON usare una domanda Sì/No (la risposta è un giorno, non un sì/no): chiedilo come TESTO nella "spiegazione" (es. "Dimmi quale giorno di luglio ha fatto il turno"). Se nel messaggio ci sono anche altre azioni applicabili (es. i tetti settimanali), applicale comunque e aggiungi lì la richiesta del giorno; se non c'è nient'altro da fare, usa tipo "risposta". Vedi la regola PASSATO vs FUTURO più sotto: questa azione la usa SOLO il coordinatore in chat, MAI a partire da una mail di disponibilità
- {"az":"slot_obbligatorio","medico":"BERTUZZI","giorno":15,"turno":"N"} → ⚠️ CANALE (leggilo PRIMA dei trigger qui sotto): un slot_obbligatorio richiesto da un MEDICO va SEMPRE in "domande.seSi" (proposta con conferma), MAI in "azioni"; va in "azioni" SOLO se è il COORDINATORE a comandarlo esplicitamente in chat — l'email di un medico → SEMPRE "domande". Detta la funzione: segna quel turno come SLOT OBBLIGATORIO: un turno che il medico vuole tenere ASSOLUTAMENTE se lo vince per gerarchia. Diventa un punto fisso della distribuzione mensile (la spaziatura costruisce gli altri turni ATTORNO ad esso) e consuma un posto del suo tetto. NON crea disponibilità (va dichiarata a parte con dispo_*): se il medico non è disponibile o non vince quel turno, viene ignorato. Campo opzionale "sede":"Spilimbergo" → pin SEDE: lo slot è obbligatorio SOLO se il medico ottiene quella sede specifica (altrimenti ignorato); senza "sede" è un pin libero (qualsiasi sede vinta va bene). Frasi trigger sede (⚓): "il 15 lo voglio ma solo a Spilimbergo", "voglio il 15 notturno ma solo se sono a Spilimbergo", "il 22 solo a Maniago", "tengo il sabato se mi date Maniago". Frasi trigger pin libero (📌): "voglio assolutamente il 15 notturno", "il ferragosto lo faccio di sicuro", "quel sabato mattina lo tengo", "il 22 di notte non me lo togliete", "il 22 sera non lo cedo". 🚦 ATTENZIONE alle frasi NEGATIVE di tipo "TIENI-lo" ("non me lo toccate / togliete / levate", "non lo cedo", "non si tocca", "è mio", "lasciatemelo") — significano che il medico VUOLE tenere quel giorno: sono PIN 📌, MAI un'indisponibilità dispo_no. Vedi il DISCRIMINATORE "TIENI-lo vs TOGLI-me" all'inizio della sezione INDISPONIBILITÀ — NO ESPLICITO, che ha la precedenza. ⚠️ PIN LIBERO 📌 vs PIN SEDE ⚓ — quando usare ⚓: emetti ⚓ (slot_obbligatorio con "sede") SOLO quando il medico restringe il PIN a un SOTTOINSIEME PROPRIO delle sedi che ha dichiarato disponibili quel giorno — cioè, tra le sedi su cui È disponibile, ne indica ALCUNE (non tutte) come condizione per tenere quel turno. Esempio: disponibile a Spilimbergo E Meduno, "il 19 lo tengo solo se sono a Spilimbergo" → ⚓ Spilimbergo (Meduno resta disponibile ma è escluso dal pin). In TUTTI gli altri casi usa il pin libero 📌 (senza "sede"), ANCHE se il medico ha dichiarato meno di 5 sedi o non è disponibile ovunque: escludere una sede dalla DISPONIBILITÀ è già sufficiente, perché il pin libero non può mai scattare su una sede non dichiarata — quindi mettere ⚓ su TUTTE le sedi dichiarate è funzionalmente identico a 📌 (ridondante, non farlo). Esempio: disponibile solo a Spilimbergo/Meduno/Claut/Anduins (NON Maniago) che dice "il 23 non lo cedo" senza vincolare la sede del pin → UN pin libero 📌 su 23N (NON quattro ⚓). Rimozione ("presente":false): "togli il pin dal 15", "non vincolare più il 22", "il 15 non è più obbligatorio". Applicabile solo a un turno che esiste quel giorno (N sempre, G solo weekend/festivi/prefestivi). NB (vedi CANALE in testa a questa definizione): il pin FORTE, SPECIFICO e VINCOLANTE di un medico su un singolo giorno+turno (non una disponibilità generica) va PROPOSTO via "domande" (seSi = lo slot_obbligatorio), MAI applicato d'ufficio in "azioni". ⚠️ SOLO SE È DAVVERO VINCOLANTE: la domanda di pin va proposta solo quando il medico vuole realmente TENERE quel giorno ("lo voglio", "ci tengo", "non lo cedo", "è fisso per me", "non me lo togliete"). Se invece il desiderio è MORBIDO e dichiarato non obbligatorio ("se possibile", "mi piacerebbe ma non è indispensabile", "vedete voi", "come vi torna", "fa niente") → NON proporre alcun pin e NON generare la domanda Sì/No (il "Sì" pianterebbe un vincolo rigido che il medico ha esplicitamente rifiutato): vedi PREFERENZE MORBIDE NON VINCOLANTI nella sezione CASI DA SEGNALARE. ⚠️ NON ESISTE UNA VIA DI MEZZO: su un giorno le uniche opzioni sono un pin 📌/⚓ (vincolo reale nel motore) OPPURE nessuna azione (al massimo una nota testuale). NON inventare né proporre categorie intermedie tipo "slot preferito", "slot preferenziale", "giorno preferito", "soft-pin": il motore NON conosce nulla del genere, l'unico meccanismo di preferenza-di-turno esistente è turno_pref (scelta diurno/notturno §3.9), che è un'altra cosa e NON è un pin.
- NOTA — COMBINARE pin 📌 (slot_obbligatorio) e turno_pref, quando il medico "ci tiene a un GIORNO":
  ⚠️ REGOLA CHE PRECEDE TUTTI I CASI SOTTO — IL PIN VA SOLO SUI TURNI CON DISPONIBILITÀ DICHIARATA: un pin (📌 o ⚓) va emesso SOLO sui turni per cui il medico ha dichiarato disponibilità quel giorno. Il fatto che il giorno ABBIA un turno (es. un superfestivo ha sia G sia N) NON basta: se il medico ha dichiarato solo i notturni, il pin va SOLO sul notturno, anche se il giorno ha pure il diurno (mettere il pin sul diurno lo pianterebbe su uno slot dove non ha disponibilità: inerte e sporca i dati). Regola operativa: pinna l'intersezione tra {i turni che esistono quel giorno} e {i turni che il medico ha dichiarato disponibili}. Distinzione: il pin va su ENTRAMBI G e N SOLO se il medico ha dichiarato disponibilità su ENTRAMBI (es. "notti E diurni del weekend" + "giorno o notte è uguale"); se ha dichiarato un turno solo, il pin va solo su quello.
  • SOLO pin 📌 (senza turno_pref): il medico ci tiene a quel giorno ma è INDIFFERENTE tra diurno e notturno → emetti UN pin 📌 (slot_obbligatorio, "presente":true) sui turni del giorno per cui HA DICHIARATO DISPONIBILITÀ (se ha dichiarato sia G sia N e il giorno li ha entrambi → entrambi; se ha dichiarato solo il notturno → solo N, anche su un giorno G+N). NESSUN turno_pref. Frasi trigger: "ci tengo al 23", "il 23 è importante per me", "voglio assolutamente il 23", "il 23 non me lo toccate", "il 23 lo faccio di sicuro", "quel giorno lì ci tengo", "il 23 è fisso per me", "riservatemi il 23".
  • pin 📌 + turno_pref: il medico ci tiene a quel giorno E preferisce uno specifico turno → emetti il pin 📌 sui turni dichiarati disponibili (G e/o N secondo la regola sopra) + un turno_pref sul turno preferito. Se poi vince entrambi i turni, §3.9 cede il non preferito. (Se ha dichiarato un turno solo, non c'è nulla da preferire: pin sul solo turno, niente turno_pref.) Frasi trigger: "ci tengo al 23 ma preferirei il diurno", "il 23 lo voglio, meglio la mattina", "il 23 è fisso, se possibile il giorno", "il 23 ci tengo, preferirei la notte", "voglio il 23, ma se posso scelgo il notturno", "il 23 è importante, diurno se c'è", "quel giorno lo voglio fare, magari di giorno".
  • pin ⚓ (ci tiene MA solo se è in quella sede): il medico ci tiene a quel giorno SOLO se ottiene una sede specifica → emetti il pin ⚓ (slot_obbligatorio con "sede":"<sede>") sui turni dichiarati disponibili (G e/o N secondo la regola sopra). Se non ottiene quella sede il pin viene ignorato. Frasi trigger: "ci tengo al 23 ma solo se sono a Spilimbergo", "il 23 lo farei volentieri ma solo a Maniago", "il 23 è importante per me, però solo se mi date Spilimbergo", "quel giorno lo voglio ma solo nella mia sede", "il 23 lo tengo solo se sono a Maniago".
  • pin ⚓ + turno_pref: ci tiene a quel giorno SOLO su una sede E preferisce un turno → emetti il pin ⚓ (con "sede") + un turno_pref sul turno preferito. Frasi trigger: "il 23 lo faccio solo a Spilimbergo, preferibilmente di giorno", "il 23 solo a Maniago, meglio il notturno".
  In tutti i casi, se è il MEDICO a chiederlo (non il coordinatore), proponi con conferma al coordinatore come per slot_obbligatorio.
- {"az":"finestra_settimanale","medico":"BERTUZZI","giorno":10,"minTurni":3} → VINCOLO DI FINESTRA SETTIMANALE: il medico vuole ALMENO minTurni turni nella settimana (lun-dom) che contiene quel "giorno" (un numero qualunque della settimana desiderata va bene — per identificare la settimana giusta e ricavarne il giorno usa il campo "settimane" dello STATO ATTUALE, vedi SETTIMANE DEL MESE, non calcolarla a mente). È un MINIMO, opposto di tetto_settimana (che è un massimo): il coordinatore dà solo il numero, il MOTORE sceglie autonomamente QUALI turni tenere tra quelli che il medico vince per gerarchia in quella settimana, li àncora e distribuisce il resto del mese attorno. Consuma posti del tetto mensile (che resta rigido). Se il medico ne vince MENO di minTurni in quella settimana, il motore tiene tutti quelli vinti e genera un avviso. NON crea disponibilità (va dichiarata a parte con dispo_*). Frasi trigger: "voglio almeno 3 turni la settimana del 10", "nella settimana di Ferragosto voglio farne almeno 2", "quella settimana almeno due guardie". Rimozione ("presente":false, o minTurni 0): "togli il minimo dalla settimana del 10", "non serve più il minimo settimanale". NON confondere con slot_obbligatorio (che vincola UN turno preciso scelto dal coordinatore) né con tetto_settimana (massimo). Se è il MEDICO a chiederlo, proponilo con conferma al coordinatore come per slot_obbligatorio.
- {"az":"elabora"} → elabora/rielabora lo schema del mese con le regole ufficiali (mettila SEMPRE per ultima se richiesta)
Note: "turno": N=notturno, G=diurno, M=mattina MMG, P=pomeriggio MMG. "sede"/"sedi": Maniago | Spilimbergo | Meduno | Claut | Anduins. "medico": cognome ESATTO dall'elenco. Puoi combinare più azioni nella stessa proposta, verranno eseguite in ordine. Se la richiesta non è chiara usa "risposta".
Nello STATO ATTUALE sotto: "oreExtra"/"turniExtra"/"maxTurniMese" per medico sono i valori GIÀ dichiarati per il mese (0 se non impostati, null per maxTurniMese se nessun tetto) — controllali prima di sovrascriverli con una nuova azione ore_extra/turni_extra/tetto_mese; "oreAssegnate"/"oreMancanti" per medico sono null se lo schema non è ancora elaborato (oreMancanti è null anche per i medici senza incarico, che non hanno un monte ore); "preferenzeTurno" elenca le preferenze di turno stesso giorno già dichiarate (vedi sopra); "disponibilitaPresenti" elenca, per OGNI medico (anche con lista vuota se non ha ancora nulla), i giorni/turni per cui esiste già una disponibilità inserita (di qualsiasi tipo, incluso NO) — usalo SEMPRE per verificare con certezza cosa è già stato inserito e cosa manca rispetto a una richiesta o email incollata, invece di dedurlo dalla cronologia della chat; "slotObbligatoriPresenti" elenca, per i medici che ne hanno, i turni g{giorno}{N|G} già marcati come slot obbligatori (azione slot_obbligatorio) — non riproporli; "finestreSettimanali" elenca, per i medici che ne hanno, i minimi settimanali già dichiarati (azione finestra_settimanale, "settimana del {lunedì}: min N turni") — non riproporli; "azioniGiaEseguite" è un elenco (array di stringhe "MEDICO g{giorno}{turno}") delle azioni già confermate in QUESTA conversazione — svuotato solo con "Nuova conversazione" — da non riproporre mai (vedi sopra).`;
      // Voce B: lo STATO ATTUALE (volatile) è separato dal regolamento (statico) — quest'ultimo va nel campo
      // system cacheabile, lo stato resta nel turno user dopo il breakpoint. Il testo del regolamento è invariato.
      const statoBlocco = `STATO ATTUALE: ${JSON.stringify(stato)}`;
      // Timeout lato client: se la risposta è molto lunga, l'ambiente artifact può bloccare la
      // fetch senza mai risolverla né rifiutarla (nessun errore, nessuna risposta: silenzio totale
      // per l'utente). Interrompiamo noi stessi dopo 55s per garantire SEMPRE un feedback in chat.
      const abortCtrl = new AbortController();
      const timeoutId = setTimeout(() => abortCtrl.abort(), 55000);
      let resp;
      try {
        resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortCtrl.signal,
          body: JSON.stringify({
            model: (MODELLI_AI[aiModel] || MODELLI_AI.sonnet).modello, max_tokens: 16000,
            // Livello di ragionamento selezionato nel pannello. output_config.effort è la sintassi
            // corretta e identica per Sonnet 5 e Opus 4.8 (NON dentro thinking, NON top-level).
            // "high" è già il default del server, quindi inviarlo esplicitamente non cambia il comportamento.
            output_config: { effort: aiEffort },
            // Voce B: regolamento statico nel campo system con cache_control (è identico a ogni chiamata → cacheabile).
            system: [{ type: "text", text: sys, cache_control: { type: "ephemeral" } }],
            // Cronologia = aiMsgs (turni precedenti, mai troncata: il testo incollato deve restare nel contesto).
            // La domanda corrente NON è più duplicata come turno a sé: il turno finale porta lo STATO ATTUALE
            // volatile (fuori dal blocco cacheabile) + la richiesta, una sola volta.
            messages: [...aiMsgs.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: `${statoBlocco}\n\nRICHIESTA: ${domanda}` }],
          }),
        });
      } finally {
        clearTimeout(timeoutId);
      }
      const data = await resp.json();
      if (!resp.ok) {
        // API ha risposto con errore HTTP (es. 401, 529, ecc.): mostra il messaggio completo di Anthropic
        const errObj = data?.error;
        const dettaglio = errObj ? `${errObj.type || "errore"}: ${errObj.message || JSON.stringify(errObj)}` : JSON.stringify(data);
        const reqId = data?.request_id ? ` [request_id: ${data.request_id}]` : "";
        setAiMsgs((p) => [...p, { role: "assistant", content: `Errore API (HTTP ${resp.status}): ${dettaglio}${reqId}` }]);
        setAiBusy(false);
        return;
      }
      let testo = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n") || "";
      testo = testo.replace(/```json|```/g, "").trim();
      let obj = null;
      try { obj = JSON.parse(testo); } catch (e) { obj = null; }
      if (!obj) {
        // Il modello potrebbe aver anteposto del testo introduttivo al JSON (es. un "ragionamento"
        // scritto per errore, in violazione di "RISPONDI SOLO con JSON"): estraiJsonBilanciato
        // ignora correttamente eventuali graffe presenti nel preambolo stesso (es. notazione
        // matematica tipo "h = (...) mod 7"), a differenza di un semplice "prima { ultima }" che
        // si romperebbe proprio in quel caso.
        obj = estraiJsonBilanciato(testo);
      }
      const eTroncato = data.stop_reason === "max_tokens";
      if (eTroncato && !obj) {
        // Risposta tagliata prima di completare il JSON: nessuna azione è stata applicata.
        // Offriamo comunque un modo per proseguire, ripetendo la richiesta originale più in breve.
        setTroncato(true);
        setAzioniRestanti(true);
        setAiMsgs((p) => [...p, { role: "assistant", content: "La risposta è stata troncata perché troppo lunga (limite di token raggiunto) — nessuna modifica è stata applicata. Premi \"Continua →\" per far ripetere la richiesta in modo più sintetico." }]);
        setAiBusy(false);
        return;
      }
      if (obj?.tipo === "vai_mese") {
        const mi = MESI_DISPONIBILI.findIndex((x) => MESI_IT[x.mese].toLowerCase() === String(obj.mese || "").toLowerCase() && x.anno === Number(obj.anno));
        if (mi >= 0) {
          setMeseIdx(mi);
          setAiMsgs((p) => [...p, { role: "assistant", content: `Ti ho portato su ${MESI_IT[MESI_DISPONIBILI[mi].mese]} ${MESI_DISPONIBILI[mi].anno}.` }]);
        } else {
          setAiMsgs((p) => [...p, { role: "assistant", content: "Mese non trovato (calendario: Agosto 2026 – Dicembre 2036)." }]);
        }
      } else if ((obj?.tipo === "modifiche" || obj?.tipo === "modifica" || obj?.tipo === "modifica_dispo") &&
        ((Array.isArray(obj.azioni) && obj.azioni.length) || (Array.isArray(obj.domande) && obj.domande.length) || (Array.isArray(obj.avvisi) && obj.avvisi.length))) {
        // retrocompatibilità con i vecchi formati
        const azioniRaw = Array.isArray(obj.azioni) ? obj.azioni : [];
        const azioni = azioniRaw.map((a) => {
          if (a.az) return a;
          if (obj.tipo === "modifica_dispo") return a.op === "togli" ? { az: "dispo_togli", ...a } : { az: "dispo_aggiungi", ...a };
          return { az: "schema", ...a };
        });
        const domandeNuove = Array.isArray(obj.domande) ? obj.domande.filter((d) => d && d.domanda) : [];
        // GUARD PIN (voce 81): un slot_obbligatorio è un vincolo RIGIDO — non va MAI applicato in silenzio col
        // "Conferma" del batch disponibilità. Ovunque compaia (nelle azioni per errore, o nelle domande.seSi dal
        // canale corretto) lo estraiamo e ne facciamo UNA card Sì/No distinta (riuso del flusso domande). Vale
        // anche per il pin del coordinatore: un vincolo rigido si vede e si sceglie sempre. Principio: il modello
        // propone, il codice garantisce che nulla di irreversibile venga applicato senza una scelta esplicita.
        const isPinPianta = (a) => a && a.az === "slot_obbligatorio" && a.presente !== false; // "presente:false" = rimozione → resta nel batch
        const azioniSenzaPin = azioni.filter((a) => !isPinPianta(a));
        // Dedup su medico+giorno+turno IGNORANDO la sede; se due versioni differiscono sulla sede tengo la più
        // specifica (con ⚓) e lo segnalo nella card.
        const pinMap = new Map();
        const addPin = (slot, citazione) => {
          if (!isPinPianta(slot)) return;
          const k = `${slot.medico}|${slot.giorno}|${slot.turno}`, prev = pinMap.get(k);
          if (!prev) { pinMap.set(k, { slot, citazione: citazione || null, sedeFlag: false }); return; }
          const prevSede = prev.slot.sede || null, newSede = slot.sede || null;
          if (prevSede !== newSede) {
            // discrepanza sulla sede tra due versioni dello stesso pin: tieni la più specifica (con ⚓) e segnala
            if (newSede && !prevSede) pinMap.set(k, { slot, citazione: prev.citazione || citazione || null, sedeFlag: true });
            else prev.sedeFlag = true; // prev ha la sede (o entrambe hanno sede diversa): tieni prev, segnala comunque
          } else if (!prev.citazione && citazione) {
            prev.citazione = citazione;
          }
        };
        // Domande del modello: separa quelle che propongono un pin (→ dedup) dalle altre (MMG, titolarità… → invariate)
        const altreDomande = [];
        for (const d of domandeNuove) {
          const pinsInSeSi = Array.isArray(d.seSi) ? d.seSi.filter(isPinPianta) : [];
          if (pinsInSeSi.length) pinsInSeSi.forEach((a) => addPin(a, d.citazione || d.situazione || null));
          else altreDomande.push(d);
        }
        azioni.filter(isPinPianta).forEach((a) => addPin(a, null)); // pin finiti (per errore) nelle azioni
        const pinDomande = [...pinMap.values()].map(({ slot, citazione, sedeFlag }) => ({
          medico: slot.medico, giorno: slot.giorno, _pinGuard: true,
          citazione: citazione || undefined,
          situazione: citazione ? undefined : "vincolo rigido (pin) da approvare esplicitamente",
          domanda: `Piantare il pin sul giorno ${slot.giorno} ${slot.turno === "G" ? "diurno" : "notturno"}${slot.sede ? ` (⚓ solo se ottiene ${SEDI_BREVI[slot.sede] || slot.sede})` : ""}? È un vincolo RIGIDO: la distribuzione lo terrà fisso.${sedeFlag ? " ⚠️ due versioni del pin differivano sulla sede: tengo la più specifica (⚓)." : ""}`,
          seSi: [slot], seNo: [],
        }));
        // GUARD FUORI-SEDE (voce 86): §3.1a — un dispo_* di un TITOLARE le cui sedi VERDI sono TUTTE ≠ dalla
        // sua titolarità non va applicato in silenzio col "Conferma": va confermato con una card Sì/No (stesso
        // danno del pin — approvo una disponibilità normale e sposto un medico fuori titolarità senza sceglierlo).
        const sedeTitolare = (nome) => { const mid = nomeToId(nome); return (mid !== undefined && mid !== null && byId[mid]) ? (byId[mid].sedeContratto || null) : null; };
        const isFuoriSede = (a) => {
          if (!a || (a.az !== "dispo_set" && a.az !== "dispo_aggiungi")) return false;
          const tit = sedeTitolare(a.medico);
          if (!tit) return false; // senza incarico o medico ignoto: non è il caso §3.1a
          const verdi = Array.isArray(a.sedi) ? a.sedi : [];
          return verdi.length > 0 && !verdi.includes(tit); // tutte le sedi verdi diverse dalla titolarità
        };
        const azioniFuoriSede = azioniSenzaPin.filter(isFuoriSede);
        const azioniFinali = azioniSenzaPin.filter((a) => !isFuoriSede(a));
        // Dedup col modello: se una sua domanda propone GIÀ l'inserimento fuori-sede di quel medico, non doppiare.
        const fuoriSedeGiaChiesto = new Set();
        for (const dq of altreDomande) if (Array.isArray(dq.seSi)) dq.seSi.filter(isFuoriSede).forEach((a) => fuoriSedeGiaChiesto.add(a.medico));
        const fuoriSedeDomande = [];
        for (const a of azioniFuoriSede) {
          if (fuoriSedeGiaChiesto.has(a.medico)) continue; fuoriSedeGiaChiesto.add(a.medico);
          const tit = sedeTitolare(a.medico), sediLabel = (a.sedi || []).join(", "); // nomi pieni: più chiari del codice breve per una conferma di titolarità
          fuoriSedeDomande.push({
            medico: a.medico, giorno: a.giorno,
            situazione: `è titolare di ${tit} ma ha chiesto solo ${sediLabel}`,
            domanda: `inserisco la disponibilità fuori dalla sua titolarità (${sediLabel})?`,
            seSi: [a], seNo: [],
          });
        }
        const domandeTutte = [...altreDomande, ...pinDomande, ...fuoriSedeDomande];
        // Avvisi (voce A2): 🔴/ℹ️ come campo strutturato, non più prosa nella spiegazione. {livello:"rosso"|"info",testo}
        const avvisiNuovi = Array.isArray(obj.avvisi) ? obj.avvisi.filter((a) => a && a.testo).map((a) => ({ livello: a.livello === "info" ? "info" : "rosso", testo: String(a.testo) })) : [];
        // GUARD-DATE (voce 84): controllo DETERMINISTICO app-side delle date IMPOSSIBILI citate nel TESTO della
        // mail. Il motore rigetta già le date impossibili nelle azioni (giorno > giorniNelMese), ma il modello
        // può soft-notarle o rimapparle in silenzio (es. "31 settembre" → "31 agosto"): l'unico posto dove il
        // problema è visibile è il testo. Cerchiamo «<N> <mese>» con N oltre la fine di quel mese (fatto
        // verificabile, non giudizio a temp-1). Promemoria, non blocco. Solo IMPOSSIBILI (scope A): le date
        // valide di un altro mese NON si toccano (sarebbero falsi positivi — "a settembre ho le ferie" è contesto).
        const avvisiData = [];
        try {
          const re = /\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\b/gi;
          const testoMail = String(domanda || ""), visti = new Set();
          let mm;
          while ((mm = re.exec(testoMail)) !== null) {
            const gg = Number(mm[1]), nomeMese = mm[2].toLowerCase();
            const mi = MESI_IT.findIndex((x) => x.toLowerCase() === nomeMese);
            if (mi < 0) continue;
            const giorniDiQuelMese = new Date(anno, mi + 1, 0).getDate();
            if (gg >= 1 && gg <= giorniDiQuelMese) continue; // data valida → non è compito di questo guard
            const etichetta = `${gg} ${nomeMese}`;
            if (visti.has(etichetta)) continue; visti.add(etichetta);
            // Dedup col modello: se un suo avviso o la spiegazione cita già quella data, non duplico il 🔴.
            const giaCitata = avvisiNuovi.some((a) => a.testo.toLowerCase().includes(etichetta)) || String(obj.spiegazione || "").toLowerCase().includes(etichetta);
            if (!giaCitata) avvisiData.push({ livello: "rosso", testo: `«${etichetta}» non è una data valida (${nomeMese} ${anno} ha ${giorniDiQuelMese} giorni): nessuna disponibilità presa per quel giorno, verifica con il medico quale data intendesse.` });
          }
        } catch (e) { /* il guard-date non deve mai rompere il flusso della risposta */ }
        const avvisiFinali = [...avvisiNuovi, ...avvisiData];
        if (azioniFinali.length) setProposta({ azioni: azioniFinali, spiegazione: obj.spiegazione || "Modifica proposta" });
        if (domandeTutte.length) setDomande((prev) => [...prev, ...domandeTutte]); // accumula: non perde domande di round precedenti non ancora risposte
        setAvvisi(avvisiFinali);
        setAzioniRestanti(!!obj.altreAzioniRestanti || eTroncato); // eTroncato = rete di sicurezza se il modello non ha impostato il campo
        let msg = obj.spiegazione || (azioniFinali.length ? "Modifica proposta" : avvisiFinali.length && !domandeTutte.length ? "Ho una segnalazione per te" : "Ho una domanda per te");
        if (azioniFinali.length) msg += " — conferma o annulla qui sotto.";
        if (avvisiFinali.length) msg += ` (${avvisiFinali.length} ${avvisiFinali.length > 1 ? "avvisi" : "avviso"} da leggere qui sotto)`;
        if (domandeTutte.length) msg += ` (${domandeTutte.length} ${domandeTutte.length > 1 ? "domande" : "domanda"} da rispondere qui sotto)`;
        setAiMsgs((p) => [...p, { role: "assistant", content: azioniFinali.length ? `PROPOSTA: ${msg}` : msg }]);
      } else if (obj?.tipo === "risposta") {
        setAiMsgs((p) => [...p, { role: "assistant", content: obj.testo }]);
      } else if (obj?.tipo === "stato_medico") {
        // Verifica read-only dello stato REALE di un medico: il testo lo costruisce l'app dai dati veri
        // (statoRealeMedico), MAI l'AI — così non può "raccontare" uno stato diverso da quello effettivo.
        const mid = nomeToId(obj.medico);
        if (mid === undefined || mid === null) setAiMsgs((p) => [...p, { role: "assistant", content: erroreMedico(obj.medico) }]);
        else {
          const st = statoRealeMedico(mid, dati.dispo, dati.maxTurniMese);
          setAiMsgs((p) => [...p, { role: "assistant", content: formattaStatoReale(byId[mid].nome, st, mese, anno) }]);
        }
      } else if (obj) {
        // JSON valido ma di struttura non riconosciuta (es. "modifiche" con azioni vuote/mancanti):
        // NON mostrare mai il JSON grezzo in chat. Recupera un testo leggibile se presente, altrimenti
        // un messaggio generico.
        setAiMsgs((p) => [...p, { role: "assistant", content: obj.spiegazione || obj.testo || "Non ho capito bene la richiesta, puoi riformulare?" }]);
      } else {
        // Nemmeno estraiJsonBilanciato è riuscita: se il testo contiene comunque una graffa "{" in
        // QUALUNQUE punto (non solo se l'intero testo INIZIA con una, come prima) è quasi certamente
        // JSON grezzo o un misto testo+JSON (es. un preambolo di "ragionamento" seguito dal JSON vero
        // ma malformato) — non va mai mostrato così com'è, in nessun caso.
        const contieneJson = testo.includes("{");
        setAiMsgs((p) => [...p, { role: "assistant", content: contieneJson ? "Non sono riuscito a interpretare la risposta, riprova." : (testo || "Nessuna risposta.") }]);
      }
    } catch (e) {
      if (e?.name === "AbortError") {
        // Richiesta interrotta dal nostro timeout: la risposta stava impiegando troppo (probabilmente
        // troppo lunga). Stesso trattamento del troncamento per JSON incompleto: nessuna azione
        // applicata, offriamo di ripetere la richiesta originale in modo più sintetico.
        setTroncato(true);
        setAzioniRestanti(true);
        setAiMsgs((p) => [...p, { role: "assistant", content: "La richiesta ha impiegato troppo tempo (oltre 55s) ed è stata interrotta — probabilmente la risposta era troppo lunga. Nessuna modifica è stata applicata. Premi \"Continua →\" per far ripetere la richiesta in modo più sintetico." }]);
      } else {
        setAiMsgs((p) => [...p, { role: "assistant", content: `Errore: ${e?.message || String(e)}. Verifica di star usando l'app all'interno di claude.ai come artifact attivo (non come file scaricato).` }]);
      }
    }
    setAiBusy(false);
  };

  // Abbina il nome scritto (dall'AI o dall'utente) a un medico. La corrispondenza ESATTA vince sempre
  // ed è sempre univoca. Come fallback si accetta un match per prefisso (in una delle due direzioni)
  // SOLO se identifica un unico medico: se il prefisso corrisponde a PIÙ medici (ambiguo, es. un
  // cognome che è l'inizio di un altro) NON si indovina — meglio segnalare che agganciare a caso.
  const mediciCheMatchano = (nome) => {
    if (!nome) return [];
    const n = String(nome).trim().toUpperCase();
    const esatto = MEDICI.find((x) => x.nome === n);
    if (esatto) return [esatto]; // corrispondenza esatta: univoca, batte qualsiasi prefisso
    return MEDICI.filter((x) => x.nome.startsWith(n) || n.startsWith(x.nome));
  };
  const nomeToId = (nome) => {
    if (!nome) return null;
    const cand = mediciCheMatchano(nome);
    return cand.length === 1 ? cand[0].id : undefined; // 0 = non trovato, >1 = ambiguo → non indovinare
  };
  // Messaggio di errore appropriato quando nomeToId non restituisce un id univoco: distingue
  // "ambiguo" (prefisso di più cognomi) da "non trovato", così il coordinatore sa cosa correggere.
  const erroreMedico = (nome) => {
    const cand = mediciCheMatchano(nome);
    if (cand.length > 1) return `nome "${nome}" ambiguo: corrisponde a ${cand.map((x) => x.nome).join(", ")} — specifica il cognome completo`;
    return `medico ${nome} non trovato`;
  };

  // Descrizione leggibile di un ambito dispo_set (per messaggi d'errore, anteprima proposta e riepilogo).
  const etichettaAmbito = (ambito) => {
    if (ambito === "feriali") return "feriali";
    if (ambito === "weekend") return "weekend";
    if (ambito === "mese") return "tutto il mese";
    if (ambito && typeof ambito === "object" && ambito.giorni_settimana != null) {
      const gs = ambito.giorni_settimana;
      if (Array.isArray(gs)) return gs.join(", ");
      if (gs && gs.da != null && gs.a != null) return `da ${gs.da} a ${gs.a}`;
      return "giorni della settimana";
    }
    if (ambito && typeof ambito === "object" && ambito.da != null && ambito.a != null) return `dal ${Math.min(Number(ambito.da), Number(ambito.a))} al ${Math.max(Number(ambito.da), Number(ambito.a))}`;
    return "ambito non valido";
  };

  // Formatta in testo leggibile lo stato reale restituito da statoRealeMedico (per la chat e il pannello Medici).
  const formattaStatoReale = (nome, st, mese, anno) => {
    const sd = (arr) => arr.map((x) => `${SEDI_BREVI[x.sede] || x.sede}${x.liv}`).join(",");
    const righeDispo = st.disponibilita.length
      ? st.disponibilita.map((x) => {
          if (x.no) return `  • g${x.giorno} ${x.turno}: NON disponibile`;
          const parti = [];
          if (x.verde.length) parti.push(sd(x.verde));
          if (x.blu.length) parti.push(`blu:${sd(x.blu)}`);
          return `  • g${x.giorno} ${x.turno}: ${parti.join(" | ")}`;
        }).join("\n")
      : "  (nessuna)";
    const tettoM = st.tettoMese != null ? `${st.tettoMese} turni` : "nessuno";
    const tettiS = st.tettiSettimanali.length ? st.tettiSettimanali.map((t) => `${t.settimana}: max ${t.max}`).join(" · ") : "nessuno";
    const finestreS = (st.finestreSettimanali || []).length ? st.finestreSettimanali.map((f) => `${f.settimana}: min ${f.min}`).join(" · ") : "nessuna";
    const pref = st.preferenzeTurno.length ? st.preferenzeTurno.map((p) => `g${p.giorno}→${p.turno === "G" ? "diurno" : "notturno"}`).join(" · ") : "nessuna";
    const obbl = (st.slotObbligatori || []).length ? st.slotObbligatori.map((o) => `g${o.giorno}${o.turno}${o.sede ? ` (⚓${SEDI_BREVI[o.sede] || o.sede})` : ""}`).join(" · ") : "nessuno";
    return `📋 Stato reale di ${nome} — ${MESI_IT[mese]} ${anno} (letto dai dati, non dall'AI)\n`
      + `Disponibilità (${st.disponibilita.length}):\n${righeDispo}\n`
      + `Tetto mensile: ${tettoM}\nTetti settimanali: ${tettiS}\nFinestre settimanali (min): ${finestreS}\nPreferenze turno: ${pref}\n📌 Slot obbligatori: ${obbl}`;
  };

  // TUTTE le settimane ISO (lun-dom) che contengono almeno un giorno del mese corrente — INCLUSE le
  // troncate ai bordi (la settimana del giorno 1 inizia nel mese precedente, quella dell'ultimo giorno
  // sfora nel successivo). settimanaDi(giorno) restituisce il lunedì della sua settimana, quindi la
  // distinta su tutti i giorni del mese copre esattamente quelle settimane, senza buchi ai bordi.
  const settimaneDelMese = () => {
    const nG = new Date(anno, mese + 1, 0).getDate();
    const set = new Set();
    for (let g = 1; g <= nG; g++) set.add(settimanaDi(dk(anno, mese, g)));
    return [...set];
  };
  // La settimana ISO a CAVALLO di due mesi: se il giorno 1 NON è lunedì, la sua settimana inizia nel mese
  // precedente. Ritorna il lunedì (chiave SETT:) di quella settimana, oppure null se il mese inizia di
  // lunedì (nessun cavallo). L'effetto dei turni di luglio riguarda SOLO questa settimana.
  const settimanaCavallo = () => {
    const day1 = dk(anno, mese, 1);
    const lun = settimanaDi(day1);
    return lun < day1 ? lun : null;
  };
  // I giorni del MESE PRECEDENTE che cadono nella settimana a cavallo (dal lunedì fino al giorno prima
  // dell'1 corrente): es. agosto 2026 → 27..31 luglio. Ogni giorno con dataStr, numero, mese breve, e se
  // aveva DAVVERO il diurno G (weekend/festivo/prefestivo, via turniDelGiorno) — così il check G non
  // compare sui feriali dove il diurno non esisteva. (Le date servono al PASSO 2, il conteggio al PASSO 1.)
  const giorniLuglioCavallo = () => {
    const lun = settimanaCavallo();
    if (!lun) return [];
    const day1 = dk(anno, mese, 1);
    const out = [];
    for (let d = new Date(lun + "T00:00:00"); dk(d.getFullYear(), d.getMonth(), d.getDate()) < day1; d.setDate(d.getDate() + 1)) {
      const info = turniDelGiorno(d.getFullYear(), d.getMonth(), d.getDate(), {});
      out.push({ dataStr: dk(d.getFullYear(), d.getMonth(), d.getDate()), giorno: d.getDate(), meseBreve: MESI_IT[d.getMonth()].slice(0, 3).toLowerCase(), haG: info.turni.some((t) => t.id === "G") });
    }
    return out;
  };
  // Totale turni (N+G) già fatti a luglio nella settimana a cavallo, letto da turniPrecedenti[mid].
  const countLuglio = (perMid) => Object.values(perMid || {}).reduce((s, d) => s + (d.N ? 1 : 0) + (d.G ? 1 : 0), 0);
  // Mappa passata al motore per la distribuzione §3.11 (PASSO 2): mid -> giorni-riferimento dei turni di
  // luglio in OFFSET non-positivo rispetto all'1 del mese (30 lug → −1, 31 lug → 0). Giorni DISTINTI
  // (N+G lo stesso giorno = un solo riferimento). Il motore la usa solo per allontanare da luglio i turni
  // in eccesso tenuti da chi supera un tetto; vuota → comportamento identico a prima.
  const riferimentiCavalloDi = () => {
    const tp = dati.turniPrecedenti || {};
    const daysPrev = new Date(anno, mese, 0).getDate(); // ultimo giorno del mese precedente
    const out = {};
    Object.keys(tp).forEach((mid) => {
      const giorni = new Set();
      Object.entries(tp[mid] || {}).forEach(([dataStr, v]) => { if (v && (v.N || v.G)) giorni.add(Number(dataStr.slice(8, 10)) - daysPrev); });
      if (giorni.size) out[mid] = [...giorni];
    });
    return out;
  };
  // Tetto DICHIARATO dal coordinatore per la settimana wk. Per la settimana a cavallo è il campo
  // "dichiarato" (SETT:cavallo = {maxTurni: effettivo, dichiarato}); per le altre coincide con maxTurni.
  // È il valore mostrato/editato in UI; il MOTORE legge sempre maxTurni (l'effettivo, già ridotto di luglio).
  const capDichiaratoDi = (mid, wk) => {
    const raw = dati.dispo[mid]?.["SETT:" + wk];
    if (!raw) return null;
    const v = raw.dichiarato != null ? raw.dichiarato : raw.maxTurni;
    return typeof v === "number" && v >= 0 ? v : null;
  };
  // Costruisce il valore della chiave SETT: per una settimana: sul cavallo {maxTurni: max(0,dich−luglio),
  // dichiarato}, altrove {maxTurni: dich}. UNICO punto che compone effettivo/dichiarato (V-A).
  const valoreSett = (mid, wk, dich) => {
    if (wk === settimanaCavallo()) return { maxTurni: Math.max(0, dich - countLuglio((dati.turniPrecedenti || {})[mid])), dichiarato: dich };
    return { maxTurni: dich };
  };
  // Valore da mostrare nel campo unico: il tetto DICHIARATO se UNIFORME su tutte le settimane, altrimenti "".
  const capSettimanaleUniforme = (mid) => {
    const vals = settimaneDelMese().map((wk) => capDichiaratoDi(mid, wk));
    return vals.length && vals.every((v) => v === vals[0]) && vals[0] != null ? vals[0] : "";
  };
  // Scrive il tetto in blocco su TUTTE le settimane (bordi inclusi): sul cavallo scrive dichiarato+effettivo.
  const setCapSettimana = (mid, valStr) => {
    const nd = { ...(dati.dispo[mid] || {}) };
    Object.keys(nd).forEach((k) => { if (k.startsWith("SETT:")) delete nd[k]; });
    if (valStr !== "") { const val = Math.max(0, Number(valStr) || 0); settimaneDelMese().forEach((wk) => { nd["SETT:" + wk] = valoreSett(mid, wk, val); }); }
    setDati({ dispo: { ...dati.dispo, [mid]: nd }, schema: null });
  };
  // Scrive/rimuove il tetto di UNA sola settimana (pannellino 📅). Sul cavallo il valore digitato è il
  // DICHIARATO → si ricompone effettivo/dichiarato; vuoto = rimuove.
  const setCapSettimanaDi = (mid, wk, valStr) => {
    const nd = { ...(dati.dispo[mid] || {}) };
    if (valStr === "") delete nd["SETT:" + wk];
    else nd["SETT:" + wk] = valoreSett(mid, wk, Math.max(0, Number(valStr) || 0));
    setDati({ dispo: { ...dati.dispo, [mid]: nd }, schema: null });
  };
  // FINESTRA SETTIMANALE (§10 voce 57): MINIMO di turni voluti in una settimana ISO (chiave SETTWK).
  // Solo per-settimana dal pannellino 📅 (nessun campo unico): il coordinatore dà il numero, il motore
  // sceglie i giorni. Editabile anche sulla settimana a cavallo (conta solo i turni in-mese di quella
  // settimana, nessuna sottrazione-luglio come per il tetto). Vuoto/0 = nessun vincolo.
  const minDichiaratoDi = (mid, wk) => { const n = (dati.dispo[mid] || {})["SETTWK:" + wk]; return typeof n === "number" && n > 0 ? n : null; };
  const setMinSettimanaDi = (mid, wk, valStr) => {
    const nd = { ...(dati.dispo[mid] || {}) };
    const val = Math.max(0, Number(valStr) || 0);
    if (valStr === "" || val === 0) delete nd["SETTWK:" + wk];
    else nd["SETTWK:" + wk] = val;
    setDati({ dispo: { ...dati.dispo, [mid]: nd }, schema: null });
  };
  // Marca/smarca un turno (N o G) già fatto a luglio in un giorno della settimana a cavallo, e RICALCOLA
  // il tetto effettivo del cavallo (dichiarato − nuovo totale luglio) senza perdere il dichiarato.
  const toggleTurnoPrec = (mid, dataStr, turno) => {
    const tp = { ...(dati.turniPrecedenti || {}) };
    const perMid = { ...(tp[mid] || {}) };
    const day = { ...(perMid[dataStr] || {}) };
    day[turno] = !day[turno];
    if (!day.N && !day.G) delete perMid[dataStr]; else perMid[dataStr] = day;
    tp[mid] = perMid;
    const lun = settimanaCavallo();
    const dich = lun ? capDichiaratoDi(mid, lun) : null; // dichiarato attuale (null = nessun tetto sul cavallo)
    const nd = { ...(dati.dispo[mid] || {}) };
    if (lun && dich != null) nd["SETT:" + lun] = { maxTurni: Math.max(0, dich - countLuglio(perMid)), dichiarato: dich };
    setDati({ turniPrecedenti: tp, dispo: { ...dati.dispo, [mid]: nd }, schema: null });
  };
  // I tetti DICHIARATI del medico sono "misti"? (almeno due settimane diverse, incluso null vs numero)
  const tettiSettMisti = (mid) => {
    const vals = settimaneDelMese().map((wk) => capDichiaratoDi(mid, wk));
    return vals.length > 0 && !vals.every((v) => v === vals[0]);
  };
  // Etichetta di una settimana ISO (dato il lunedì "YYYY-MM-DD"): intervallo lun→dom, es. "28 lug–3 ago".
  // haFestivo: true se un qualsiasi giorno lun..dom è festivo o prefestivo (per il pallino "Ferragosto & co.").
  const infoSettimana = (wk) => {
    const lun = new Date(wk + "T00:00:00");
    const dom = new Date(lun); dom.setDate(dom.getDate() + 6);
    const gg = (dt) => `${dt.getDate()} ${MESI_IT[dt.getMonth()].slice(0, 3).toLowerCase()}`;
    let haFestivo = false;
    for (let i = 0; i < 7; i++) {
      const d = new Date(lun); d.setDate(d.getDate() + i);
      const info = turniDelGiorno(d.getFullYear(), d.getMonth(), d.getDate(), {});
      if (info.festivo || info.prefestivo) { haFestivo = true; break; }
    }
    return { etichetta: `${gg(lun)}–${gg(dom)}`, haFestivo };
  };
  // Numero MASSIMO di turni che un medico può fare nella settimana wk (tetto max del campo): è il numero
  // di SLOT-TURNO (N sempre + G nei weekend/festivi/prefestivi, MAI gli MMG) nei giorni della settimana
  // che ricadono NEL MESE CORRENTE — il filtro sul mese gestisce da solo le settimane tronche (prima,
  // ultima, e cavallo, dove solo i giorni del mese corrente possono ospitare turni assegnabili). Coerente
  // col conteggio del motore (settimanaCount incrementa di 1 per ogni turno assegnato, N e G separati).
  const maxTurniSettimana = (wk) => {
    const lun = new Date(wk + "T00:00:00");
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(lun); d.setDate(d.getDate() + i);
      if (d.getFullYear() === anno && d.getMonth() === mese) {
        const info = turniDelGiorno(d.getFullYear(), d.getMonth(), d.getDate(), {});
        n += info.turni.filter((t) => t.id === "N" || t.id === "G").length;
      }
    }
    return n;
  };

  // Applica un elenco di azioni (condiviso da applicaProposta e rispondiDomanda) e aggiorna dati.
  // Ritorna {errori, dispoModificata, daElaborare} per costruire il messaggio di conferma a chi chiama.
  const applicaAzioni = (azioniDaApplicare) => {
    const errori = [];
    let dispo = { ...dati.dispo };
    let extras = { ...dati.extras };
    let extraOre = { ...dati.extraOre };
    let turniExtra = { ...(dati.turniExtra || {}) };
    let maxTurniMese = { ...(dati.maxTurniMese || {}) };
    let turniPrecedenti = { ...(dati.turniPrecedenti || {}) }; // turni di fine luglio nella settimana a cavallo (az turno_precedente)
    let schema = dati.schema;
    let daElaborare = false;
    let dispoModificata = false;
    const domandeSuggerite = []; // domande Sì/No generate dal sistema (es. diurno "a sorpresa" su un festivo in settimana)
    const giorniNelMese = new Date(anno, mese + 1, 0).getDate(); // 28..31 secondo il mese (gestisce anche febbraio)

    // PRE-PASSATA "azzera_medico": applica PRIMA di tutto il resto ogni azzeramento, qualunque sia la sua
    // posizione nell'array, così i reinserimenti (dispo_set/dispo_aggiungi/tetto_*) dello stesso batch
    // atterrano SEMPRE sulla dispo già ripulita — "correggi da capo" atomico e senza residui, a prescindere
    // dall'ordine prodotto dall'AI. Cancella dispo[mid] (slot + tetti settimanali + preferenze turno) e il
    // tetto mensile; NON tocca recupero ore né turni extra volontari (dati durevoli, non "disponibilità").
    azioniDaApplicare.forEach((a) => {
      if (a.az !== "azzera_medico") return;
      const mid = nomeToId(a.medico);
      if (mid === undefined || mid === null) { errori.push(erroreMedico(a.medico)); return; }
      dispo = azzeraDispoMedico(dispo, mid);
      const { [mid]: _drop, ...restMax } = maxTurniMese; maxTurniMese = restMax;
      dispoModificata = true;
    });

    azioniDaApplicare.forEach((a) => {
      if (a.az === "azzera_medico") return; // già applicata nella pre-passata sopra
      if (a.az === "elabora") { daElaborare = true; return; }
      if (a.az === "vai_mese") return;
      if (a.az === "turno_precedente") {
        // Registra (o toglie) un turno che il medico ha GIÀ fatto a fine luglio, nella settimana ISO a
        // cavallo con il mese in lavorazione. Il "giorno" è del MESE PRECEDENTE → NON passa dalla
        // validazione-giorno generica qui sotto (che è sul mese corrente): la sua rete di sicurezza è
        // tutta qui. L'AI fa solo il linguaggio (chi/giorno/N-G se detto, presente:false per togliere);
        // il MOTORE fa tutte le verifiche di calendario (settimana a cavallo, esistenza del turno). NON
        // tocca elaboraSchema: scrive turniPrecedenti e ricalcola il tetto EFFETTIVO del cavallo (V-A),
        // esattamente come il checkbox N/G del pannellino 📅 (toggleTurnoPrec).
        const mid = nomeToId(a.medico);
        if (mid === undefined || mid === null) { errori.push(erroreMedico(a.medico)); return; }
        const lun = settimanaCavallo();
        if (!lun) { errori.push(`${a.medico}: ${MESI_IT[mese]} ${anno} inizia di lunedì, non ha una settimana a cavallo — nessun turno di luglio da registrare`); return; }
        const giorniCav = giorniLuglioCavallo();
        const gRec = giorniCav.find((x) => x.giorno === Number(a.giorno));
        if (!gRec) {
          const mb = giorniCav[0] ? giorniCav[0].meseBreve : "lug";
          const range = giorniCav.length ? `${giorniCav[0].giorno}–${giorniCav[giorniCav.length - 1].giorno} ${mb}` : "—";
          errori.push(`${a.medico}: il ${a.giorno} ${mb} non è nella settimana a cavallo — i giorni che incidono su ${MESI_IT[mese].toLowerCase()} sono ${range}. Nessuna registrazione`);
          return;
        }
        const dataStr = gRec.dataStr;
        const rimuovi = a.presente === false;
        let turno = (a.turno === "N" || a.turno === "G") ? a.turno : null;
        // Cavolata 1 — "diurno" su un feriale (che ha solo il notturno): segnala, non registrare.
        if (turno === "G" && !gRec.haG) { errori.push(`${a.medico}: il ${gRec.giorno} ${gRec.meseBreve} è un feriale, non esiste il diurno — intendevi il notturno? Se sì, dimmelo`); return; }
        // Turno non specificato: sui feriali (solo N) default N; sui giorni con SIA diurno SIA notturno
        // è ambiguo → il sistema CHIEDE (domanda Sì/No), non decide da solo. (In rimozione senza turno
        // si toglie l'intero giorno, senza ambiguità.)
        if (!turno && !rimuovi) {
          if (gRec.haG) {
            domandeSuggerite.push({
              medico: a.medico,
              situazione: `il ${gRec.giorno} ${gRec.meseBreve} ha sia il turno diurno sia quello notturno`,
              domanda: "il turno che ha fatto era il diurno?",
              seSi: [{ az: "turno_precedente", medico: a.medico, giorno: a.giorno, turno: "G" }],
              seNo: [{ az: "turno_precedente", medico: a.medico, giorno: a.giorno, turno: "N" }],
            });
            return;
          }
          turno = "N";
        }
        const perMid = { ...(turniPrecedenti[mid] || {}) };
        if (rimuovi) {
          if (turno) { const day = { ...(perMid[dataStr] || {}) }; delete day[turno]; if (!day.N && !day.G) delete perMid[dataStr]; else perMid[dataStr] = day; }
          else delete perMid[dataStr]; // "toglilo" senza turno = azzera l'intero giorno
        } else {
          perMid[dataStr] = { ...(perMid[dataStr] || {}), [turno]: true };
        }
        turniPrecedenti = { ...turniPrecedenti, [mid]: perMid };
        // Ricalcolo del tetto EFFETTIVO del cavallo (dichiarato − nuovo totale luglio), senza perdere il
        // dichiarato — identico a toggleTurnoPrec, ma sul dispo LOCALE del batch.
        const raw = dispo[mid]?.["SETT:" + lun];
        const dich = raw ? (raw.dichiarato != null ? raw.dichiarato : raw.maxTurni) : null;
        if (typeof dich === "number" && dich >= 0) {
          const nd = { ...(dispo[mid] || {}) };
          nd["SETT:" + lun] = { maxTurni: Math.max(0, dich - countLuglio(perMid)), dichiarato: dich };
          dispo = { ...dispo, [mid]: nd };
        }
        dispoModificata = true;
        return;
      }
      // Validazione del giorno: le azioni che citano un giorno (mmg, dispo_*, schema, tetto/pref
      // settimanali/turno) costruiscono dk(anno, mese, a.giorno) — un giorno fuori dal mese (es. 31
      // in novembre, o il 30 febbraio proposto per errore dall'AI da una data che non torna) creerebbe
      // una chiave per un giorno inesistente. Lo scartiamo con un errore chiaro invece di applicarlo.
      if (a.giorno !== undefined && a.giorno !== null) {
        const g = Number(a.giorno);
        if (!Number.isInteger(g) || g < 1 || g > giorniNelMese) {
          errori.push(`giorno ${a.giorno} non esiste in ${MESI_IT[mese]} ${anno} (${MESI_IT[mese]} ha ${giorniNelMese} giorni)`);
          return;
        }
      }
      if (a.az === "mmg") {
        // Attiva/disattiva un turno MMG. La sede e la copertura a distanza NON le sceglie il
        // coordinatore: le decide il motore in base alle disponibilità dei medici (§10 voce 55).
        const dateKey = dk(anno, mese, a.giorno);
        const ex = { ...(extras[dateKey] || {}) };
        ex[a.fascia === "P" ? "P" : "M"] = a.attivo !== false;
        extras = { ...extras, [dateKey]: ex };
        return;
      }
      if (a.az === "ore_extra") {
        const mid = nomeToId(a.medico);
        if (mid === undefined || mid === null) { errori.push(erroreMedico(a.medico)); return; }
        if (CAT_INFO[byId[mid].cat].ore === null) { errori.push(`${a.medico} è senza incarico, niente ore da recuperare`); return; }
        extraOre = { ...extraOre, [mid]: Math.max(0, Number(a.ore) || 0) };
        return;
      }
      if (a.az === "turni_extra") {
        const mid = nomeToId(a.medico);
        if (mid === undefined || mid === null) { errori.push(erroreMedico(a.medico)); return; }
        if (CAT_INFO[byId[mid].cat].ore === null) { errori.push(`${a.medico} è senza incarico, niente turni extra volontari`); return; }
        turniExtra = { ...turniExtra, [mid]: Math.max(0, Number(a.turni) || 0) };
        return;
      }
      if (a.az === "tetto_mese") {
        const mid = nomeToId(a.medico);
        if (mid === undefined || mid === null) { errori.push(erroreMedico(a.medico)); return; }
        if (a.maxTurni === null || a.maxTurni === undefined) { const { [mid]: _drop, ...rest } = maxTurniMese; maxTurniMese = rest; }
        else maxTurniMese = { ...maxTurniMese, [mid]: Math.max(0, Number(a.maxTurni) || 0) };
        return;
      }
      if (a.az === "tetto_settimana") {
        const mid = nomeToId(a.medico);
        if (mid === undefined || mid === null) { errori.push(erroreMedico(a.medico)); return; }
        const wk = settimanaDi(dk(anno, mese, a.giorno));
        const nd = { ...(dispo[mid] || {}) };
        if (a.maxTurni === null || a.maxTurni === undefined) delete nd["SETT:" + wk];
        else nd["SETT:" + wk] = { maxTurni: Math.max(0, Number(a.maxTurni) || 0) };
        dispo = { ...dispo, [mid]: nd };
        dispoModificata = true;
        return;
      }
      if (a.az === "finestra_settimanale") {
        // Vincolo di FINESTRA SETTIMANALE (§10 voce 57): minimo di turni voluti nella settimana ISO che
        // contiene `giorno`. Chiave dispo[mid]["SETTWK:"+lunedì]=N (normalizzata al lunedì come SETT:, così
        // "settimana del 10" e "del 12" sono la STESSA chiave). minTurni ≤ 0 o presente:false → rimuove.
        const mid = nomeToId(a.medico);
        if (mid === undefined || mid === null) { errori.push(erroreMedico(a.medico)); return; }
        const wk = settimanaDi(dk(anno, mese, a.giorno));
        const nd = { ...(dispo[mid] || {}) };
        const N = Math.max(0, Number(a.minTurni) || 0);
        if (a.presente === false || N === 0) delete nd["SETTWK:" + wk];
        else nd["SETTWK:" + wk] = N;
        dispo = { ...dispo, [mid]: nd };
        dispoModificata = true;
        return;
      }
      if (a.az === "turno_pref") {
        const mid = nomeToId(a.medico);
        if (mid === undefined || mid === null) { errori.push(erroreMedico(a.medico)); return; }
        const info = turniDelGiorno(anno, mese, a.giorno, extras);
        if (!info.turni.some((t) => t.id === "G")) { errori.push(`giorno ${a.giorno} non ha sia diurno che notturno: preferenza di turno non applicabile`); return; }
        const dataStr = dk(anno, mese, a.giorno);
        const nd = { ...(dispo[mid] || {}) };
        const key = "TURNOPREF:" + dataStr;
        if (a.turno === "G" || a.turno === "N") nd[key] = a.turno; else delete nd[key];
        dispo = { ...dispo, [mid]: nd };
        dispoModificata = true;
        return;
      }
      if (a.az === "slot_obbligatorio") {
        // Slot che il medico vuole tenere ASSOLUTAMENTE se lo vince per gerarchia (§10 voce 49): punto
        // fisso nella distribuzione §3.11. Chiave dispo[mid]["OBBL:"+slotKey]=true; presente:false rimuove.
        // ORTOGONALE alla disponibilità (non la crea): se il medico non è disponibile lì o non lo vince,
        // il motore lo ignora silenziosamente. Il turno (N/G) deve esistere quel giorno.
        // PERCHÉ ortogonale — DECISIONE CHIUSA (§10 voce 82, NON riaprire): il pin dice "tienimelo SE lo
        // vinco", NON "sono disponibile". Accoppiare pin↔disponibilità (auto-creare la dispo dal pin) farebbe
        // INVENTARE disponibilità — assegnerebbe il medico a uno slot mai offerto: un bug peggiore. E un pin
        // "inerte" ha due facce indistinguibili qui all'apply: (A) medico SENZA disponibilità = errore (bug 10);
        // (B) medico disponibile ma che PERDE per gerarchia = corretto, giustamente ignorato. Un guard nel
        // motore colpirebbe anche (B), che è legittimo → il MOTORE NON SI TOCCA MAI. La difesa del bug 10 sta
        // altrove: prompt (voce 70, "pin solo sui turni dichiarati") + avviso caso-A component-side batch-aware (PENDING).
        const mid = nomeToId(a.medico);
        if (mid === undefined || mid === null) { errori.push(erroreMedico(a.medico)); return; }
        const info = turniDelGiorno(anno, mese, a.giorno, extras);
        const turno = a.turno === "G" || a.turno === "N" ? a.turno : null;
        if (!turno || !info.turni.some((t) => t.id === turno)) { errori.push(`${a.medico} g${a.giorno}: turno "${a.turno}" inesistente quel giorno, slot obbligatorio non applicabile`); return; }
        // "sede" opzionale = pin SEDE (vale solo se il medico ottiene quella sede); assente = pin libero (true).
        let valObbl = true;
        if (a.sede != null && a.sede !== "") { if (!SEDI5.includes(a.sede)) { errori.push(`${a.medico} g${a.giorno}: sede "${a.sede}" non valida per lo slot obbligatorio`); return; } valObbl = a.sede; }
        const key = "OBBL:" + `${dk(anno, mese, a.giorno)}|${turno}`;
        const nd = { ...(dispo[mid] || {}) };
        if (a.presente === false) delete nd[key]; else nd[key] = valObbl;
        dispo = { ...dispo, [mid]: nd };
        dispoModificata = true;
        return;
      }
      if (a.az === "dispo_aggiungi" || a.az === "dispo_togli" || a.az === "dispo_no") {
        const mid = nomeToId(a.medico);
        if (mid === undefined || mid === null) { errori.push(erroreMedico(a.medico)); return; }
        const slotKey = `${dk(anno, mese, a.giorno)}|${a.turno}`;
        const nd = { ...(dispo[mid] || {}) };
        if (a.az === "dispo_togli") delete nd[slotKey];
        else if (a.az === "dispo_no") nd[slotKey] = { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: true };
        else {
          // Entry-building condiviso con dispo_set (funzione pura del motore, unica fonte di verità)
          const { entry, errori: errEntry } = costruisciEntryDispo(a, `${a.medico} g${a.giorno}`);
          errEntry.forEach((e) => errori.push(e));
          if (!entry) return;
          nd[slotKey] = entry;
        }
        dispo = { ...dispo, [mid]: nd };
        dispoModificata = true;
        return;
      }
      if (a.az === "dispo_set") {
        // Azione "compatta": una sola riga dell'AI che dichiara una disponibilità su un intero AMBITO
        // di giorni ("feriali" | "weekend" | "mese" | {da,a}), con le STESSE sedi/livelli per
        // ogni giorno. È il MOTORE (espandiAmbito, calendario deterministico) a calcolare i singoli
        // {giorno,turno}: l'AI non deve più espandere "a mente" i giorni (fonte di errori, es. un
        // feriale saltato). Equivale a N dispo_aggiungi per-giorno con le stesse sedi (test di equivalenza).
        const mid = nomeToId(a.medico);
        if (mid === undefined || mid === null) { errori.push(erroreMedico(a.medico)); return; }
        const { entry, errori: errEntry } = costruisciEntryDispo(a, `${a.medico} (${etichettaAmbito(a.ambito)})`);
        errEntry.forEach((e) => errori.push(e));
        if (!entry) return;
        const slots = espandiAmbito(a.ambito, a.turni, a.escludi || [], anno, mese, extras);
        if (!slots.length) { errori.push(`nessun turno per ${a.medico}: l'ambito "${etichettaAmbito(a.ambito)}" non seleziona alcun giorno/turno valido`); return; }
        const nd = { ...(dispo[mid] || {}) };
        // Ogni slot riceve una COPIA indipendente dell'entry (niente aliasing tra giorni diversi)
        slots.forEach(({ giorno, turno }) => {
          nd[`${dk(anno, mese, giorno)}|${turno}`] = { verde: [...entry.verde], verdeLiv: { ...entry.verdeLiv }, blu: [...entry.blu], bluLiv: { ...entry.bluLiv }, no: false };
        });
        dispo = { ...dispo, [mid]: nd };
        dispoModificata = true;
        // Diurno "a sorpresa": per i GIORNI DELLA SETTIMANA nominati, un giorno che cade su festivo/prefestivo
        // infrasettimanale ha anche il diurno (G), ma abbiamo inserito solo la notte. NON lo aggiungiamo
        // d'ufficio: proponiamo UNA domanda Sì/No per l'intera serie (Sì = dispo_aggiungi G di quei giorni).
        if (a.ambito && typeof a.ambito === "object" && a.ambito.giorni_settimana != null) {
          const nascosti = diurniNascosti(slots, anno, mese, extras);
          if (nascosti.length) {
            const plur = nascosti.length > 1;
            domandeSuggerite.push({
              medico: a.medico,
              situazione: `${plur ? "i giorni" : "il giorno"} ${nascosti.join(", ")} ${MESI_IT[mese].toLowerCase()} ${plur ? "sono festivi/prefestivi e hanno" : "è festivo/prefestivo e ha"} anche il turno diurno (inserito solo il notturno)`,
              domanda: "vuoi aggiungere anche il diurno?",
              seSi: nascosti.map((g) => ({ az: "dispo_aggiungi", medico: a.medico, giorno: g, turno: "G", sedi: a.sedi, sedi_liv: a.sedi_liv, blu: a.blu, blu_liv: a.blu_liv })),
              seNo: [],
            });
          }
        }
        return;
      }
      if (a.az === "schema") {
        if (!schema) { errori.push(`schema non ancora elaborato (giorno ${a.giorno})`); return; }
        const gi = schema.findIndex((g) => g.giorno === a.giorno);
        if (gi < 0) { errori.push(`giorno ${a.giorno} non trovato`); return; }
        const ti = schema[gi].turni.findIndex((t) => t.id === a.turno);
        if (ti < 0) { errori.push(`turno ${a.turno} assente il ${a.giorno}`); return; }
        const si = SEDI5.indexOf(a.sede);
        if (si < 0) { errori.push(`sede ${a.sede} non valida`); return; }
        const mid = a.medico === null ? null : nomeToId(a.medico);
        if (mid === undefined) { errori.push(erroreMedico(a.medico)); return; }
        schema = schema.map((g, x) => x !== gi ? g : {
          ...g, turni: g.turni.map((tt, y) => y !== ti ? tt : { ...tt, slots: tt.slots.map((s, z) => z !== si ? s : mid) }),
        });
        return;
      }
      errori.push(`azione sconosciuta: ${a.az}`);
    });

    let avvisiNuovi = dati.avvisi;
    if (daElaborare) { const r = elaboraSchema(dispo, extraOre, anno, mese, extras, turniExtra, maxTurniMese, riferimentiCavalloDi()); schema = r.schema; avvisiNuovi = r.avvisi; }
    setDati({ dispo, extras, extraOre, turniExtra, maxTurniMese, turniPrecedenti, schema, avvisi: avvisiNuovi });
    return { errori, dispoModificata, daElaborare, domandeSuggerite };
  };
  // Riepilogo compatto (medico: giorno+turno) per le azioni che li identificano — solo un promemoria
  // visivo di una riga, non un resoconto dettagliato. Condiviso da applicaProposta e rispondiDomanda,
  // e usato anche per popolare il registro anti-loop azioniEseguite (stato.azioniGiaEseguite).
  const riepilogoDi = (azioniDaRiepilogare) => {
    const riepilogoPerMedico = {};
    azioniDaRiepilogare.forEach((a) => {
      if (a.az === "azzera_medico" && a.medico) {
        riepilogoPerMedico[a.medico] = riepilogoPerMedico[a.medico] || [];
        riepilogoPerMedico[a.medico].push("azzerato");
      } else if (a.az === "dispo_set" && a.medico) {
        // dispo_set non ha un singolo giorno/turno: la si riassume con l'etichetta dell'ambito
        riepilogoPerMedico[a.medico] = riepilogoPerMedico[a.medico] || [];
        riepilogoPerMedico[a.medico].push(etichettaAmbito(a.ambito) + (a.turni && a.turni.length ? ` (${a.turni.join("+")})` : ""));
      } else if (a.az === "turno_precedente" && a.medico) {
        // Turno passato di luglio: riassunto "lug{g}{N|G}" (con ✕ se rimozione); il giorno è del mese
        // precedente, quindi va tenuto distinto dai g{giorno}{turno} del mese corrente.
        riepilogoPerMedico[a.medico] = riepilogoPerMedico[a.medico] || [];
        riepilogoPerMedico[a.medico].push(`lug${a.giorno}${a.turno || ""}${a.presente === false ? "✕" : ""}`);
      } else if (a.az === "slot_obbligatorio" && a.medico) {
        // Slot obbligatorio: riassunto "📌{g}{N|G}" — distinto da una dispo g{giorno}{turno} nell'anti-loop.
        riepilogoPerMedico[a.medico] = riepilogoPerMedico[a.medico] || [];
        riepilogoPerMedico[a.medico].push(`📌${a.giorno}${a.turno || ""}${a.presente === false ? "✕" : ""}`);
      } else if (a.medico && a.giorno !== undefined && a.giorno !== null && a.turno) {
        riepilogoPerMedico[a.medico] = riepilogoPerMedico[a.medico] || [];
        riepilogoPerMedico[a.medico].push(`g${a.giorno}${a.turno}`);
      }
    });
    const riepilogo = Object.entries(riepilogoPerMedico).map(([m, gs]) => `${m}: ${gs.join(" ")}`).join(" · ");
    const nuoveVociRegistro = [];
    Object.entries(riepilogoPerMedico).forEach(([m, gs]) => gs.forEach((g) => nuoveVociRegistro.push(`${m} ${g}`)));
    return { riepilogo, nuoveVociRegistro };
  };
  const applicaProposta = () => {
    if (!proposta) return;
    const { errori, dispoModificata, daElaborare, domandeSuggerite } = applicaAzioni(proposta.azioni);
    const { riepilogo, nuoveVociRegistro } = riepilogoDi(proposta.azioni);
    if (nuoveVociRegistro.length) setAzioniEseguite((prev) => [...prev, ...nuoveVociRegistro]);
    if (domandeSuggerite.length) setDomande((prev) => [...prev, ...domandeSuggerite]); // es. diurno "a sorpresa" su un festivo in settimana
    let msg = errori.length ? `Applicata con avvisi: ${errori.join("; ")}. ` : `Modifiche applicate ✓${riepilogo ? " — " + riepilogo : ""} (annullabile con ↶). `;
    if (dispoModificata && !daElaborare && dati.schema) msg += "Disponibilità cambiate con schema già elaborato: valuta se rielaborarlo o correggerlo a mano.";
    if (domandeSuggerite.length) msg += ` (${domandeSuggerite.length} domanda${domandeSuggerite.length > 1 ? "e" : ""} sul diurno qui sotto)`;
    setAiMsgs((p) => [...p, { role: "assistant", content: msg.trim() }]);
    setProposta(null);
    if (!azioniRestanti && !domande.length && !domandeSuggerite.length) setCompletato(true); // nessun altro round o domanda in sospeso: mostra il banner "Completato ✓"
  };
  const rifiutaProposta = () => {
    setAiMsgs((p) => [...p, { role: "assistant", content: "Proposta annullata, nessuna modifica applicata." }]);
    setProposta(null);
  };
  // Risponde a una domanda Sì/No dell'AI (es. "attivo anche la mattina MMG?"), applicando l'elenco
  // di azioni corrispondente alla risposta scelta (seSi/seNo, entrambe opzionali/vuote).
  const rispondiDomanda = (idx, risposta) => {
    const d = domande[idx];
    if (!d) return;
    const azioniScelte = (risposta === "si" ? d.seSi : d.seNo) || [];
    let msg, sugg = [];
    if (!azioniScelte.length) {
      msg = `Risposta "${risposta === "si" ? "Sì" : "No"}" registrata, nessuna azione da applicare.`;
    } else {
      const { errori, domandeSuggerite } = applicaAzioni(azioniScelte);
      sugg = domandeSuggerite || [];
      const { riepilogo, nuoveVociRegistro } = riepilogoDi(azioniScelte);
      if (nuoveVociRegistro.length) setAzioniEseguite((prev) => [...prev, ...nuoveVociRegistro]);
      msg = errori.length ? `Risposta "${risposta === "si" ? "Sì" : "No"}" applicata con avvisi: ${errori.join("; ")}.` : `Risposta "${risposta === "si" ? "Sì" : "No"}" applicata ✓${riepilogo ? " — " + riepilogo : ""}.`;
    }
    setAiMsgs((p) => [...p, { role: "assistant", content: msg }]);
    setDomande((prev) => {
      const rest = prev.filter((_, i) => i !== idx).concat(sugg); // eventuali nuove domande generate dal sistema
      if (!rest.length && !proposta && !azioniRestanti) setCompletato(true);
      return rest;
    });
  };
  // Azzera la chat e il registro anti-loop per ripartire da zero senza ricaricare la pagina.
  const nuovaConversazione = () => {
    setAiMsgs([]);
    setAzioniEseguite([]);
    setProposta(null);
    setDomande([]);
    setAvvisi([]);
    setAzioniRestanti(false);
    setTroncato(false);
    setCompletato(false);
    setAiInput("");
  };

  const mediciOrd = useMemo(() => [...mediciList].sort((a, b) => CAT_INFO[a.cat].prio - CAT_INFO[b.cat].prio || a.grad - b.grad), [mediciList]);
  // Ore già assegnate nel mese elaborato, per medico: somma le ore dei turni in cui il medico
  // compare FISICAMENTE (stessa identica logica di scalo del debito nel motore — non conta la
  // copertura a distanza, che non consuma ore proprie). Sola lettura, tab "Medici".
  const oreAssegnateDi = useMemo(() => {
    const out = {};
    if (!dati.schema) return out;
    dati.schema.forEach((g) => {
      g.turni.forEach((t) => {
        if (!t) return;
        // Conta ogni medico una sola volta per turno: l'editor manuale dello schema (setSlot) non
        // aggiorna "fis" quando si riassegna una cella, quindi lo stesso medico può in teoria comparire
        // in più sedi fisiche dello stesso turno dopo una correzione manuale — senza questo Set le sue
        // ore verrebbero sommate una volta per ciascuna sede invece che una volta sola per il turno.
        const contati = new Set();
        t.fis.forEach((si) => {
          const mid = t.slots[si];
          if (mid !== null && mid !== undefined && !contati.has(mid)) {
            contati.add(mid);
            out[mid] = (out[mid] || 0) + t.ore;
          }
        });
      });
    });
    return out;
  }, [dati.schema]);
  // Equità sui turni extra (tab Medici) — SOLO VISUALIZZAZIONE, derivata dallo schema già prodotto,
  // senza mai toccare elaboraSchema. Per ogni medico che ha CHIESTO turni extra (turniExtra > 0):
  // X = extra OTTENUTI = turni assegnati oltre il monte ore ordinario. Il monte ore ordinario è
  // debitoOrdinarioIniziale (monte ore AGGIUSTATO per mese §3.11 + eventuale recupero) — la stessa
  // soglia oltre cui il motore inizia a consumare il budget extra (§3.10); i turni coperti da quel
  // budget ordinario sono ceil(monteOrd / 12) turni da 12h (esatto per i turni ordinari G/N).
  // Ritorna il dettaglio per-medico dell'"iniquità percepita" (vedi INIQUITA_SOGLIE in cima al componente).
  const equitaExtra = useMemo(() => {
    const perMedico = {};
    if (!dati.schema) return { perMedico };
    // turni assegnati per medico (una volta per turno, stesso criterio di oreAssegnateDi)
    const turniAssegnati = {};
    dati.schema.forEach((g) => g.turni.forEach((t) => {
      if (!t) return;
      const contati = new Set();
      t.fis.forEach((si) => {
        const mid = t.slots[si];
        if (mid !== null && mid !== undefined && !contati.has(mid)) { contati.add(mid); turniAssegnati[mid] = (turniAssegnati[mid] || 0) + 1; }
      });
    }));
    const soddisf = []; // soddisfazione (0..1 = ottenuti/richiesti) dei medici che hanno chiesto extra
    const richiedenti = []; // dettaglio per la tabella: {id, x, y, s}
    MEDICI.forEach((m) => {
      const y = (dati.turniExtra || {})[m.id] || 0;
      if (y <= 0) return; // solo chi ha dichiarato turni extra
      const monteOrd = debitoOrdinarioIniziale(m.id, dati.extraOre, mese);
      if (monteOrd === null) return; // senza incarico: nessun monte ore (non dovrebbe avere extra)
      const ordinari = Math.ceil(monteOrd / 12); // turni coperti dal solo monte ore ordinario
      const x = Math.max(0, Math.min(y, (turniAssegnati[m.id] || 0) - ordinari)); // extra ottenuti, in [0, y]
      const s = x / y;
      richiedenti.push({ id: m.id, x, y, s });
      soddisf.push(s);
    });
    // Dettaglio per-medico per la tabella (§10 voce 87): x, y, soddisfazione e LIVELLO di iniquità percepita del
    // SINGOLO = distanza dal più soddisfatto (maxP − s, in punti), mappata sulle soglie INIQUITA_SOGLIE (equità di
    // Adams applicata al singolo: quanto sto sotto chi è stato servito meglio). Così il coordinatore vede CHI,
    // QUANTO e a che livello. Con un solo richiedente non c'è confronto → dist 0 → "Nessuna".
    const maxPall = soddisf.length ? Math.max(...soddisf) : 0;
    for (const r of richiedenti) {
      const dist = (maxPall - r.s) * 100;
      const livello = INIQUITA_SOGLIE[INIQUITA_SOGLIE.findIndex((x) => dist <= x.maxDivario)].label;
      perMedico[r.id] = { x: r.x, y: r.y, s: r.s, dist, livello };
    }
    return { perMedico };
  }, [dati.schema, dati.turniExtra, dati.extraOre, mese]);
  const iconaT = { G: "☀", N: "☾", M: "am", P: "pm" };
  // Palette condivisa del restyling grafico (solo stile, nessun impatto sulla logica). Verde
  // principale moderno/meno cupo, testi in grigi leggibili, bordi morbidi, rossi tenui per
  // "non disponibile / scoperto", blu per "copertura a distanza". I colori DELLE CATEGORIE
  // restano quelli di CAT_INFO (letti sempre via CAT_INFO[...], mai da questa palette).
  const T = {
    bg: "#f5f7f6",          // sfondo pagina, chiaro e ariato
    surface: "#ffffff",     // riquadri/card
    surfaceAlt: "#f1f4f2",  // header di tabella, celle neutre
    primary: "#1c8066",     // verde principale moderno (meno cupo del vecchio #12312a)
    primaryDark: "#14664f", // verde per hover/stati premuti/testi su tinta
    primaryTint: "#e7f3ef", // verde tenue (tab attivo, celle coperte tenui)
    text: "#2c3733",        // testo principale, grigio-verde scuro (non nero pieno)
    textMuted: "#6a7671",   // testo secondario
    textFaint: "#9aa39d",   // testo terziario/etichette leggere
    border: "#e5e9e6",      // bordi morbidi e sottili
    borderStrong: "#d3dad6",// bordi header tabella
    divider: "#eef1ee",     // separatori interni leggerissimi
    danger: "#bf4d3d",      // rosso tenue: non disponibile / scoperto
    dangerText: "#bf4d3d",  // testo rosso tenue
    dangerBg: "#fbeceb",    // sfondo rosso tenue (cella coperta scoperta)
    dangerBorder: "#eecac4",// bordo rosso tenue
    blu: "#3a6fd9",         // copertura a distanza (blu)
    bluDark: "#2853ad",     // blu scuro (testi su tinta)
    bluTint: "#e8eefb",     // blu tenue (sfondi)
    warning: "#b8791a",     // giallo/arancio scuro: scoperto di gravità minore (testo/bordo)
    warningBg: "#fdf3dd",   // giallo tenue (sfondo)
    warningBorder: "#e8d199",// bordo giallo tenue
    neutralCell: "#eef1ee", // cella "non disponibile" grigio tenue (era rosso)
  };
  const btn = { padding: "8px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.text, cursor: "pointer", fontSize: 12 };
  const hPast = historyRef.current.past.length, hFut = historyRef.current.future.length;
  // Avvisi mostrati nel banner (SOLO visualizzazione — `dati.avvisi` resta identico, motore intatto):
  // linguaggio più umano e filtro degli avvisi SCOPERTO "ovvi" (con 1 solo medico presente il motivo è
  // solo la mancanza di medici; l'avviso SCOPERTO è utile solo con 2+ medici presenti).
  const avvisiUI = (dati.avvisi || [])
    .filter((a) => !(a.includes("SCOPERTE") && /con 1 medici presenti/.test(a)))
    .map((a) => a
      .replace("nessuna disponibilità verde o blu dichiarata", "nessun medico disponibile come sede fisica o copertura a distanza")
      .replace("con 1 medici presenti", "con 1 solo medico presente"));
  // (c) Promemoria "CDC scoperta con personale altrove" (§10 voce 89) — SOLO visualizzazione,
  // derivato dallo schema già prodotto (motore intatto). Anomalia CORREGGIBILE: una CDC (Maniago/
  // Spilimbergo, sempre prioritaria) resta vuota MENTRE c'è un medico FISICAMENTE su una sede minore
  // (Meduno/Claut/Anduins) — spostabile. Usa `fis` (corpo fisico, non copertura a distanza) per le
  // minori: chi copre a distanza è già altrove, non si sposta. NON è la penuria (tutte scoperte): se
  // nessuna minore è presidiata fisicamente, non c'è nessuno da muovere → niente promemoria. Ruolo
  // distinto dal banner ambra (che dice il FATTO: nessuno disponibile lì); qui l'AZIONE possibile.
  const promemoriaCDC = useMemo(() => {
    if (!dati.schema) return [];
    const out = [];
    dati.schema.forEach((g) => g.turni.forEach((t) => {
      if (!t) return;
      const cdcScoperte = [0, 1].filter((si) => t.slots[si] === null);
      const minoriFisiche = [2, 3, 4].filter((si) => t.fis.includes(si));
      if (!cdcScoperte.length || !minoriFisiche.length) return;
      const presenti = t.fis.filter((si) => t.slots[si] !== null).map((si) => `${SEDI5[si]} → ${byId[t.slots[si]].nome}`);
      out.push({ giorno: g.giorno, turno: t.label, cdc: cdcScoperte.map((si) => SEDI5[si]).join(", "), presenti });
    }));
    return out;
  }, [dati.schema]);
  // Selettori mese/anno separati (stile "app nativa"): l'anno non ha tutti i 12 mesi disponibili
  // per il 2026 (parte da agosto), quindi il menu del mese mostra SOLO i mesi validi per l'anno
  // attualmente scelto — mai una combinazione inesistente in MESI_DISPONIBILI.
  const anniDisponibili = [...new Set(MESI_DISPONIBILI.map((m) => m.anno))];
  const mesiDelAnno = MESI_DISPONIBILI.filter((m) => m.anno === anno).map((m) => m.mese);
  const vaiAMese = (nuovoAnno, nuovoMese) => {
    let idx = MESI_DISPONIBILI.findIndex((m) => m.anno === nuovoAnno && m.mese === nuovoMese);
    if (idx < 0) idx = MESI_DISPONIBILI.findIndex((m) => m.anno === nuovoAnno); // mese non valido per quell'anno: primo disponibile
    if (idx >= 0) setMeseIdx(idx);
  };

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif", background: T.bg, minHeight: "100vh", color: T.text }}>
      <div style={{ background: T.primary, color: "#fff", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", boxShadow: "0 1px 3px rgba(20,102,79,.18)" }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, opacity: 0.7 }}>ASFO · DISTRETTO NORD</div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Coordinamento Turni Guardia Medica</h1>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => setMeseIdx((i) => Math.max(0, i - 1))} disabled={meseIdx === 0} style={{ ...btn, background: "rgba(255,255,255,.15)", color: "#fff", border: "none" }}>‹</button>
          {/* Due selettori separati (mese + anno), stile "app nativa": salto diretto a qualunque
              mese disponibile senza cliccare le frecce decine di volte. Le opzioni del mese si
              filtrano in base all'anno scelto (il 2026 ha solo agosto-dicembre). Le frecce restano
              per il caso d'uso "mese successivo/precedente" più comune. */}
          <select value={mese} onChange={(e) => vaiAMese(anno, Number(e.target.value))}
            style={{ fontSize: 14, fontWeight: 700, minWidth: 100, textAlign: "center", textAlignLast: "center", background: "rgba(255,255,255,.15)", color: "#fff", border: "none", borderRadius: 6, padding: "8px 4px", cursor: "pointer" }}>
            {mesiDelAnno.map((m) => (
              <option key={m} value={m} style={{ color: T.text, background: "#fff" }}>{MESI_IT[m]}</option>
            ))}
          </select>
          <select value={anno} onChange={(e) => vaiAMese(Number(e.target.value), mese)}
            style={{ fontSize: 14, fontWeight: 700, minWidth: 68, textAlign: "center", textAlignLast: "center", background: "rgba(255,255,255,.15)", color: "#fff", border: "none", borderRadius: 6, padding: "8px 4px", cursor: "pointer" }}>
            {anniDisponibili.map((a) => (
              <option key={a} value={a} style={{ color: T.text, background: "#fff" }}>{a}</option>
            ))}
          </select>
          <button onClick={() => setMeseIdx((i) => Math.min(MESI_DISPONIBILI.length - 1, i + 1))} disabled={meseIdx === MESI_DISPONIBILI.length - 1} style={{ ...btn, background: "rgba(255,255,255,.15)", color: "#fff", border: "none" }}>›</button>
          <button onClick={() => setAiOpen((o) => !o)} style={{ ...btn, background: aiOpen ? "#fff" : "rgba(255,255,255,.15)", color: aiOpen ? T.primary : "#fff", border: "none", fontWeight: 700 }}>Assistente AI</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, background: "#fff", borderBottom: `1px solid ${T.border}`, padding: "8px 16px", flexWrap: "wrap", alignItems: "center" }}>
        {[["dispo", "1 · Disponibilità"], ["mmg", "2 · Coperture MMG e PLS"], ["medici", "3 · Medici / ore da recuperare"], ["schema", "4 · Schema turni"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: "9px 16px", borderRadius: 999, border: "none", background: tab === k ? T.primaryTint : "transparent", cursor: "pointer", fontSize: 13, fontWeight: tab === k ? 600 : 500, color: tab === k ? T.primaryDark : T.textMuted, transition: "background .15s, color .15s" }}>{l}</button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, padding: "8px 0", flexWrap: "wrap" }}>
          <button onClick={annulla} disabled={!hPast} title="Annulla ultima azione" style={{ ...btn, opacity: hPast ? 1 : 0.4, fontWeight: 700 }}>↶ Annulla</button>
          <button onClick={ripeti} disabled={!hFut} title="Ripeti azione annullata" style={{ ...btn, opacity: hFut ? 1 : 0.4, fontWeight: 700 }}>↷ Ripeti</button>
          <button onClick={elabora} style={{ ...btn, background: T.primary, color: "#fff", border: "none", fontWeight: 600 }}>Elabora schema</button>
          <button onClick={() => esporta(false)} style={btn}>Esporta mese</button>
          <button onClick={() => esporta(true)} style={btn}>Esporta anno</button>
        </div>
      </div>

      {!caricato && <div style={{ padding: 8, textAlign: "center", fontSize: 12, background: "#fdf3dd", color: "#8a5a00" }}>Carico i dati salvati…</div>}
      <div style={{ display: "flex" }}>
        <div style={{ flex: 1, padding: 16, minWidth: 0 }}>
          {tab === "dispo" && (
            <div>
              <p style={{ fontSize: 12, color: T.textMuted, margin: "0 0 8px" }}>
                Legenda: <b>📌</b> Ci tengo a questa data · <b>⚓</b> Ci tengo a questa data solo se sono in questa sede · <b style={{color:T.primary}}>pallino verde</b> = sede fisica, <b style={{color:T.blu}}>pallino blu</b> = copertura a distanza.
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                <button onClick={azzeraMese}
                  style={{ padding: "7px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700,
                    border: confermaAzzera ? "2px solid #bf4d3d" : "1px solid #eecac4",
                    background: confermaAzzera ? T.danger : "#fff",
                    color: confermaAzzera ? "#fff" : T.danger }}>
                  {confermaAzzera ? "⚠ Confermi? Tocca di nuovo per CANCELLARE tutto il mese" : "🗑 Azzera mese da capo"}
                </button>
                <button onClick={() => setRapidoOpen((o) => !o)} style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #1c8066", background: rapidoOpen ? T.primary : "#fff", color: rapidoOpen ? "#fff" : T.primary, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>⚡ Inserimento rapido per intervallo</button>
              </div>
              {rapidoOpen && (
                <div style={{ background: "#fff", border: "2px solid #1c8066", borderRadius: 10, padding: 14, marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Inserimento rapido</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: T.textMuted }}>Medico<br />
                      <select value={rapMedico} onChange={(e) => setRapMedico(Number(e.target.value))} style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #e5e9e6", marginTop: 3 }}>
                        {[...MEDICI].sort((a, b) => a.nome.localeCompare(b.nome)).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                      </select>
                    </label>
                    <label style={{ fontSize: 11, color: T.textMuted }}>Dal<br />
                      <input type="date" min="2026-08-01" max="2027-12-31" value={rapInizio} onChange={(e) => setRapInizio(e.target.value)} style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #e5e9e6", marginTop: 3 }} />
                    </label>
                    <label style={{ fontSize: 11, color: T.textMuted }}>Al<br />
                      <input type="date" min="2026-08-01" max="2027-12-31" value={rapFine} onChange={(e) => setRapFine(e.target.value)} style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #e5e9e6", marginTop: 3 }} />
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 12 }}>
                    <label style={{ cursor: "pointer" }}><input type="checkbox" checked={rapNotte} onChange={(e) => setRapNotte(e.target.checked)} /> Notturno</label>
                    <label style={{ cursor: "pointer" }}><input type="checkbox" checked={rapGiorno} onChange={(e) => setRapGiorno(e.target.checked)} /> Diurno (solo weekend/festivi)</label>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 6 }}>Sedi disponibili (<b style={{color:T.primary}}>verde</b> = in sede, <b style={{color:T.blu}}>blu</b> = a distanza)</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {SEDI5.map((s) => {
                        const stato = rapSedi[s] || "off";
                        return (
                          <span key={s} onClick={() => setRapSedi((prev) => {
                            const cur = prev[s] || "off";
                            const next = cur === "off" ? "verde" : cur === "verde" ? "blu" : "off";
                            const np = { ...prev };
                            if (next === "off") delete np[s]; else np[s] = next;
                            return np;
                          })}
                            style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 700, userSelect: "none",
                              background: stato === "verde" ? T.primary : stato === "blu" ? T.blu : T.surfaceAlt,
                              color: stato === "verde" ? "#fff" : stato === "blu" ? "#fff" : T.textFaint }}>
                            {SEDI_BREVI[s]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 6 }}>Periodi <b style={{color:T.danger}}>non disponibili</b> (es. ferie)</div>
                    {rapIndisp.map((r, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 6 }}>
                        <label style={{ fontSize: 11, color: T.textMuted }}>Dal<br />
                          <input type="date" min="2026-08-01" max="2027-12-31" value={r.inizio}
                            onChange={(e) => setRapIndisp((prev) => prev.map((x, xi) => xi === i ? { ...x, inizio: e.target.value } : x))}
                            style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #e5e9e6", marginTop: 3 }} />
                        </label>
                        <label style={{ fontSize: 11, color: T.textMuted }}>Al<br />
                          <input type="date" min="2026-08-01" max="2027-12-31" value={r.fine}
                            onChange={(e) => setRapIndisp((prev) => prev.map((x, xi) => xi === i ? { ...x, fine: e.target.value } : x))}
                            style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #e5e9e6", marginTop: 3 }} />
                        </label>
                        <button onClick={() => setRapIndisp((prev) => prev.filter((_, xi) => xi !== i))}
                          style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #eecac4", background: T.dangerBg, color: T.danger, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✕</button>
                      </div>
                    ))}
                    <button onClick={() => setRapIndisp((prev) => [...prev, { inizio: "", fine: "" }])}
                      style={{ padding: "6px 12px", borderRadius: 6, border: "1px dashed #bf4d3d", background: "#fff", color: T.danger, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>+ Aggiungi periodo non disponibile</button>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: T.textMuted, display: "flex", alignItems: "center", gap: 8 }}>
                      Tetto turni/settimana (opzionale)
                      <input type="number" min="0" step="1" placeholder="nessun limite" value={rapMaxSettimana}
                        onChange={(e) => setRapMaxSettimana(e.target.value)}
                        style={{ width: 90, fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #e5e9e6" }} />
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={applicaRapido} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: T.primary, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Applica</button>
                    <button onClick={() => setRapidoOpen(false)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #e5e9e6", background: "#fff", cursor: "pointer", fontSize: 12 }}>Chiudi</button>
                  </div>
                </div>
              )}
              <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e9e6", overflow: "auto", maxHeight: "68vh", position: "relative" }}>
                <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ position: "sticky", left: 0, top: 0, zIndex: 3, background: T.surfaceAlt, padding: "5px 8px", textAlign: "left", minWidth: 160, borderBottom: "2px solid #d3dad6" }}>Medico</th>
                      {colonne.map((c, i) => (
                        <th key={i} style={{ position: "sticky", top: 0, zIndex: 2, padding: "3px 2px", minWidth: 30, background: c.festivo || c.prefestivo ? "#fbe9e0" : c.weekend ? "#eef3ea" : T.surfaceAlt, borderBottom: "2px solid #d3dad6" }}>
                          <div style={{ fontSize: 8.5, color: T.textMuted }}>{GIORNI_BREVI[c.dow]}</div>
                          <div style={{ fontWeight: 800, fontSize: 12.5, color: T.text }}>{c.giorno}</div>
                          <div style={{ fontSize: 9, color: T.textMuted }}>{iconaT[c.turno.id]}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mediciOrd.map((m) => (
                      <tr key={m.id}>
                        <td style={{ position: "sticky", left: 0, zIndex: 1, background: "#fff", padding: "4px 8px", borderBottom: "1px solid #eef1ee", whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 600, fontSize: 10.5 }}>{m.nome}</div>
                          <span style={{ display: "inline-block", marginTop: 2, fontSize: 8.5, fontWeight: 700, color: CAT_INFO[m.cat].color, background: CAT_INFO[m.cat].bg, borderRadius: 5, padding: "1px 6px" }}>{CAT_INFO[m.cat].label}</span>
                        </td>
                        {colonne.map((c, i) => {
                          const sk = `${c.key}|${c.turno.id}`;
                          const sedi = normDispo(dati.dispo[m.id]?.[sk]);
                          const on = !sedi.no && (sedi.verde.length + sedi.blu.length > 0);
                          const obblVal = dati.dispo[m.id]?.["OBBL:" + sk]; // slot obbligatorio (§10 voce 49): 📌 pin libero (alto-sx), ⚓ pin sede (alto-dx)
                          const inEdit = editCella && editCella.mid === m.id && editCella.slotKey === sk;
                          // Dicotomico: SOLO 2 stati visivi possibili — disponibile (verde) o non disponibile
                          // (rosso). "Non specificato" e "NO esplicito" appaiono identici: la distinzione
                          // interna esiste solo per proteggere le indisponibilità dichiarate dall'inserimento
                          // rapido, non è mai mostrata all'utente.
                          // Dicotomico invariato (righe 1870/3095): "on" = disponibile, "!on" = non
                          // disponibile. Resa "che respira": sfondo NEUTRO (non verde pieno), il contenuto
                          // è fatto di PALLINI colorati (verde = sede fisica, blu = a distanza) con la sigla
                          // (1 sede) o il conteggio (≥2, con elenco grigio sotto). I livelli NON
                          // mostrati in griglia — solo nel popup. I DATI (V/B) restano invariati:
                          // cambia solo la VISUALIZZAZIONE.
                          const bg = inEdit ? "#8a5a00" : on ? T.surface : T.neutralCell;
                          return (
                            <td key={i} style={{ borderBottom: "1px solid #eef1ee", borderLeft: "1px solid #eef1ee", textAlign: "center", cursor: "pointer", background: bg, color: T.text, padding: "4px 3px", userSelect: "none", position: "relative", verticalAlign: "middle" }}
                              onClick={() => {
                                if (inEdit) setEditCella(null);
                                else setEditCella({ mid: m.id, slotKey: sk, giorno: c.giorno, turno: c.turno.label });
                              }}>
                              {on ? (() => {
                                const verdeO = ordinaPerLivello(sedi.verde, sedi.verdeLiv, MAX_LIV_VERDE);
                                const bluO = ordinaPerLivello(sedi.blu, sedi.bluLiv, MAX_LIV_BLU);
                                const nV = verdeO.length, nB = bluO.length;
                                const Dot = (col) => <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: col, flex: "0 0 auto" }} />;
                                const pill = (col, n, sedeArr) => (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                    {Dot(col)}<span style={{ fontWeight: 700, fontSize: 11, color: inEdit ? "#fff" : T.text }}>{n === 1 ? SEDI_BREVI[sedeArr[0]] : n}</span>
                                  </span>
                                );
                                const grigio = [];
                                if (nV >= 2) grigio.push(verdeO.map((s) => SEDI_BREVI[s]).join(" "));
                                if (nB >= 2) grigio.push(bluO.map((s) => SEDI_BREVI[s]).join(" "));
                                return (
                                  <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 1, lineHeight: 1.15 }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                      {nV > 0 && pill(T.primary, nV, verdeO)}
                                      {nB > 0 && pill(T.blu, nB, bluO)}
                                    </span>
                                    {grigio.length > 0 && <span style={{ color: inEdit ? "#f0e6cf" : T.textFaint, fontSize: 8, fontWeight: 600, letterSpacing: .2 }}>{grigio.join(" · ")}</span>}
                                  </span>
                                );
                              })() : <span style={{ display: "inline-block", width: 4, height: 4, borderRadius: "50%", background: T.textFaint, opacity: .45 }} />}
                              {obblVal === true && <span title="Slot obbligatorio: se lo vince, la distribuzione lo tiene sempre" style={{ position: "absolute", top: 0, left: 1, fontSize: 8, lineHeight: 1, pointerEvents: "none" }}>📌</span>}
                              {typeof obblVal === "string" && <span title={`Slot obbligatorio solo se ottiene ${SEDI_BREVI[obblVal] || obblVal}`} style={{ position: "absolute", top: 0, right: 1, fontSize: 8, lineHeight: 1, pointerEvents: "none" }}>⚓</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {editCella && (() => {
                const sedi = normDispo(dati.dispo[editCella.mid]?.[editCella.slotKey]);
                const dataStrCella = editCella.slotKey.split("|")[0];
                const turnoIdCella = editCella.slotKey.split("|")[1]; // "G" | "N" | "M" | "P" — solo per il FILTRO opzioni notturne Claut/Anduins (UI, non tocca il motore)
                const ordScelta = ["1ª", "2ª", "3ª", "4ª", "5ª"];
                const hasEntrambiTurni = !!giorniMese[editCella.giorno - 1]?.turni.some((t) => t.id === "G");
                const turnoPref = turnoPrefDi(dati.dispo, editCella.mid, dataStrCella);
                return (
                  <div style={{ position: "fixed", left: "50%", bottom: 20, transform: "translateX(-50%)", background: "#fff", border: "1px solid #e5e9e6", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,.25)", padding: 14, zIndex: 50, minWidth: 290, maxWidth: "92vw" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{byId[editCella.mid].nome}</div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 8 }}>Giorno {editCella.giorno} · {editCella.turno}</div>

                    {hasEntrambiTurni && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, color: T.textFaint }}>Se vince sia diurno che notturno, preferisce:</span>
                        <span onClick={() => setTurnoPref(editCella.mid, dataStrCella, "G")}
                          title={turnoPref === "G" ? "Preferisce il diurno: tocca per togliere" : "Preferisce il diurno se vince entrambi i turni"}
                          style={{ cursor: "pointer", fontSize: 15, padding: "3px 7px", borderRadius: 6, userSelect: "none", background: turnoPref === "G" ? "#fdf0d5" : T.surfaceAlt, border: turnoPref === "G" ? "1px solid #cf9a1a" : "1px solid transparent" }}>
                          ☀️
                        </span>
                        <span onClick={() => setTurnoPref(editCella.mid, dataStrCella, "N")}
                          title={turnoPref === "N" ? "Preferisce il notturno: tocca per togliere" : "Preferisce il notturno se vince entrambi i turni"}
                          style={{ cursor: "pointer", fontSize: 15, padding: "3px 7px", borderRadius: 6, userSelect: "none", background: turnoPref === "N" ? T.bluTint : T.surfaceAlt, border: turnoPref === "N" ? "1px solid #3a6fd9" : "1px solid transparent" }}>
                          🌙
                        </span>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                      <span onClick={() => setNoCella(editCella.mid, editCella.slotKey, false)}
                        style={{ flex: 1, textAlign: "center", padding: "8px 6px", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 12, userSelect: "none", background: !sedi.no ? T.primary : T.surfaceAlt, color: !sedi.no ? "#fff" : T.textFaint }}>
                        Disponibile
                      </span>
                      <span onClick={() => setNoCella(editCella.mid, editCella.slotKey, true)}
                        style={{ flex: 1, textAlign: "center", padding: "8px 6px", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 12, userSelect: "none", background: sedi.no ? T.danger : T.surfaceAlt, color: sedi.no ? "#fff" : T.textFaint }}>
                        Non disponibile
                      </span>
                    </div>

                    {sedi.no ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setEditCella(null)} style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "none", background: T.primaryDark, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Chiudi</button>
                      </div>
                    ) : (
                      <>
                        {(() => {
                          const obblKey = "OBBL:" + editCella.slotKey;
                          const obblVal = dati.dispo[editCella.mid]?.[obblKey];
                          const isObbl = !!obblVal;
                          return (
                            <div onClick={() => { const nd = { ...(dati.dispo[editCella.mid] || {}) }; if (isObbl) delete nd[obblKey]; else nd[obblKey] = true; setDati({ dispo: { ...dati.dispo, [editCella.mid]: nd }, schema: null }); }}
                              title="📌 lo tieni se lo vince; ⚓ = solo se ottiene quella sede"
                              style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "7px 9px", borderRadius: 8, cursor: "pointer", userSelect: "none", background: isObbl ? T.primaryTint : T.surfaceAlt, border: isObbl ? `1px solid ${T.primary}` : "1px solid transparent" }}>
                              <span style={{ fontSize: 15 }}>📌</span>
                              <span style={{ fontSize: 11, fontWeight: isObbl ? 700 : 500, color: isObbl ? T.primary : T.textMuted }}>Voglio questo turno{typeof obblVal === "string" ? ` — solo a ${SEDI_BREVI[obblVal] || obblVal} ⚓` : ""} {isObbl ? "✓" : ""}</span>
                            </div>
                          );
                        })()}
                        <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 8 }}>Di notte Claut e Anduins solo <b style={{ color: T.blu }}>a distanza</b> (non sono sedi fisiche).</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                          {SEDI5.map((s) => {
                            const valore = sedi.verde.includes(s) ? `V${sedi.verdeLiv[s] || 1}` : sedi.blu.includes(s) ? `B${sedi.bluLiv[s] || 1}` : "";
                            const isVerde = valore.startsWith("V");
                            // Di NOTTE Claut/Anduins non sono sedi fisiche (motore, riga 491): nel menu
                            // mostra SOLO le opzioni "A distanza". Filtro UI — i valori (V/B + livello)
                            // restano identici, cambia solo cosa è OFFERTO nel menu, mai il dato al motore.
                            const soloDistanza = (s === "Claut" || s === "Anduins") && turnoIdCella === "N";
                            return (
                              <label key={s} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                                <span style={{ fontWeight: 700, minWidth: 24 }}>{SEDI_BREVI[s]}</span>
                                <select value={valore} onChange={(e) => setSedeOpzione(editCella.mid, editCella.slotKey, s, e.target.value)}
                                  style={{ flex: 1, fontSize: 12, padding: "5px 4px", borderRadius: 5, border: "1px solid #e5e9e6",
                                    background: valore.startsWith("V") ? T.primaryTint : valore.startsWith("B") ? T.bluTint : "#fff",
                                    color: valore.startsWith("V") ? T.primary : valore.startsWith("B") ? T.bluDark : T.textMuted }}>
                                  <option value="">Non disponibile</option>
                                  {!soloDistanza && (
                                    <optgroup label="Sede principale (fisica)">
                                      {[1, 2, 3, 4, 5].map((l) => <option key={"V" + l} value={"V" + l} style={{ background: T.primaryTint, color: T.primary }}>{ordScelta[l - 1]} scelta</option>)}
                                    </optgroup>
                                  )}
                                  <optgroup label="Copertura a distanza">
                                    {[1, 2, 3, 4].map((l) => <option key={"B" + l} value={"B" + l} style={{ background: T.bluTint, color: T.bluDark }}>A distanza · {ordScelta[l - 1]} scelta</option>)}
                                  </optgroup>
                                </select>
                                {isVerde && (() => {
                                  const obblKey = "OBBL:" + editCella.slotKey;
                                  const pinnedHere = dati.dispo[editCella.mid]?.[obblKey] === s;
                                  return (
                                    <span onClick={() => { const nd = { ...(dati.dispo[editCella.mid] || {}) }; if (pinnedHere) delete nd[obblKey]; else nd[obblKey] = s; setDati({ dispo: { ...dati.dispo, [editCella.mid]: nd }, schema: null }); }}
                                      title={`Voglio questo turno SOLO se ottengo ${SEDI_BREVI[s] || s} (⚓ pin sede)${pinnedHere ? " — tocca per togliere" : ""}`}
                                      style={{ cursor: "pointer", fontSize: 13, minWidth: 16, textAlign: "center", color: pinnedHere ? T.primary : T.textFaint, userSelect: "none" }}>
                                      ⚓
                                    </span>
                                  );
                                })()}
                              </label>
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => setEditCella(null)} style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "none", background: T.primaryDark, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Chiudi</button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {tab === "mmg" && (
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e9e6", padding: 16 }}>
              <p style={{ fontSize: 12, color: T.textMuted, marginTop: 0 }}>Compaiono <b>solo i feriali semplici</b> (weekend e festivi esclusi).</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
                {giorniMese.map((g, i) => {
                  // Solo feriali semplici (§10 voce 53): weekend/festivo/prefestivo esclusi. La
                  // classificazione viene SEMPRE da turniDelGiorno (giorniMese[i] ne è l'output), mai a memoria.
                  if (g.weekend || g.festivo || g.prefestivo) return null;
                  return (
                  <div key={i} style={{ border: "1px solid #e5e9e6", borderRadius: 8, padding: "6px 8px", background: "#fff" }}>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>{i + 1} <span style={{ fontWeight: 400, color: T.textFaint }}>{GIORNI_BREVI[g.dow]}</span></div>
                    <label style={{ display: "block", fontSize: 11, cursor: "pointer" }}><input type="checkbox" checked={!!dati.extras[g.key]?.M} onChange={() => toggleExtra(g.key, "M")} /> Mattina</label>
                    <label style={{ display: "block", fontSize: 11, cursor: "pointer" }}><input type="checkbox" checked={!!dati.extras[g.key]?.P} onChange={() => toggleExtra(g.key, "P")} /> Pomeriggio</label>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "medici" && (
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e9e6", padding: 16, maxWidth: 860, overflow: "auto" }}>
              {dati.schema && Object.values(equitaExtra.perMedico).some((d) => d.livello !== "Nessuna") && (
                // Mini-nota SOPRA la tabella, discreta, mostrata SOLO quando c'è almeno un medico con iniquità
                // percepita > "Nessuna" (altrimenti spazio pulito). Non ripete i valori (già in tabella): spiega
                // solo COSA guardare — il confronto, non il conteggio dei turni.
                <div style={{ marginBottom: 12, fontSize: 11, color: T.textFaint, lineHeight: 1.5, maxWidth: 620 }}>
                  <b style={{ color: T.textMuted }}>Iniquità percepita</b> <span style={{ color: T.textFaint }}>(Nessuna · Bassa · Media · Alta · Altissima)</span> — quanto un medico è stato servito peggio dei colleghi, in proporzione a quello che aveva chiesto. Non è il numero di turni che conta: è il confronto.
                </div>
              )}
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #d3dad6" }}>
                  <th style={{ padding: "6px 8px" }}>Medico</th><th style={{ padding: "6px 8px" }}>Categoria</th><th style={{ padding: "6px 8px" }}>Grad.</th><th style={{ padding: "6px 8px" }}>Titolarità</th><th style={{ padding: "6px 8px" }}>Monte ore</th><th style={{ padding: "6px 8px" }}>Ore da recuperare</th><th style={{ padding: "6px 8px" }}>Turni extra</th><th style={{ padding: "6px 8px" }}>Max turni mese</th><th style={{ padding: "6px 8px" }}>Max turni sett.</th><th style={{ padding: "6px 8px", color: T.textMuted }} title="Sola lettura: visibile solo dopo l'elaborazione dello schema del mese">Ore assegnate</th><th style={{ padding: "6px 8px", color: T.textMuted }} title="Sola lettura: visibile solo dopo l'elaborazione dello schema del mese">Ore mancanti</th><th style={{ padding: "6px 8px" }}></th>
                </tr></thead>
                <tbody>
                  {mediciOrd.map((m) => [
                    <tr key={m.id} style={{ borderBottom: "1px solid #eef1ee" }}>
                      <td style={{ padding: "6px 8px", fontWeight: 600 }}>{m.nome}</td>
                      <td style={{ padding: "6px 8px" }}>
                        <select value={m.cat} onChange={(e) => {
                          const nuovaCat = e.target.value;
                          // Titolarità obbligatoria per ogni contrattualizzato (§3.1a): passando a SENZA
                          // si azzera (nessuna titolarità per i senza incarico); passando a un
                          // contrattualizzato senza titolarità già impostata, default a Maniago (mai
                          // lasciarla null — il coordinatore la corregge dalla colonna Titolarità).
                          const patch = { cat: nuovaCat };
                          if (nuovaCat === "SENZA") patch.sedeContratto = null;
                          else if (!m.sedeContratto) patch.sedeContratto = "Maniago";
                          aggiornaMedico(m.id, patch);
                        }}
                          style={{ fontSize: 11, padding: "4px 8px", borderRadius: 999, border: `1px solid ${CAT_INFO[m.cat].color}33`, background: CAT_INFO[m.cat].bg, color: CAT_INFO[m.cat].color, fontWeight: 700, cursor: "pointer" }}>
                          {Object.entries(CAT_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        <input type="number" min={0} value={m.grad}
                          onChange={(e) => aggiornaMedico(m.id, { grad: Number(e.target.value) })}
                          style={{ width: 58, padding: "3px 5px", borderRadius: 5, border: "1px solid #e5e9e6" }} />
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        {isContrattualizzato(m.id) ? (
                          <select value={m.sedeContratto || "Maniago"} onChange={(e) => aggiornaMedico(m.id, { sedeContratto: e.target.value })}
                            style={{ fontSize: 11, padding: "3px 5px", borderRadius: 5, border: "1px solid #e5e9e6" }}>
                            {CDC.map((s) => <option key={s} value={s}>{SEDI_BREVI[s]}</option>)}
                          </select>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "6px 8px" }}>{CAT_INFO[m.cat].ore ?? "—"}</td>
                      <td style={{ padding: "6px 8px" }}>
                        {CAT_INFO[m.cat].ore !== null ? (
                          <input type="number" min={0} step={6} value={dati.extraOre[m.id] || 0}
                            onChange={(e) => setDati({ extraOre: { ...dati.extraOre, [m.id]: Number(e.target.value) }, schema: null })}
                            style={{ width: 64, padding: "3px 5px", borderRadius: 5, border: "1px solid #e5e9e6" }} />
                        ) : "—"}
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        {CAT_INFO[m.cat].ore !== null ? (
                          <input type="number" min={0} step={1} value={(dati.turniExtra || {})[m.id] || 0}
                            onChange={(e) => setDati({ turniExtra: { ...(dati.turniExtra || {}), [m.id]: Math.max(0, Number(e.target.value) || 0) }, schema: null })}
                            style={{ width: 50, padding: "3px 5px", borderRadius: 5, border: "1px solid #e5e9e6" }} />
                        ) : "—"}
                        {dati.schema && ((dati.turniExtra || {})[m.id] || 0) > 0 && (() => {
                          const d = equitaExtra.perMedico[m.id];
                          if (!d) return null;
                          const pct = Math.round((d.s || 0) * 100);
                          // mappa colore del livello: verde (Nessuna/Bassa) → ambra (Media) → rosso (Alta/Altissima)
                          const col = d.livello === "Nessuna" || d.livello === "Bassa" ? T.primary : d.livello === "Media" ? "#c17d0f" : T.danger;
                          return (
                            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>
                              Extra: <b>{d.x}/{d.y}</b> · {pct}% · <b style={{ color: col }}>{d.livello}</b>
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        <input type="number" min={0} step={1} placeholder="—" value={(dati.maxTurniMese || {})[m.id] ?? ""}
                          onChange={(e) => { const v = e.target.value; const nd = { ...(dati.maxTurniMese || {}) }; if (v === "") delete nd[m.id]; else nd[m.id] = Math.max(0, Number(v) || 0); setDati({ maxTurniMese: nd, schema: null }); }}
                          style={{ width: 50, padding: "3px 5px", borderRadius: 5, border: "1px solid #e5e9e6" }} />
                      </td>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                        <input type="number" min={0} step={1} placeholder={tettiSettMisti(m.id) ? "misto" : "—"} value={capSettimanaleUniforme(m.id)}
                          onChange={(e) => setCapSettimana(m.id, e.target.value)}
                          title="Massimo turni/settimana (per valori diversi usa 📅)"
                          style={{ width: 50, padding: "3px 5px", borderRadius: 5, border: `1px solid ${tettiSettMisti(m.id) ? "#c17d0f" : "#e5e9e6"}` }} />
                        <button onClick={() => setSettAperto(settAperto === m.id ? null : m.id)}
                          title="Tetti per singola settimana (diversi per settimana)"
                          style={{ marginLeft: 4, padding: "3px 5px", borderRadius: 5, border: "1px solid #cfe0da", background: (settAperto === m.id || tettiSettMisti(m.id)) ? T.primary : "#fff", color: (settAperto === m.id || tettiSettMisti(m.id)) ? "#fff" : T.primary, cursor: "pointer", fontSize: 11 }}>📅</button>
                      </td>
                      <td style={{ padding: "6px 8px", color: T.textMuted }}>
                        {dati.schema ? `${oreAssegnateDi[m.id] || 0}h` : "—"}
                      </td>
                      <td style={{ padding: "6px 8px", color: T.textMuted }}>
                        {dati.schema && CAT_INFO[m.cat].ore !== null
                          ? `${(CAT_INFO[m.cat].ore + (dati.extraOre[m.id] || 0)) - (oreAssegnateDi[m.id] || 0)}h`
                          : "—"}
                      </td>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                        <button onClick={() => setStatoAperto(statoAperto === m.id ? null : m.id)}
                          style={{ padding: "3px 7px", borderRadius: 5, border: "1px solid #cfe0da", background: statoAperto === m.id ? T.primary : "#fff", color: statoAperto === m.id ? "#fff" : T.primary, cursor: "pointer", fontSize: 11, fontWeight: 700, marginRight: 4 }}>🔍</button>
                        <button onClick={() => rimuoviMedico(m.id)} title="Rimuovi medico dall'elenco"
                          style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #eecac4", background: "#fff", color: T.danger, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✕</button>
                      </td>
                    </tr>,
                    statoAperto === m.id ? (
                      <tr key={m.id + "-stato"}>
                        <td colSpan={12} style={{ padding: "0 8px 12px", background: T.primaryTint }}>
                          <pre style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap", fontFamily: "inherit", color: T.text }}>{formattaStatoReale(m.nome, statoRealeMedico(m.id, dati.dispo, dati.maxTurniMese), mese, anno)}</pre>
                        </td>
                      </tr>
                    ) : null,
                    settAperto === m.id ? (
                      <tr key={m.id + "-sett"}>
                        <td colSpan={12} style={{ padding: "4px 8px 12px", background: "#f3f7f5" }}>
                          {settimanaCavallo() && (() => {
                            // Riquadro collassabile (CHIUSO di default) per registrare i turni già svolti a fine mese
                            // PRECEDENTE nella settimana a cavallo. NON dipende più da un tetto dichiarato: i turni di
                            // fine mese precedente contano SEMPRE nella distribuzione (§10 voce 46/47), e se quella
                            // settimana ha un tetto lo riducono. Generico su qualsiasi mese (usa mesePrec/mese corrente).
                            const july = countLuglio((dati.turniPrecedenti || {})[m.id]);
                            const mesePrec = MESI_IT[(mese + 11) % 12].toLowerCase();
                            const aperto = turniPrecAperto === m.id;
                            const haCap = capDichiaratoDi(m.id, settimanaCavallo()) != null;
                            return (
                              <div style={{ marginBottom: 10 }}>
                                <button onClick={() => setTurniPrecAperto(aperto ? null : m.id)}
                                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #c9a24a", background: aperto ? "#fdf7e8" : "#fff", color: "#8a6d1f", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                                  {aperto ? "▾" : "▸"} Turni già fatti a fine {mesePrec}{july > 0 ? ` (${july})` : ""}
                                </button>
                                {aperto && (
                                  <div style={{ marginTop: 6, padding: "6px 8px", border: "1px dashed #c9a24a", borderRadius: 6, background: "#fdf7e8" }}>
                                    <div style={{ fontSize: 11, color: "#8a6d1f", marginBottom: 5 }}>
                                      Spunta i turni svolti a {mesePrec} nella settimana a cavallo: allontanano i turni di {MESI_IT[mese].toLowerCase()} da fine {mesePrec} nella distribuzione{haCap ? " e riducono il tetto di quella settimana" : ""} (non toccano il tetto mensile).
                                    </div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                                      {giorniLuglioCavallo().map((g) => {
                                        const tp = ((dati.turniPrecedenti || {})[m.id] || {})[g.dataStr] || {};
                                        return (
                                          <div key={g.dataStr} style={{ textAlign: "center" }}>
                                            <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 2, whiteSpace: "nowrap" }}>{g.giorno} {g.meseBreve}</div>
                                            <label style={{ fontSize: 10, marginRight: g.haG ? 5 : 0, cursor: "pointer" }}><input type="checkbox" checked={!!tp.N} onChange={() => toggleTurnoPrec(m.id, g.dataStr, "N")} /> N</label>
                                            {g.haG && <label style={{ fontSize: 10, cursor: "pointer" }}><input type="checkbox" checked={!!tp.G} onChange={() => toggleTurnoPrec(m.id, g.dataStr, "G")} /> G</label>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    {july > 0 && haCap && <div style={{ fontSize: 10, color: "#8a6d1f", marginTop: 5 }}>Totale {july} turn{july === 1 ? "o" : "i"} a {mesePrec} → il tetto della settimana a cavallo scende di {july}.</div>}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 6 }}><b>Al massimo</b> = limite di disponibilità settimanale · <b>Vorrei assolutamente</b> = settimana prioritaria in cui il medico vorrebbe quei turni</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {settimaneDelMese().map((wk) => {
                              const info = infoSettimana(wk);
                              const dich = capDichiaratoDi(m.id, wk);
                              const july = wk === settimanaCavallo() ? countLuglio((dati.turniPrecedenti || {})[m.id]) : 0;
                              return (
                                <div key={wk} style={{ border: "1px solid #d9e2dd", borderRadius: 6, padding: "5px 7px", background: "#fff", textAlign: "center" }}>
                                  <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 3, whiteSpace: "nowrap" }}>
                                    {info.etichetta} {info.haFestivo && <span style={{ color: "#c17d0f" }} title="settimana con festivo/prefestivo">•</span>}
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                                    <span style={{ fontSize: 9, color: T.textMuted }}>Al massimo</span>
                                    {wk === settimanaCavallo() ? (() => {
                                    // BUG 1/2: box cavallo = solo calcolatore, read-only, mostra l'EFFETTIVO live (dichiarato − turni luglio).
                                    // Il dichiarato si imposta dal campo unico; i turni di luglio si spuntano nel riquadro giallo.
                                    // Feedback visivo: senza tetto ma con turni di fine mese prec. registrati, mostra il conteggio
                                    // (arancio) invece di lasciare il box vuoto — così la spunta non sembra "persa".
                                    const soloJuly = dich == null && july > 0;
                                    const mesePrec = MESI_IT[(mese + 11) % 12].toLowerCase();
                                    return (
                                      <input type="number" value={dich == null ? (july > 0 ? july : "") : Math.max(0, dich - july)} readOnly disabled
                                        title={soloJuly
                                          ? `${july} turn${july === 1 ? "o" : "i"} di ${mesePrec} registrat${july === 1 ? "o" : "i"} (nessun tetto impostato)`
                                          : "Settimana a cavallo: valore calcolato (dichiarato − turni di luglio), non modificabile qui. Il tetto si imposta dal campo unico; i turni di luglio si spuntano nel riquadro giallo."}
                                        style={{ width: 46, padding: "3px 4px", borderRadius: 5, border: "1px solid #e5e9e6", textAlign: "center", background: "#eceff1", color: soloJuly ? "#c17d0f" : "#607d8b", cursor: "not-allowed" }} />
                                    );
                                  })() : (() => {
                                    // BUG 3: tetto max = numero di turni realmente possibili nella settimana (slot N+G, tronche incluse).
                                    const mx = maxTurniSettimana(wk);
                                    return (
                                      <input type="number" min={0} max={mx} step={1} placeholder="—" value={dich ?? ""}
                                        title={`Al massimo — max possibile ${mx} turni in questa settimana`}
                                        onChange={(e) => { const v = e.target.value; setCapSettimanaDi(m.id, wk, v === "" ? "" : String(Math.min(mx, Math.max(0, Number(v) || 0)))); }}
                                        style={{ width: 46, padding: "3px 4px", borderRadius: 5, border: "1px solid #e5e9e6", textAlign: "center" }} />
                                    );
                                  })()}
                                  </div>
                                  {july > 0 && dich != null && <div style={{ fontSize: 9, color: "#c17d0f", marginTop: 2, whiteSpace: "nowrap" }}>{dich} − {july} lug → {Math.max(0, dich - july)}</div>}
                                  {(() => {
                                    // FINESTRA SETTIMANALE (§10 voce 57): campo MINIMO, sotto il tetto (max). Il motore
                                    // sceglie quali giorni tenere tra quelli vinti e distribuisce il resto attorno.
                                    const mn = minDichiaratoDi(m.id, wk);
                                    const mx = maxTurniSettimana(wk);
                                    return (
                                      <div style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}
                                        title="Vorrei assolutamente tot turni in settimana: il motore sceglie quali">
                                        <span style={{ fontSize: 9, color: T.textMuted }}>Vorrei assolutamente</span>
                                        <input type="number" min={0} max={mx} step={1} placeholder="—" value={mn ?? ""}
                                          onChange={(e) => { const v = e.target.value; setMinSettimanaDi(m.id, wk, v === "" ? "" : String(Math.min(mx, Math.max(0, Number(v) || 0)))); }}
                                          style={{ width: 40, padding: "2px 3px", borderRadius: 5, border: `1px solid ${mn != null ? T.primary : "#e5e9e6"}`, textAlign: "center", fontSize: 11 }} />
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ) : null,
                  ])}
                </tbody>
              </table>
              <div style={{ marginTop: 14, padding: 12, border: "1px dashed #1c8066", borderRadius: 8, background: T.primaryTint }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: T.primary }}>+ Aggiungi nuovo medico</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <label style={{ fontSize: 11, color: T.textMuted }}>Cognome<br />
                    <input type="text" value={nuovoMedico.nome} placeholder="es. ROSSI"
                      onChange={(e) => setNuovoMedico((p) => ({ ...p, nome: e.target.value }))}
                      style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #e5e9e6", marginTop: 3, width: 150 }} />
                  </label>
                  <label style={{ fontSize: 11, color: T.textMuted }}>Categoria<br />
                    <select value={nuovoMedico.cat} onChange={(e) => setNuovoMedico((p) => ({ ...p, cat: e.target.value }))}
                      style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #e5e9e6", marginTop: 3 }}>
                      {Object.entries(CAT_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </label>
                  {nuovoMedico.cat !== "SENZA" && (
                    <label style={{ fontSize: 11, color: T.textMuted }}>Titolarità<br />
                      <select value={nuovoMedico.sedeContratto || "Maniago"} onChange={(e) => setNuovoMedico((p) => ({ ...p, sedeContratto: e.target.value }))}
                        title="Sede di titolarità (obbligatoria per ogni contrattualizzato)"
                        style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #e5e9e6", marginTop: 3 }}>
                        {CDC.map((s) => <option key={s} value={s}>{SEDI_BREVI[s]}</option>)}
                      </select>
                    </label>
                  )}
                  <label style={{ fontSize: 11, color: T.textMuted }}>Graduatoria<br />
                    <input type="number" min={0} value={nuovoMedico.grad} placeholder="es. 88"
                      onChange={(e) => setNuovoMedico((p) => ({ ...p, grad: e.target.value }))}
                      style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #e5e9e6", marginTop: 3, width: 80 }} />
                  </label>
                  <button onClick={aggiungiMedico}
                    style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: T.primary, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Aggiungi</button>
                </div>
              </div>
            </div>
          )}

          {tab === "schema" && (
            !dati.schema ? (
              <div style={{ background: "#fff", border: "1px dashed #e5e9e6", borderRadius: 10, padding: 36, textAlign: "center", color: T.textMuted }}>Inserisci le disponibilità e premi <b>Elabora schema</b>.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                <p style={{ fontSize: 12, color: T.textMuted, margin: "0 0 4px" }}>
                  <b>Stesso nome su più sedi = copertura a distanza</b> (nell'export: "*coperto da …").
                </p>
                {/* PANNELLO AVVISI (§10 voce 57): avvisi del motore (finestre settimanali non soddisfatte,
                    titolarità) — visibili in UI dopo l'elaborazione, sopra la griglia, banner collassabile.
                    NON esportati in Excel: sono solo un aiuto a schermo per il coordinatore. */}
                {avvisiUI.length > 0 && (
                  <div style={{ background: "#fff8e6", border: "1px solid #f0d98a", borderRadius: 8, overflow: "hidden" }}>
                    <button onClick={() => setAvvisiAperti((v) => !v)}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px", background: "transparent", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#8a5a00", textAlign: "left" }}>
                      <span>⚠️ Da verificare prima di esportare</span>
                      <span style={{ fontSize: 11, color: "#a07a2a" }}>{avvisiAperti ? "nascondi ▲" : "mostra ▼"}</span>
                    </button>
                    {avvisiAperti && (
                      <ul style={{ listStyle: "none", margin: 0, padding: "0 12px 10px", display: "grid", gap: 5 }}>
                        {avvisiUI.map((a, i) => (
                          <li key={i} style={{ fontSize: 11.5, color: "#5a4a20", lineHeight: 1.35, paddingLeft: 14, position: "relative" }}>
                            <span style={{ position: "absolute", left: 0 }}>•</span>{a}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {/* (c) PROMEMORIA CDC scoperte (§10 voce 89): una sede prioritaria (Maniago/Spilimbergo)
                    vuota mentre c'è un medico fisicamente su una sede minore → azione possibile (spostamento).
                    Tono blu/info, distinto dal banner ambra (che è il fatto: nessuno disponibile lì). */}
                {promemoriaCDC.length > 0 && (
                  <div style={{ background: T.bluTint, border: `1px solid ${T.blu}`, borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ padding: "8px 12px", fontSize: 13, fontWeight: 700, color: T.bluDark }}>↔ Sede prioritaria scoperta con personale altrove — valutare uno spostamento</div>
                    <ul style={{ listStyle: "none", margin: 0, padding: "0 12px 10px", display: "grid", gap: 5 }}>
                      {promemoriaCDC.map((p, i) => (
                        <li key={i} style={{ fontSize: 11.5, color: T.bluDark, lineHeight: 1.35, paddingLeft: 14, position: "relative" }}>
                          <span style={{ position: "absolute", left: 0 }}>•</span>Giorno {p.giorno} · {p.turno} — CDC scoperta: <b>{p.cdc}</b>. Presenti: {p.presenti.join(", ")}.
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {dati.schema.map((g, gi) => (
                  <div key={gi} style={{ background: "#fff", border: "1px solid #e5e9e6", borderRadius: 8, padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{g.giorno}</span>
                      <span style={{ fontSize: 10, color: T.textFaint }}>{GIORNI_IT[g.dow]}</span>
                      {g.festivo && <span style={{ fontSize: 9, background: "#fbe0d5", color: "#a04010", padding: "2px 7px", borderRadius: 10, fontWeight: 700 }}>{g.festivo}</span>}
                      {g.prefestivo && <span style={{ fontSize: 9, background: "#fdf0d5", color: "#8a5a00", padding: "2px 7px", borderRadius: 10, fontWeight: 700 }}>PREFESTIVO</span>}
                    </div>
                    {g.turni.map((t, ti) => {
                      // SOLO RENDER (nessun calcolo del motore): il motore ha già prodotto t.slots/t.fis.
                      const isExtra = !!t.extra;
                      const isNotte = t.id === "N"; // di notte Claut/Anduins NON sono fisiche (motore, riga 491)
                      // Un MMG (extra) ha la stessa struttura di sedi di un notturno: Maniago/Spilimbergo/
                      // Meduno fisiche, Claut/Anduins solo a distanza (§10 voce 55) → si rende come il notturno.
                      const treFisiche = isNotte || isExtra;
                      const slotKeyT = `${g.key}|${t.id}`;
                      // "qualcuno l'ha dichiarata a distanza (blu)?" — solo lettura dispo, per distinguere
                      // "dichiarata ma scoperta" da "nessuno l'ha dichiarata".
                      const dichiarataBlu = (sedeNome) => MEDICI.some((m) => normDispo(dati.dispo[m.id]?.[slotKeyT]).blu.includes(sedeNome));
                      // Sedi DA COPRIRE: notturno/MMG → Maniago/Spilimbergo/Meduno (+ Claut/Anduins solo se
                      // dichiarate a distanza); diurno → tutte e 5.
                      let daCoprire = [];
                      if (treFisiche) { daCoprire = [0, 1, 2]; [3, 4].forEach((si) => { if (dichiarataBlu(SEDI5[si])) daCoprire.push(si); }); }
                      else daCoprire = [0, 1, 2, 3, 4];
                      const scoperte = daCoprire.filter((si) => !t.slots[si]);
                      const grave = scoperte.some((si) => si === 0 || si === 1); // Maniago/Spilimbergo mancanti = rosso
                      const bordoSede = (si) => scoperte.includes(si) ? (si === 0 || si === 1 ? T.danger : T.warning) : null;
                      return (
                        <div key={ti} style={{ display: "flex", gap: 6, alignItems: "flex-start", padding: "4px 0", borderTop: ti > 0 ? "1px solid #eef1ee" : "none", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, minWidth: 140, color: T.text, paddingTop: 4 }}>{t.label}</span>
                          {scoperte.length > 0 && (
                            <span style={{ background: grave ? T.dangerBg : T.warningBg, color: grave ? T.danger : T.warning, border: `1px solid ${grave ? T.dangerBorder : T.warningBorder}`, fontWeight: 700, fontSize: 10, letterSpacing: .2, padding: "2px 8px", borderRadius: 999 }}>Scoperto: {scoperte.map((si) => SEDI5[si]).join(", ")}</span>
                          )}
                          {SEDI5.map((sede, si) => {
                            // NOTTURNO/MMG: Claut/Anduins non hanno tendina fisica — mostra lo stato a distanza.
                            if (treFisiche && (si === 3 || si === 4)) {
                              const mid = t.slots[si];
                              if (mid) {
                                const prim = t.fis.find((fi) => t.slots[fi] === mid); // sede fisica di chi copre
                                return (
                                  <span key={si} style={{ display: "inline-flex", flexDirection: "column", gap: 1, background: T.bluTint, border: `1px solid ${T.blu}`, borderRadius: 5, padding: "3px 6px", fontSize: 11 }}>
                                    <span style={{ color: T.bluDark, fontWeight: 700 }}><b style={{ fontSize: 10 }}>{sede}</b> ← {byId[mid].nome}</span>
                                    <span style={{ color: T.bluDark, fontSize: 9 }}>a distanza da {prim !== undefined ? SEDI5[prim] : "?"}</span>
                                  </span>
                                );
                              }
                              if (dichiarataBlu(sede)) {
                                return (
                                  <span key={si} style={{ display: "inline-flex", flexDirection: "column", gap: 1, background: "#fff", border: `1px solid ${T.warning}`, borderRadius: 5, padding: "3px 6px", fontSize: 11 }}>
                                    <span style={{ color: T.warning, fontWeight: 700 }}><b style={{ fontSize: 10 }}>{sede}</b> a distanza —</span>
                                  </span>
                                );
                              }
                              return (
                                <span key={si} style={{ display: "inline-flex", flexDirection: "column", gap: 1, background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 5, padding: "3px 6px", fontSize: 11, opacity: .75 }}>
                                  <span style={{ color: T.textFaint }}><b style={{ fontSize: 10 }}>{sede}</b> solo diurno</span>
                                </span>
                              );
                            }
                            const nota = notaSlot(t.slots, si, t.fis);
                            const bd = bordoSede(si);
                            return (
                              <span key={si} style={{ display: "inline-flex", flexDirection: "column", gap: 1, background: nota.tipo === "copertura" ? "#eef3ea" : T.divider, border: bd ? `1px solid ${bd}` : "1px solid transparent", borderRadius: 5, padding: "3px 6px", fontSize: 11 }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <b style={{ fontSize: 10 }}>{sede}</b>
                                  <select value={t.slots[si] || ""} onChange={(e) => setSlot(gi, ti, si, e.target.value)} style={{ fontSize: 11, border: "1px solid #d3dad6", borderRadius: 4, padding: "1px 2px", maxWidth: 110 }}>
                                    <option value="">—</option>
                                    {MEDICI.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                                  </select>
                                </span>
                                {nota.testo && <span style={{ color: T.textMuted, fontSize: 9 }}>{nota.testo}</span>}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {aiOpen && (
          <div style={{ width: 480, borderLeft: "1px solid #e5e9e6", background: "#fff", display: "flex", flexDirection: "column", height: "calc(100vh - 110px)", position: "sticky", top: 0 }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #eef1ee", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Assistente AI <span style={{ fontWeight: 400, color: T.textFaint }}>— risponde solo se interpellata</span></div>
              <button onClick={nuovaConversazione} disabled={aiBusy} title="Svuota la chat e il registro delle azioni già eseguite" style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e9e6", background: "#fff", cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" }}>Nuova conversazione</button>
            </div>
            <div style={{ padding: "8px 14px", borderBottom: `1px solid ${T.divider}`, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.textFaint, whiteSpace: "nowrap", letterSpacing: ".02em" }}>Modello AI</span>
              <div style={{ display: "flex", flex: 1, gap: 4, background: T.surfaceAlt, borderRadius: 8, padding: 3 }}>
                {["sonnet", "opus"].map((k) => {
                  const m = MODELLI_AI[k], attivo = aiModel === k;
                  return (
                    <button key={k} onClick={() => cambiaModello(k)} disabled={aiBusy} title={aiBusy ? "Attendi la fine della risposta per cambiare modello" : `${m.nome} — ${m.desc}`}
                      style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "none", textAlign: "left", cursor: aiBusy ? "default" : "pointer",
                        background: attivo ? T.surface : "transparent", boxShadow: attivo ? "0 1px 2px rgba(20,102,79,.12)" : "none",
                        opacity: aiBusy && !attivo ? 0.45 : 1, transition: "background .12s" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: attivo ? T.primary : T.textMuted, lineHeight: 1.25 }}>{m.nome}</div>
                      <div style={{ fontSize: 10, color: T.textFaint, lineHeight: 1.2 }}>{m.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ padding: "8px 14px", borderBottom: `1px solid ${T.divider}`, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.textFaint, whiteSpace: "nowrap", letterSpacing: ".02em" }}>Effort</span>
              <div style={{ display: "flex", flex: 1, gap: 4, background: T.surfaceAlt, borderRadius: 8, padding: 3 }}>
                {["low", "medium", "high"].map((k) => {
                  const e = EFFORT_AI[k], attivo = aiEffort === k;
                  return (
                    <button key={k} onClick={() => cambiaEffort(k)} disabled={aiBusy} title={aiBusy ? "Attendi la fine della risposta per cambiare effort" : `${e.nome} — ${e.desc}`}
                      style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "none", textAlign: "left", cursor: aiBusy ? "default" : "pointer",
                        background: attivo ? T.surface : "transparent", boxShadow: attivo ? "0 1px 2px rgba(20,102,79,.12)" : "none",
                        opacity: aiBusy && !attivo ? 0.45 : 1, transition: "background .12s" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: attivo ? T.primary : T.textMuted, lineHeight: 1.25 }}>{e.nome}</div>
                      <div style={{ fontSize: 10, color: T.textFaint, lineHeight: 1.2 }}>{e.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 12, display: "grid", gap: 8, alignContent: "start" }}>
              {aiMsgs.length === 0 && <div style={{ fontSize: 12, color: T.textFaint }}>Chiedimi es.: "ci sono turni scoperti?", "chi lavora a Ferragosto?", "riassumi lo schema".</div>}
              {aiMsgs.map((m, i) => (
                <div key={i} style={{ background: m.role === "user" ? T.primaryDark : T.surfaceAlt, color: m.role === "user" ? "#fff" : T.text, borderRadius: 8, padding: "8px 10px", fontSize: 12, whiteSpace: "pre-wrap", justifySelf: m.role === "user" ? "end" : "start", maxWidth: "90%" }}>{m.content}</div>
              ))}
              {aiBusy && <div style={{ fontSize: 12, color: T.textFaint }}>Sto ragionando…</div>}
              {avvisi.map((a, i) => {
                const rosso = a.livello !== "info";
                return (
                  <div key={"avv" + i} style={{ border: `2px solid ${rosso ? "#c0392b" : "#1c6fa8"}`, background: rosso ? "#fdecea" : "#eaf3fb", borderRadius: 10, padding: "8px 10px", fontSize: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 14, lineHeight: 1.25 }}>{rosso ? "🔴" : "ℹ️"}</span>
                    <span style={{ color: T.text }}>{a.testo}</span>
                  </div>
                );
              })}
              {proposta && (
                <div style={{ border: "2px solid #8a5a00", background: "#fdf3dd", borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Sto per applicare:</div>
                  <div style={{ fontSize: 12, marginBottom: 6 }}>{proposta.spiegazione}</div>
                  <ul style={{ margin: "0 0 8px", paddingLeft: 16, fontSize: 11 }}>
                    {proposta.azioni.map((a, i) => {
                      let d = "";
                      if (a.az === "schema") d = `Schema: giorno ${a.giorno} · ${a.turno} · ${a.sede} → ${a.medico || "— (svuota)"}`;
                      else if (a.az === "dispo_aggiungi") d = `Disponibilità: ${a.medico} · giorno ${a.giorno} · ${a.turno} → ${(a.sedi || []).map((s) => SEDI_BREVI[s] || s).join(", ")}${(a.blu || []).length ? ` (+ blu: ${a.blu.map((s) => SEDI_BREVI[s] || s).join(", ")})` : ""}`;
                      else if (a.az === "dispo_set") d = `Disponibilità ${etichettaAmbito(a.ambito)}${a.turni && a.turni.length ? ` (${a.turni.join("+")})` : ""}${a.escludi && a.escludi.length ? `, escl. ${a.escludi.join(",")}` : ""}: ${a.medico} → ${(a.sedi || []).map((s) => SEDI_BREVI[s] || s).join(", ")}${(a.blu || []).length ? ` (+ blu: ${a.blu.map((s) => SEDI_BREVI[s] || s).join(", ")})` : ""}`;
                      else if (a.az === "azzera_medico") d = `Azzera e reinserisci: ${a.medico} — cancella TUTTE le disponibilità del mese (+ tetti settimanali, preferenze turno, tetto mensile); restano recupero ore e turni extra`;
                      else if (a.az === "dispo_no") d = `Segna NON disponibile: ${a.medico} · giorno ${a.giorno} · ${a.turno}`;
                      else if (a.az === "dispo_togli") d = `Togli disponibilità: ${a.medico} · giorno ${a.giorno} · ${a.turno}`;
                      else if (a.az === "mmg") d = `MMG: giorno ${a.giorno} · ${a.fascia === "P" ? "pomeriggio" : "mattina"} → ${a.attivo === false ? "disattiva" : "attiva"}`;
                      else if (a.az === "ore_extra") d = `Ore da recuperare: ${a.medico} → ${a.ore}h`;
                      else if (a.az === "turni_extra") d = `Turni extra volontari: ${a.medico} → ${a.turni} turn${a.turni === 1 ? "o" : "i"} (${(a.turni || 0) * 12}h)`;
                      else if (a.az === "tetto_settimana") d = `Tetto settimanale: ${a.medico} → ${(a.maxTurni === null || a.maxTurni === undefined) ? "nessun limite" : a.maxTurni + " turni/settimana"} (settimana del giorno ${a.giorno})`;
                      else if (a.az === "tetto_mese") d = `Max turni mese: ${a.medico} → ${(a.maxTurni === null || a.maxTurni === undefined) ? "nessun limite" : a.maxTurni + " turni/mese"}`;
                      else if (a.az === "turno_pref") d = `Preferenza turno: ${a.medico} · giorno ${a.giorno} → ${(a.turno === "G" || a.turno === "N") ? `preferisce il ${a.turno === "G" ? "diurno" : "notturno"} se vince entrambi` : "rimuovi preferenza"}`;
                      else if (a.az === "slot_obbligatorio") d = `📌 Slot obbligatorio: ${a.medico} · giorno ${a.giorno} · ${a.turno === "G" ? "diurno" : "notturno"}${a.sede ? ` ⚓ solo se ottiene ${SEDI_BREVI[a.sede] || a.sede}` : ""} → ${a.presente === false ? "rimuovi" : "lo vuole tenere se lo vince (punto fisso della distribuzione)"}`;
                      else if (a.az === "finestra_settimanale") d = `📐 Finestra settimanale: ${a.medico} → ${(a.presente === false || !(Number(a.minTurni) > 0)) ? "rimuovi minimo" : `almeno ${a.minTurni} turni`} (settimana del giorno ${a.giorno})`;
                      else if (a.az === "turno_precedente") d = `Turno di luglio (settimana a cavallo): ${a.medico} · ${a.giorno} lug${(a.turno === "G" || a.turno === "N") ? ` · ${a.turno === "G" ? "diurno" : "notturno"}` : ""} → ${a.presente === false ? "TOGLI" : "registra come già fatto"}`;
                      else if (a.az === "elabora") d = "Elabora lo schema del mese con le regole ufficiali";
                      else d = JSON.stringify(a);
                      return <li key={i}>{d}</li>;
                    })}
                  </ul>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={applicaProposta} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "none", background: T.primary, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Conferma</button>
                    <button onClick={rifiutaProposta} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "1px solid #e5e9e6", background: "#fff", cursor: "pointer", fontSize: 12 }}>Annulla</button>
                  </div>
                </div>
              )}
              {domande.map((d, i) => {
                const giornoSett = d.giorno ? ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"][new Date(anno, mese, d.giorno).getDay()] : "";
                const contesto = d.citazione ? `ha scritto "${d.citazione}"` : (d.situazione || "");
                return (
                  <div key={i} style={{ border: `2px solid ${d._pinGuard ? "#8a5a00" : "#1c8066"}`, background: d._pinGuard ? "#fdf3dd" : T.primaryTint, borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 12, marginBottom: 6 }}>
                      {d._pinGuard ? "📌" : "❓"} {d.medico ? `${d.medico} ` : ""}{d.giorno ? `${d.giorno} ${MESI_IT[mese].toLowerCase()}${giornoSett ? ` (${giornoSett})` : ""}` : ""}{(d.medico || d.giorno) ? ": " : ""}{contesto}{contesto && d.domanda ? " — " : ""}{d.domanda}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => rispondiDomanda(i, "si")} disabled={aiBusy} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "none", background: T.primary, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Sì</button>
                      <button onClick={() => rispondiDomanda(i, "no")} disabled={aiBusy} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "1px solid #e5e9e6", background: "#fff", cursor: "pointer", fontSize: 12 }}>No</button>
                    </div>
                  </div>
                );
              })}
              {!proposta && !domande.length && azioniRestanti && (
                <button onClick={() => chiediAI(troncato ? `[la tua risposta precedente è stata troncata per lunghezza, non è stata applicata alcuna modifica] ${ultimaDomandaRef.current}` : "continua")} disabled={aiBusy}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "2px solid #1c8066", background: T.primaryTint, color: T.primary, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                  Continua →
                </button>
              )}
              {!proposta && !domande.length && completato && (
                <div style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #1c8066", background: T.primaryTint, color: T.primary, fontWeight: 700, fontSize: 12, textAlign: "center" }}>
                  Completato ✓
                </div>
              )}
            </div>
            <div style={{ padding: 10, borderTop: "1px solid #eef1ee", display: "flex", gap: 6 }}>
              <input value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && chiediAI()} placeholder="Scrivi qui…" style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid #e5e9e6", fontSize: 12 }} />
              <button onClick={() => chiediAI()} disabled={aiBusy} style={{ ...btn, background: T.primary, color: "#fff", border: "none", fontWeight: 600 }}>Invia</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
