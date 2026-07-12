export interface AlaUneElement {
  id: string;
  nom: string;
  prix: number;
}

export interface AlaUneBloc {
  id: string;
  prestataireId: string;
  titre: string;
  description: string | null;
  categorieId: string;
  sousCategorieId: string | null;
  elements: AlaUneElement[];
  actif: boolean;
  createdAt: string;
  expireAt: string;
  shopName?: string;
  shopLogoUrl?: string | null;
}
