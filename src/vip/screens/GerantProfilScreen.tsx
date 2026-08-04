import React, { useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { royal as r } from '../theme';
import { VIP_FONTS } from '../useVipFonts';
import { Blason } from '../composants/Blason';
import { VIP_CATEGORIE_LABELS } from '../../types/vip';
import useGerantStore from '../../store/gerantStore';
import useLanguageStore from '../../store/languageStore';
import { TOP_INSET } from '../../theme';
import { deconnexionVip } from '../authVip';
import HelpScreen from '../../screens/home/HelpScreen';
import SignalerProblemeScreen from '../../screens/common/SignalerProblemeScreen';
import AProposScreen from '../../screens/common/AProposScreen';
import LanguageModal from '../../components/common/LanguageModal';
import { contacterServiceClient } from '../../config/contact';
import DeleteAccountModal from '../../components/common/DeleteAccountModal';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoBack = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

const IcoFleche = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 18l6-6-6-6" />
  </Svg>
);

const IcoRegistre = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    <Path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
    <Path d="M9 12h6M9 16h4" />
  </Svg>
);

const IcoHorloge = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 6v6l4 2" />
  </Svg>
);

const IcoMaison = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <Path d="M9 22V12h6v10" />
  </Svg>
);

const IcoOeil = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" />
    <Circle cx={12} cy={12} r={3} />
  </Svg>
);

const IcoCle = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </Svg>
);

const IcoBell = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </Svg>
);

const IcoGlobe = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={9} />
    <Path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </Svg>
);

const IcoAide = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={9} />
    <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <Path d="M12 17h.01" />
  </Svg>
);

const IcoFlag = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <Path d="M4 22v-7" />
  </Svg>
);

const IcoInfo = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 8h.01M11 12h1v4h1" />
  </Svg>
);

const IcoWhatsapp = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </Svg>
);

const IcoTrend = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 17l6-6 4 4 8-8M17 7h4v4" />
  </Svg>
);

const IcoMega = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 11v2M18 8c1.5.8 2.5 2.3 2.5 4s-1 3.2-2.5 4" />
    <Path d="M5 11v2h3l6 4V7l-6 4H5z" />
  </Svg>
);

const IcoDollar = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </Svg>
);

const IcoWallet = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
    <Path d="M16 3H8L4 7h16l-4-4zM16 13h.01" />
  </Svg>
);

const IcoCrown = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke={r.couleur.or} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2 20h20M5 20l-1-9 6 4 4-8 4 8 6-4-1 9H5z" />
  </Svg>
);

// ─── Composant ligne ──────────────────────────────────────────────────────────

function Ligne({
  icone,
  titre,
  sousTitre,
  fin = 'fleche',
  actif,
  onToggle,
  onPress,
  derniere = false,
}: {
  icone: React.ReactNode;
  titre: string;
  sousTitre?: string;
  fin?: 'fleche' | 'toggle' | 'aucun';
  actif?: boolean;
  onToggle?: () => void;
  onPress?: () => void;
  derniere?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[lg.ligne, derniere && lg.derniere]}
      onPress={onPress}
      activeOpacity={fin === 'toggle' ? 1 : 0.7}
      disabled={fin === 'toggle'}
    >
      <View style={lg.icone}>{icone}</View>
      <View style={lg.texte}>
        <Text style={lg.titre}>{titre}</Text>
        {sousTitre ? <Text style={lg.sous}>{sousTitre}</Text> : null}
      </View>
      {fin === 'fleche' && <IcoFleche />}
      {fin === 'toggle' && (
        <Switch
          value={actif}
          onValueChange={onToggle}
          trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(201,162,39,0.35)' }}
          thumbColor={actif ? r.couleur.or : r.couleur.gris}
          ios_backgroundColor="rgba(255,255,255,0.1)"
        />
      )}
    </TouchableOpacity>
  );
}

const lg = StyleSheet.create({
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: r.couleur.filetFin,
    gap: 14,
  },
  derniere: { borderBottomWidth: 0 },
  icone: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(201,162,39,0.08)',
    borderWidth: 1,
    borderColor: r.couleur.filetFin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texte: { flex: 1 },
  titre: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 14,
    color: r.couleur.ivoire,
    marginBottom: 2,
  },
  sous: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 11,
    color: r.couleur.gris,
  },
});

// ─── Types ────────────────────────────────────────────────────────────────────

type NavId = 'registre' | 'horaires' | 'maison' | 'changeMdp' | 'visibilite' | 'campagne' | 'revenus' | 'encaissements' | 'offreQuartier';

interface Props {
  onBack: () => void;
  onNav: (id: NavId) => void;
  onPreview: () => void;
  onLogout: () => void;
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function GerantProfilScreen({ onBack, onNav, onPreview, onLogout }: Props) {
  const profil      = useGerantStore(s => s.profil);
  const clearGerant = useGerantStore(s => s.clearGerant);
  const lang        = useLanguageStore(s => s.lang);

  const [notifOn,          setNotifOn]          = useState(true);
  const [showLang,         setShowLang]         = useState(false);
  const [showHelp,         setShowHelp]         = useState(false);
  const [showSignaler,     setShowSignaler]     = useState(false);
  const [showAPropos,      setShowAPropos]      = useState(false);
  const [showDeleteModal,  setShowDeleteModal]  = useState(false);

  const handleLogout = async () => {
    Alert.alert(
      'Se déconnecter',
      'Quitter l\'interface gérant ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: async () => {
            try { await deconnexionVip(); } catch {}
            clearGerant();
            onLogout();
          },
        },
      ],
    );
  };

  if (showHelp)     return <HelpScreen     onBack={() => setShowHelp(false)} role="merchant" />;
  if (showSignaler) return <SignalerProblemeScreen onBack={() => setShowSignaler(false)} profil="prestataire" />;
  if (showAPropos)  return <AProposScreen  onBack={() => setShowAPropos(false)} />;

  return (
    <View style={s.fond}>
      <StatusBar barStyle="light-content" backgroundColor={r.couleur.encre} />

      {/* En-tête navigation */}
      <View style={[s.navbar, { paddingTop: TOP_INSET + 8 }]}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={s.btnBack}>
          <IcoBack />
        </TouchableOpacity>
        <Text style={s.navTitre}>Profil</Text>
        <View style={s.btnBack} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Carte identité établissement */}
        <View style={s.carteId}>
          <Blason initiale={profil?.initiale ?? 'V'} taille={64} />
          <View style={s.carteInfo}>
            <Text style={s.nom} numberOfLines={1}>{profil?.nomAffiche ?? '—'}</Text>
            <Text style={[r.caps, s.categorie]}>
              {profil ? VIP_CATEGORIE_LABELS[profil.categorie] : ''}
            </Text>
            <View style={s.badge}>
              <Text style={s.badgeTxt}>✦ Établissement 5 Étoiles</Text>
            </View>
          </View>
        </View>

        {/* ── MON ÉTABLISSEMENT ───────────────────────────── */}
        <Text style={s.secLabel}>Mon Établissement</Text>
        <View style={s.groupe}>
          <Ligne
            icone={<IcoRegistre />}
            titre="Mon registre"
            sousTitre="Prestations, tarifs, disponibilités"
            onPress={() => onNav('registre')}
          />
          <Ligne
            icone={<IcoHorloge />}
            titre="Mes heures"
            sousTitre="Horaires d'ouverture quotidiens"
            onPress={() => onNav('horaires')}
          />
          <Ligne
            icone={<IcoMaison />}
            titre="Ma maison"
            sousTitre="Baseline, mot du gérant, initiale"
            onPress={() => onNav('maison')}
          />
          <Ligne
            icone={<IcoTrend />}
            titre="Visibilité"
            sousTitre="3 façons d'être plus visible"
            onPress={() => onNav('visibilite')}
          />
          <Ligne
            icone={<IcoMega />}
            titre="Ma Campagne"
            sousTitre="Annonces sponsorisées & forfaits actifs"
            onPress={() => onNav('campagne')}
          />
          <Ligne
            icone={<IcoDollar />}
            titre="Mes revenus"
            sousTitre="Rapports & statistiques"
            onPress={() => onNav('revenus')}
          />
          <Ligne
            icone={<IcoWallet />}
            titre="Mes encaissements"
            sousTitre="Virements reçus & historique Wave / OM"
            onPress={() => onNav('encaissements')}
          />
          <Ligne
            icone={<IcoCrown />}
            titre="Offre du Quartier"
            sousTitre="Vos services mis en avant sur l'accueil"
            onPress={() => onNav('offreQuartier')}
          />
          <Ligne
            icone={<IcoOeil />}
            titre="Aperçu de ma fiche"
            sousTitre="Voir comme vos clients"
            onPress={onPreview}
            derniere
          />
        </View>

        {/* ── PARAMÈTRES ──────────────────────────────────── */}
        <Text style={s.secLabel}>Paramètres</Text>
        <View style={s.groupe}>
          <Ligne
            icone={<IcoCle />}
            titre="Mot de passe"
            sousTitre="Sécurité d'accès"
            onPress={() => onNav('changeMdp')}
          />
          <Ligne
            icone={<IcoBell />}
            titre="Notifications"
            sousTitre="Nouvelles commandes, alertes"
            fin="toggle"
            actif={notifOn}
            onToggle={() => setNotifOn(v => !v)}
          />
          <Ligne
            icone={<IcoGlobe />}
            titre="Langue"
            sousTitre={lang === 'fr' ? 'Français' : 'English'}
            onPress={() => setShowLang(true)}
            derniere
          />
        </View>

        {/* ── AIDE & COMPTE ───────────────────────────────── */}
        <Text style={s.secLabel}>Aide & Compte</Text>
        <View style={s.groupe}>
          <Ligne
            icone={<IcoAide />}
            titre="Aide & support"
            onPress={() => setShowHelp(true)}
          />
          <Ligne
            icone={<IcoFlag />}
            titre="Signaler un problème"
            onPress={() => setShowSignaler(true)}
          />
          <Ligne
            icone={<IcoInfo />}
            titre="À propos"
            onPress={() => setShowAPropos(true)}
          />
          <Ligne
            icone={<IcoWhatsapp />}
            titre="Contacter LASSI"
            sousTitre="Support via WhatsApp"
            onPress={() => contacterServiceClient().catch(() => {})}
            derniere
          />
        </View>

        {/* Déconnexion */}
        <TouchableOpacity style={s.btnLogout} onPress={handleLogout} activeOpacity={0.7}>
          <Text style={s.btnLogoutTxt}>Se déconnecter</Text>
        </TouchableOpacity>

        {/* Suppression de compte */}
        <TouchableOpacity style={s.btnDelete} onPress={() => setShowDeleteModal(true)} activeOpacity={0.7}>
          <Text style={s.btnDeleteTxt}>Supprimer mon compte</Text>
        </TouchableOpacity>

        <View style={{ height: 48 }} />
      </ScrollView>

      <LanguageModal visible={showLang} onClose={() => setShowLang(false)} />
      <DeleteAccountModal
        visible={showDeleteModal}
        role="merchant"
        onClose={() => setShowDeleteModal(false)}
        onSuccess={() => { clearGerant(); onLogout(); }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  fond: { flex: 1, backgroundColor: r.couleur.encre },

  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  btnBack: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitre: {
    fontFamily: VIP_FONTS.palais.titre,
    fontSize: 15,
    color: r.couleur.ivoire,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  carteId: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 16,
    gap: 16,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: r.couleur.filet,
  },
  carteInfo: { flex: 1 },
  nom: {
    fontFamily: VIP_FONTS.palais.titre,
    fontSize: 18,
    color: r.couleur.ivoire,
    letterSpacing: 1.2,
  },
  categorie: { marginTop: 4 },
  badge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: r.couleur.filet,
  },
  badgeTxt: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 10,
    color: r.couleur.orClair,
    letterSpacing: 0.8,
  },

  secLabel: {
    ...r.caps,
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
  },
  groupe: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: r.couleur.filet,
    overflow: 'hidden',
  },

  btnLogout: {
    marginHorizontal: 20,
    marginTop: 28,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: r.couleur.filetFin,
    alignItems: 'center',
  },
  btnLogoutTxt: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 13,
    color: r.couleur.gris,
    letterSpacing: 1,
  },
  btnDelete: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(224,122,122,0.3)',
    alignItems: 'center',
  },
  btnDeleteTxt: {
    fontFamily: VIP_FONTS.palais.util,
    fontSize: 13,
    color: 'rgb(224,122,122)',
    letterSpacing: 1,
  },
});
