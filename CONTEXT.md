# CONTEXT — App Turni Guardia Medica ASFO Distretto Nord

## LEGGERE PRIMA DI QUALSIASI INTERVENTO

Questo file contiene tutto il contesto necessario per lavorare sull'app senza ricominciare da capo.
**Leggi prima il file `turni-guardia-medica.jsx`, poi questo documento, prima di toccare qualsiasi cosa.**

---

## 1. CONTESTO DEL PROGETTO

App React single-file (`turni-guardia-medica.jsx`) per la gestione mensile dei turni di guardia medica del Distretto Nord ASFO (Azienda Sanitaria Friuli Occidentale). L'utente è il futuro coordinatore.

**Sedi del distretto:** Maniago (MA), Spilimbergo (SP), Meduno (ME), Claut (CL), Anduins (AN).

L'app:
- Permette di inserire disponibilità mensili per ciascun medico (sedi preferite, ripieghi con livelli, indisponibilità NO, preferiti)
- Applica le regole di assegnazione turni (gerarchia, debito orario, graduatoria) per produrre uno schema
- Permette correzioni manuali post-elaborazione
- Esporta lo schema in Excel (.xlsx) fedele al formato reale ASFO
- Ha un assistente AI integrato (chiama `https://api.anthropic.com/v1/messages` con claude-sonnet-4-6)
- **NON usa React Router, NON usa librerie esterne** (solo React + useState/useMemo/useRef/useEffect). L'xlsx viene costruito a mano come ZIP binario.

---

## 2. STRUTTURA DEL FILE (1655 righe)

```
righe 1-105    → DATI SIMULAZIONE (MEDICI_DEFAULT, byId, CAT_INFO, SEDI5, calendari)
righe 106-143  → MOTORE: normDispo, ripiegoPerLivello, sediScenario
righe 144-319  → MOTORE: elaboraTurno (cuore dell'algoritmo di assegnazione)
righe 320-430  → MOTORE: elaboraSchema (orchestrazione mese, preferiti prima, poi resto)
righe 431-754  → MOTORE: notaSlot, avvisiPreferiti (helper post-elaborazione)
righe 755-984  → EXPORT XLSX (costruito a mano come ZIP/OOXML)
righe 985-1655 → COMPONENTE REACT (UI, state, event handlers, AI)
```

**La sezione motore è pura JavaScript** (niente React hooks) — può essere estratta e testata con Node.js:
```bash
# Estrai il motore e crea engine_test.mjs per i test
python3 -c "
src = open('turni-guardia-medica.jsx').read()
end = src.index('// ============ COMPONENTE ============')
engine = src[:end].replace('import { useState, useMemo, useRef, useEffect } from \"react\";\n', '')
open('engine_test.mjs', 'w').write(engine + '\nexport { MEDICI, MEDICI_DEFAULT, setMediciGlobal, byId, CAT_INFO, SEDI5, SEDI_BREVI, dk, mk, turniDelGiorno, elaboraSchema, normDispo, ripiegoPerLivello, MESI_DISPONIBILI, MESI_IT };\n')
print('motore estratto')
"
```

---

## 3. REGOLE DI BUSINESS (IMMUTABILI — NON INTERPRETARE, NON SEMPLIFICARE)

### 3.1 Gerarchia categorie

| Priorità | Categoria | Debito mensile | Spareggio interno |
|----------|-----------|----------------|-------------------|
| 1° | IND36 — Indeterminato 36h/sett | 156h | debito ↓ → graduatoria |
| 2° | IND24 — Indeterminato 24h/sett | 104h | debito ↓ → graduatoria |
| 3° | DET36 — Determinato 36h/sett | 156h | debito ↓ → graduatoria |
| 4° | DET24 — Determinato 24h/sett | 104h | debito ↓ → graduatoria |
| 5° | SENZA — Senza incarico | null (nessun debito) | solo graduatoria |

**Regola del debito:** chi ha più debito residuo vince; a parità vince chi ha il numero di graduatoria più basso (= posizione migliore). Questo si applica SOLO all'interno della stessa categoria.

**La categoria prevale SEMPRE finché il medico ha debito > 0.** Un IND36 con un'ora di debito batte qualsiasi DET36.

**Debito esaurito (= 0 o negativo):** il medico esce dalla priorità di categoria. L'ordine di precedenza diventa:
1. contrattualizzati con debito > 0 (ordinati per cat → debito → grad)
2. senza incarico (solo grad)
3. contrattualizzati con debito ≤ 0 (possono solo coprire turni SCOPERTI, non in conflitto)

**Recupero ore da mese precedente:** dichiarato esplicitamente al coordinatore. Aumenta il debito mensile: `debito = monte_ore + ore_recupero`. Partecipa normalmente a tutti i conflitti. NON applicabile ai senza incarico (che non hanno debito).

### 3.2 Sedi e scenari di copertura

**Maniago e Spilimbergo sono sempre prioritarie e devono essere coperte per prime.**

| N. medici | Target fisico | Coperture a distanza |
|-----------|---------------|----------------------|
| 1 | MA o SP | tutto il resto da lì |
| 2 | MA + SP | ME da chi ha priorità superiore; CL sempre da MA; AN da SP o ME (grad migliore) |
| 3 | MA + SP + ME | CL sempre da MA; AN da SP o ME (grad migliore) |
| 4 | MA + SP + ME + CL | AN da SP o ME (titolarità/grad) |

**Claut è SEMPRE coperta da Maniago** (mai da SP, ME, o AN). Questa è una regola assoluta.

**Anduins** va a chi tra SP e ME ha la graduatoria migliore (numero più basso).

### 3.3 Disponibilità — formato dati

```javascript
dispo[mid][slotKey] = {
  piene: ["Maniago", "Spilimbergo"],   // sedi in preferenza piena
  pieneLiv: { Maniago: 1, Spilimbergo: 2 }, // livello 1..5 per ogni piena
  ripiego: ["Meduno"],                  // sedi di ripiego (solo se necessarie per lo scenario)
  ripiegoLiv: { Meduno: 1 },            // livello 1..5 per ogni ripiego
  no: false,                            // NO esplicito (protegge dall'inserimento rapido)
  preferito: false,                     // turno preferito sulla preferenza
  preferitoRip: false,                  // lo vuole anche se finisce in ripiego
}
```

**Livelli sulle preferenze piene (feature importante):**
- Livelli PARI tra più sedi = indifferenti per il medico. Il motore può spostarlo tra di esse per massimizzare le coperture (es. Maniago:1, Spilimbergo:1 → entrambi lo stesso per lui).
- Livello più basso = sede che il medico ha diritto di tenere contro chiunque non lo superi in gerarchia.
- **I livelli non cambiano MAI chi vince un conflitto** (quello è sempre categoria→debito→graduatoria). Cambiano solo quale sede viene assegnata a ciascun vincitore, massimizzando il numero di medici al lavoro.

**Retrocompatibilità:** dispo senza `pieneLiv` = tutte le piene a livello 1 (equivalenti/indifferenti).

### 3.4 Meccanismo auto-bilanciante del debito

Turni elaborati in ordine cronologico (ma i turni con almeno un "preferito" vengono elaborati TUTTI PRIMA del resto):

```
turni_del_mese = [...conPref, ...resto]  // conPref = turni con preferito o preferitoRip
```

Questo è critico: cambia i debiti progressivi e quindi i risultati di conflitti successivi.

A parità di debito e categoria, vince la graduatoria migliore (numero più basso).
Dopo ogni assegnazione il debito del vincitore scende. Al turno successivo a parità, l'altro medico ha più debito → vince lui. **L'equità emerge automaticamente**, con vantaggio strutturale per chi ha graduatoria migliore (vince i tie-break).

Esempio con 5 turni a parità di debito iniziale:
- A(grad3) vs B(grad124): A 1°, B 2°, A 3°, B 4°, A 5° → risultato 3-2 per A

### 3.5 Preferiti

Il flag `preferito` NON decide mai chi vince un conflitto. Serve solo a garantire che il turno preferito venga elaborato tra i primi (fase `conPref`), così il debito del medico è ancora pieno quando viene valutato — aumentando la probabilità (non la certezza) di ottenerlo. La gerarchia rimane intoccata.

### 3.6 Calendario mensile e fasi

- **Giorno 27**: invio mail richiesta disponibilità ai medici
- **Entro giorno 3** (23:59): scadenza disponibilità → regole ordinarie
- **Giorno 10**: invio primo schema
- **Entro giorno 14** (23:59): modifiche → first come, first served (niente gerarchia)
- **Giorno 15**: invio schema definitivo all'azienda

**First come, first served** si applica solo alle richieste arrivate dopo il giorno 3. Le regole ordinarie (gerarchia, debito, graduatoria) si applicano solo alle disponibilità entro il giorno 3. **Eccezione assoluta:** errori del coordinatore si correggono sempre retroattivamente.

---

## 4. GRADUATORIA SIMULATA (dati di test — da sostituire con la reale)

```
IND36:  BERTUZZI(id1, grad0)
IND24:  CAMPANER(id2, grad1)
DET36:  TRIGODKO(id3, grad4), PRESSACCO(id4, grad57), GHIZZO(id5, grad91), IENGO(id6, grad107), DE MARCHI L(id7, grad130)
DET24:  FOSCHIANI(id8, grad3), BEKAEVA(id9, grad17), CERVESATO(id10, grad63), COLOSETTI(id11, grad97), WANG(id12, grad124)
SENZA:  ZURLO(id13, grad2), GRANDO(id14, grad13), PITAU(id15, grad14), DE CECCO-BEOLCHI(id16, grad20),
        MICHELI(id17, grad39), MARZANO(id18, grad45), MUNARETTO(id19, grad54), CESCO(id20, grad59),
        PARRONI(id21, grad71), MORANO(id22, grad72), DE CANDIDO(id23, grad83), SIEGA-VIGNUT(id24, grad87),
        MERLINO(id25, grad105), MARCUZZO(id26, grad109)
```

La lista è modificabile dall'interfaccia (tab "3 · Medici / ore extra") e salvata nello store persistente. In `store.medici` se presente, altrimenti `MEDICI_DEFAULT`.

---

## 5. ARCHITETTURA DEL MOTORE

### elaboraTurno (cuore)

```javascript
function elaboraTurno(d, turno, slotKey, dispo, debiti) {
  // 1. Trova candidati con disponibilità valida per questo slotKey
  // 2. Li ordina: [conDeb (cat→deb→grad), senzaInc (grad), esaur (grad)]
  // 3. target = sedi fisiche da coprire (sediScenario(min(ordinati.length, 4)))
  // 4. prova() — assegnazione con ricollocazione e scalzamento:
  //    - Rispetta livelli delle piene (veto se livello migliore)
  //    - Ricollocazione: se l'occupante è indifferente (stessa o peggiore sede), si sposta
  //    - Scalzamento: solo se il richiedente ha priorità superiore (isBetterPriority)
  // 5. Passo 2: ripieghi per sedi ancora scoperte nel target
  // 6. Rebuild slots da sedeDi (elimina "fantasmi" da ricollocazioni intermedie)
  // 7. Coperture a distanza (CL da MA, AN da best(SP,ME), ME da chi ha priorità)
  // 8. Avvisi per preferiti non rispettati
}
```

**INVARIANTI DEL MOTORE (non devono mai essere violati):**
- INV1: nessun medico fisico senza disponibilità dichiarata per quella sede
- INV2: nessun medico con NO esplicito assegnato fisicamente
- INV3: coperture a distanza solo da fisici presenti nel turno
- INV4: Claut a distanza viene sempre da Maniago (mai da altri)
- INV_GER: nessun medico con priorità inferiore (considerando il debito corrente) occupa una sede che un medico con priorità superiore voleva come piena e non ha ottenuto

### elaboraSchema (orchestratore)

```javascript
function elaboraSchema(dispo, extraOre, anno, mese, extras) {
  // Inizializza debiti: CAT_INFO[cat].ore + (extraOre[mid] || 0)
  // Costruisce lista turni del mese
  // ORDINE CRITICO: [...conPref, ...resto]
  //   conPref = turni dove almeno un medico ha preferito=true o preferitoRip=true
  //   Questo ordine cambia i debiti progressivi — il checker di gerarchia DEVE rispettarlo
  // Chiama elaboraTurno per ogni turno nell'ordine sopra
  // Raccoglie avvisi preferiti (4 casi: piena ottenuta, solo ripiego, niente, PREFRIP)
}
```

---

## 6. FEATURE IMPLEMENTATE (tutte complete e testate)

1. **Disponibilità dicotomiche** (verde disponibile / rosso non disponibile) — visivamente 2 stati, internamente 3 (no esplicito, non specificato, disponibile)
2. **NO esplicito** — protegge l'indisponibilità dall'inserimento rapido massivo
3. **Inserimento rapido per intervallo** — compila blocchi di disponibilità con periodi di eccezione
4. **Preferito sulla preferenza e anche in ripiego** — 2 flag separati, informativi non decisionali
5. **Livelli ripiego 1-5** — ogni tocco aumenta il livello, massimizzano le coperture nell'ordine dichiarato
6. **Livelli anche sulle preferenze piene 1-5** — FEATURE NUOVA: livelli pari = indifferenti, livello più basso = veto
7. **Avvisi post-elaborazione** per preferiti non rispettati (4 casi distinti)
8. **Esportazione Excel** — layout identico al file reale ASFO (costruito a mano come ZIP OOXML)
9. **AI integrata** — conosce tutte le regole, può modificare disponibilità e schema tramite JSON
10. **Medici modificabili** — categoria e graduatoria modificabili dall'UI, aggiunta/rimozione medici
11. **Azzera mese con doppio tocco** — sicuro, posizionato lontano dai pulsanti di esportazione
12. **Undo/redo** — history completo di tutte le azioni
13. **Storage persistente** — `window.storage` (API Claude.ai), chiave `gm-turni-store-v3`

---

## 7. FEATURE NON IMPLEMENTATE / POSSIBILI FUTURI

- Scenario 1 medico con sede preferita SP: il motore pone sempre il solo medico su MA per primo (target=[0]=MA). Se il medico vuole SP, dovrebbe poter andare su SP e coprire MA da lì. **Noto ma non corretto** — comportamento accettabile per ora.
- Integrazione con graduatoria reale definitiva (attualmente lista simulata).
- Export del Progetto Claude per elaborare email di disponibilità → vedi prompt separato.

---

## 8. SUITE DI TEST (Node.js, usa engine_test.mjs estratto)

Tutti i file di test usano `import` da `./engine_test.mjs`. Devono girare **tutti verdi** dopo qualsiasi modifica al motore.

```bash
# Estrai motore (da fare dopo ogni modifica al file .jsx)
python3 -c "
src = open('turni-guardia-medica.jsx').read()
end = src.index('// ============ COMPONENTE ============')
engine = src[:end].replace('import { useState, useMemo, useRef, useEffect } from \"react\";\n', '')
open('engine_test.mjs', 'w').write(engine + '\nexport { MEDICI, MEDICI_DEFAULT, setMediciGlobal, byId, CAT_INFO, SEDI5, SEDI_BREVI, dk, mk, turniDelGiorno, elaboraSchema, normDispo, ripiegoPerLivello, MESI_DISPONIBILI, MESI_IT };\n')
"

# Lancia tutti i test
node run_tests2.mjs          # 40 test runtime (gerarchia, scenari, debito)
node test_preferiti2.mjs     # 14 test preferiti e ordine elaborazione
node test_rapido2.mjs        # 13 test inserimento rapido e protezione NO
node test_livelli_ripiego.mjs # test livelli ripiego 1-5
node test_stesso_cat2.mjs    # test conflitti stessa categoria
node test_simulazione_completa.mjs  # 15167 check su scenari randomici × 5 mesi × 5 semi
node test_nuove_funzioni.mjs # 14 test livelli piene + medici modificabili
```

**Il test di simulazione** (`test_simulazione_completa.mjs`) è il più importante: genera scenari casuali con tutti i 26 medici e verifica gli invarianti INV1-INV4 su ogni singolo turno.

**Quando si aggiunge un test:** scrivilo in Node.js puro (ESM, `import`), con `process.exit(0/1)` e output `✅ TUTTI I TEST SUPERATI` o `❌ N FALLITI`. Aggiungilo al blocco `# Lancia tutti i test` sopra.

---

## 9. COME VERIFICARE CHE NON HAI ROTTO NIENTE

```bash
# 1. Controlla compilazione (solo errori reali, ignora type inference)
cd /tmp && cp ../turni-guardia-medica.jsx check.tsx
npx tsc --jsx preserve --noEmit --allowJs check.tsx 2>&1 | grep -E "error TS(1[0-9]{3}|2304|2339|2552|2454)[^0-9]"
# output vuoto = ok

# 2. Verifica nessuna funzione duplicata
for fn in toggleSedeCella setNoCella setPreferitoCella toggleExtra elabora azzeraMese \
  setMedici aggiornaMedico aggiungiMedico rimuoviMedico setSlot applicaRapido \
  applicaProposta chiediAI nomeToId elaboraSchema elaboraTurno normDispo \
  ripiegoPerLivello isBetterPriority setMediciGlobal; do
  n=$(grep -c "const $fn = \|function $fn(" turni-guardia-medica.jsx)
  [ "$n" != "1" ] && echo "DUPLICATA: $fn"
done

# 3. Estrai motore e lancia tutti i test
python3 -c "..."  # vedi sopra
node run_tests2.mjs && node test_preferiti2.mjs && node test_rapido2.mjs && \
  node test_livelli_ripiego.mjs && node test_stesso_cat2.mjs && \
  node test_nuove_funzioni.mjs && node test_simulazione_completa.mjs
```

---

## 10. BUG NOTI E STORICI (risolti)

Questi bug sono stati trovati e corretti durante lo sviluppo. Se riappaiono è una regressione.

1. **Phantom slot bug** — la ricollocazione ricorsiva lasciava un "fantasma" in `slots` non corrispondente a `sedeDi`. Fix: rebuild di `slots` da `sedeDi` dopo tutti i passaggi (riga ~263 del file).

2. **delete sedeDi[occ] prematuro** — in `prova()`, il `delete sedeDi[occ]` avveniva dopo la ricollocazione riuscita, cancellando la nuova sede dell'occupante. Fix: `prova()` usa ora `maxLiv` per permettere/negare la ricollocazione, e gestisce correttamente il ripristino.

3. **Ordine iterazione passo 2** — il passo 2 (ripieghi) ignorava l'ordine dei livelli del medico. Fix: `prova()` itera sull'array `acc` restituito da `accDi()` (già ordinato per livello) invece dell'ordine fisso del target.

4. **normDispo con oggetti `{sede, liv}` residui** — format legacy rompeva silenziosamente il motore. Fix: `normDispo` ora gestisce la retrocompatibilità.

5. **GER checker con ordine sbagliato** — il checker di gerarchia nei test stress processava i turni in ordine cronologico invece di `[conPref, ...resto]` come fa il motore reale, producendo falsi positivi. Fix: il checker replica l'ordine esatto del motore.

---

## 11. CONVENZIONI DI CODICE

- Il file è un **single-file React component** — non spezzarlo in più file.
- Nessuna libreria esterna (niente axios, date-fns, lodash, ecc.).
- Il motore (funzioni prima di `// ============ COMPONENTE ============`) è **puro JavaScript** senza hooks React.
- I tipi di TypeScript NON sono usati — il file è `.jsx`. Il compilatore tsc serve solo per rilevare errori sintattici reali (filtro su codici TS1xxx, TS2304, TS2339, TS2552, TS2454).
- Lo storage usa `window.storage` (API specifica di Claude.ai artifacts) — NON usare `localStorage`.
- Le chiamate API ai modelli usano `fetch("https://api.anthropic.com/v1/messages")` senza API key (gestita da Claude.ai).

---

## 12. COME SEGNALARE E CORREGGERE UN BUG

**Per un bug concettuale (comportamento sbagliato):**
1. Scrivi un test Node.js che riproduce il caso atteso e verifica che fallisce
2. Identifica la funzione del motore responsabile (quasi sempre `elaboraTurno` o `prova`)
3. Correggi rispettando gli invarianti INV1-INV4 e la gerarchia categoria→debito→graduatoria
4. Rilancia tutti i test — zero fallimenti prima di considerare il fix completo

**Template test minimo:**
```javascript
import { MEDICI, byId, CAT_INFO, SEDI5, dk, elaboraSchema } from './engine_test.mjs';
const base = () => { const d={}; MEDICI.forEach(m=>d[m.id]={}); return d; };
const N = (g) => `${dk(2026,7,g)}|N`;
const disp = (p=[], r=[]) => ({ piene:p, pieneLiv:{}, ripiego:r, ripiegoLiv:{}, no:false, preferito:false, preferitoRip:false });
// ... test case ...
```

**Per modificare il motore:** lavora SOLO sulle funzioni tra riga 106 e 430. La UI (righe 985+) non dovrebbe mai contenere logica di assegnazione.

---

## 13. PROMPTS E SISTEMI ESTERNI

**Assistente AI nell'app** — usa il system prompt in `chiediAI` (riga ~985). Conosce tutte le regole di business, il formato JSON per modificare disponibilità e schema, le categorie, gli scenari di copertura. Il prompt è nel codice e può essere aggiornato.

**Progetto Claude separato** — esiste un prompt di sistema separato (fuori da questa app) per processare email di disponibilità e produrre un file Excel. Non è nel file `.jsx`.

---

*Ultimo aggiornamento: luglio 2026. File app: turni-guardia-medica.jsx (1655 righe)*
