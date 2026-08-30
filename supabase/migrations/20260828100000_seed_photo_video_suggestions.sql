-- Seed suggestions_fiche pour photo_video (photographe + vidéaste)
-- Adapté au marché dakarois : mariages, baptêmes, événements, portraits

INSERT INTO public.suggestions_fiche (categorie_id, sous_categorie_id, section, valeur, ordre, actif) VALUES

-- ══════════════════════════════════════════════════════════════
-- CATEGORY : photo_video — SOUS-CAT : photographe
-- ══════════════════════════════════════════════════════════════

-- type_contenu
('photo_video','photographe','type_contenu','Tarif prestation',1,true),
('photo_video','photographe','type_contenu','Forfait événement',2,true),
('photo_video','photographe','type_contenu','Pack photo',3,true),
('photo_video','photographe','type_contenu','Grille tarifaire',4,true),
('photo_video','photographe','type_contenu','Catalogue services',5,true),

-- sous_categorie_produit
('photo_video','photographe','sous_categorie_produit','Mariage',1,true),
('photo_video','photographe','sous_categorie_produit','Baptême',2,true),
('photo_video','photographe','sous_categorie_produit','Anniversaire',3,true),
('photo_video','photographe','sous_categorie_produit','Portrait & Studio',4,true),
('photo_video','photographe','sous_categorie_produit','Entreprise & Corporate',5,true),
('photo_video','photographe','sous_categorie_produit','Remise de diplôme',6,true),
('photo_video','photographe','sous_categorie_produit','Couverture presse',7,true),
('photo_video','photographe','sous_categorie_produit','Retouche & Post-traitement',8,true),

-- nom_produit
('photo_video','photographe','nom_produit','Séance portrait studio (1h)',1,true),
('photo_video','photographe','nom_produit','Couverture mariage journée complète',2,true),
('photo_video','photographe','nom_produit','Couverture baptême demi-journée',3,true),
('photo_video','photographe','nom_produit','Pack 50 photos retouchées',4,true),
('photo_video','photographe','nom_produit','Pack 100 photos retouchées',5,true),
('photo_video','photographe','nom_produit','Pack 200 photos retouchées',6,true),
('photo_video','photographe','nom_produit','Couverture anniversaire (3h)',7,true),
('photo_video','photographe','nom_produit','Séance famille (1h)',8,true),
('photo_video','photographe','nom_produit','Photo corporate & CV professionnel',9,true),
('photo_video','photographe','nom_produit','Couverture événement entreprise',10,true),
('photo_video','photographe','nom_produit','Remise de diplôme (cérémonie)',11,true),
('photo_video','photographe','nom_produit','Retouche photo unitaire',12,true),
('photo_video','photographe','nom_produit','Album photo imprimé (30 pages)',13,true),
('photo_video','photographe','nom_produit','Shooting mode & catalogue',14,true),

-- prix
('photo_video','photographe','prix','5 000',1,true),
('photo_video','photographe','prix','10 000',2,true),
('photo_video','photographe','prix','15 000',3,true),
('photo_video','photographe','prix','25 000',4,true),
('photo_video','photographe','prix','35 000',5,true),
('photo_video','photographe','prix','50 000',6,true),
('photo_video','photographe','prix','75 000',7,true),
('photo_video','photographe','prix','100 000',8,true),
('photo_video','photographe','prix','150 000',9,true),
('photo_video','photographe','prix','200 000',10,true),
('photo_video','photographe','prix','300 000',11,true),

-- ══════════════════════════════════════════════════════════════
-- CATEGORY : photo_video — SOUS-CAT : videaste
-- ══════════════════════════════════════════════════════════════

-- type_contenu
('photo_video','videaste','type_contenu','Tarif prestation',1,true),
('photo_video','videaste','type_contenu','Forfait tournage',2,true),
('photo_video','videaste','type_contenu','Pack vidéo',3,true),
('photo_video','videaste','type_contenu','Grille tarifaire',4,true),
('photo_video','videaste','type_contenu','Catalogue services',5,true),

-- sous_categorie_produit
('photo_video','videaste','sous_categorie_produit','Mariage',1,true),
('photo_video','videaste','sous_categorie_produit','Baptême',2,true),
('photo_video','videaste','sous_categorie_produit','Clip musical',3,true),
('photo_video','videaste','sous_categorie_produit','Publicité & Corporate',4,true),
('photo_video','videaste','sous_categorie_produit','Anniversaire',5,true),
('photo_video','videaste','sous_categorie_produit','Remise de diplôme',6,true),
('photo_video','videaste','sous_categorie_produit','Événement & Conférence',7,true),
('photo_video','videaste','sous_categorie_produit','Montage & Post-production',8,true),

-- nom_produit
('photo_video','videaste','nom_produit','Film mariage complet (journée)',1,true),
('photo_video','videaste','nom_produit','Film baptême demi-journée',2,true),
('photo_video','videaste','nom_produit','Clip musical (tournage + montage)',3,true),
('photo_video','videaste','nom_produit','Vidéo publicitaire courte (30s)',4,true),
('photo_video','videaste','nom_produit','Vidéo publicitaire longue (2 min)',5,true),
('photo_video','videaste','nom_produit','Couverture anniversaire (3h)',6,true),
('photo_video','videaste','nom_produit','Film remise de diplôme',7,true),
('photo_video','videaste','nom_produit','Couverture conférence / séminaire',8,true),
('photo_video','videaste','nom_produit','Montage vidéo à partir de rushes',9,true),
('photo_video','videaste','nom_produit','Teaser événement (1 min)',10,true),
('photo_video','videaste','nom_produit','Film institutionnel entreprise',11,true),
('photo_video','videaste','nom_produit','Live streaming événement',12,true),
('photo_video','videaste','nom_produit','Drone (prise de vue aérienne)',13,true),
('photo_video','videaste','nom_produit','Reportage documentaire',14,true),

-- prix
('photo_video','videaste','prix','10 000',1,true),
('photo_video','videaste','prix','20 000',2,true),
('photo_video','videaste','prix','35 000',3,true),
('photo_video','videaste','prix','50 000',4,true),
('photo_video','videaste','prix','75 000',5,true),
('photo_video','videaste','prix','100 000',6,true),
('photo_video','videaste','prix','150 000',7,true),
('photo_video','videaste','prix','200 000',8,true),
('photo_video','videaste','prix','300 000',9,true),
('photo_video','videaste','prix','500 000',10,true);
