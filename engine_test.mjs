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
// Param opzionale `sedeTit` (titolarità del medico): a parità di livello la titolarità rompe il
// pareggio (la sua sede prima delle altre pari). Usato SOLO dal target del singolo medico
// (nFisici===1): lì mandarlo alla sua sede è gratis (nessuno da spostare). NON si passa nella FASE 1
// competitiva: a più medici la ricollocazione per titolarità sistema già gli incroci, e forzare la
// titolarità toglierebbe al motore la libertà di spostare gli indifferenti per massimizzare la
// copertura (§10: il caso IENGO). Senza sedeTit → comportamento identico a prima.
const ordinaPerLivello = (sedi, liv, maxLivello, sedeTit) => {
  const out = [];
  for (let l = 1; l <= maxLivello; l++) {
    if (sedeTit && sedi.includes(sedeTit) && (liv[sedeTit] || 1) === l) out.push(sedeTit);
    SEDI5.forEach((s) => { if (s !== sedeTit && sedi.includes(s) && (liv[s] || 1) === l) out.push(s); });
  }
  return out;
};
const MAX_LIV_VERDE = 5, MAX_LIV_BLU = 4;

// Differenza in giorni interi tra due date "YYYY-MM-DD" (b - a). NB: la regola di spaziatura
// temporale §3.7 (l'unica che la chiamava nel motore) è stata RIMOSSA (CONTEXT.md §10 voce 10,
// 5 luglio 2026). NON è codice morto: resta esportata e usata da test_spaziatura_settimana.mjs
// (tetto settimanale §3.8) — non rimuoverla o quel test si rompe. Confronta SEMPRE date di calendario.
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
function risolviBlu(fisMids, sedeFisicaDi, slotKey, dispo, debiti, debitiExtra, sitiChiusi) {
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
      if (sitiChiusi && sitiChiusi.has(si)) continue; // sede CHIUSA (Claut/Anduins nei notturni con diurno, §10 voce 96): servizio non attivo, nemmeno a distanza
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
function elaboraTurno(d, turno, slotKey, dispo, debiti, debitiExtra, settimanaCount, esente, haDiurno) {
  // CHIUSURA ASFO (§10 voce 96): nei notturni/MMG dei giorni che hanno ANCHE il diurno (sab/dom/festivi/
  // prefestivi → haDiurno) Claut e Anduins sono CHIUSE: servizio non attivo, nemmeno a distanza (di giorno
  // hanno già avuto il loro servizio fisico). È l'UNICA modifica: chiude i loro slot in FASE 2 (risolviBlu).
  // NON tocca il fisico (FASE 1 gira prima e non le vede mai fisiche di notte), né debiti/conteggi (la
  // copertura a distanza non li consuma) → misurato: 0 diff fisici su 260.000 turni. Nei feriali (no diurno)
  // la copertura a distanza resta valida com'era. Stesso predicato del display (esistenza del turno "G").
  const sitiChiusi = (haDiurno && turno.id !== "G") ? new Set([3, 4]) : null;
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
    // (il target è il prefisso di quest'ordine). Con 1 solo medico il target è la sua CDC preferita
    // (Maniago/Spilimbergo), MAI Meduno — catena di priorità ASFO (non forzato su Maniago). Claut e
    // Anduins non sono mai contemporaneamente fisiche e a distanza: sitiCoperti (FASE 2) deriva
    // dalle sole sedi effettivamente fisiche, quindi la distanza copre solo ciò che resta scoperto —
    // niente doppione, senza toccare la FASE 2.
    // Sedi fisiche del turno. Un MMG (extra) compete su TUTTE le sedi esattamente come un turno
    // ordinario: la sede la decide il motore in base alle disponibilità dei medici (verde), non il
    // coordinatore (§10 voce 55). Maniago/Spilimbergo/Meduno fisiche sempre; Claut/Anduins fisiche solo
    // nel diurno G (di notte e nell'anticipo MMG sono coperte solo a distanza, FASE 2). Con 1 solo
    // medico il target è la sua CDC preferita (Maniago/Spilimbergo), mai una sede sotto.
    const sediFisiche = turno.id === "G" ? [0, 1, 2, 3, 4] : [0, 1, 2];
    const nFisici = Math.min(ordinati.length, sediFisiche.length);
    let target = [];
    if (nFisici === 1) {
      const v = normDispo(dispo[ordinati[0].id]?.[slotKey]);
      // Catena di priorità ASFO (§10): con 1 solo medico il target è la sua CDC preferita
      // (Maniago/Spilimbergo) — MAI Meduno/Claut/Anduins. Se non ha dichiarato verde nessuna CDC,
      // target vuoto → non lavora (una casa di comunità viene prima di una sede periferica).
      // A parità di livello fra le due CDC, la TITOLARITÀ rompe il pareggio (§10): l'indifferente
      // va nella SUA sede — qui è gratis (è solo, nessuno da spostare). `sedeTit` passato apposta.
      const top = ordinaPerLivello(v.verde, v.verdeLiv, MAX_LIV_VERDE, byId[ordinati[0].id].sedeContratto).find((sd) => [0, 1].includes(SEDI5.indexOf(sd)));
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
    // ---- Catena di priorità di copertura (regola aziendale ASFO, §10) ----
    // Una sede si apre SOLO se tutte quelle sopra di lei hanno un medico FISICAMENTE presente (fis,
    // non la copertura a distanza: una CDC presidiata solo al telefono è "spenta"). Livelli:
    // L0 = {Maniago, Spilimbergo} (le due CDC, pari), L1 = {Meduno}, L2 = {Claut, Anduins}. Meduno
    // non regge con una CDC scoperta; Claut/Anduins non reggono con MA/SP/ME scoperte. Alla prima
    // scoperta dall'alto si svuotano tutte le sedi sotto; i medici liberati restano IDLE. Va DOPO lo
    // step voce-32 e PRIMA di scalaDebito: rimuovendoli da sedeDi qui, il loro debito NON viene
    // consumato (idle vero, come i medici in eccesso della voce 30). INV1 resta sacro: nessuno viene
    // forzato altrove — semplicemente non lavora se sopra di lui manca qualcuno.
    {
      const cdcOk = slots[0] !== null && slots[1] !== null;
      const meOk = slots[2] !== null;
      const svuota = !cdcOk ? [2, 3, 4] : (!meOk ? [3, 4] : []);
      svuota.forEach((si) => { const mid = slots[si]; if (mid !== null && mid !== undefined) { delete sedeDi[mid]; slots[si] = null; } });
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
    const sedeBluDi = risolviBlu(fisMids, sedeDi, slotKey, dispo, debiti, debitiExtra, sitiChiusi);
    Object.entries(sedeBluDi).forEach(([siStr, mid]) => { slots[Number(siStr)] = mid; });

    // AVVISO: qualunque sede (fisica o a distanza) resti scoperta per mancanza di dichiarazione — per
    // gli MMG identico agli ordinari (l'MMG compete su tutte le sedi in base alle disponibilità).
    {
      const scoperte = [0, 1, 2, 3, 4].filter((si) => slots[si] === null && !(sitiChiusi && sitiChiusi.has(si))); // le sedi CHIUSE (voce 96) non sono "scoperte": non entrano nell'avviso
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
  const haDiurnoDi = {}; // info.key → il giorno ha il turno diurno "G" (voce 96): predicato di chiusura Claut/Anduins
  for (let d = 1; d <= nGiorni; d++) {
    const info = turniDelGiorno(anno, mese, d, extras);
    const haDiurno = info.turni.some((t) => t.id === "G");
    haDiurnoDi[info.key] = haDiurno;
    info.turni.forEach((turno) => voci.push({ d, turno, slotKey: `${info.key}|${turno.id}`, haDiurno }));
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
    ordineVoci.forEach(({ d, turno, slotKey, haDiurno }) => {
      let dispoEff = dispo;
      const esclusi = escludiPerSlot && escludiPerSlot(slotKey);
      if (esclusi && esclusi.size) {
        dispoEff = { ...dispo };
        esclusi.forEach((mid) => {
          dispoEff[mid] = { ...dispoEff[mid], [slotKey]: { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: true } };
        });
      }
      const { turnoOut, avviso } = elaboraTurno(d, turno, slotKey, dispoEff, debiti, debitiExtra, settimanaCount, esente, haDiurno);
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
      const sitiChiusiRic = (haDiurnoDi[dataStr] && out.id !== "G") ? new Set([3, 4]) : null; // dopo lo scambio, Claut/Anduins restano chiuse sui notturni con diurno (voce 96)
      const sedeBluDi = risolviBlu(fisMids, sedeFisicaOut, skRic, dispo, debiti, debitiExtra, sitiChiusiRic);
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


export { MEDICI, MEDICI_DEFAULT, setMediciGlobal, byId, CAT_INFO, SEDI5, SEDI_BREVI, CDC, dk, mk, turniDelGiorno, espandiAmbito, diurniNascosti, costruisciEntryDispo, elaboraSchema, normDispo, ordinaPerLivello, MAX_LIV_VERDE, MAX_LIV_BLU, isDeterminato, isContrattualizzato, MESI_DISPONIBILI, MESI_IT, giorniTra, settimanaDi, capSettimanale, debitoOrdinarioIniziale, tettoDistribuzioneDi, statoRealeMedico, azzeraDispoMedico, scegliConRiferimento, scegliIndiciEquidistanti, notaSlot, GIORNI_IT, MESI_BREVI };
