# Fiche agent

## À quoi ça sert

Décrire chaque agent une seule fois, avec ce que le centre a vraiment besoin de savoir, et le montrer seulement à ceux qui doivent le voir.

## Les champs

| Bloc | Champs | Qui le voit |
|---|---|---|
| Identité | prénom, nom, photo, surnom (facultatif) | tout le centre |
| Contact | e-mail (pour la connexion), téléphone | e-mail : gestionnaires ; téléphone : seulement si l'agent l'accepte |
| Naissance | date de naissance | l'agent et les gestionnaires ; le centre voit seulement « anniversaire aujourd'hui », sans l'âge |
| Parcours | date d'entrée au centre, date d'engagement SPV, grade et date de nomination | tout le centre, sauf les dates d'engagement |
| Opérationnel | équipe (affectation datée), statut opérationnel, aptitudes datées (dont l'aptitude médicale) | tout le centre ; les dates d'expiration : l'agent et les gestionnaires |
| Responsabilités | attributions en cours et passées | tout le centre |
| Urgence | une personne à prévenir (facultatif) | gestionnaires seulement |
| Champs du centre | champs libres définis par le centre (taille d'EPI, casier…) | réglable par champ |

Ici, les **gestionnaires** sont ceux qui ont le droit `GERER_ACCES` sur le centre ou sur l'équipe de l'agent.

## Ce que la fiche permet

- **Anniversaires** : un mot sur l'accueil le jour J. L'agent peut le désactiver.
- **Ancienneté** : un rappel des médailles d'honneur à 10, 20, 25 et 30 ans de service, pour préparer les dossiers à temps.
- **Fin d'engagement** : l'engagement SPV dure 5 ans et se renouvelle. L'agent et le chef de centre sont prévenus avant l'échéance.
- **Aptitudes et aptitude médicale** : un rappel avant expiration. Voir Composition des gardes.

## Les règles

- L'agent modifie lui-même sa photo, son surnom, son téléphone et sa visibilité, ainsi que son contact d'urgence. Les gestionnaires modifient tout le reste.
- **RGPD** : la date de naissance et le contact d'urgence sont limités au strict nécessaire et effacés au départ de l'agent. L'historique opérationnel (prises de garde, attributions) est gardé selon les durées de conservation du centre.

## Ce que la fonction ne fait pas

- Pas de dossier médical : seule la date de l'aptitude médicale est notée, jamais son contenu.
- Pas de gestion de carrière SDIS (avancement, formations obligatoires) : l'appli se limite à des rappels.
