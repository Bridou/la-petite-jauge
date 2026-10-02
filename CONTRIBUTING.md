# Contribuer

Les contributions et les signalements de bugs sont les bienvenus. Utilise les modèles d'issue pour signaler un bug ou proposer une évolution; pour un changement important, ouvre d'abord une issue afin de discuter de l'approche. Les problèmes de sécurité doivent suivre la procédure de [SECURITY.md](SECURITY.md), pas être signalés publiquement.

## Environnement de développement

Les prérequis et les commandes de démarrage de l'application sont décrits dans le [README](README.md). Les tests backend utilisent une base temporaire et ne doivent pas être exécutés avec des données personnelles.

## Vérifications avant une pull request

Depuis la racine du projet, exécuter :

```sh
python -m pip install -r requirements-dev.txt
python -m pytest
npm ci
npm audit --audit-level=moderate
npm run build
docker compose config --quiet
docker compose build
```

Une pull request devrait expliquer le problème corrigé, décrire le comportement attendu et inclure les changements de documentation nécessaires. Ne jamais inclure de secrets ni de fichier de base SQLite.