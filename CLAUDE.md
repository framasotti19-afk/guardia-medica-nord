# CLAUDE.md — regole permanenti per ogni sessione

## File di lavoro e sorgenti di verità

- **Il file di test AI è UNO SOLO:** `mail_test_prompt_ai.md` nella working directory (repo). È l'unica fonte di verità.
- **NON esiste alcun file in `~/.claude/uploads/`.** Qualunque copia lì (es. un vecchio `mail_test_prompt_ai.md` residuo di un upload) è **MORTA**: non va letta, non scritta, non "riconciliata", non sincronizzata. Ignorala del tutto.
- **Regola generale su `~/.claude/uploads/`:** se serve un file che sta lì, la PRIMA e UNICA azione è **copiarlo nel repo una volta sola**; da quel momento si lavora esclusivamente sulla copia nel repo. **Mai** scrivere (né leggere per "verificare") dentro `uploads` — ogni scrittura lì costringe l'utente a confermare a mano ed è vietata.

## Riferimenti

- Contesto architetturale, storia delle decisioni e §10 (registro voci) → `CONTEXT.md`.
