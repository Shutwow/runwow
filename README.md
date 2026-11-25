# RunwoW

Plans de course à pied (5 km → ultra-trail) avec renforcement musculaire et mobilité intégrés.
Le plan est calculé **uniquement par des règles fixes** : pas d'IA, mêmes entrées = même plan.
Toutes les règles sont lisibles dans l'appli (onglet *Plus → Les règles du plan*).

**En ligne : https://shutwow.github.io/runwow/** (GitHub Pages, mis à jour à chaque envoi sur la branche `main`).

## Lancer l'appli en local

Aucune installation : un petit serveur PowerShell suffit.

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1 -Port 8123
```

Puis ouvrir http://localhost:8123/. Les tests du moteur sont sur http://localhost:8123/tests/index.html.

C'est une PWA : une fois hébergée en HTTPS, elle s'installe sur le téléphone et marche hors ligne.
Les données restent dans le navigateur (export/import JSON dans *Plus*).

## Organisation

| Fichier | Rôle |
|---|---|
| `js/engine/plan.js` | Générateur : phases, volumes, placement des séances, renfo, mobilité |
| `js/engine/replan.js` | Recalcul : semaines incomplètes (R1-R3), coupure (R4), déplacements (R5) |
| `js/engine/paces.js` | VMA et zones d'allure |
| `js/engine/strength.js` | Construction des séances de renfo et de mobilité |
| `js/data/exercises.js` | Bibliothèque d'exercices |
| `js/engine/rules.js` | Texte des règles affiché dans l'appli |
| `js/sync/fit.js` | Export des séances en entraînements Garmin (.FIT) |
| `js/sync/zip.js` | Archive .zip d'une semaine de séances |
| `js/sync/strava.js` | Connexion Strava (OAuth, lecture des activités) |
| `js/sync/match.js` | Règle R7 : rapprochement sorties Strava ↔ séances |
| `js/app.js`, `css/style.css`, `index.html` | Interface |
| `tests/` | Vérification automatique des règles sur 576 plans |
