export interface Avis {
  id:                 string;
  orderId:            string;
  shopId:             string;
  authorId:           string;
  authorName:         string;
  note:               number;
  commentaire:        string | null;
  photoUrl:           string | null;
  reponseCommercant:  string | null;
  masque:             boolean;
  createdAt:          string;
  updatedAt:          string;
}

export interface AvisInput {
  orderId:     string;
  shopId:      string;
  authorName:  string;
  note:        number;
  commentaire?: string;
  photoUrl?:   string;
}

export interface CanLeaveAvisResult {
  canLeave:        boolean;
  orderId?:        string;   // order éligible (done, sans avis)
  existingAvisId?: string;   // si toutes les commandes ont déjà un avis → édition
  existingAvis?:   Avis;
}
