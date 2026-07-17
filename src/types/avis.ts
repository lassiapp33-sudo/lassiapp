export interface Avis {
  id: string;
  orderId: string | null;
  shopId: string;
  authorId: string;
  authorName: string;
  note: number;
  commentaire: string | null;
  photoUrl: string | null;
  vocalUrl: string | null;
  reponseCommercant: string | null;
  masque: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AvisInput {
  orderId?: string;
  shopId: string;
  authorId: string;
  authorName: string;
  note: number;
  commentaire?: string;
  photoUrl?: string;
  vocalUrl?: string;
}

export interface CanLeaveAvisResult {
  canLeave: boolean;
  existingAvisId?: string;
  existingAvis?: Avis;
}
