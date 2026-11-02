-- Ajouté à la main : le rôle système « Chef d'équipe » écrit autrement (apostrophe droite, casse, espaces) devient aussi « Chef de garde ».
-- Additive : seul le libellé change ; un nom choisi par le centre est gardé.
UPDATE `responsabilite` SET `nom` = 'Chef de garde' WHERE `systeme` = 'chef_equipe' AND replace(replace(replace(lower(trim(`nom`)), '’', ''''), 'É', 'é'), 'é', 'e') = 'chef d''equipe';
