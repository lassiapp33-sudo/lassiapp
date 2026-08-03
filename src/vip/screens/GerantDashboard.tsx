import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { royal as r } from '../theme';
import { VIP_FONTS } from '../useVipFonts';
import { Blason } from '../composants/Blason';
import { Fleuron } from '../composants/Fleuron';
import { VIP_CATEGORIE_LABELS } from '../../types/vip';
import useGerantStore from '../../store/gerantStore';
import { TOP_INSET } from '../../theme';
import { deconnexionVip } from '../authVip';

type TileId = 'profil' | 'registre' | 'horaires' | 'maison' | 'changeMdp' | 'alaune' | 'avis' | 'classement' | 'livraison' | 'autourDeMoi' | 'reservations_table' | 'espaces_config' | 'creneaux_config' | 'rdv_beauty' | 'creneaux_beauty';

interface Tile {
  id: TileId;
  label: string;
  desc: string;
}

const TILES: Tile[] = [
  { id: 'registre',   label: 'Mon registre', desc: 'Prestations, tarifs, disponibilités' },
  { id: 'horaires',   label: 'Mes heures',   desc: 'Horaires d\'ouverture quotidiens' },
  { id: 'maison',     label: 'Ma maison',    desc: 'Baseline, mot du gérant, initiale' },
  { id: 'changeMdp',  label: 'Mot de passe', desc: 'Changer votre mot de passe d\'accès' },
];

const TILES2: Tile[] = [
  { id: 'alaune',      label: 'À la une',      desc: 'Blocs mis en avant pour vos clients' },
  { id: 'avis',        label: 'Mes avis',       desc: 'Notes et commentaires reçus' },
  { id: 'classement',  label: 'Classement',     desc: 'Votre rang dans votre catégorie' },
  { id: 'livraison',   label: 'Livraison',      desc: 'Demander et suivre une livraison' },
  { id: 'autourDeMoi', label: 'Autour de moi',  desc: 'Prestataires et services à proximité' },
];

const TILES_RESTAURATION: Tile[] = [
  { id: 'reservations_table', label: 'Réservations',  desc: 'Gérer les demandes de table clients' },
  { id: 'espaces_config',     label: 'Mes espaces',   desc: 'Étages, terrasses, salles — configurer' },
  { id: 'creneaux_config',    label: 'Mes créneaux',  desc: 'Déjeuner, dîner, brunch — horaires' },
];

const TILES_BEAUTY: Tile[] = [
  { id: 'rdv_beauty',      label: 'Mes rendez-vous', desc: 'Gérer les demandes de RDV clients' },
  { id: 'creneaux_beauty', label: 'Mes créneaux',    desc: 'Horaires disponibles pour les réservations' },
];

const IcoArrow = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 18l6-6-6-6" />
  </Svg>
);

interface Props {
  onNav: (id: TileId) => void;
  onPreview: () => void;
  onLogout: () => void;
}

export default function GerantDashboard({ onNav, onPreview, onLogout }: Props) {
  const profil      = useGerantStore(s => s.profil);
  const clearGerant = useGerantStore(s => s.clearGerant);

  const handleLogout = async () => {
    try { await deconnexionVip(); } catch {}
    clearGerant();
    onLogout();
  };

  return (
    <View style={s.fond}>
      <StatusBar barStyle="light-content" backgroundColor={r.couleur.encre} />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* En-tête */}
        <View style={[s.entete, { paddingTop: TOP_INSET + 12 }]}>
          <View style={s.enteteInfo}>
            <Text style={s.nom} numberOfLines={1}>{profil?.nomAffiche ?? '…'}</Text>
            <Text style={[r.caps, s.categorie]}>
              {profil ? VIP_CATEGORIE_LABELS[profil.categorie] : ''}
            </Text>
          </View>
          {/* Blason cliquable → écran Profil */}
          <TouchableOpacity onPress={() => onNav('profil')} activeOpacity={0.75}>
            <Blason initiale={profil?.initiale ?? 'V'} taille={64} />
          </TouchableOpacity>
        </View>

        <Fleuron />

        {/* Tuiles de navigation */}
        <View style={s.tuiles}>
          {TILES.map(t => (
            <TouchableOpacity key={t.id} style={s.tuile} onPress={() => onNav(t.id)}>
              <View style={s.tuileTexte}>
                <Text style={s.tuileLabel}>{t.label}</Text>
                <Text style={s.tuileDesc}>{t.desc}</Text>
              </View>
              <IcoArrow />
            </TouchableOpacity>
          ))}
        </View>

        <Fleuron />

        {/* Tuiles services */}
        <View style={s.tuiles}>
          {TILES2.map(t => (
            <TouchableOpacity key={t.id} style={s.tuile} onPress={() => onNav(t.id)}>
              <View style={s.tuileTexte}>
                <Text style={s.tuileLabel}>{t.label}</Text>
                <Text style={s.tuileDesc}>{t.desc}</Text>
              </View>
              <IcoArrow />
            </TouchableOpacity>
          ))}
        </View>

        {/* Réservations de table (restauration uniquement) */}
        {profil?.categorie === 'restauration' && (
          <>
            <Fleuron />
            <View style={s.tuiles}>
              {TILES_RESTAURATION.map(t => (
                <TouchableOpacity key={t.id} style={[s.tuile, s.tuileRestau]} onPress={() => onNav(t.id)}>
                  <View style={s.tuileTexte}>
                    <Text style={s.tuileLabel}>{t.label}</Text>
                    <Text style={s.tuileDesc}>{t.desc}</Text>
                  </View>
                  <IcoArrow />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Rendez-vous (beauté / coiffure uniquement) */}
        {(profil?.categorie === 'beaute_tressage' || profil?.categorie === 'coiffure') && (
          <>
            <Fleuron />
            <View style={s.tuiles}>
              {TILES_BEAUTY.map(t => (
                <TouchableOpacity key={t.id} style={[s.tuile, s.tuileBeauty]} onPress={() => onNav(t.id)}>
                  <View style={s.tuileTexte}>
                    <Text style={s.tuileLabel}>{t.label}</Text>
                    <Text style={s.tuileDesc}>{t.desc}</Text>
                  </View>
                  <IcoArrow />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Fleuron />

        {/* Prévisualiser */}
        <TouchableOpacity style={s.btnPreview} onPress={onPreview}>
          <Text style={s.btnPreviewTxt}>Aperçu de ma fiche →</Text>
        </TouchableOpacity>

        {/* Déconnexion */}
        <TouchableOpacity style={s.btnLogout} onPress={handleLogout}>
          <Text style={s.btnLogoutTxt}>Se déconnecter</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  fond: { flex: 1, backgroundColor: r.couleur.encre },

  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: r.espace.md,
    paddingBottom: r.espace.md,
    gap: r.espace.md,
  },
  enteteInfo: { flex: 1 },
  nom: {
    fontFamily: VIP_FONTS.palais.titre,
    fontSize: 22,
    color: r.couleur.ivoire,
    letterSpacing: 1.5,
  },
  categorie: { marginTop: 6 },

  tuiles: {
    marginHorizontal: r.espace.md,
    borderWidth: 1,
    borderColor: r.couleur.filet,
  },
  tuile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: r.espace.md,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: r.couleur.filetFin,
  },
  tuileRestau: { backgroundColor: `${r.couleur.orLassi}0A` },
  tuileBeauty: { backgroundColor: 'rgba(180,120,200,0.06)' },
  tuileTexte: { flex: 1 },
  tuileLabel: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 15,
    color: r.couleur.ivoire,
    marginBottom: 3,
  },
  tuileDesc: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 11,
    color: r.couleur.gris,
  },

  btnPreview: {
    marginHorizontal: r.espace.md,
    marginBottom: r.espace.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    alignItems: 'center',
  },
  btnPreviewTxt: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 13,
    color: r.couleur.orClair,
    letterSpacing: 1,
  },

  btnLogout: {
    marginHorizontal: r.espace.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnLogoutTxt: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 13,
    color: r.couleur.gris,
    letterSpacing: 1,
  },
});
