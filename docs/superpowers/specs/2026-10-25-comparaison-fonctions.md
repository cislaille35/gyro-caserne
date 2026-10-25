# Comparaison des fonctions avec l'existant

Recherche du 25/10/2026, faite pour définir les contours de chaque fonction. Sources surtout éditeurs.


**Remarque générale.** La plupart des sources disponibles sont des pages commerciales ou des pages d'aide d'éditeurs. Je n'ai rien trouvé de public sur la mécanique fine des outils SDIS français. Ce que je présente comme une déduction est marqué *(déduction)*.

### 1. Anomalies / défauts
**Comportements courants / bonnes idées**
- Le signalement se fait de trois façons : pendant une vérification prévue, par une vérification ponctuelle, ou directement depuis la fiche du matériel. Il comporte des notes, des pièces jointes (photos, rapport), une priorité et des destinataires. Chaque alerte a une catégorie qui décide qui est prévenu, par e-mail ou SMS. [PSTrax](https://help.pstrax.com/setting-asset-alerts)
- Dans la vérification, les résultats possibles sont « Hors service » et « Réparation requise ». Une réparation se crée depuis l'écran de vérification. [D4H](https://help.d4h.com/article/291-completing-an-inspection)
- Quand on clôt une réparation sur un matériel indisponible, l'app demande « remettre en service ? Oui / Non, toujours HS ». La personne qui a ouvert la réparation est prévenue. La remise en service est donc une décision distincte de la réparation. [D4H](https://help.d4h.com/article/294-completing-a-repair)
- Mettre un engin hors service suspend ses vérifications programmées. Il garde un historique complet, de la sortie du camion jusqu'au retour. [PSTrax](https://pstrax.com/vehicle-checks/)
- En GMAO, l'état « en attente » reste séparé de « ouvert », pour voir ce qui est bloqué (pièce, prestataire, validation). On l'accompagne d'un motif. [Xenia](https://help.xenia.team/hc/en-us/articles/49715444987931-Work-Order-Statuses-Explained)
- Chez Powerfleet, la réparation revient au conducteur, qui la confirme ou la refuse. Cela correspond à votre étape « vérifiée ». [Powerfleet](https://kb.powerfleet.com/hc/en-us/articles/27119750621202-How-to-View-Defect-Status)

**Pièges**
- Trop peu d'états. Sur MaintainX, des utilisateurs contournent avec un champ « motif d'attente » qu'on ne voit qu'en ouvrant le bon de travail. Il vaut mieux des états explicites et visibles dans la liste. [MaintainX community](https://community.getmaintainx.com/product-q-a-6/not-enough-status-372)
- Un passage automatique en indisponible (vérification en retard → HS) oblige ensuite à remettre l'état à la main. C'est une source de faux HS. [D4H](https://help.d4h.com/article/291-completing-an-inspection)

### 2. Accès et rôles
- Slack : par défaut, les membres peuvent inviter. Une option impose la validation d'un admin. Les demandes partent vers tous les admins ou vers un canal dédié, et le demandeur est prévenu de la décision. Les invités externes exigent toujours une validation. [Slack](https://slack.com/help/articles/115004854783)
- Signal : un lien d'invitation peut exiger l'approbation d'un admin, et on peut le réinitialiser ou le couper. Ce modèle convient bien à une liste fermée. [Signal](https://support.signal.org/hc/articles/360051086971)

### 3. Astreinte par équipe, exceptions
**Comportements courants / bonnes idées**
- On part de cycles préconfigurés (24/48, Panama…) appliqués sur plusieurs années, puis on ajuste ponctuellement par glisser-déposer. [Aladtec](https://tcpsoftware.com/products/aladtec/rotational-scheduling/)
- PagerDuty distingue deux exceptions :
  - le *remplacement* (« override ») : quelqu'un prend la place du titulaire, par exemple pour des congés ;
  - le *créneau en plus* : on ajoute une personne ou on bouche un trou sans retirer personne.
  Le test proposé : « si je retire le changement, reste-t-il un trou ? » [PagerDuty](https://www.pagerduty.com/blog/operations-cloud/introducing-shift-based-schedules-smarter-faster-and-easier-for-any-team/)
- PagerDuty abandonne les « couches » superposées au profit de créneaux simples, à cause de la complexité des chevauchements. [PagerDuty](https://www.pagerduty.com/blog/operations-cloud/introducing-shift-based-schedules-smarter-faster-and-easier-for-any-team/)

**Pièges**
- Un remplacement sur une période remplace toute la couche, pas seulement les heures d'astreinte. Et suspendre puis reprendre une rotation au même point n'est pas prévu. [Forum PagerDuty](https://db_f1b8b24d_2c79_4c4a_919d_685188a12f3c.influitive.com/forum/t/override-a-schedule-layer-vs-a-schedule-pause-a-rotation/4681)
- Dans un SDIS, l'astreinte programmée (indemnisée) et la disponibilité déclarée (sans contrepartie) sont deux régimes distincts. Il ne faut pas les confondre dans le modèle. [SDIS 81](https://www.sdis81.fr/sites/default/files/actes-reglementaires/095_reconnaissance_disponibilite_declaree_par_spv_en_journee.pdf)

### 4. Équipage minimum par qualifications
**Comportements courants / bonnes idées**
- Le minimum se règle par planning, à l'heure près et par jour de la semaine. On peut l'exprimer en nombre de personnes, par statut (volontaire…) ou par poste (conducteur, chef…). Un avertissement apparaît sur le planning quand la règle n'est pas respectée. [Aladtec](https://tcpsoftware.com/products/aladtec/)
- Des « qualificatifs » sont attachés aux places. Seul un agent qualifié peut occuper une place qui en porte un, et les qualificatifs viennent des fiches de formation. [Vector Scheduling](https://www.vectorsolutions.com/solutions/vector-scheduling/fire-department-shift-scheduling-rad-cro-ppc/)
- On peut agréger plusieurs engins pour atteindre un minimum commun. [Vector](https://www.vectorsolutions.com/solutions/vector-scheduling/fire-department-shift-scheduling-rad-cro-ppc/)
- Côté terrain, on définit d'abord le minimum avec lequel l'engin peut décaler, puis on affecte des places nominatives (conducteur qualifié, chef d'agrès). [Firefighter Nation](https://www.firefighternation.com/?p=85745)

**Piège**
- Un agent qui a plusieurs qualifications ne doit compter qu'une fois, sur une seule place. Aucun outil consulté ne documente ce point *(déduction)*. Le raisonnement par places nominatives l'impose de fait. [Firefighter Nation](https://www.firefighternation.com/?p=85745)

### 5. Disponibilités / absences
**Comportements courants / bonnes idées**
- En France, eBrigade (gratuit, open source, né en caserne) s'organise ainsi : les SPV saisissent leurs disponibilités, puis le responsable des gardes construit le tableau à partir de ces saisies. [feuxdeforet.fr](https://feuxdeforet.fr/2019/01/31/ebrigade-une-application-web-gratuite-qui-cartonne-chez-les-pompiers-et-les-secouristes/)
- Les responsables sont prévenus des demandes d'absence et d'échange. L'approbation peut être automatique selon des critères, ou manuelle. [Aladtec](https://tcpsoftware.com/products/aladtec/)

**Piège**
- Dans un SDIS en gestion individuelle centralisée, c'est la disponibilité déclarée au CTA-CODIS qui fait foi pour l'alerte. Une app de CIS qui en tient une deuxième crée une double saisie et des écarts. Elle doit rester une aide à la planification *(déduction)*. [SDIS 81](https://www.sdis81.fr/sites/default/files/actes-reglementaires/095_reconnaissance_disponibilite_declaree_par_spv_en_journee.pdf)

### 6. Remplacements et échanges
**Comportements courants / bonnes idées**
- Deux types d'échange : simple et réciproque (avec « remboursement »). La demande est routée vers les validateurs et vers le personnel qualifié. [First Due](https://support.firstduesizeup.com/hc/en-us/articles/44012304268315-Requesting-a-Shift-Trade) (page bloquée à la lecture, information tirée de l'extrait de recherche)
- L'échange est validé automatiquement s'il respecte les critères, sinon il passe en validation manuelle. [Aladtec](https://tcpsoftware.com/products/aladtec/)
- Exemple de règles locales (Payson, sous CrewSense) : l'accord se fait entre agents, la saisie au moins 7 jours avant, et si le remplaçant se désiste, le titulaire reprend la garde. [Payson AZ](https://paysonaz.gov/home/showpublisheddocument/914/637874527684700000)

**Pièges**
- Le désistement du remplaçant est un cas fréquent. Il faut une règle claire sur qui redevient responsable. [Payson AZ](https://paysonaz.gov/home/showpublisheddocument/914/637874527684700000)
- Aucune source ne dit si un échange est contrôlé contre le minimum et les qualifications avant validation. C'est à vérifier explicitement chez vous. [Aladtec](https://tcpsoftware.com/products/aladtec/)

### 7. Stock / pharmacie
**Comportements courants / bonnes idées**
- Code couleur par rapport au niveau cible : rouge sous le minimum, jaune au minimum, vert au maximum ou au-dessus. Sous le minimum, une alerte automatique demande un réassort ou un transfert. [PSTrax](https://pstrax.com/inventory-checks/)
- Le besoin est converti en conditionnements : il manque 14 unités vendues par boîtes de 10, donc 2 boîtes. [PSTrax](https://pstrax.com/inventory-checks/)
- Les produits périssables sont signalés à l'approche de leur péremption. [PSTrax](https://pstrax.com/inventory-checks/)
- Pour les stupéfiants : traçabilité de la réception jusqu'à l'administration ou la destruction, double vérification (empreinte, signature, PIN) et audit des coffres. [Operative IQ](https://www.operativeiq.com/narcotics-tracking)

**Pièges**
- Chez PSTrax, numéros de lot et dates de péremption se saisissent à la main pendant le comptage. Le coût de saisie est réel. [PSTrax help](https://help.pstrax.com/logging-scheduled-inventory-checks)
- En France, les médicaments relèvent de la pharmacie à usage intérieur (PUI) du SDIS (arrêté du 7 août 2023). Les stupéfiants ont des règles spécifiques (arrêté de 2014). Je n'ai pas vérifié si l'arrêté de 2023 remplace celui de 2014 sur ce point. Un registre de stupéfiants au niveau du CIS sort probablement du périmètre et du droit *(déduction, à valider avec la PUI)*. [Weka](https://www.weka.fr/actualite/sante-et-securite-au-travail/breve_juridique/pharmacies-a-usage-interieur-des-services-departementaux-dincendie-et-de-secours-17692/)

### 8. Réservation (VL, matériel partagé)
**Comportements courants / bonnes idées**
- Google : par défaut, l'acceptation est automatique si le créneau est libre, ce qui empêche la double réservation. Un gestionnaire, qui n'a pas besoin d'être admin, peut quand même refuser. [Brown IT](https://ithelp.brown.edu/kb/articles/control-how-your-resource-calendar-accepts-events), [Google](https://knowledge.workspace.google.com/admin/calendar/approve-or-deny-calendar-room-and-resource-bookings)
- Exchange : soit acceptation automatique, soit demande laissée « provisoire » jusqu'à la décision d'un délégué. [Microsoft](https://learn.microsoft.com/en-us/training/modules/manage-exchange-online-use-windows-powershell/4-manage-resources)
- Pour les externes, Exchange refuse par défaut. Google demande d'approuver le domaine de l'expéditeur, ressource par ressource. [Microsoft](https://learn.microsoft.com/en-us/troubleshoot/exchange/calendars/meeting-requests-routed-through-third-party-service-not-auto-processed), [Cronofy](https://docs.cronofy.com/calendar-admins/enterprise-connect-gsuite/free-busy-access-mode/google-resource-calendars/)
- Libération automatique : chez Google, si tous les invités déclinent, avec des exclusions. [Google](https://support.google.com/a/answer/9047638)

**Pièges**
- Chez Exchange, un réglage qui laisse accepter tout le monde (« AllBookInPolicy ») court-circuite le délégué sans qu'on s'en aperçoive. [office365itpros](https://office365itpros.com/2018/10/18/room-mailbox-automatic-processing/)
- L'option Google « tout ajouter » permet la double réservation. [Brown IT](https://ithelp.brown.edu/kb/articles/control-how-your-resource-calendar-accepts-events)

### 9. Canaux internes (annonces, manœuvres, amicale)
**Comportements courants / bonnes idées**
- Groupe d'annonces WhatsApp : seuls les admins publient. Les réponses sont regroupées et silencieuses. [Android Authority](https://androidauthority.com/whatsapp-communities-events-replies-3439293)
- Événements avec réponse de présence (RSVP), affichés dans les infos du groupe, avec un rappel automatique avant la date. [Android Authority](https://androidauthority.com/whatsapp-communities-events-replies-3439293)
- Teams distingue le message « Important » (simple étiquette) du message « Urgent », qui notifie toutes les 2 minutes pendant 20 minutes jusqu'à lecture. [Microsoft](https://support.microsoft.com/office/mark-a-message-as-important-or-urgent-in-teams-ea99d5b6-1317-4550-8d75-86ff14cd4462)

**Pièges**
- Les accusés de lecture Teams ne fonctionnent pas dans les canaux et dépendent des réglages du destinataire. Pour une prise de connaissance fiable, il faut un bouton explicite « lu / pris connaissance » *(déduction)*. [UO](https://is.uoregon.edu/uo-will-enable-microsoft-teams-read-receipts-nov-20), [UBC](https://canvas.ubc.ca/courses/66705/modules/items/2472047)
- Le message « Urgent » est indisponible dans les canaux et dans les groupes de plus de 20 personnes. [Microsoft](https://support.microsoft.com/office/mark-a-message-as-important-or-urgent-in-teams-ea99d5b6-1317-4550-8d75-86ff14cd4462)

### 10. Messages directs et groupes créés par les utilisateurs
**Comportements courants / bonnes idées**
- Signal : les admins contrôlent qui peut écrire, qui peut modifier les infos du groupe et le minuteur des messages éphémères. [Signal](https://support.signal.org/hc/articles/360007319331-Group-chats)
- Slack : la conservation se règle globalement (tout garder ou suppression après un délai). Les membres peuvent avoir le droit de la régler pour leurs MP et leurs canaux privés. [Slack](https://slack.com/help/articles/203457187)
- Mise en sourdine graduée : « mentions seulement » garde un badge si on vous mentionne. « /mute » coupe tout, même les mentions. [Slack blog](https://slack.com/intl/en-in/blog/productivity/how-to-customize-notifications-in-slack)

**Piège**
- Supprimer un canal efface définitivement ses messages, quelle que soit la politique de conservation. [Slack](https://slack.com/help/articles/203457187)

### 11. Notifications
**Comportements courants / bonnes idées**
- Deux familles de règles par utilisateur, haute et basse urgence, chacune avec un délai d'envoi. Hors horaires, la basse urgence attend et peut passer en haute si personne n'a accusé réception. [PagerDuty](https://support.pagerduty.com/docs/notification-rules), [Dynamic](https://support.pagerduty.com/docs/dynamic-notifications)
- Chaque agent choisit ses canaux : SMS, appel, notification push, bip. [Vector](https://www.vectorsolutions.com/solutions/vector-scheduling/fire-department-shift-scheduling-rad-cro-ppc/)
- Heures calmes programmables (tous les jours, week-end), plus des alertes sur mots-clés. [How-To Geek](https://www.howtogeek.com/241765/how-to-manage-slack-notifications-and-do-not-disturb-settings/)
- Alertes critiques iOS : son au volume maximum même en silencieux ou en Ne pas déranger. L'agent doit les activer lui-même. [Active911](https://active911.com/?p=3259)

**Pièges**
- Apple ne réserve les alertes critiques qu'à certaines catégories d'apps (santé, sécurité du domicile, sécurité publique), sur demande de droit spécial. Pour une app de CIS non opérationnelle, ce droit risque d'être refusé *(déduction)*. [Forum](https://db_f1b8b24d_2c79_4c4a_919d_685188a12f3c.influitive.com/forum/t/iphone-app-bypass-dnd-mode/1815)
- Chez Slack, l'expéditeur peut forcer le Ne pas déranger du destinataire. Ce droit est à réserver à un rôle précis *(déduction)*. [How-To Geek](https://www.howtogeek.com/241765/how-to-manage-slack-notifications-and-do-not-disturb-settings/)
