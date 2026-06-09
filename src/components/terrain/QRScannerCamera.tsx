import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, Alert, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts, radius } from '../../theme';

// ─── Icônes ──────────────────────────────────────────────────────────────────

const IcoClose = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round">
    <Path d="M18 6 6 18M6 6l12 12" stroke={colors.white} />
  </Svg>
);

const IcoFlash = ({ active }: { active: boolean }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round">
    <Path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" stroke={active ? colors.accent : colors.white} fill={active ? `${colors.accent}40` : 'none'} />
  </Svg>
);

// ─── Overlay viseur ───────────────────────────────────────────────────────────

function ScanFrame() {
  const size = 220;
  const corner = 24;
  const stroke = 3;
  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      {/* Coins */}
      {[
        { top: 0, left: 0 },
        { top: 0, right: 0 },
        { bottom: 0, left: 0 },
        { bottom: 0, right: 0 },
      ].map((pos, i) => (
        <View
          key={i}
          style={[
            styles.corner,
            pos,
            {
              borderTopWidth: i < 2 ? stroke : 0,
              borderBottomWidth: i >= 2 ? stroke : 0,
              borderLeftWidth: i % 2 === 0 ? stroke : 0,
              borderRightWidth: i % 2 === 1 ? stroke : 0,
              width: corner,
              height: corner,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onScan: (code: string) => void;
  onClose: () => void;
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function QRScannerCamera({ visible, onScan, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const lastScanRef = useRef<string | null>(null);
  const cooldownRef = useRef(false);

  // Reset à chaque ouverture
  useEffect(() => {
    if (visible) {
      lastScanRef.current = null;
      cooldownRef.current = false;
      setTorch(false);
    }
  }, [visible]);

  const handleBarcode = ({ data }: { data: string }) => {
    if (cooldownRef.current) return;
    const cleaned = data.trim().toUpperCase();
    if (!cleaned || cleaned.length < 4) return;
    if (cleaned === lastScanRef.current) return;

    lastScanRef.current = cleaned;
    cooldownRef.current = true;
    onScan(cleaned);
    // Délai anti-double-scan de 2 s
    setTimeout(() => { cooldownRef.current = false; }, 2000);
  };

  const handleRequestPermission = async () => {
    const result = await requestPermission();
    if (!result.granted) {
      Alert.alert(
        'Permission refusée',
        'Active la caméra dans les réglages de ton téléphone pour scanner les QR codes.',
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Scanner le QR code</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <IcoClose />
          </TouchableOpacity>
        </View>

        {/* Corps */}
        {!permission ? (
          // Chargement permissions
          <View style={styles.center}>
            <Text style={styles.infoTxt}>Initialisation caméra…</Text>
          </View>
        ) : !permission.granted ? (
          // Permission non accordée
          <View style={styles.center}>
            <Text style={styles.infoEmoji}>📷</Text>
            <Text style={styles.infoTxt}>Accès caméra requis pour scanner</Text>
            <TouchableOpacity style={styles.permBtn} onPress={handleRequestPermission} activeOpacity={0.85}>
              <Text style={styles.permTxt}>Autoriser la caméra</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Caméra active
          <View style={styles.cameraBox}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcode}
            />

            {/* Overlay sombre + viseur */}
            <View style={styles.overlay}>
              <View style={styles.overlayTop} />
              <View style={styles.overlayMiddle}>
                <View style={styles.overlaySide} />
                <ScanFrame />
                <View style={styles.overlaySide} />
              </View>
              <View style={styles.overlayBottom}>
                <Text style={styles.scanHint}>
                  Place le QR code du client dans le cadre
                </Text>
              </View>
            </View>

            {/* Bouton torche */}
            <TouchableOpacity
              style={[styles.torchBtn, torch && styles.torchBtnOn]}
              onPress={() => setTorch(t => !t)}
              activeOpacity={0.8}
            >
              <IcoFlash active={torch} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const BOTTOM_SAFE = Platform.OS === 'ios' ? 40 : 20;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: colors.bg,
    zIndex: 10,
  },
  headerTitle: { color: colors.white, fontFamily: fonts.title, fontSize: 17 },
  closeBtn: {
    width: 40, height: 40, borderRadius: radius.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  cameraBox: { flex: 1, position: 'relative' },

  overlay: { ...StyleSheet.absoluteFillObject },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayMiddle: { flexDirection: 'row', height: 220 },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayBottom: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'flex-start',
    paddingTop: 24,
  },

  frame: { position: 'relative' },
  corner: {
    position: 'absolute',
    borderColor: colors.accent,
    borderRadius: 2,
  },

  scanHint: {
    color: colors.white, fontFamily: fonts.body,
    fontSize: 13, textAlign: 'center',
    paddingHorizontal: 32,
  },

  torchBtn: {
    position: 'absolute', bottom: BOTTOM_SAFE + 24, right: 24,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  torchBtnOn: {
    backgroundColor: `${colors.accent}30`,
    borderColor: colors.accent,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 32 },
  infoEmoji: { fontSize: 52 },
  infoTxt: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  permBtn: {
    backgroundColor: colors.accent, borderRadius: radius.lg,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  permTxt: { color: colors.bg, fontFamily: fonts.titleXL, fontSize: 14 },
});
