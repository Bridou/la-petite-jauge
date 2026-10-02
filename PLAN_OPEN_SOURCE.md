# Plan d'action pour open-sourcer La petite jauge

Ce plan prépare la publication du dépôt source. Il ne suppose pas que l'application soit hébergée publiquement : son usage actuel est local, avec une base SQLite sur la machine de l'utilisateur.

## Suivi d'exécution

- [x] Initialiser le dépôt Git local sur la branche `main`; aucun historique antérieur ni dépôt distant n'était présent.
- [x] Choisir une licence permissive MIT et créer `LICENSE` avec la notice `Bridou`.
- [x] Décider de conserver un déploiement local ou sur réseau privé, sans accès Internet pris en charge.
- [x] Confirmer que la base locale `carnet_essence.db` est ignorée par Git.
- [x] Effectuer un scan indicatif de motifs de secrets courants; aucun fichier correspondant n'a été signalé. Une relecture manuelle reste nécessaire.
- [x] Vérifier que Docker crée un dossier si le fichier source SQLite manque; désactiver cette création automatique et documenter l'initialisation sûre du fichier.
- [x] Construire l'image Docker avec succès, y compris `npm ci` et `npm run build` dans l'étape frontend.
- [x] Démarrer l'image avec une base SQLite temporaire, appeler l'API et vérifier qu'une entrée fictive survit au redémarrage du conteneur.
- [x] Ajouter trois tests API isolés; résultat local en conteneur : 3 tests réussis.
- [x] Ajouter un workflow GitHub Actions pour les tests backend, le build frontend et l'image Docker.
- [x] Configurer Dependabot pour proposer chaque semaine les mises à jour npm, Python et GitHub Actions.
- [x] Auditer les licences Python/npm et corriger les avis npm : Vite `6.4.3`, `npm audit` sans vulnérabilités; aucun paquet tiers sans licence détectée. `caniuse-lite` est sous CC-BY-4.0; vérifier son attribution si ses données sont redistribuées. Le scanner marque le paquet racine `UNLICENSED` malgré MIT dans les métadonnées; `private: true` est conservé pour interdire une publication npm accidentelle.
- [x] Choisir « La petite jauge » comme nom public provisoire et `Bridou` comme titulaire de la notice.
- [x] Rechercher le slug `la-petite-jauge` parmi les dépôts GitHub publics : aucun résultat exact.
- [x] Vérifier la page publique `https://github.com/Bridou/la-petite-jauge` : elle renvoie 404 au moment du contrôle.
- [ ] Confirmer la disponibilité du slug lors de la création dans le compte `Bridou` et vérifier les éventuelles marques similaires.
- [ ] Relire manuellement les fichiers qui seront publiés avant le premier commit.

## 1. Décider du cadre de publication

- [x] Choisir « La petite jauge » comme nom public provisoire.
- [ ] Confirmer la disponibilité du slug `la-petite-jauge` lors de la création dans le compte `Bridou` et vérifier les éventuelles marques similaires.
- [x] Choisir une licence selon les réutilisations souhaitées (par exemple MIT, Apache-2.0 ou GPL) : MIT.
- [x] Ajouter le fichier `LICENSE` correspondant.
- [ ] Vérifier que le code, les ressources graphiques et les autres éléments publiés peuvent être redistribués.
- [x] Vérifier les licences des dépendances JavaScript et Python; vérifier l'attribution de `caniuse-lite` si ses données sont redistribuées.
- [ ] Décider si le projet est destiné uniquement à être cloné ou si un paquet npm sera aussi publié. `private: true` dans `package.json` bloque la publication sur npm, pas la publication du dépôt Git.

**Terminé quand :** la licence est présente et les droits sur les éléments publiés sont compris.

## 2. Auditer les fichiers et l'historique Git

- [ ] Vérifier les fichiers actuellement suivis par Git avant de rendre le dépôt public.
- [ ] Examiner l'historique Git pour repérer d'anciennes bases de données, données personnelles, secrets ou fichiers locaux qui auraient été commités.
- [ ] Retirer du dépôt toute donnée personnelle ou tout secret découvert; si un secret a été publié, le révoquer et le remplacer.
- [x] Confirmer que les bases SQLite et fichiers d'environnement sont ignorés par `.gitignore` et `.dockerignore`.
- [ ] Ajouter des motifs d'exclusion si de nouveaux fichiers locaux sont introduits.

**Terminé quand :** aucun secret ni aucune donnée personnelle n'est présent dans les fichiers publiés ou dans l'historique public.

## 3. Corriger et compléter la documentation

- [x] Corriger dans `README.md` le port Docker annoncé : Compose utilise actuellement `8082` par défaut, avec surcharge possible par `PORT`.
- [x] Corriger la documentation de persistance : `docker-compose.yml` monte actuellement `./carnet_essence.db` dans le conteneur, et non un volume Docker nommé.
- [ ] Tester et documenter les étapes d'installation pour les systèmes réellement pris en charge; les commandes actuelles de démarrage manuel sont orientées PowerShell.
- [x] Documenter les prérequis, la configuration, le démarrage, l'arrêt, les mises à jour et le dépannage courant.
- [x] Expliquer quelles données sont conservées localement, où se trouve la base SQLite et comment la sauvegarder/restaurer.
- [ ] Décrire clairement les limites actuelles du projet et les plateformes testées.

**Terminé quand :** une nouvelle personne peut suivre le README sans ambiguïté et conserver ses données lors d'une mise à jour.

## 4. Clarifier les limites de sécurité

- [x] Ajouter un avertissement : l'API n'a pas d'authentification et ne doit pas être exposée directement à Internet.
- [x] Préciser les implications du port publié par Docker et recommander un réseau de confiance pour l'accès local au réseau.
- [x] Décider si l'application restera volontairement locale ou si un accès distant sera pris en charge : local ou réseau privé.
- [ ] Si l'accès distant est souhaité, définir séparément les exigences d'authentification, HTTPS, sauvegardes et mises à jour avant de le recommander.

**Terminé quand :** les utilisateurs comprennent ce qui est protégé, ce qui ne l'est pas et quel déploiement est pris en charge.

## 5. Préparer les contributions

- [x] Ajouter `CONTRIBUTING.md` avec les outils requis, les commandes de développement et la procédure de proposition d'un changement.
- [x] Ajouter des modèles d'issue pour les bugs et demandes d'évolution.
- [ ] Décider si un `CODE_OF_CONDUCT.md` est souhaité pour la communauté.
- [x] Définir dans le README où proposer un changement, signaler un bug ou une vulnérabilité.
- [x] Ajouter `SECURITY.md` avec une procédure de signalement privé; activer le canal correspondant dans les réglages GitHub avant publication.

**Terminé quand :** une personne extérieure sait comment contribuer et où signaler un problème.

## 6. Ajouter des vérifications automatiques

- [x] Ajouter des tests backend ciblant les routes, la validation des entrées et les opérations SQLite.
- [ ] Ajouter des tests frontend pour les comportements essentiels si l'interface évolue régulièrement.
- [x] Ajouter une CI GitHub Actions qui installe les dépendances et exécute les vérifications à chaque pull request.
- [x] Faire vérifier la compilation frontend avec `npm ci` puis `npm run build` dans la construction Docker.
- [x] Vérifier la construction et le démarrage de l'image Docker, ainsi que la persistance de la base après redémarrage sur une base de test isolée.
- [x] Documenter les vérifications disponibles pour qu'un contributeur puisse les lancer localement.

**Terminé quand :** les vérifications essentielles passent automatiquement sur une pull request et sont reproductibles localement.

## 7. Publier la première version

- [ ] Relire le dépôt public, le README, la licence et les avertissements de sécurité.
- [ ] Créer les issues initiales pour les travaux reportés et les limites connues.
- [ ] Créer une première release versionnée avec des notes de version concises.
- [ ] Décider du niveau de support attendu et l'indiquer dans le README.
- [x] Prévoir une routine raisonnable de suivi des dépendances via Dependabot et des signalements de sécurité via `SECURITY.md`.

**Terminé quand :** la release est reproductible, ses limites sont connues et les utilisateurs savent à quoi s'attendre en matière de support.

## Ordre recommandé

1. Décider de la licence et vérifier les droits.
2. Auditer les fichiers et l'historique Git.
3. Corriger le README et expliquer les limites de sécurité.
4. Ajouter les consignes de contribution et les vérifications automatiques.
5. Publier le dépôt, puis créer une release versionnée.

## Critère minimal avant de rendre le dépôt public

- [ ] Une licence choisie est présente.
- [ ] L'audit des fichiers et de l'historique Git est terminé.
- [ ] Le README décrit correctement l'installation, le port Docker et la persistance des données.
- [ ] L'avertissement sur l'absence d'authentification est visible.
- [x] La compilation frontend et la construction Docker ont été vérifiées.