// Test di scegliConRiferimento (§10 voce 54): la selezione dei turni da tenere in eccesso al tetto
// (§3.11) quando ci sono giorni FISSI (obbligatori/MMG/cavallo/livelli migliori) MINIMIZZA IL GAP
// MASSIMO tra giorni consecutivi dell'insieme completo (pin + scelti), code ai bordi dello span
// incluse — cioè la distribuzione più uniforme possibile, nessun buco lungo. Confronto con la
// verità (brute force) su tanti casi + le proprietà invarianti (conteggio, casi base, determinismo).
import { scegliConRiferimento, scegliIndiciEquidistanti } from "./engine_test.mjs";
import { makeSuite } from "./test_utils.mjs";

const s = makeSuite("scegliConRiferimento — min gap massimo (voce 54)");
const mk = (giorni) => giorni.map((g) => ({ slotKey: "N" + g, giorno: g }));
const giorniDi = (slotKeys) => slotKeys.map((k) => Number(k.slice(1))).sort((a, b) => a - b);

// gap massimo dell'insieme (pin + scelti), con code allo span [L,R] = min/max di (candidati ∪ pin)
const maxGapTail = (candDays, chosen, fissi) => {
  const L = Math.min(...candDays, ...fissi), R = Math.max(...candDays, ...fissi);
  const all = [...fissi, ...chosen].sort((a, b) => a - b);
  let mx = all[0] - L;
  for (let i = 1; i < all.length; i++) mx = Math.max(mx, all[i] - all[i - 1]);
  return Math.max(mx, R - all[all.length - 1]);
};
// verità: gap massimo minimo ottenibile scegliendo n giorni distinti tra candDays, con pin fissi
const bruteOptMaxGap = (candDays, n, fissi) => {
  const cd = [...new Set(candDays)].sort((a, b) => a - b);
  let best = Infinity;
  const rec = (start, combo) => {
    if (combo.length === n) { best = Math.min(best, maxGapTail(cd, combo.map((i) => cd[i]), fissi)); return; }
    for (let i = start; i < cd.length; i++) rec(i + 1, [...combo, i]);
  };
  rec(0, []);
  return best;
};

s.test("caso BERTUZZI (pin 3,22, tetto 8 → 6 liberi tra le notti 1-31): raggiunge il gap massimo ottimo = 4", () => {
  const cand = mk([...Array(31)].map((_, i) => i + 1).filter((g) => g !== 3 && g !== 22));
  const sel = giorniDi(scegliConRiferimento(cand, 6, [3, 22]));
  s.eq(sel.length, 6, "ritorna esattamente 6 turni liberi");
  const candDays = cand.map((c) => c.giorno);
  const mx = maxGapTail(candDays, sel, [3, 22]);
  s.eq(mx, 4, "gap massimo = 4 (ottimo empirico, vs 5 del vecchio greedy)");
  s.eq(mx, bruteOptMaxGap(candDays, 6, [3, 22]), "coincide con l'ottimo brute force");
});

s.test("riempie il buco tra due pin vicini invece di lasciarlo aperto (1,15,22 tetto 8)", () => {
  // pin 1,15,22; 5 turni liberi tra le altre notti 1-31. Il vecchio greedy lasciava 15→22 = 7.
  const cand = mk([...Array(31)].map((_, i) => i + 1).filter((g) => ![1, 15, 22].includes(g)));
  const sel = giorniDi(scegliConRiferimento(cand, 5, [1, 15, 22]));
  const candDays = cand.map((c) => c.giorno);
  const mx = maxGapTail(candDays, sel, [1, 15, 22]);
  s.eq(mx, 5, "gap massimo = 5 (riempie 15→22), non 7");
  s.eq(mx, bruteOptMaxGap(candDays, 5, [1, 15, 22]), "coincide con l'ottimo brute force");
  s.assert(sel.some((g) => g > 15 && g < 22), "c'è un turno tra i pin 15 e 22 (buco riempito)");
});

s.test("ottimalità su 300 casi random (span/pin/n vari) vs brute force", () => {
  let rng = 424242;
  const rnd = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff; };
  let tutti = 0, ok = 0, contoOk = 0;
  for (let t = 0; t < 300; t++) {
    const D = 8 + Math.floor(rnd() * 10);
    const days = [...Array(D)].map((_, i) => i + 1);
    const nPin = 1 + Math.floor(rnd() * 3);
    const pin = new Set(); while (pin.size < nPin) pin.add(1 + Math.floor(rnd() * D));
    const fissi = [...pin];
    const cand = days.filter((d) => !pin.has(d));
    if (cand.length < 2) continue;
    const n = 1 + Math.floor(rnd() * Math.min(cand.length - 1, 6));
    tutti++;
    const sel = giorniDi(scegliConRiferimento(mk(cand), n, fissi));
    if (sel.length === n) contoOk++;
    const mx = maxGapTail(cand, sel, fissi);
    if (mx === bruteOptMaxGap(cand, n, fissi)) ok++;
  }
  s.eq(ok, tutti, `gap massimo ottimo su tutti i ${tutti} casi (ok=${ok})`);
  s.eq(contoOk, tutti, "ritorna sempre esattamente n turni");
});

s.test("casi base invariati: senza pin = equidistante posizionale; n≥candidati = tutti", () => {
  const cand = mk([1, 5, 9, 13, 17, 21, 25, 29, 31]);
  const senzaPin = scegliConRiferimento(cand, 4, []);
  s.eq(JSON.stringify(senzaPin), JSON.stringify(scegliIndiciEquidistanti(cand.length, 4).map((i) => cand[i].slotKey)), "senza pin ricade sull'equidistante posizionale (comportamento invariato)");
  s.eq(scegliConRiferimento(cand, 20, [3]).length, cand.length, "n ≥ candidati → tutti");
});

s.test("giorni duplicati (G+N lo stesso giorno): ritorna comunque esattamente n slot", () => {
  // due slot lo stesso giorno 10 (es. diurno e notturno di un weekend, stesso livello)
  const cand = [{ slotKey: "N5", giorno: 5 }, { slotKey: "G10", giorno: 10 }, { slotKey: "N10", giorno: 10 }, { slotKey: "N15", giorno: 15 }, { slotKey: "N20", giorno: 20 }];
  const sel = scegliConRiferimento(cand, 3, [1, 25]);
  s.eq(sel.length, 3, "3 slot restituiti anche con un giorno duplicato nel pool");
  s.eq(new Set(sel).size, 3, "nessuno slot ripetuto");
});

s.test("deterministica: stessa chiamata → stesso risultato", () => {
  const cand = mk([2, 4, 6, 9, 12, 14, 18, 23, 27, 30]);
  const a = scegliConRiferimento(cand, 4, [1, 16, 31]);
  const b = scegliConRiferimento(cand, 4, [1, 16, 31]);
  s.eq(JSON.stringify(a), JSON.stringify(b), "output deterministico");
});

s.finish();
