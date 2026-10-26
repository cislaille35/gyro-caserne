# 0007 — Courriels par Brevo, sans domaine

- **Contexte** : les liens de connexion partent par courriel. Le mot d'ordre est la gratuité, et le centre n'a pas de nom de domaine, seulement la boîte `cislaille35@gmail.com`. Resend (prévu en 0003) exige un domaine authentifié pour écrire à d'autres adresses que celle du compte.
- **Options** :
  - acheter un domaine (environ 10 € par an) : la solution fiable ;
  - Brevo, offre gratuite (300 courriels par jour), avec l'adresse Gmail vérifiée comme expéditeur ;
  - envoyer directement par la boîte Gmail : compliqué depuis Cloudflare, et fragile.
- **Choix** : Brevo avec `cislaille35@gmail.com`, nom affiché « Gyro Caserne ». Brevo s'appelle par une simple requête HTTP : Resend est retiré, sans nouvelle bibliothèque.
- **Pourquoi** : gratuit, et une dépendance en moins.
- **Contrepartie** : sans domaine, Brevo remplace l'adresse d'envoi par une adresse à lui ; les courriels risquent davantage d'arriver dans les indésirables. L'écran de connexion invite à y regarder.
- **Plus tard** : si le comité accepte un domaine, on l'authentifie dans Brevo et on change le secret `COURRIEL_EXPEDITEUR`. Aucun code à modifier.
- **Validé par** : le porteur du projet, le 26/10/2026.
