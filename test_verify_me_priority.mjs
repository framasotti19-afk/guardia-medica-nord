// Verifica: la copertura a distanza di Meduno (ME) per lo scenario a 2 medici (MA+SP)
// deve andare a chi ha "priorità superiore" (categoria -> debito -> graduatoria),
// come da CONTEXT.md sezione 3.2. Confrontiamo con un caso dove il medico a grad
// numerico peggiore ha però categoria superiore (quindi priorità vera superiore).
import { MEDICI, byId, CAT_INFO, SEDI5, dk, elaboraSchema } from './engine_test.mjs';

const base = () => { const d = {}; MEDICI.forEach((m) => (d[m.id] = {})); return d; };
const N = (g) => `${dk(2026, 7, g)}|N`; // 2026-08 = mese index 7
const disp = (p = []) => ({ piene: p, pieneLiv: {}, ripiego: [], ripiegoLiv: {}, no: false, preferito: false, preferitoRip: false });

// BERTUZZI (id1) = IND36, grad 0 (priorità categoria altissima, ma diamogli grad alto per il test)
// Usiamo invece due medici di categorie diverse: prendiamo TRIGODKO (DET36, grad4) e
// una SENZA incarico con grad basso (numero migliore) tipo ZURLO (grad2).
// Full priority: DET36 (prio3) batte SENZA (prio5) SEMPRE se ha debito.
// .grad puro: ZURLO(2) < TRIGODKO(4) quindi vincerebbe ZURLO se si usa solo grad.

const dispo = base();
// Solo 2 medici disponibili su questo turno: TRIGODKO su Maniago, ZURLO su Spilimbergo.
// Nessuno dichiara Meduno: la copertura di ME deve avvenire "a distanza".
dispo[3][N(3)] = disp(["Maniago"]);     // TRIGODKO id3, DET36, grad4
dispo[13][N(3)] = disp(["Spilimbergo"]); // ZURLO id13, SENZA, grad2

const { schema } = elaboraSchema(dispo, {}, 2026, 7, {});
const giorno3 = schema.find((g) => g.giorno === 3);
const turnoN = giorno3.turni.find((t) => t.id === "N");
console.log("slots:", turnoN.slots.map((mid) => (mid ? byId[mid].nome : null)));

const meAssignee = turnoN.slots[2]; // indice 2 = Meduno
console.log("ME coperto da:", meAssignee ? byId[meAssignee].nome : null);

// Aspettativa secondo CONTEXT.md 3.2 ("ME da chi ha priorità superiore" = cat->debito->grad):
// TRIGODKO (DET36, prio3, debito>0) ha priorità superiore a ZURLO (SENZA, prio5).
// Quindi ME dovrebbe essere coperto da TRIGODKO.
const atteso = 3; // TRIGODKO
if (meAssignee === atteso) {
  console.log("✅ ME assegnato secondo priorità superiore (cat->debito->grad)");
  process.exit(0);
} else {
  console.log(`❌ ME assegnato per grad numerico puro (id${meAssignee}, ${byId[meAssignee].nome}) invece che per priorità superiore (atteso: TRIGODKO, id${atteso})`);
  process.exit(1);
}
