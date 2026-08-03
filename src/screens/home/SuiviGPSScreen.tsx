import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import Svg, { Path } from 'react-native-svg';
import * as Location from 'expo-location';
import { fonts, TOP_INSET } from '../../theme';
import { haversineMeters, formatDistance, walkMinutes } from '../../services/location';
import Avatar from '../../components/Avatar';
import useLocationStore from '../../store/locationStore';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  shopLat:     number;
  shopLng:     number;
  shopName:    string;
  shopLogoUrl: string | null;
  onBack:      () => void;
}

// ─── Palette thème clair (miroir de MapScreen) ────────────────────────────────

const L_BG     = '#FFFFFF';
const L_TEXT   = '#111827';
const L_MUTED  = '#6B7280';
const L_BORDER = 'rgba(0,0,0,0.08)';
const L_SHADOW = 'rgba(0,0,0,0.10)';
const ACCENT   = '#FDCF34';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/`/g, '&#096;')
    .replace(/\\/g, '&#092;');
}

// ─── HTML Leaflet navigation thème clair ──────────────────────────────────────

const buildNavHTML = (
  uLat: number, uLng: number,
  sLat: number, sLng: number,
  shopName: string, logoUrl: string | null,
): string => {
  const initial = esc((shopName || '?').charAt(0).toUpperCase());
  const logoContent = logoUrl
    ? `<img src="${esc(logoUrl)}" style="width:28px;height:28px;border-radius:9px;object-fit:cover;">`
    : `<span style="color:#111827;font-weight:700;font-size:18px;font-family:sans-serif;line-height:1;">${initial}</span>`;

  return `<!DOCTYPE html>
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
    /* Dot utilisateur */
    .ud{width:18px;height:18px;border-radius:50%;background:#3B82F6;border:3px solid #fff;box-shadow:0 2px 8px rgba(59,130,246,.5),0 0 0 12px rgba(59,130,246,.15);}
    /* Pin boutique */
    .lp{display:flex;flex-direction:column;align-items:center;}
    .lp-b{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 4px 14px rgba(253,207,52,.45);background:#FDCF34;border:2.5px solid #fff;}
    .lp-t{width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid #FDCF34;margin-top:-1px;}
  </style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>
const UL=${uLat},UG=${uLng},SL=${sLat},SG=${sLng};
const map=L.map('map',{zoomControl:false});

L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{
  attribution:'© OpenStreetMap © CARTO',maxZoom:20,detectRetina:true
}).addTo(map);

const uIco=L.divIcon({html:'<div class="ud"></div>',iconSize:[18,18],iconAnchor:[9,9],className:''});
let uMarker=L.marker([UL,UG],{icon:uIco,zIndexOffset:2000}).addTo(map);

const sHtml='<div class="lp"><div class="lp-b">${logoContent}</div><div class="lp-t"></div></div>';
const sIco=L.divIcon({html:sHtml,iconSize:[42,56],iconAnchor:[21,56],className:''});
L.marker([SL,SG],{icon:sIco,zIndexOffset:1000}).addTo(map);

function sendRN(d){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(d));}

function haversineM(la1,lo1,la2,lo2){
  const R=6371000,dLa=(la2-la1)*Math.PI/180,dLo=(lo2-lo1)*Math.PI/180;
  const a=Math.sin(dLa/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLo/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

let routeLayer=null;
let lastCalcLat=UL,lastCalcLng=UG;

function drawPolyline(coords){
  if(routeLayer)map.removeLayer(routeLayer);
  routeLayer=L.polyline(coords,{color:'#3B82F6',weight:5,opacity:.9,lineCap:'round',lineJoin:'round'}).addTo(map);
}

function drawStraight(lat,lng){
  drawPolyline([[lat,lng],[SL,SG]]);
}

function calcRoute(lat,lng){
  lastCalcLat=lat;lastCalcLng=lng;
  const dist=haversineM(lat,lng,SL,SG);
  if(dist<500){drawStraight(lat,lng);return;}
  fetch('https://router.project-osrm.org/route/v1/foot/'+lng+','+lat+';'+SG+','+SL+'?overview=full&geometries=geojson')
    .then(r=>r.json())
    .then(data=>{
      if(data.routes&&data.routes.length>0&&data.routes[0].distance<=dist*4){
        drawPolyline(data.routes[0].geometry.coordinates.map(c=>[c[1],c[0]]));
      }else{drawStraight(lat,lng);}
    })
    .catch(()=>drawStraight(lat,lng));
}

calcRoute(UL,UG);
map.fitBounds([[UL,UG],[SL,SG]],{padding:[80,80]});
sendRN({type:'ready'});

function handleCmd(str){
  try{
    const d=JSON.parse(str);
    if(d.type==='updateUser'){
      uMarker.setLatLng([d.lat,d.lng]);
      if(haversineM(d.lat,d.lng,lastCalcLat,lastCalcLng)>25)calcRoute(d.lat,d.lng);
    }
  }catch(e){}
}
document.addEventListener('message',function(e){handleCmd(e.data);});
window.addEventListener('message',function(e){handleCmd(e.data);});
</script>
</body>
</html>`;
};

// ─── Composant ────────────────────────────────────────────────────────────────

const DAKAR = { latitude: 14.7167, longitude: -17.4677 };

export default function SuiviGPSScreen({
  shopLat, shopLng, shopName, shopLogoUrl, onBack,
}: Props) {
  const storeCoords = useLocationStore(s => s.coords);

  const wvRef       = useRef<WebView>(null);
  const mapReadyRef = useRef(false);
  const latestRef   = useRef<{ latitude: number; longitude: number } | null>(null);

  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const [navHTML] = useState(() =>
    buildNavHTML(
      storeCoords?.latitude  ?? DAKAR.latitude,
      storeCoords?.longitude ?? DAKAR.longitude,
      shopLat, shopLng, shopName, shopLogoUrl,
    )
  );

  useEffect(() => {
    let mounted = true;
    let sub: Location.LocationSubscription | null = null;

    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !mounted) return;

      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
        ({ coords }) => {
          if (!mounted) return;
          const pos = { latitude: coords.latitude, longitude: coords.longitude };
          latestRef.current = pos;
          setUserCoords(pos);
          if (mapReadyRef.current) {
            wvRef.current?.postMessage(JSON.stringify({
              type: 'updateUser',
              lat: coords.latitude,
              lng: coords.longitude,
            }));
          }
        },
      );
    };

    start();
    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        mapReadyRef.current = true;
        if (latestRef.current) {
          wvRef.current?.postMessage(JSON.stringify({
            type: 'updateUser',
            lat: latestRef.current.latitude,
            lng: latestRef.current.longitude,
          }));
        }
      }
    } catch { /* ignoré */ }
  }, []);

  const distanceM = userCoords
    ? haversineMeters(userCoords.latitude, userCoords.longitude, shopLat, shopLng)
    : null;

  return (
    <View style={styles.root}>
      {/* ── Carte Leaflet ──────────────────────────────────────────────────── */}
      <WebView
        ref={wvRef}
        style={StyleSheet.absoluteFill}
        source={{ html: navHTML }}
        originWhitelist={['*']}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        overScrollMode="never"
        scrollEnabled={false}
      />

      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: TOP_INSET + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.75}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={2.2}
            strokeLinecap="round" strokeLinejoin="round">
            <Path d="M19 12H5M12 5l-7 7 7 7" stroke={L_TEXT} />
          </Svg>
        </TouchableOpacity>
        <View style={styles.titleBox}>
          <Text style={styles.titleLabel}>Navigation vers</Text>
          <Text style={styles.titleName} numberOfLines={1}>{shopName}</Text>
        </View>
      </View>

      {/* ── Carte de distance ──────────────────────────────────────────────── */}
      <View style={styles.bottomCard}>
        <Avatar imageUrl={shopLogoUrl} name={shopName} size={46} variant="shop" />

        <View style={styles.infoCol}>
          <Text style={styles.shopName} numberOfLines={1}>{shopName}</Text>
          <View style={styles.metaRow}>
            {distanceM !== null ? (
              <>
                <Text style={styles.metaDist}>{formatDistance(distanceM)}</Text>
                <Text style={styles.metaSep}>·</Text>
                <Text style={styles.metaWalk}>{walkMinutes(distanceM)}</Text>
              </>
            ) : (
              <ActivityIndicator size="small" color={ACCENT} />
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.stopBtn} onPress={onBack} activeOpacity={0.85}>
          <Text style={styles.stopTxt}>Terminer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0EFE9' },

  topBar: {
    position: 'absolute',
    top: 0, left: 16, right: 16,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 44, height: 44,
    borderRadius: 14,
    backgroundColor: L_BG,
    borderWidth: 1, borderColor: L_BORDER,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    shadowColor: L_SHADOW,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
  titleBox: {
    flex: 1,
    backgroundColor: L_BG,
    borderWidth: 1, borderColor: L_BORDER,
    borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 9,
    shadowColor: L_SHADOW,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
  titleLabel: {
    color: L_MUTED,
    fontFamily: fonts.body,
    fontSize: 10,
  },
  titleName: {
    color: L_TEXT,
    fontFamily: fonts.title,
    fontSize: 13.5,
  },

  bottomCard: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    zIndex: 30,
    backgroundColor: L_BG,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: L_BORDER,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    shadowColor: 'rgba(0,0,0,0.14)',
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: -6 },
    shadowRadius: 18,
    elevation: 16,
  },
  infoCol: { flex: 1, minWidth: 0 },
  shopName: {
    color: L_TEXT,
    fontFamily: fonts.titleXL,
    fontSize: 15,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  metaDist: {
    color: '#92600A',
    fontFamily: fonts.title,
    fontSize: 13,
  },
  metaSep: { color: L_MUTED, fontSize: 12 },
  metaWalk: {
    color: L_MUTED,
    fontFamily: fonts.body,
    fontSize: 11.5,
  },

  stopBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(220,38,38,.10)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,.30)',
  },
  stopTxt: {
    color: '#DC2626',
    fontFamily: fonts.ui,
    fontSize: 13,
  },
});
