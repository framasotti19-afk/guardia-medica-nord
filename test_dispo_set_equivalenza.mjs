// Test di EQUIVALENZA dell'azione dispo_set (passo 2): una singola dispo_set su un "ambito" deve
// produrre ESATTAMENTE la stessa dispo di N dispo_aggiungi per-giorno equivalenti (stesse sedi/livelli/
// preferito su ogni {giorno,turno} coperto dall'ambito). Verifica il refactor costruisciEntryDispo
// (chiamato UNA volta da dispo_set vs una volta per slot da dispo_aggiungi) e il wiring del ciclo slot.
//
// Le due funzioni pure del motore (costruisciEntryDispo, espandiAmbito) sono la stessa fonte di verità
// usata dal componente in applicaAzioni: qui replichiamo i DUE rami di applicazione esattamente come
// in turni-guardia-medica.jsx e ne confrontiamo l'output.
import { espandiAmbito, costruisciEntryDispo, dk } from "./engine_test.mjs";
import { makeSuite, GIORNI_FERIALI_SEMPLICI } from "./test_utils.mjs";

const s = makeSuite("dispo_set ≡ N dispo_aggiungi per-giorno (equivalenza motore)");
const J = (x) => JSON.stringify(x);
const slotKey = (anno, mese, g, t) => `${dk(anno, mese, g)}|${t}`;

// --- RAMO A: dispo_set (come in applicaAzioni, blocco a.az === "dispo_set") ---
// costruisce l'entry UNA volta e la replica (copia indipendente) su ogni slot dell'ambito.
function applicaDispoSet(a, anno, mese, extras) {
  const { entry, errori } = costruisciEntryDispo(a, "X");
  const nd = {};
  if (!entry) return { nd, errori };
  const slots = espandiAmbito(a.ambito, a.turni, a.escludi || [], anno, mese, extras);
  slots.forEach(({ giorno, turno }) => {
    nd[slotKey(anno, mese, giorno, turno)] = { verde: [...entry.verde], verdeLiv: { ...entry.verdeLiv }, blu: [...entry.blu], bluLiv: { ...entry.bluLiv }, no: false, preferito: entry.preferito };
  });
  return { nd, errori };
}

// --- RAMO B: N dispo_aggiungi, una per ogni {giorno,turno}, con le stesse sedi (come blocco dispo_aggiungi) ---
// Usa la LISTA di slot passata: se `slotsIndip` è fornita, è calcolata in modo INDIPENDENTE (senza
// espandiAmbito) per non fidarsi della funzione sotto test; altrimenti deriva da espandiAmbito.
function applicaDispoAggiungiLista(a, anno, mese, extras, slotsIndip) {
  const slots = slotsIndip || espandiAmbito(a.ambito, a.turni, a.escludi || [], anno, mese, extras);
  const nd = {};
  for (const { giorno, turno } of slots) {
    const aAgg = { sedi: a.sedi, blu: a.blu, preferito: a.preferito, sedi_liv: a.sedi_liv, blu_liv: a.blu_liv };
    const { entry } = costruisciEntryDispo(aAgg, `X g${giorno}`); // come dispo_aggiungi: una entry per slot
    if (entry) nd[slotKey(anno, mese, giorno, turno)] = entry;
  }
  return { nd };
}

// Set di sedi/livelli/preferito variegati da provare su ogni ambito
const SPEC = [
  { sedi: ["Maniago"] },
  { sedi: ["Maniago", "Spilimbergo"], preferito: "Maniago" },
  { sedi: ["Maniago"], blu: ["Claut"] },
  { sedi: ["Spilimbergo", "Meduno"], blu: ["Anduins"], sedi_liv: { Spilimbergo: 2, Meduno: 3 }, blu_liv: { Anduins: 4 }, preferito: "Meduno" },
  { blu: ["Claut", "Anduins"] }, // solo blu, nessun verde
  { sedi: ["Maniago"], preferito: "Spilimbergo" }, // preferito NON tra le verdi → ignorato (entry uguale in A e B)
];
const AMBITI = [
  { ambito: "feriali", turni: ["N"] },
  { ambito: "feriali", turni: ["G", "N"] },
  { ambito: "weekend", turni: ["N"] },
  { ambito: "weekend", turni: ["G", "N"] },
  { ambito: "mese", turni: ["N"] },
  { ambito: "mese", turni: ["G", "N"] },
  { ambito: { da: 3, a: 12 }, turni: ["N"] },
  { ambito: { da: 3, a: 12 }, turni: ["G", "N"] },
  { ambito: "feriali", turni: ["N"], escludi: [4, 5, 20] },
  { ambito: "mese", turni: ["G", "N"], escludi: [1, 15, 31] },
];
// Mesi-trappola (stessi del test di espansione): agosto/dicembre/aprile/settembre 2026
const MESI = [[2026, 7], [2026, 11], [2026, 3], [2026, 8]];

for (const [anno, mese] of MESI) {
  for (const amb of AMBITI) {
    for (const spec of SPEC) {
      const a = { az: "dispo_set", medico: "X", ...amb, ...spec };
      s.test(`${anno}-${mese + 1} ${J(amb.ambito)} t=${J(amb.turni)}${amb.escludi ? " x" + J(amb.escludi) : ""} sedi=${J(spec.sedi || [])}${spec.blu ? " blu=" + J(spec.blu) : ""}${spec.preferito ? " pref=" + spec.preferito : ""}`, () => {
        const A = applicaDispoSet(a, anno, mese, {});
        const B = applicaDispoAggiungiLista(a, anno, mese, {});
        s.eq(J(A.nd), J(B.nd), "dispo_set ≠ N dispo_aggiungi");
      });
    }
  }
}

// --- Verifica con lista di giorni INDIPENDENTE (non da espandiAmbito): chiude il cerchio con
//     test_espansione_ambito, provando che dispo_set copre ESATTAMENTE i giorni giusti. ---
s.test("agosto: dispo_set feriali/N ≡ dispo_aggiungi sui GIORNI_FERIALI_SEMPLICI (lista hardcodata)", () => {
  const a = { az: "dispo_set", medico: "X", ambito: "feriali", turni: ["N"], sedi: ["Maniago"], blu: ["Claut"], preferito: "Maniago" };
  const A = applicaDispoSet(a, 2026, 7, {});
  const slotsIndip = GIORNI_FERIALI_SEMPLICI.map((g) => ({ giorno: g, turno: "N" }));
  const B = applicaDispoAggiungiLista(a, 2026, 7, {}, slotsIndip);
  s.eq(J(A.nd), J(B.nd), "feriali/N non copre esattamente i feriali semplici di agosto");
  s.eq(Object.keys(A.nd).length, GIORNI_FERIALI_SEMPLICI.length, "numero di slot diverso dai feriali semplici");
});
s.test("settembre: dispo_set {da:10,a:14}/N ≡ dispo_aggiungi su 10,11,12,13,14 (lista hardcodata, mese pulito)", () => {
  const a = { az: "dispo_set", medico: "X", ambito: { da: 10, a: 14 }, turni: ["N"], sedi: ["Meduno"] };
  const A = applicaDispoSet(a, 2026, 8, {});
  const slotsIndip = [10, 11, 12, 13, 14].map((g) => ({ giorno: g, turno: "N" }));
  const B = applicaDispoAggiungiLista(a, 2026, 8, {}, slotsIndip);
  s.eq(J(A.nd), J(B.nd), "intervallo 10..14/N non copre esattamente quei 5 giorni");
});

// --- Contenuto dell'entry: livelli, preferito e blu finiscono corretti negli slot ---
s.test("contenuto entry: sedi_liv/blu_liv/preferito riportati su ogni slot", () => {
  const a = { az: "dispo_set", medico: "X", ambito: { da: 3, a: 3 }, turni: ["N"], sedi: ["Spilimbergo", "Meduno"], blu: ["Anduins"], sedi_liv: { Spilimbergo: 2, Meduno: 3 }, blu_liv: { Anduins: 4 }, preferito: "Meduno" };
  const { nd } = applicaDispoSet(a, 2026, 8, {}); // 3 settembre feriale → un solo slot N
  const only = nd[slotKey(2026, 8, 3, "N")];
  s.assert(!!only, "slot g3 N mancante");
  s.eq(J(only), J({ verde: ["Spilimbergo", "Meduno"], verdeLiv: { Spilimbergo: 2, Meduno: 3 }, blu: ["Anduins"], bluLiv: { Anduins: 4 }, no: false, preferito: "Meduno" }), "entry non corrisponde alla spec");
});

// --- Sedi non valide: entry=null, errore, nessuno slot scritto (come dispo_aggiungi che salta) ---
s.test("sedi non valide: nessuno slot scritto + errore, come dispo_aggiungi", () => {
  const a = { az: "dispo_set", medico: "X", ambito: "mese", turni: ["N"], sedi: ["Sedeinesistente"], blu: [] };
  const { nd, errori } = applicaDispoSet(a, 2026, 8, {});
  s.eq(Object.keys(nd).length, 0, "ha scritto slot pur senza sedi valide");
  s.assert(errori.some((e) => e.includes("sedi non valide")), "manca l'errore 'sedi non valide'");
});

// --- Copie indipendenti per slot: mutare un giorno NON tocca gli altri (niente aliasing) ---
s.test("no aliasing: gli slot sono copie indipendenti", () => {
  const a = { az: "dispo_set", medico: "X", ambito: "weekend", turni: ["G", "N"], sedi: ["Maniago", "Spilimbergo"], preferito: "Maniago" };
  const { nd } = applicaDispoSet(a, 2026, 7, {});
  const keys = Object.keys(nd);
  s.assert(keys.length >= 2, "servono almeno 2 slot per il test di aliasing");
  nd[keys[0]].verde.push("HACK");
  nd[keys[0]].verdeLiv.HACK = 9;
  s.assert(!nd[keys[1]].verde.includes("HACK"), "mutazione di un array verde ha toccato un altro slot (aliasing)");
  s.assert(nd[keys[1]].verdeLiv.HACK === undefined, "mutazione di verdeLiv ha toccato un altro slot (aliasing)");
});

s.finish();
