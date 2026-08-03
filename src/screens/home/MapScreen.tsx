import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Linking,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LassiMascotte, MASCOTTE_NOM } from '../../components/LassiMascotte';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import { colors, fonts, TOP_INSET } from '../../theme';
import { IcoBack, IcoSearch } from '../../components/icons';
import Avatar from '../../components/Avatar';
import useLocationStore from '../../store/locationStore';
import * as shopsService from '../../services/shops';
import { recordCarteClick } from '../../services/recentlyViewed';
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
import { ouvrirNavigation } from '../../utils/navigation';

// ─── HTML Leaflet embarqué (100 % gratuit — tuiles CARTO Voyager claires) ─────

const buildMapHTML = (lat: number, lng: number): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body{width:100%;height:100%;background:#F0EFE9;}
    #map{width:100%;height:100%;}
    .leaflet-control-attribution{font-size:8px!important;background:rgba(255,255,255,.88)!important;color:#9CA3AF!important;border-radius:6px!important;border:none!important;padding:2px 6px!important;}
    .leaflet-control-attribution a{color:#9CA3AF!important;}
    /* Pin commerce */
    .lp{display:flex;flex-direction:column;align-items:center;cursor:pointer;}
    .lp-crown{font-size:11px;line-height:1;margin-bottom:2px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));}
    .lp-b{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 3px 10px rgba(0,0,0,.18);transition:transform .15s ease,box-shadow .15s ease;}
    .lp-b.std{background:#FFFFFF;border:2px solid #E5E7EB;}
    .lp-b.vip{background:#FDCF34;border:2.5px solid #fff;box-shadow:0 4px 14px rgba(253,207,52,.45);}
    .lp-b.sel{border-color:#FDCF34!important;box-shadow:0 0 0 3px rgba(253,207,52,.35),0 4px 14px rgba(0,0,0,.18);transform:scale(1.12);}
    .lp-t{width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid;margin-top:-1px;}
    .lp-t.std{border-top-color:#E5E7EB;}
    .lp-t.vip{border-top-color:#FDCF34;}
    /* Pin siège LASSI */
    .lp-b.lassi{background:#FDCF34;border:3px solid #fff;box-shadow:0 4px 16px rgba(253,207,52,.55),0 0 0 5px rgba(253,207,52,.18);}
    .lp-t.lassi{border-top-color:#FDCF34;}
    .lassi-popup .leaflet-popup-content-wrapper{background:#fff;border:1px solid rgba(253,207,52,.4);border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.14);padding:0;}
    .lassi-popup .leaflet-popup-content{margin:10px 14px;color:#14152A;font-family:sans-serif;font-size:13px;line-height:1.6;}
    .lassi-popup .leaflet-popup-tip{background:#fff;}
    .lassi-popup .leaflet-popup-close-button{color:#9CA3AF!important;font-size:16px!important;top:6px!important;right:8px!important;}
    /* Dot utilisateur */
    .ud{width:18px;height:18px;border-radius:50%;background:#3B82F6;border:3px solid #fff;box-shadow:0 2px 8px rgba(59,130,246,.5),0 0 0 12px rgba(59,130,246,.15);}
  </style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>
const IMG_STYLE='width:28px;height:28px;border-radius:9px;object-fit:cover;';
const map=L.map('map',{center:[${lat},${lng}],zoom:15,zoomControl:false});

L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{
  attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
  maxZoom:20,detectRetina:true
}).addTo(map);

// Marqueur utilisateur — zIndex bas pour ne pas couvrir les pins de prestataires
const uIco=L.divIcon({html:'<div class="ud"></div>',iconSize:[18,18],iconAnchor:[9,9],className:''});
let uMarker=L.marker([${lat},${lng}],{icon:uIco,zIndexOffset:50}).addTo(map);

// Marqueur siège LASSI — toujours visible, zIndex max
const LASSI_LAT=14.7950;const LASSI_LNG=-17.4098;
const lassiHtml='<div class="lp"><div class="lp-crown">⭐</div><div class="lp-b lassi" style="color:#14152A;font-size:20px;font-weight:900;font-family:sans-serif;line-height:1;">L</div><div class="lp-t lassi"></div></div>';
const lassiIco=L.divIcon({html:lassiHtml,iconSize:[40,56],iconAnchor:[20,56],className:''});
L.marker([LASSI_LAT,LASSI_LNG],{icon:lassiIco,zIndexOffset:3000})
  .bindPopup('<div><b style="color:#14152A;font-size:14px;">🏢 Siège LASSI</b><br><span style="color:#6B7280;font-size:12px;">Guédiawaye — Golf Sud<br>Fith Mith, Dakar</span></div>',{className:'lassi-popup',maxWidth:210,closeButton:true})
  .addTo(map);

// Marqueurs commerces — diff intelligent via fingerprints
const mkrs={};
const mkrFP={};
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

// Calcule une empreinte unique du pin — si elle n'a pas changé, on ne recrée pas le marqueur
function fingerprint(s,sel){
  return (s.isEtoiles?'1':'0')+'|'+(s.isVip&&!s.isEtoiles?'1':'0')+'|'+(s.hasGoldenPin?'1':'0')+'|'+(s.id===sel?'1':'0')+'|'+(s.logoUrl||'');
}

function createMarker(s){
  const exclu=s.isEtoiles;
  const v=s.isVip&&!exclu;
  const pin=s.hasGoldenPin;
  const gold=exclu||v||pin;
  const sel=s.id===selId;
  const initial=escapeHtml((s.name||'?').charAt(0).toUpperCase());
  const txtColor=gold?'#14152A':'#374151';
  const content=s.logoUrl
    ?'<img src="'+escapeHtml(s.logoUrl)+'" style="'+IMG_STYLE+'" loading="lazy">'
    :'<span style="color:'+txtColor+';font-weight:700;font-size:18px;font-family:sans-serif;line-height:1;">'+initial+'</span>';
  const topIcon=exclu?'⭐':(v?'👑':(pin?'📌':''));
  const html='<div class="lp">'
    +(topIcon?'<div class="lp-crown">'+topIcon+'</div>':'')
    +'<div class="lp-b '+(gold?'vip':'std')+(sel?' sel':'')+'">'+content+'</div>'
    +'<div class="lp-t '+(gold?'vip':'std')+'"></div></div>';
  const ico=L.divIcon({html,iconSize:[40,52],iconAnchor:[20,52],className:''});
  const m=L.marker([s.latitude,s.longitude],{icon:ico,zIndexOffset:gold?1000:100});
  m.on('click',function(){selectShop(s.id);});
  return m;
}

// Sélection d'un pin : ne re-render que les 2 marqueurs concernés (ancien sel + nouveau)
function selectShop(id){
  const prevId=selId;
  selId=id;
  // Mettre à jour uniquement le pin désélectionné
  if(prevId&&prevId!==id&&mkrs[prevId]){
    const ps=lastShops.find(s=>s.id===prevId);
    if(ps&&ps.latitude&&ps.longitude){
      map.removeLayer(mkrs[prevId]);
      const nm=createMarker(ps);
      nm.addTo(map);
      mkrs[prevId]=nm;
      mkrFP[prevId]=fingerprint(ps,selId);
    }
  }
  // Mettre à jour le nouveau pin sélectionné
  const cs=lastShops.find(s=>s.id===id);
  if(cs&&cs.latitude&&cs.longitude){
    if(mkrs[id])map.removeLayer(mkrs[id]);
    const nm=createMarker(cs);
    nm.addTo(map);
    mkrs[id]=nm;
    mkrFP[id]=fingerprint(cs,selId);
  }
  sendRN({type:'shopPress',shopId:id});
}

// Rendu diff — ne recrée que les marqueurs dont le fingerprint a changé
function renderShops(shops){
  lastShops=shops;
  const incoming={};
  shops.forEach(s=>{if(s.latitude&&s.longitude)incoming[s.id]=s;});

  // Supprimer les marqueurs absents de la nouvelle liste
  Object.keys(mkrs).forEach(id=>{
    if(!incoming[id]){map.removeLayer(mkrs[id]);delete mkrs[id];delete mkrFP[id];}
  });

  // Ajouter ou mettre à jour uniquement si le fingerprint a changé
  Object.values(incoming).forEach(s=>{
    const fp=fingerprint(s,selId);
    if(mkrFP[s.id]===fp)return;
    if(mkrs[s.id]){map.removeLayer(mkrs[s.id]);delete mkrs[s.id];}
    mkrFP[s.id]=fp;
    const m=createMarker(s);
    m.addTo(map);
    mkrs[s.id]=m;
  });
}

function sendRN(d){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(d));}

// Debounce moveend — évite de spammer React Native pendant le pan/zoom
let moveTimer=null;
map.on('moveend',function(){
  clearTimeout(moveTimer);
  moveTimer=setTimeout(function(){
    const b=map.getBounds();
    sendRN({type:'regionChange',minLat:b.getSouth(),maxLat:b.getNorth(),minLng:b.getWest(),maxLng:b.getEast()});
  },150);
});

// Commandes reçues de React Native
function dispatchCmd(str){
  try{
    const d=JSON.parse(str);
    if(d.type==='shops')renderShops(d.shops);
    if(d.type==='recenter'){uMarker.setLatLng([d.lat,d.lng]);map.setView([d.lat,d.lng],16,{animate:true,duration:.4});}
    if(d.type==='clearSel'){selId=null;renderShops(lastShops);}
    if(d.type==='flyTo'){map.setView([d.lat,d.lng],d.zoom||16,{animate:true,duration:.5});}
    if(d.type==='fitBounds'&&d.latlngs&&d.latlngs.length>0){
      if(d.latlngs.length===1){map.setView(d.latlngs[0],16,{animate:true,duration:.5});}
      else{map.fitBounds(d.latlngs,{padding:[50,50],animate:true,maxZoom:16});}
    }
  }catch(e){}
}
document.addEventListener('message',function(e){dispatchCmd(e.data);});
window.addEventListener('message',function(e){dispatchCmd(e.data);});

sendRN({type:'ready'});
</script>
</body>
</html>
`;

// ─── Filtres de catégories ────────────────────────────────────────────────────

type FilterItem = {
  id: string;
  label: string;
  emoji: string | null;
  imageUri: number | null;
  SvgIcon: React.FC<{ color: string }> | null;
};

const SUBCAT_FILTERS: FilterItem[] = [
  { id: 'all',  label: 'Tout',      emoji: null, imageUri: null, SvgIcon: null },
  { id: 'vip',  label: '5 Étoiles', emoji: null, imageUri: null, SvgIcon: null },
  ...CATEGORIES.flatMap(cat =>
    cat.subcats.map(sub => ({
      id: sub.id,
      label: sub.label,
      emoji: sub.emoji,
      imageUri: sub.imageUri ?? null,
      SvgIcon: sub.SvgIcon ?? null,
    })),
  ),
];

// ─── Palette locale thème clair ──────────────────────────────────────────────

const L_BG      = '#FFFFFF';
const L_SURFACE = '#F9FAFB';
const L_TEXT    = '#111827';
const L_MUTED   = '#6B7280';
const L_BORDER  = 'rgba(0,0,0,0.08)';
const L_SHADOW  = 'rgba(0,0,0,0.10)';
const ACCENT    = colors.accent; // #FDCF34

// ─── Composant pour réduire les SvgIcons fixes 36×36 ────────────────────────

function ScaledSvgIcon({ Icon, size, color }: { Icon: React.FC<{ color: string }>; size: number; color: string }) {
  const ICON_NATIVE = 36;
  const scale = size / ICON_NATIVE;
  return (
    <View style={{ width: size, height: size, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: ICON_NATIVE, height: ICON_NATIVE, transform: [{ scale }] }}>
        <Icon color={color} />
      </View>
    </View>
  );
}

// ─── Icônes SVG ───────────────────────────────────────────────────────────────

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
    <SvgCircle cx={12} cy={12} r={3} stroke={ACCENT} />
    <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke={ACCENT} />
  </Svg>
);

// ─── Bottom sheet ─────────────────────────────────────────────────────────────

interface SheetProps {
  shop: Shop;
  distanceM: number | null;
  zone: string;
  grabHandlers: object;
  onView: () => void;
  onRoute: () => void;
  onClose: () => void;
}

function MapShopSheet({ shop, distanceM, zone, grabHandlers, onView, onRoute, onClose }: SheetProps) {
  const distStr = distanceM !== null ? formatDistance(distanceM) : null;
  const walkStr = distanceM !== null ? walkMinutes(distanceM) : null;
  const { isOpen } = computeStatus(
    shop.openingHours as WeekHours | null,
    shop.isManuallyClose ?? false,
  );

  const adresse = shop.addressText?.trim() || zone;

  const callPhone = () => {
    if (shop.phone) Linking.openURL(`tel:${shop.phone}`);
  };

  return (
    <View style={styles.sheet}>
      {/* Zone de grab — supporte le swipe vers le bas pour fermer */}
      <View style={styles.grabRow} {...grabHandlers}>
        <View style={styles.grab} />
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2.5} strokeLinecap="round">
            <Path d="M18 6 6 18M6 6l12 12" stroke={L_MUTED} />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Ligne principale : logo + nom + distance */}
      <View style={styles.sheetCard}>
        <Avatar imageUrl={shop.logoUrl} name={shop.name} size={52} variant="shop" />

        <View style={styles.sheetInfo}>
          <View style={styles.sheetTopRow}>
            <Text style={styles.sheetName} numberOfLines={1}>
              {shop.name}
            </Text>
            {shop.isEtoiles && <Text style={styles.vipBadge}>⭐ 5 Étoiles</Text>}
            {!shop.isEtoiles && shop.isVip && <Text style={styles.vipBadge}>VIP</Text>}
            {shop.hasGoldenPin && (
              <View style={styles.pinBadge}>
                <Svg width={9} height={11} viewBox="0 0 10 12">
                  <Path d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 7 5 7s5-3.25 5-7C10 2.24 7.76 0 5 0z" fill="#FDCF34"/>
                  <SvgCircle cx={5} cy={4.5} r={2} fill="#92600A"/>
                </Svg>
              </View>
            )}
          </View>
          <View style={styles.sheetMeta}>
            <Text style={styles.sheetMetaTxt}>⭐ {shop.rating.toFixed(1)}</Text>
            <Text style={[styles.sheetMetaTxt, { color: isOpen ? '#16A34A' : '#DC2626' }]}>
              ● {isOpen ? 'Ouvert' : 'Fermé'}
            </Text>
          </View>
        </View>

        {distStr ? (
          <View style={styles.sheetDist}>
            <Text style={styles.sheetDistKm}>{distStr}</Text>
            {walkStr ? <Text style={styles.sheetDistWalk}>{walkStr}</Text> : null}
          </View>
        ) : null}
      </View>

      {/* Bloc localisation exacte */}
      {adresse ? (
        <View style={styles.locRow}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M12 21C12 21 5 13.5 5 9a7 7 0 1 1 14 0c0 4.5-7 12-7 12z" stroke={ACCENT} />
            <SvgCircle cx={12} cy={9} r={2.5} stroke={ACCENT} />
          </Svg>
          <Text style={styles.locTxt} numberOfLines={2}>{adresse}</Text>
        </View>
      ) : null}

      {/* Zone (quartier) séparée si on a aussi une adresse texte */}
      {zone && shop.addressText?.trim() && zone !== shop.addressText.trim() ? (
        <View style={styles.locRow}>
          <Text style={styles.zoneTxt}>{zone}</Text>
        </View>
      ) : null}

      {/* Téléphone cliquable */}
      {shop.phone ? (
        <TouchableOpacity style={styles.phoneRow} onPress={callPhone} activeOpacity={0.75}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 3.08 4.18 2 2 0 0 1 5.09 2h3a2 2 0 0 1 2 1.72 12.05 12.05 0 0 0 .57 2.57 2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6.29 6.29l1.27-1.27a2 2 0 0 1 2.11-.45 12.05 12.05 0 0 0 2.57.57A2 2 0 0 1 22 16.92z" stroke={ACCENT} />
          </Svg>
          <Text style={styles.phoneTxt}>{shop.phone}</Text>
          <Text style={styles.phoneCallTxt}>Appeler</Text>
        </TouchableOpacity>
      ) : null}

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
            <Path d="M5 12h14M12 5l7 7-7 7" stroke={L_TEXT} />
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
            <Path d="M3 11 22 2 13 21 11 13 3 11z" stroke={L_TEXT} />
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
  onRouteSuivi?: (params: { shopLat: number; shopLng: number; shopName: string; shopLogoUrl: string | null }) => void;
}

const DAKAR = { latitude: 14.7167, longitude: -17.4677 };

export default function MapScreen({
  onBack,
  onShopPress,
  excludeShopId,
  initialFilter,
  initialSearchQuery,
  onFilterChange,
  onSearchChange,
  onRouteSuivi,
}: Props) {
  const wvRef = useRef<WebView>(null);
  const sheetAnim = useRef(new Animated.Value(600)).current;
  const lastFilterRef = useRef(initialFilter ?? 'all');
  // Cache géocodage inverse pour éviter de re-requêter les mêmes coordonnées
  const geocodeCache = useRef<Map<string, string>>(new Map());
  // Ref pour debounce de l'envoi shops vers la WebView
  const sendShopsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref stable vers closeSheet pour le PanResponder (créé une seule fois)
  const closeSheetRef = useRef<() => void>(() => {});

  const coords = useLocationStore(s => s.coords);
  const refreshLocation = useLocationStore(s => s.refreshLocation);

  const [allShops, setAllShops] = useState<Shop[]>([]);
  // Ref pour accéder aux shops courants dans les callbacks stables (handleWebViewMessage)
  const allShopsRef = useRef<Shop[]>([]);
  const [selected, setSelected] = useState<Shop | null>(null);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState(initialFilter ?? 'all');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery ?? '');
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);

  const initLat = coords?.latitude ?? DAKAR.latitude;
  const initLng = coords?.longitude ?? DAKAR.longitude;
  const mapHtml = useRef(buildMapHTML(initLat, initLng)).current;

  // ── Shops filtrés — recalculé uniquement si les données changent ─────────
  const filteredShops = useMemo(() => {
    let result =
      activeFilter === 'all'
        ? allShops
        : activeFilter === 'vip'
        ? allShops.filter(s => s.isEtoiles)
        : allShops.filter(s => s.subcategories.includes(activeFilter));
    if (excludeShopId) result = result.filter(s => s.id !== excludeShopId);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q));
    }
    return result;
  }, [allShops, activeFilter, searchQuery, excludeShopId]);

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

  useEffect(() => {
    if (!coords) refreshLocation();
    loadAllShops();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Synchronise le ref à chaque mise à jour pour les callbacks stables
  useEffect(() => {
    allShopsRef.current = allShops;
  }, [allShops]);

  useRealtimeShops(updated => {
    setAllShops(prev => prev.map(s => (s.id === updated.id ? updated : s)));
  });

  // Recentre la carte quand la position GPS devient disponible
  useEffect(() => {
    if (!coords || !mapReady) return;
    sendToWebView({ type: 'recenter', lat: coords.latitude, lng: coords.longitude });
  }, [coords, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Envoi vers la WebView ────────────────────────────────────────────────
  const sendToWebView = useCallback((data: object) => {
    wvRef.current?.postMessage(JSON.stringify(data));
  }, []);

  // ── Shops filtrés → WebView avec debounce 150ms (fluidité recherche live) ─
  useEffect(() => {
    if (!mapReady) return;

    const withCoords = filteredShops.filter(s => s.latitude && s.longitude);
    const filterChanged = lastFilterRef.current !== activeFilter;
    lastFilterRef.current = activeFilter;

    setVisibleCount(withCoords.length);

    if (sendShopsTimer.current) clearTimeout(sendShopsTimer.current);
    sendShopsTimer.current = setTimeout(() => {
      sendToWebView({ type: 'shops', shops: filteredShops });
      if (filterChanged && activeFilter !== 'all' && withCoords.length > 0) {
        if (withCoords.length === 1) {
          sendToWebView({ type: 'flyTo', lat: withCoords[0].latitude, lng: withCoords[0].longitude, zoom: 16 });
        } else {
          sendToWebView({ type: 'fitBounds', latlngs: withCoords.map(s => [s.latitude, s.longitude]) });
        }
      }
    }, 150);

    return () => {
      if (sendShopsTimer.current) clearTimeout(sendShopsTimer.current);
    };
  }, [filteredShops, mapReady, activeFilter, sendToWebView]);

  // ── Messages de la WebView → React Native ────────────────────────────────
  const handleWebViewMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'ready') {
        setMapReady(true);
        return;
      }

      if (data.type === 'regionChange') return;

      if (data.type === 'shopPress') {
        const shop = allShopsRef.current.find(s => s.id === data.shopId);
        if (!shop) return;
        setSelected(shop);
        Animated.spring(sheetAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 70,
          friction: 11,
        }).start();
      }
    } catch {
      // message non JSON — ignoré
    }
  }, [sheetAnim]);

  // ── Zone GPS du shop sélectionné — avec cache ────────────────────────────
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
      const key = `${selected.latitude},${selected.longitude}`;
      const cached = geocodeCache.current.get(key);
      if (cached !== undefined) {
        setSelectedZone(cached);
        return;
      }
      reverseGeocode(selected.latitude, selected.longitude)
        .then(z => {
          geocodeCache.current.set(key, z);
          setSelectedZone(z);
        })
        .catch(() => setSelectedZone(''));
    }
  }, [selected]);

  // ── Fermeture du bottom sheet ────────────────────────────────────────────
  const closeSheet = useCallback(() => {
    Animated.spring(sheetAnim, {
      toValue: 600,
      useNativeDriver: true,
      tension: 80,
      friction: 14,
    }).start(() => {
      setSelected(null);
      sendToWebView({ type: 'clearSel' });
    });
  }, [sheetAnim, sendToWebView]);

  // Mise à jour de la ref stable → le PanResponder appelle toujours la version courante
  closeSheetRef.current = closeSheet;

  // ── PanResponder pour swipe vers le bas → fermer le sheet ───────────────
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy, dx }) =>
        Math.abs(dy) > Math.abs(dx) && dy > 8,
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) sheetAnim.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 100 || vy > 0.6) {
          closeSheetRef.current();
        } else {
          Animated.spring(sheetAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start();
        }
      },
    }),
  ).current;

  // ── Distance utilisateur ↔ shop sélectionné ──────────────────────────────
  const distanceM =
    selected && coords && selected.latitude && selected.longitude
      ? haversineMeters(coords.latitude, coords.longitude, selected.latitude, selected.longitude)
      : null;

  // ── Itinéraire ───────────────────────────────────────────────────────────
  const openRoute = useCallback((shop: Shop) => {
    if (onRouteSuivi && shop.latitude && shop.longitude) {
      closeSheetRef.current();
      onRouteSuivi({ shopLat: shop.latitude, shopLng: shop.longitude, shopName: shop.name, shopLogoUrl: shop.logoUrl });
    } else {
      ouvrirNavigation({
        latitude: shop.latitude,
        longitude: shop.longitude,
        adresse: shop.addressText,
        nomLieu: shop.name,
      });
    }
  }, [onRouteSuivi]);

  // ── Recentrer ────────────────────────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    if (!coords) {
      refreshLocation();
      return;
    }
    sendToWebView({ type: 'recenter', lat: coords.latitude, lng: coords.longitude });
  }, [coords, refreshLocation, sendToWebView]);

  return (
    <View style={styles.root}>
      {/* ── WebView Leaflet plein écran ─────────────────────────────────── */}
      <WebView
        ref={wvRef}
        style={StyleSheet.absoluteFill}
        source={{ html: mapHtml }}
        originWhitelist={['*']}
        onMessage={handleWebViewMessage}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        overScrollMode="never"
        scrollEnabled={false}
        // Cache la WebView le temps que Leaflet charge les tuiles
        renderLoading={() => <View style={[StyleSheet.absoluteFill, { backgroundColor: '#F0EFE9' }]} />}
        startInLoadingState
      />

      {/* ── Topbar flottante ────────────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
          <IcoBack color={L_TEXT} />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <IcoSearch color={L_MUTED} />
          <TextInput
            style={styles.searchInput}
            placeholder="Chercher sur la carte…"
            placeholderTextColor={L_MUTED}
            value={searchQuery}
            onChangeText={t => {
              setSearchQuery(t);
              onSearchChange?.(t);
            }}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => { setSearchQuery(''); onSearchChange?.(''); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.6}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2.5} strokeLinecap="round">
                <Path d="M18 6 6 18M6 6l12 12" stroke={L_MUTED} />
              </Svg>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Filtres catégories flottants ────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
        nestedScrollEnabled
      >
        {SUBCAT_FILTERS.map(f => {
          const on = activeFilter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              style={[
                styles.filterChip,
                on && styles.filterChipOn,
                f.id === 'vip' && !on && styles.filterChipVip,
              ]}
              onPress={() => {
                setActiveFilter(f.id);
                onFilterChange?.(f.id);
              }}
              activeOpacity={0.8}
            >
              {f.imageUri ? (
                <ExpoImage source={f.imageUri} style={styles.filterIco} contentFit="cover" cachePolicy="memory-disk" transition={0} />
              ) : f.SvgIcon ? (
                <ScaledSvgIcon Icon={f.SvgIcon} size={22} color={on ? L_TEXT : L_MUTED} />
              ) : f.emoji ? (
                <Text style={styles.filterEmoji}>{f.emoji}</Text>
              ) : null}
              <Text style={[styles.filterTxt, on && styles.filterTxtOn, f.id === 'vip' && !on && styles.filterTxtVip]}>{f.label}</Text>
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

      {/* ── Compteur / état vide ────────────────────────────────────────── */}
      {!loading && mapReady && !selected && visibleCount > 0 && (
        <View style={styles.countBadge}>
          <Image source={require('../../../assets/favicon.png')} style={styles.countIcon} resizeMode="contain" />
          <Text style={styles.countTxt}>{visibleCount} commerce{visibleCount > 1 ? 's' : ''} sur la carte</Text>
        </View>
      )}
      {!loading && mapReady && !selected && visibleCount === 0 && (
        <View style={styles.emptyBadge}>
          <LassiMascotte forme="explorer" taille={110} glow={false} />
          <Text style={styles.emptyTxt}>
            {allShops.length === 0
              ? `${MASCOTTE_NOM} explore… aucun commerce ici pour l'instant.`
              : 'Aucun commerce dans cette catégorie pour le moment.'}
          </Text>
        </View>
      )}

      {/* ── Bottom sheet (tap sur un pin) ─────────────────────────────────── */}
      {selected && (
        <Animated.View style={[styles.sheetWrap, { transform: [{ translateY: sheetAnim }] }]}>
          <MapShopSheet
            shop={selected}
            distanceM={distanceM}
            zone={selectedZone}
            grabHandlers={panResponder.panHandlers}
            onClose={closeSheet}
            onView={() => {
              if (selected.hasGoldenPin) recordCarteClick(selected.id).catch(() => {});
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
  root: { flex: 1, backgroundColor: '#F0EFE9' },

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
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: L_BG,
    borderWidth: 1,
    borderColor: L_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: L_SHADOW,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
  searchBox: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: L_BG,
    borderWidth: 1,
    borderColor: L_BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 9,
    shadowColor: L_SHADOW,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    color: L_TEXT,
    fontFamily: fonts.body,
    fontSize: 13,
    padding: 0,
  },

  // Filtres
  filtersScroll: {
    position: 'absolute',
    top: TOP_INSET + 60,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  filtersContent: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: L_BG,
    borderWidth: 1,
    borderColor: L_BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    shadowColor: L_SHADOW,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  filterChipOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  filterChipVip: {
    borderColor: ACCENT,
    borderWidth: 1.5,
  },
  filterIco: { width: 22, height: 22, borderRadius: 5 },
  filterEmoji: { fontSize: 13 },
  filterTxt: { color: L_MUTED, fontFamily: fonts.ui, fontSize: 12.5 },
  filterTxtOn: { color: L_TEXT },
  filterTxtVip: { color: '#92600A' },

  // Recentrer
  recenter: {
    position: 'absolute',
    right: 16,
    bottom: 250,
    zIndex: 30,
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: L_BG,
    borderWidth: 1,
    borderColor: L_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: L_SHADOW,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 5,
  },

  // Indicateurs
  loadingBadge: {
    position: 'absolute',
    right: 16,
    top: TOP_INSET + 112,
    zIndex: 30,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: L_BG,
    borderWidth: 1,
    borderColor: L_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: L_SHADOW,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  countBadge: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    zIndex: 30,
    backgroundColor: L_BG,
    borderWidth: 1,
    borderColor: L_BORDER,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    shadowColor: L_SHADOW,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 5,
  },
  countIcon: { width: 18, height: 18, borderRadius: 4 },
  countTxt: { color: L_TEXT, fontFamily: fonts.body, fontSize: 12.5 },
  emptyBadge: {
    position: 'absolute',
    bottom: 200,
    left: 40,
    right: 40,
    zIndex: 30,
    backgroundColor: L_BG,
    borderWidth: 1,
    borderColor: L_BORDER,
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    shadowColor: L_SHADOW,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    elevation: 6,
  },
  emptyTxt: { color: L_MUTED, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },

  // Bottom sheet
  sheetWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50 },
  sheet: {
    backgroundColor: L_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: L_BORDER,
    paddingHorizontal: 18,
    paddingBottom: 32,
    shadowColor: 'rgba(0,0,0,0.16)',
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: -6 },
    shadowRadius: 20,
    elevation: 20,
  },
  grabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 16,
    position: 'relative',
    // Zone tactile élargie pour le swipe
    paddingVertical: 6,
  },
  grab: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' },
  closeBtn: {
    position: 'absolute',
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: L_SURFACE,
    borderWidth: 1,
    borderColor: L_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCard: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  sheetInfo: { flex: 1, minWidth: 0 },
  sheetTopRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sheetName: { color: L_TEXT, fontFamily: fonts.titleXL, fontSize: 16, flexShrink: 1 },
  vipBadge: {
    color: '#92600A',
    fontFamily: fonts.ui,
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(253,207,52,.22)',
    borderRadius: 6,
  },
  pinBadge: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: 'rgba(253,207,52,.22)',
    borderRadius: 6,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sheetMeta: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 4, flexWrap: 'wrap' },
  sheetMetaTxt: { color: L_MUTED, fontFamily: fonts.body, fontSize: 11.5 },
  sheetDist: { alignItems: 'flex-end', flexShrink: 0 },
  sheetDistKm: { color: '#92600A', fontFamily: fonts.titleXL, fontSize: 15 },
  sheetDistWalk: { color: L_MUTED, fontFamily: fonts.body, fontSize: 9.5, marginTop: 2 },

  // Localisation & téléphone
  locRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  locTxt: { flex: 1, color: L_TEXT, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },
  zoneTxt: { color: L_MUTED, fontFamily: fonts.body, fontSize: 11.5 },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  phoneTxt: { flex: 1, color: L_TEXT, fontFamily: fonts.body, fontSize: 13, letterSpacing: 0.3 },
  phoneCallTxt: {
    color: '#92600A',
    fontFamily: fonts.ui,
    fontSize: 11.5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(253,207,52,.18)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(253,207,52,.35)',
  },

  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnGo: {
    flex: 1,
    height: 50,
    borderRadius: 15,
    backgroundColor: ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    shadowColor: 'rgba(253,207,52,.5)',
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  btnGoTxt: { color: L_TEXT, fontFamily: fonts.title, fontSize: 13.5 },
  btnRoute: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(253,207,52,.5)',
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
});
