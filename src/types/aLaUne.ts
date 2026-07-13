export interface ElementALaUne {
  id: string;
  nom: string;
  prix: number;
}

export interface BlocALaUne {
  id: string;
  prestataire_id: string;
  titre: string;
  description: string | null;
  categorie_id: string;
  sous_categorie_id: string | null;
  elements: ElementALaUne[];
  actif: boolean;
  created_at: string;
  expire_at: string;
  code?: string;
  // enrichi côté client par getBlocsActifs
  shop_name?: string;
  shop_logo_url?: string | null;
}
