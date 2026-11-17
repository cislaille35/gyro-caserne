-- Écrite à la main. Un rôle natif (installé avec le centre) n'a pas de modèle d'origine : seuls les rôles créés par le centre en gardent un.
-- La migration 0022 avait marqué à tort le référent habillement natif ; un rôle créé par le centre a sa ligne de création au journal.
UPDATE `responsabilite` SET `modele` = NULL
WHERE `modele` = 'referent_habillement'
	AND NOT EXISTS (SELECT 1 FROM `journal` j WHERE j.`action` = 'creer_responsabilite' AND j.`cible_type` = 'responsabilite' AND j.`cible_id` = `responsabilite`.`id`);
