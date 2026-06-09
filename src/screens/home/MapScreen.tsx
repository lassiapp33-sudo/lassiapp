import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { LassiMascotte, MASCOTTE_NOM } from '../../components/LassiMascotte';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import { colors, fonts, TOP_INSET } from '../../theme';
import { IcoBack, IcoSearch } from '../../components/icons';
import Avatar from '../../components/Avatar';
import useLocationStore from '../../store/locationStore';
import * as shopsService from '../../services/shops';
import {
  haversineMeters,
  formatDistance,
  walkMinutes,
  reverseGeocode,
} from '../../services/location';
import type { Shop } from '../../services/shops';
import { computeStatus, type WeekHours } from '../../services/hours';
import { useRealtimeShops } from '../../hooks/useRealtimeShops';
import { CATEGORIES } from '../../config/categories';

// ─── HTML Leaflet embarqué (100 % gratuit — tuiles Carto dark) ────────────────

const buildMapHTML = (lat: number, lng: number): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body{width:100%;height:100%;background:#14152A;}
    #map{width:100%;height:100%;}
    .leaflet-control-attribution{font-size:8px!important;background:rgba(20,21,42,.8)!important;color:#5a5c80!important;border-radius:4px!important;}
    .leaflet-control-attribution a{color:#5a5c80!important;}
    /* Pin */
    .lp{display:flex;flex-direction:column;align-items:center;cursor:pointer;}
    .lp-crown{font-size:11px;line-height:1;margin-bottom:1px;}
    .lp-b{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 4px 10px rgba(0,0,0,.45);}
    .lp-b.std{background:#1E2040;border:2px solid #2A2C52;}
    .lp-b.vip{background:#FDCF34;border:2px solid #fff;}
    .lp-b.sel{border-color:#FDCF34!important;box-shadow:0 0 0 3px rgba(253,207,52,.4);}
    .lp-t{width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid;margin-top:-1px;}
    .lp-t.std{border-top-color:#2A2C52;}
    .lp-t.vip{border-top-color:#FDCF34;}
    /* Dot utilisateur */
    .ud{width:18px;height:18px;border-radius:50%;background:#4D9FFF;border:3px solid #fff;box-shadow:0 0 0 14px rgba(77,159,255,.18);}
  </style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>
const IMG_STYLE='width:26px;height:26px;border-radius:8px;object-fit:cover;';
const FB_LAT=${lat};const FB_LNG=${lng};
const map=L.map('map',{center:[${lat},${lng}],zoom:15,zoomControl:false});

L.tileLayer('https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',{
  attribution:'© OpenStreetMap contributors © CARTO',maxZoom:19
}).addTo(map);

// Marqueur utilisateur
const uIco=L.divIcon({html:'<div class="ud"></div>',iconSize:[18,18],iconAnchor:[9,9],className:''});
let uMarker=L.marker([${lat},${lng}],{icon:uIco,zIndexOffset:2000}).addTo(map);

// Marqueurs commerces
const mkrs={};
let selId=null;
let lastShops=[];

function escapeHtml(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function renderShops(shops){
  lastShops=shops;
  Object.values(mkrs).forEach(m=>map.removeLayer(m));
  Object.keys(mkrs).forEach(k=>delete mkrs[k]);
  shops.forEach(s=>{
    const slat=s.latitude||FB_LAT;const slng=s.longitude||FB_LNG;
    const v=s.isVip;
    const sel=s.id===selId;
    const initial=escapeHtml((s.name||'?').charAt(0).toUpperCase());
    const txtColor=v?'#14152A':'#FDCF34';
    const content=s.logoUrl
      ?'<img src="'+escapeHtml(s.logoUrl)+'" style="'+IMG_STYLE+'">'
      :'<span style="color:'+txtColor+';font-weight:700;font-size:18px;font-family:sans-serif;line-height:1;">'+initial+'</span>';
    const html='<div class="lp">'
      +(v?'<div class="lp-crown">👑</div>':'')
      +'<div class="lp-b '+(v?'vip':'std')+(sel?' sel':'')+'">'+content+'</div>'
      +'<div class="lp-t '+(v?'vip':'std')+'"></div></div>';
    const ico=L.divIcon({html,iconSize:[40,52],iconAnchor:[20,52],className:''});
    const m=L.marker([slat,slng],{icon:ico,zIndexOffset:v?1000:100});
    m.on('click',function(){selId=s.id;renderShops(lastShops);sendRN({type:'shopPress',shopId:s.id});});
    m.addTo(map);
    mkrs[s.id]=m;
  });
}

function sendRN(d){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(d));}

map.on('moveend',function(){
  const b=map.getBounds();
  sendRN({type:'regionChange',minLat:b.getSouth(),maxLat:b.getNorth(),minLng:b.getWest(),maxLng:b.getEast()});
});

// Commandes reçues de React Native
function dispatchCmd(str){
  try{
    const d=JSON.parse(str);
    if(d.type==='shops') renderShops(d.shops);
    if(d.type==='recenter'){uMarker.setLatLng([d.lat,d.lng]);map.setView([d.lat,d.lng],16,{animate:true});}
    if(d.type==='clearSel'){selId=null;renderShops(lastShops);}
  }catch(e){}
}
document.addEventListener('message',function(e){dispatchCmd(e.data);});
window.addEventListener('message',function(e){dispatchCmd(e.data);});

// Signal "prêt" vers React Native
sendRN({type:'ready'});
</script>
</body>
</html>
`;

// ─── Filtres de catégories ────────────────────────────────────────────────────

const SUBCAT_FILTERS = [
  { id: 'all', label: 'Tout', emoji: null as string | null, imageUri: null as number | null },
  ...CATEGORIES.flatMap(cat =>
    cat.subcats.map(sub => ({
      id: sub.id,
      label: sub.label,
      emoji: sub.emoji,
      imageUri: sub.imageUri ?? null,
    })),
  ),
];

// ─── Icônes SVG ───────────────────────────────────────────────────────────────

const W = colors.white;

const IcoRecenter = () => (
  <Svg
    width={21}
    height={21}
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <SvgCircle cx={12} cy={12} r={3} stroke={colors.accent} />
    <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke={colors.accent} />
  </Svg>
);

// ─── Bottom sheet ─────────────────────────────────────────────────────────────

interface SheetProps {
  shop: Shop;
  distanceM: number | null;
  zone: string;
  onView: () => void;
  onRoute: () => void;
}

function MapShopSheet({ shop, distanceM, zone, onView, onRoute }: SheetProps) {
  const distStr = distanceM !== null ? formatDistance(distanceM) : null;
  const walkStr = distanceM !== null ? walkMinutes(distanceM) : null;
  const { isOpen } = computeStatus(
    shop.openingHours as WeekHours | null,
    shop.isManuallyClose ?? false,
  );

  return (
    <View style={styles.sheet}>
      <View style={styles.grab} />

      <View style={styles.sheetCard}>
        {/* Logo boutique — Avatar unique, source de vérité shops.logo_url */}
        <Avatar imageUrl={shop.logoUrl} name={shop.name} size={52} variant="shop" />

        <View style={styles.sheetInfo}>
          <View style={styles.sheetTopRow}>
            <Text style={styles.sheetName} numberOfLines={1}>
              {shop.name}
            </Text>
            {shop.isVip && <Text style={styles.vipBadge}>🏆 VIP</Text>}
          </View>
          <View style={styles.sheetMeta}>
            <Text style={styles.sheetMetaTxt}>⭐ {shop.rating.toFixed(1)}</Text>
            <Text style={[styles.sheetMetaTxt, { color: isOpen ? colors.success : colors.danger }]}>
              ● {isOpen ? 'Ouvert' : 'Fermé'}
            </Text>
            {zone ? <Text style={styles.sheetMetaTxt}>{zone}</Text> : null}
          </View>
        </View>

        {distStr ? (
          <View style={styles.sheetDist}>
            <Text style={styles.sheetDistKm}>{distStr}</Text>
            {walkStr ? <Text style={styles.sheetDistWalk}>{walkStr}</Text> : null}
          </View>
        ) : null}
      </View>

      <View style={styles.sheetActions}>
        <TouchableOpacity style={styles.btnGo} onPress={onView} activeOpacity={0.85}>
          <Svg
            width={17}
            height={17}
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M5 12h14M12 5l7 7-7 7" stroke={colors.bg} />
          </Svg>
          <Text style={styles.btnGoTxt}>Voir le commerce</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnRoute} onPress={onRoute} activeOpacity={0.85}>
          <Svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M3 11 22 2 13 21 11 13 3 11z" stroke={colors.accent} />
          </Svg>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  onShopPress?: (shopId: string, shopName: string) => void;
  excludeShopId?: string;
  initialFilter?: string;
  initialSearchQuery?: string;
  onFilterChange?: (filter: string) => void;
  onSearchChange?: (query: string) => void;
}

// Position de secours : Dakar centre
const DAKAR = { latitude: 14.7167, longitude: -17.4677 };

export default function MapScreen({
  onBack,
  onShopPress,
  excludeShopId,
  initialFilter,
  initialSearchQuery,
  onFilterChange,
  onSearchChange,
}: Props) {
  const wvRef = useRef<WebView>(null);
  const sheetAnim = useRef(new Animated.Value(300)).current;

  const coords = useLocationStore(s => s.coords);
  const refreshLocation = useLocationStore(s => s.refreshLocation);

  const [allShops, setAllShops] = useState<Shop[]>([]);
  const [selected, setSelected] = useState<Shop | null>(null);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState(initialFilter ?? 'all');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery ?? '');
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Position initiale (vraie ou Dakar en fallback)
  const initLat = coords?.latitude ?? DAKAR.latitude;
  const initLng = coords?.longitude ?? DAKAR.longitude;

  // ── Chargement de TOUS les commerces ────────────────────────────────────
  const loadAllShops = useCallback(async () => {
    setLoading(true);
    try {
      const data = await shopsService.getShops();
      setAllShops(data);
    } catch {
      setAllShops([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Montage seul — chargement initial unique ; loadAllShops est useCallback([]), refreshLocation est stable (Zustand)
  useEffect(() => {
    if (!coords) refreshLocation();
    loadAllShops();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mise à jour temps réel quand un commerce change ses horaires ou son statut
  useRealtimeShops(updated => {
    setAllShops(prev => prev.map(s => (s.id === updated.id ? updated : s)));
  });

  // Recentre la carte quand la position GPS devient disponible
  useEffect(() => {
    if (!coords || !mapReady) return;
    sendToWebView({ type: 'recenter', lat: coords.latitude, lng: coords.longitude });
  }, [coords, mapReady]);

  // ── Envoi vers la WebView ────────────────────────────────────────────────
  const sendToWebView = (data: object) => {
    wvRef.current?.postMessage(JSON.stringify(data));
  };

  // ── Shops filtrés envoyés à la WebView à chaque changement ──────────────
  useEffect(() => {
    if (!mapReady) return;
    let filtered =
      activeFilter === 'all'
        ? allShops
        : allShops.filter(s => s.subcategories.includes(activeFilter));
    if (excludeShopId) filtered = filtered.filter(s => s.id !== excludeShopId);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => s.name.toLowerCase().includes(q));
    }
    sendToWebView({ type: 'shops', shops: filtered });
  }, [allShops, activeFilter, mapReady, searchQuery, excludeShopId]);

  // ── Messages de la WebView → React Native ────────────────────────────────
  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      // La carte est prête → on envoie les shops initiaux
      if (data.type === 'ready') {
        setMapReady(true);
        return;
      }

      if (data.type === 'regionChange') return;

      // Tap sur un pin
      if (data.type === 'shopPress') {
        const shop = allShops.find(s => s.id === data.shopId);
        if (!shop) return;
        setSelected(shop);
        Animated.spring(sheetAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 60,
          friction: 10,
        }).start();
      }
    } catch {
      // message non JSON — ignoré
    }
  };

  // ── Zone GPS du shop sélectionné ─────────────────────────────────────────
  useEffect(() => {
    if (!selected) {
      setSelectedZone('');
      return;
    }
    if (selected.zone) {
      setSelectedZone(selected.zone);
      return;
    }
    if (selected.latitude && selected.longitude) {
      reverseGeocode(selected.latitude, selected.longitude)
        .then(z => setSelectedZone(z))
        .catch(() => setSelectedZone(''));
    }
  }, [selected]);

  // ── Fermeture du bottom sheet ────────────────────────────────────────────
  const closeSheet = () => {
    Animated.timing(sheetAnim, {
      toValue: 300,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setSelected(null);
      sendToWebView({ type: 'clearSel' });
    });
  };

  // ── Distance utilisateur ↔ shop sélectionné ──────────────────────────────
  const distanceM =
    selected && coords && selected.latitude && selected.longitude
      ? haversineMeters(coords.latitude, coords.longitude, selected.latitude, selected.longitude)
      : null;

  // ── Itinéraire externe ────────────────────────────────────────────────────
  const openRoute = (shop: Shop) => {
    if (!shop.latitude || !shop.longitude) return;
    const url =
      Platform.OS === 'ios'
        ? `maps://maps.apple.com/?daddr=${shop.latitude},${shop.longitude}`
        : `geo:${shop.latitude},${shop.longitude}?q=${encodeURIComponent(shop.name)}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`,
      ),
    );
  };

  // ── Recentrer ────────────────────────────────────────────────────────────
  const handleRecenter = () => {
    if (!coords) {
      refreshLocation();
      return;
    }
    sendToWebView({ type: 'recenter', lat: coords.latitude, lng: coords.longitude });
  };

  return (
    <View style={styles.root}>
      {/* ── WebView Leaflet plein écran ─────────────────────────────────── */}
      <WebView
        ref={wvRef}
        style={StyleSheet.absoluteFill}
        source={{ html: buildMapHTML(initLat, initLng) }}
        originWhitelist={['*']}
        onMessage={handleWebViewMessage}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        // Nécessaire pour que le tactile fonctionne correctement sur Android
        overScrollMode="never"
        scrollEnabled={false}
      />

      {/* ── Topbar flottante ────────────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
          <IcoBack />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <IcoSearch />
          <TextInput
            style={styles.searchInput}
            placeholder="Chercher sur la carte…"
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={t => {
              setSearchQuery(t);
              onSearchChange?.(t);
            }}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>
      </View>

      {/* ── Filtres catégories flottants ────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
        // Empêche le ScrollView de capturer le scroll vertical de la carte
        nestedScrollEnabled
      >
        {SUBCAT_FILTERS.map(f => {
          const on = activeFilter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterChip, on && styles.filterChipOn]}
              onPress={() => {
                setActiveFilter(f.id);
                onFilterChange?.(f.id);
              }}
              activeOpacity={0.8}
            >
              {f.imageUri ? (
                <Image source={f.imageUri} style={styles.filterIco} resizeMode="cover" />
              ) : f.emoji ? (
                <Text style={styles.filterEmoji}>{f.emoji}</Text>
              ) : null}
              <Text style={[styles.filterTxt, on && styles.filterTxtOn]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Bouton recentrer ─────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.recenter} onPress={handleRecenter} activeOpacity={0.85}>
        <IcoRecenter />
      </TouchableOpacity>

      {/* ── Indicateur de chargement ─────────────────────────────────────── */}
      {loading && (
        <View style={styles.loadingBadge}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      )}

      {/* ── État vide ────────────────────────────────────────────────────── */}
      {!loading && mapReady && allShops.length === 0 && (
        <View style={styles.emptyBadge}>
          <LassiMascotte forme="explorer" taille={110} glow={false} />
          <Text style={styles.emptyTxt}>
            {`${MASCOTTE_NOM} explore… aucun commerce ici pour l'instant.`}
          </Text>
        </View>
      )}

      {/* ── Bottom sheet (tap sur un pin) ─────────────────────────────────── */}
      {selected && (
        <Animated.View style={[styles.sheetWrap, { transform: [{ translateY: sheetAnim }] }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeSheet}
          />
          <MapShopSheet
            shop={selected}
            distanceM={distanceM}
            zone={selectedZone}
            onView={() => {
              closeSheet();
              onShopPress?.(selected.id, selected.name);
            }}
            onRoute={() => openRoute(selected)}
          />
        </Animated.View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  // Topbar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(20,21,42,.92)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  searchBox: {
    flex: 1,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(20,21,42,.92)',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 9,
  },
  searchInput: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 12.5,
    padding: 0,
  },

  // Filtres
  filtersScroll: {
    position: 'absolute',
    top: TOP_INSET + 58,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  filtersContent: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 11,
    backgroundColor: 'rgba(20,21,42,.92)',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  filterChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterIco: { width: 22, height: 22, borderRadius: 5 },
  filterEmoji: { fontSize: 13 },
  filterTxt: { color: colors.muted, fontFamily: fonts.ui, fontSize: 12 },
  filterTxtOn: { color: colors.bg },

  // Recentrer
  recenter: {
    position: 'absolute',
    right: 16,
    bottom: 250,
    zIndex: 30,
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(20,21,42,.95)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Indicateurs
  loadingBadge: {
    position: 'absolute',
    right: 16,
    top: TOP_INSET + 108,
    zIndex: 30,
  },
  emptyBadge: {
    position: 'absolute',
    bottom: 200,
    left: 40,
    right: 40,
    zIndex: 30,
    backgroundColor: 'rgba(20,21,42,.9)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  emptyTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
  },

  // Bottom sheet
  sheetWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: -8 },
    shadowRadius: 20,
    elevation: 20,
  },
  grab: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  sheetCard: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  sheetInfo: { flex: 1, minWidth: 0 },
  sheetTopRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sheetName: {
    color: W,
    fontFamily: fonts.titleXL,
    fontSize: 16,
    flexShrink: 1,
  },
  vipBadge: {
    color: colors.accent,
    fontFamily: fonts.ui,
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(253,207,52,.15)',
    borderRadius: 6,
  },
  sheetMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  sheetMetaTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 11.5 },
  sheetDist: { alignItems: 'flex-end', flexShrink: 0 },
  sheetDistKm: { color: colors.accent, fontFamily: fonts.titleXL, fontSize: 15 },
  sheetDistWalk: { color: colors.muted, fontFamily: fonts.body, fontSize: 9.5, marginTop: 2 },

  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 15 },
  btnGo: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  btnGoTxt: { color: colors.bg, fontFamily: fonts.title, fontSize: 13.5 },
  btnRoute: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
