# 0038 — Notifications des chefs : urgences, suivi du centre, e-mail aux référents

- **Contexte** : à la présentation de Laillé (18/11/2026), le chef et son adjoint ne savaient pas ce que l'autre avait changé, rien ne les avertissait de l'urgent, et une manœuvre modifiée s'affichait signée « PD ». Spec : `docs/superpowers/specs/2026-11-19-notifications-des-chefs-design.md`.
- **Choix** :
  1. **Urgences** (liste fixe) : engin indisponible, remplacement sans remplaçant la veille, équipe sans chef de garde la veille de sa relève ; au chef et à l'adjoint, lieu de coupure `urgences`. « Tout couper » les coupe aussi (porteur, 19/11).
  2. **Suivi du centre** (choix A) : une page lue dans le journal, une ligne dans la cloche ; plutôt qu'une ligne de cloche par événement (B : cloche noyée).
  3. **E-mail** (choix A) : un e-mail par nouvelle demande ; plutôt qu'un récapitulatif par jour (B : trop lent pour une réservation du lendemain).
  4. **Chefs retirés** des demandes dès qu'un référent est nommé (porteur, 19/11) : la demande passe dans leur suivi.
  5. **« Planning »** signe ce que l'appli publie, avec son icône ; « Modifiée par… » dit qui l'a changé (signer du nom de qui modifie a été écarté).
- **Calcul** (offre gratuite de Cloudflare) : aucune requête de plus sur une page. Le compteur du suivi tient dans la requête de l'en-tête (`personne.suivi_vu` : la dernière ligne du journal vue, compte borné à 99, sur les 1 000 dernières lignes) ; « Modifiée par » dans le batch des publications ; urgences et nominations dans le batch du geste ; l'équipe sans chef n'est regardée qu'aux réveils de 8 h et 8 h 10 la veille d'une relève ; les e-mails après la réponse, en une requête.
- **Décisions prises en route, à valider** : la ligne du suivi compte pour 1 dans le chiffre de la cloche et la pastille de l'icône ; l'équipe sans chef se vérifie d'après le roulement et le planning publié, sans tenir compte des groupes d'été ; l'interrupteur e-mail s'affiche à qui tient un rôle ; « Tout couper » ne coupe pas les e-mails ; un engin ne devient indisponible que par une anomalie (la prise de garde et la fiche ne changent pas son état).
- **Validé par** : le porteur, le 18 et le 19/11/2026 (cadrage, choix A, retrait des chefs, « tout » coupe les urgences) ; le reste à valider dans la PR.
