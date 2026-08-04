import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  JOURS_SEMAINE,
  VipCategorie,
  VipFiche,
  VipHoraire,
  VipPrestation,
} from '../types/vip';
import { getVipFiche } from '../services/vip';
import { royal as r } from './theme';
import { VIP_FONTS } from './useVipFonts';
import { Blason } from './composants/Blason';
import { Monogramme } from './composants/Monogramme';
import { Fleuron } from './composants/Fleuron';
import { Ecrin, fcfa } from './composants/Ecrin';
import { ouvrirNavigation } from '../utils/navigation';
import { TOP_INSET } from '../theme';
import useCartStore, { CartShopInfo, selectTotalPrice, selectTotalQty } from '../store/cartStore';
import CartFloating from '../components/shop/CartFloating';
import { calculerPrixClientVip } from '../config/payment';

// ─── CTA par catégorie ────────────────────────────────────────────────────────

const CTA_LABEL: Record<VipCategorie, string> = {
  restauration:          'Réserver une table',
  beaute_tressage:       'Prendre rendez-vous',
  coiffure:              'Prendre rendez-vous',
  musculation_fitness:   'Choisir une formule',
  boulangerie_patisserie:'Écrire',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculerStatut(
  horaires: VipHoraire[],
  isManuallyClosed: boolean,
): { ouvert: boolean; fermeA: string | null } {
  if (isManuallyClosed) return { ouvert: false, fermeA: null };
  const now = new Date();
  const jourUtc = now.getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const minCourant = now.getUTCHours() * 60 + now.getUTCMinutes();
  const h = horaires.find(x => x.jour === jourUtc);
  if (!h || h.ferme || !h.ouverture || !h.fermeture) return { ouvert: false, fermeA: null };
  const [ho, mo] = h.ouverture.split(':').map(Number);
  const [hf, mf] = h.fermeture.split(':').map(Number);
  return {
    ouvert: minCourant >= ho * 60 + mo && minCourant < hf * 60 + mf,
    fermeA: h.fermeture.slice(0, 5),
  };
}

function sectionsDePrestations(prestations: VipPrestation[]): [string, VipPrestation[]][] {
  const map = new Map<string, VipPrestation[]>();
  for (const p of prestations) {
    if (p.estSignature) continue;
    const key = p.section ?? 'Carte';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  const entries = [...map.entries()];
  entries.forEach(([, items]) => items.sort((a, b) => a.ordre - b.ordre));
  entries.sort((a, b) => (a[1][0]?.ordre ?? 0) - (b[1][0]?.ordre ?? 0));
  return entries;
}

// Lundi en premier, dimanche en dernier
function trierHoraires(horaires: VipHoraire[]): VipHoraire[] {
  return [...horaires].sort((a, b) => {
    const ord = (j: number) => (j === 0 ? 7 : j);
    return ord(a.jour) - ord(b.jour);
  });
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function IcoBack() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
      stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 18l-6-6 6-6" />
    </Svg>
  );
}

function StatutBadge({ ouvert, fermeA }: { ouvert: boolean; fermeA: string | null }) {
  const couleur = ouvert ? r.couleur.vert : r.couleur.gris;
  return (
    <View style={[s.statutBadge, { borderColor: couleur }]}>
      <Text style={[s.statutTexte, { color: couleur }]}>
        {ouvert
          ? fermeA ? `Ouvert · ferme à ${fermeA}` : 'Ouvert'
          : 'Fermé'}
      </Text>
    </View>
  );
}

function FrontonPalais({ profil }: { profil: VipFiche['profil'] }) {
  return (
    <View style={s.fronton}>
      <Blason initiale={profil.initiale} taille={92} />
      <Text style={s.frontonNom}>{profil.nomAffiche}</Text>
      {profil.baseline != null && (
        <Text style={s.frontonBaseline}>{profil.baseline}</Text>
      )}
      {profil.adresseCourte != null && (
        <Text style={[r.caps, s.frontonAdresse]}>{profil.adresseCourte}</Text>
      )}
    </View>
  );
}

function PortiqueMaison({ profil }: { profil: VipFiche['profil'] }) {
  return (
    <View>
      <View style={s.panneauVelours}>
        <Monogramme initiale={profil.initiale} taille={120} />
        <Text style={s.portNom}>{profil.nomAffiche}</Text>
        {profil.baseline != null && (
          <Text style={s.portBaseline}>{profil.baseline}</Text>
        )}
      </View>
      {profil.adresseCourte != null && (
        <Text style={[r.caps, s.portAdresse]}>{profil.adresseCourte}</Text>
      )}
    </View>
  );
}

function SectionTitre({ titre, isPalais }: { titre: string; isPalais: boolean }) {
  if (isPalais) {
    return (
      <View style={s.sectionTitrePalais}>
        <View style={s.sectionFilet} />
        <Text style={s.sectionTextPalais}>{titre.toUpperCase()}</Text>
        <View style={s.sectionFilet} />
      </View>
    );
  }
  return <Text style={s.sectionTextMaison}>{titre}</Text>;
}

function LigneMets({ presta, onAjouter }: { presta: VipPrestation; onAjouter?: (p: VipPrestation) => void }) {
  const epuise = !presta.disponible;
  return (
    <View style={[s.mets, epuise && s.epuise]}>
      <View style={s.metsNomRangee}>
        <Text style={s.metsNom}>{presta.nom}</Text>
        {!epuise && (
          <TouchableOpacity style={s.plusBouton} onPress={() => onAjouter?.(presta)} activeOpacity={0.7} hitSlop={8}>
            <Text style={s.plusTexte}>+</Text>
          </TouchableOpacity>
        )}
      </View>
      {presta.description != null && (
        <Text style={s.metsDesc}>{presta.description}</Text>
      )}
      {presta.mention != null && (
        <Text style={[r.caps, s.metsMention]}>{presta.mention}</Text>
      )}
      {epuise ? (
        <Text style={[r.caps, s.epuiseLabel]}>Épuisé</Text>
      ) : (
        <Text style={s.metsPrix}>
          {fcfa(calculerPrixClientVip(presta.prix))}
          {presta.prixBarre != null && (
            <Text style={s.metsBarre}>{'  '}{fcfa(calculerPrixClientVip(presta.prixBarre))}</Text>
          )}
          {presta.unite != null && (
            <Text style={s.metsUnite}> / {presta.unite}</Text>
          )}
        </Text>
      )}
    </View>
  );
}

function LignePresta({ presta, onAjouter }: { presta: VipPrestation; onAjouter?: (p: VipPrestation) => void }) {
  const epuise = !presta.disponible;
  return (
    <View style={[s.prestaLigne, epuise && s.epuise]}>
      <View style={s.prestaGauche}>
        <View style={s.prestaNomRangee}>
          <Text style={s.prestaNom}>{presta.nom}</Text>
          {!epuise && (
            <TouchableOpacity style={s.plusBouton} onPress={() => onAjouter?.(presta)} activeOpacity={0.7} hitSlop={8}>
              <Text style={s.plusTexte}>+</Text>
            </TouchableOpacity>
          )}
        </View>
        {presta.description != null && (
          <Text style={s.prestaDesc}>{presta.description}</Text>
        )}
      </View>
      <View style={s.prestaDroite}>
        {epuise ? (
          <Text style={[r.caps, s.epuiseLabel]}>Épuisé</Text>
        ) : (
          <>
            <Text style={s.prestaPrix}>{fcfa(calculerPrixClientVip(presta.prix))}</Text>
            {presta.prixBarre != null && (
              <Text style={s.prestaBarre}>{fcfa(calculerPrixClientVip(presta.prixBarre))}</Text>
            )}
            {presta.unite != null && (
              <Text style={s.prestaUnite}>/{presta.unite}</Text>
            )}
            {presta.mention != null && (
              <Text style={[r.caps, s.prestaMention]}>{presta.mention}</Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function LigneHoraire({
  h,
  estAujourdHui,
}: {
  h: VipHoraire;
  estAujourdHui: boolean;
}) {
  const jourLabel = JOURS_SEMAINE[h.jour];
  const heures = h.ferme
    ? 'Fermé'
    : h.ouverture && h.fermeture
    ? `${h.ouverture.slice(0, 5)} – ${h.fermeture.slice(0, 5)}`
    : '—';
  return (
    <View style={[s.horaireLigne, estAujourdHui && s.horaireAujourdHui]}>
      <Text style={[s.horaireJour, estAujourdHui && s.horaireJourActif]}>
        {jourLabel}
      </Text>
      <Text style={[s.horaireHeure, h.ferme && s.horaireFerme]}>{heures}</Text>
    </View>
  );
}

function ErreurVue({
  onBack,
  onRetry,
}: {
  onBack: () => void;
  onRetry: () => void;
}) {
  return (
    <View style={[s.fond, s.centre]}>
      <StatusBar barStyle="light-content" backgroundColor={r.couleur.encre} />
      <TouchableOpacity
        onPress={onBack}
        style={[s.backBouton, { position: 'absolute', top: TOP_INSET + 12, left: 20 }]}
        hitSlop={12}>
        <IcoBack />
      </TouchableOpacity>
      <Text style={s.erreurTexte}>Fiche indisponible</Text>
      <TouchableOpacity onPress={onRetry} style={s.reessayerBouton}>
        <Text style={s.reessayerTexte}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

interface Props {
  shopId: string;
  onBack: () => void;
  onChat: (shopId: string, shopName: string) => void;
  onGoCart?: (shopId: string, shopName: string, mode: 'normal' | 'livraison') => void;
  onReserver?: (vipProfilId: string, vipNom: string) => void;
  onPrendreRdv?: (vipProfilId: string, vipNom: string, categorie: VipCategorie) => void;
  onGoMap?: (nomBoutique: string) => void;
}

export default function FicheVip({ shopId, onBack, onChat, onGoCart, onReserver, onPrendreRdv, onGoMap }: Props) {
  const [fiche, setFiche] = useState<VipFiche | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [modalCommander, setModalCommander] = useState(false);

  const addItem    = useCartStore(s => s.addItem);
  const setOrderType = useCartStore(s => s.setOrderType);
  const cartCount  = useCartStore(selectTotalQty);
  const cartTotal  = useCartStore(selectTotalPrice);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(false);
    const data = await getVipFiche(shopId);
    if (!data) {
      setErreur(true);
    } else {
      setFiche(data);
    }
    setChargement(false);
  }, [shopId]);

  useEffect(() => { charger(); }, [charger]);

  if (chargement) {
    return (
      <View style={[s.fond, s.centre]}>
        <StatusBar barStyle="light-content" backgroundColor={r.couleur.encre} />
        <ActivityIndicator color={r.couleur.or} size="large" />
      </View>
    );
  }

  if (erreur || !fiche) {
    return <ErreurVue onBack={onBack} onRetry={charger} />;
  }

  const { profil, prestations, horaires, shop } = fiche;
  const isPalais = profil.gabarit === 'palais';
  const statut = calculerStatut(horaires, shop.isManuallyClose);
  const signature = prestations.find(p => p.estSignature) ?? null;
  const sections = sectionsDePrestations(prestations);
  const horairesTries = trierHoraires(horaires);
  const jourCourant = new Date().getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const ctaLabel = CTA_LABEL[profil.categorie];

  const onNaviguer = () => {
    if (onGoMap) {
      onGoMap(profil.nomAffiche);
    } else {
      ouvrirNavigation({
        latitude: shop.latitude,
        longitude: shop.longitude,
        adresse: profil.adresseCourte,
        nomLieu: profil.nomAffiche,
      });
    }
  };

  const onEcrire = () => onChat(shopId, profil.nomAffiche);

  const onCtaPrimaire = () => {
    if (profil.categorie === 'restauration' && onReserver) {
      onReserver(profil.id, profil.nomAffiche);
    } else if (
      (profil.categorie === 'beaute_tressage' || profil.categorie === 'coiffure') &&
      onPrendreRdv
    ) {
      onPrendreRdv(profil.id, profil.nomAffiche, profil.categorie);
    } else {
      onEcrire();
    }
  };

  const shopInfo: CartShopInfo = {
    id: shop.id,
    initial: profil.initiale,
    name: profil.nomAffiche,
    location: profil.adresseCourte ?? '',
    logoUrl: shop.logoUrl ?? undefined,
    showOrderType: false,
    isVip: true,
  };

  const onAjouter = (p: VipPrestation) => {
    addItem(shopInfo, { id: p.id, name: p.nom, emoji: '', price: calculerPrixClientVip(p.prix) });
  };

  const onCommander = (mode: 'normal' | 'livraison') => {
    setModalCommander(false);
    onGoCart?.(shopId, profil.nomAffiche, mode);
  };

  return (
    <View style={s.fond}>
      <StatusBar barStyle="light-content" backgroundColor={r.couleur.encre} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* En-tête : retour + statut */}
        <View style={[s.entete, { paddingTop: TOP_INSET + 12 }]}>
          <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBouton}>
            <IcoBack />
          </TouchableOpacity>
          <StatutBadge ouvert={statut.ouvert} fermeA={statut.fermeA} />
        </View>

        {/* Fronton palais ou Portique maison */}
        {isPalais
          ? <FrontonPalais profil={profil} />
          : <PortiqueMaison profil={profil} />
        }

        {/* Prestation signature → Ecrin */}
        {signature != null && (
          <Ecrin
            surtitre="Signature maison"
            titre={signature.nom}
            description={signature.description ?? undefined}
            prix={calculerPrixClientVip(signature.prix)}
            prixBarre={signature.prixBarre != null ? calculerPrixClientVip(signature.prixBarre) : null}
          />
        )}

        <Fleuron />

        {/* Registre des prestations par section */}
        {sections.map(([sectionNom, items]) => (
          <View key={sectionNom}>
            <SectionTitre titre={sectionNom} isPalais={isPalais} />
            {items.map(p =>
              isPalais
                ? <LigneMets key={p.id} presta={p} onAjouter={onAjouter} />
                : <LignePresta key={p.id} presta={p} onAjouter={onAjouter} />
            )}
          </View>
        ))}

        {sections.length > 0 && <Fleuron />}

        {/* Horaires */}
        {horairesTries.length > 0 && (
          <View style={s.bloc}>
            <Text style={[r.caps, s.blocTitre]}>Horaires</Text>
            {horairesTries.map(h => (
              <LigneHoraire
                key={h.id}
                h={h}
                estAujourdHui={h.jour === jourCourant}
              />
            ))}
          </View>
        )}

        {/* Mot du gérant */}
        {profil.motDuGerant != null && (
          <>
            <Fleuron />
            <View style={s.bloc}>
              <Text style={[r.caps, s.blocTitre]}>Le gérant</Text>
              <Text style={s.motTexte}>« {profil.motDuGerant} »</Text>
              {profil.signatureMot != null && (
                <Text style={s.signatureGerant}>{profil.signatureMot}</Text>
              )}
            </View>
          </>
        )}

        {/* M'y rendre */}
        {(shop.latitude != null || profil.adresseCourte != null) && (
          <TouchableOpacity style={s.navRangee} onPress={onNaviguer}>
            <Text style={s.navAdresse} numberOfLines={1}>
              {profil.adresseCourte ?? 'Dakar'}
            </Text>
            <Text style={s.navFleche}>{'→'}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 96 }} />
      </ScrollView>

      {/* CartFloating — s'affiche dès qu'un article est dans le panier */}
      <CartFloating
        count={cartCount}
        total={cartTotal}
        onPress={() => onGoCart?.(shopId, profil.nomAffiche, 'normal')}
        bottom={(Platform.OS === 'ios' ? 34 : 14) + 72}
      />

      {/* Barre d'action fixe */}
      <View style={[s.barre, { paddingBottom: Platform.OS === 'ios' ? 34 : 14 }]}>
        <TouchableOpacity style={s.boutonSecond} onPress={() => setModalCommander(true)} activeOpacity={0.7}>
          <Text style={s.texteSecond}>Commander</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.boutonPrimaire} onPress={onCtaPrimaire} activeOpacity={0.85}>
          <Text style={s.textePrimaire}>{ctaLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* Modal — choix du mode de commande */}
      <Modal
        visible={modalCommander}
        transparent
        animationType="fade"
        onRequestClose={() => setModalCommander(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setModalCommander(false)}>
          <Pressable style={s.modalCard} onPress={e => e.stopPropagation()}>
            <Text style={s.modalSurtitre}>COMMENT SOUHAITEZ-VOUS COMMANDER ?</Text>
            <View style={s.modalFilet} />
            <TouchableOpacity
              style={s.modalOption}
              onPress={() => onCommander('normal')}
              activeOpacity={0.7}
            >
              <Text style={s.modalOptionTitre}>Commander</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modalOption, s.modalOptionDernier]}
              onPress={() => onCommander('livraison')}
              activeOpacity={0.7}
            >
              <Text style={s.modalOptionTitre}>Commander + Livrer</Text>
              <Text style={s.modalOptionSous}>Livraison à domicile</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  fond:   { flex: 1, backgroundColor: r.couleur.encre },
  centre: { alignItems: 'center', justifyContent: 'center' },

  // En-tête
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: r.espace.md,
    paddingBottom: r.espace.sm,
  },
  backBouton: { padding: 4 },

  // Statut badge
  statutBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 2,
  },
  statutTexte: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 11,
    letterSpacing: 1,
  },

  // ── Fronton palais ──────────────────────────────────────────────────────────
  fronton: {
    alignItems: 'center',
    paddingTop: r.espace.lg,
    paddingBottom: r.espace.md,
    paddingHorizontal: r.espace.lg,
  },
  frontonNom: {
    fontFamily: VIP_FONTS.palais.titre,
    fontSize: 28,
    color: r.couleur.ivoire,
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: r.espace.md,
  },
  frontonBaseline: {
    fontFamily: VIP_FONTS.palais.corpsIt,
    fontSize: 16,
    color: r.couleur.gris,
    textAlign: 'center',
    marginTop: r.espace.xs,
    lineHeight: 26,
  },
  frontonAdresse: {
    marginTop: r.espace.sm,
    textAlign: 'center',
  },

  // ── Portique maison ─────────────────────────────────────────────────────────
  panneauVelours: {
    backgroundColor: r.couleur.encre,
    alignItems: 'center',
    paddingTop: r.espace.xl,
    paddingBottom: r.espace.xl,
    paddingHorizontal: r.espace.lg,
  },
  portNom: {
    fontFamily: VIP_FONTS.maison.titre,
    fontSize: 30,
    color: r.couleur.ivoire,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: r.espace.md,
  },
  portBaseline: {
    fontFamily: VIP_FONTS.maison.corpsIt,
    fontSize: 15,
    color: r.couleur.gris,
    textAlign: 'center',
    marginTop: r.espace.xs,
    lineHeight: 24,
    paddingHorizontal: r.espace.xl,
  },
  portAdresse: {
    textAlign: 'center',
    marginTop: r.espace.md,
    marginBottom: r.espace.xs,
  },

  // ── Sections ────────────────────────────────────────────────────────────────
  sectionTitrePalais: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: r.espace.md,
    marginTop: r.espace.lg,
    marginBottom: r.espace.sm,
  },
  sectionFilet: {
    flex: 1,
    height: 1,
    backgroundColor: r.couleur.filetFin,
  },
  sectionTextPalais: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 9.5,
    letterSpacing: 3.2,
    color: r.couleur.orClair,
    marginHorizontal: r.espace.md,
  },
  sectionTextMaison: {
    fontFamily: VIP_FONTS.maison.titre,
    fontSize: 20,
    color: r.couleur.orClair,
    textAlign: 'center',
    marginTop: r.espace.lg,
    marginBottom: r.espace.sm,
  },

  // ── Ligne mets palais (centrée) ─────────────────────────────────────────────
  mets: {
    alignItems: 'center',
    paddingHorizontal: r.espace.md,
    paddingVertical: r.espace.sm,
    borderBottomWidth: 1,
    borderBottomColor: r.couleur.filetFin,
  },
  metsNom: {
    fontFamily: VIP_FONTS.palais.titre,
    fontSize: 16,
    color: r.couleur.ivoire,
    letterSpacing: 1,
    textAlign: 'center',
  },
  metsDesc: {
    fontFamily: VIP_FONTS.palais.corpsIt,
    fontSize: 13,
    color: r.couleur.gris,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 20,
  },
  metsMention: {
    marginTop: 4,
    color: r.couleur.or,
  },
  metsPrix: {
    fontFamily: VIP_FONTS.palais.titre,
    fontSize: 17,
    color: r.couleur.orClair,
    letterSpacing: 1.2,
    marginTop: r.espace.xs,
  },
  metsBarre: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 11,
    color: r.couleur.gris,
    textDecorationLine: 'line-through',
  },
  metsUnite: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 11,
    color: r.couleur.gris,
  },

  // ── Ligne prestation maison (2 colonnes) ────────────────────────────────────
  prestaLigne: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: r.espace.md,
    paddingVertical: r.espace.sm,
    borderBottomWidth: 1,
    borderBottomColor: r.couleur.filetFin,
  },
  prestaGauche: {
    flex: 1,
    paddingRight: r.espace.sm,
  },
  prestaDroite: {
    alignItems: 'flex-end',
    minWidth: 90,
  },
  prestaNom: {
    fontFamily: VIP_FONTS.maison.semi,
    fontSize: 15,
    color: r.couleur.ivoire,
  },
  prestaDesc: {
    fontFamily: VIP_FONTS.maison.corpsIt,
    fontSize: 12,
    color: r.couleur.gris,
    marginTop: 3,
    lineHeight: 18,
  },
  prestaPrix: {
    fontFamily: VIP_FONTS.maison.titre,
    fontSize: 16,
    color: r.couleur.orClair,
  },
  prestaBarre: {
    fontFamily: VIP_FONTS.maison.util,
    fontSize: 11,
    color: r.couleur.gris,
    textDecorationLine: 'line-through',
  },
  prestaUnite: {
    fontFamily: VIP_FONTS.maison.util,
    fontSize: 11,
    color: r.couleur.gris,
  },
  prestaMention: {
    marginTop: 2,
    color: r.couleur.or,
  },

  // ── Épuisé ──────────────────────────────────────────────────────────────────
  epuise:      { opacity: 0.42 },
  epuiseLabel: { color: r.couleur.gris },

  // ── Horaires ────────────────────────────────────────────────────────────────
  bloc: {
    marginHorizontal: r.espace.md,
    marginBottom: r.espace.lg,
  },
  blocTitre: {
    marginBottom: r.espace.sm,
  },
  horaireLigne: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: r.couleur.filetFin,
  },
  horaireAujourdHui: {
    borderBottomColor: r.couleur.filet,
  },
  horaireJour: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 13,
    color: r.couleur.gris,
  },
  horaireJourActif: {
    color: r.couleur.orClair,
  },
  horaireHeure: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 13,
    color: r.couleur.ivoire,
  },
  horaireFerme: {
    color: r.couleur.gris,
  },

  // ── Mot du gérant ───────────────────────────────────────────────────────────
  motTexte: {
    fontFamily: VIP_FONTS.palais.corpsIt,
    fontSize: 17,
    color: r.couleur.ivoire,
    lineHeight: 30,
    textAlign: 'center',
    paddingHorizontal: r.espace.sm,
    marginBottom: r.espace.xs,
  },
  signatureGerant: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 12,
    color: r.couleur.or,
    textAlign: 'center',
    marginTop: r.espace.sm,
    letterSpacing: 1.5,
  },

  // ── M'y rendre ──────────────────────────────────────────────────────────────
  navRangee: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: r.espace.md,
    marginBottom: r.espace.md,
    paddingVertical: r.espace.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: r.couleur.filetFin,
  },
  navAdresse: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 13,
    color: r.couleur.gris,
    flex: 1,
  },
  navFleche: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 18,
    color: r.couleur.or,
    marginLeft: r.espace.sm,
  },

  // ── Barre d'action fixe ─────────────────────────────────────────────────────
  barre: {
    flexDirection: 'row',
    paddingHorizontal: r.espace.md,
    paddingTop: r.espace.sm,
    backgroundColor: r.couleur.encre,
    borderTopWidth: 1,
    borderTopColor: r.couleur.filetFin,
    gap: r.espace.sm,
  },
  boutonSecond: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    alignItems: 'center',
  },
  texteSecond: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 14,
    color: r.couleur.orClair,
    letterSpacing: 1,
  },
  boutonPrimaire: {
    flex: 2,
    paddingVertical: 14,
    backgroundColor: r.couleur.orLassi,
    alignItems: 'center',
  },

  // ── Petit bouton + par produit ───────────────────────────────────────────────
  metsNomRangee: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  prestaNomRangee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  plusBouton: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: r.couleur.or,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusTexte: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 14,
    color: r.couleur.or,
    lineHeight: 16,
    includeFontPadding: false,
  },
  textePrimaire: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 14,
    color: r.couleur.encre,
    letterSpacing: 0.5,
  },

  // ── Modal panier ─────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: r.couleur.encre,
    borderTopWidth: 1,
    borderTopColor: r.couleur.filet,
    paddingTop: r.espace.lg,
    paddingHorizontal: r.espace.md,
    paddingBottom: 44,
  },
  modalSurtitre: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 9,
    letterSpacing: 2.5,
    color: r.couleur.gris,
    textAlign: 'center',
    marginBottom: r.espace.md,
  },
  modalFilet: {
    height: 1,
    backgroundColor: r.couleur.filetFin,
    marginBottom: r.espace.sm,
  },
  modalOption: {
    paddingVertical: r.espace.md,
    borderBottomWidth: 1,
    borderBottomColor: r.couleur.filetFin,
    alignItems: 'center',
  },
  modalOptionDernier: {
    borderBottomWidth: 0,
  },
  modalOptionTitre: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 15,
    letterSpacing: 0.8,
    color: r.couleur.ivoire,
  },
  modalOptionSous: {
    fontFamily: VIP_FONTS.palais.corpsIt,
    fontSize: 12,
    color: r.couleur.gris,
    marginTop: 4,
  },

  // ── Erreur ──────────────────────────────────────────────────────────────────
  erreurTexte: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 16,
    color: r.couleur.gris,
    marginBottom: r.espace.lg,
  },
  reessayerBouton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: r.couleur.or,
  },
  reessayerTexte: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 13,
    color: r.couleur.or,
  },
});
