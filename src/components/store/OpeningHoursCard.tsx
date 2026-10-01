/**
 * components/store/OpeningHoursCard.tsx
 * Réutilisable dans 3 contextes :
 *   readOnly=true  → fiche client (statut en temps réel + liste jours)
 *   readOnly=false → tableau de bord marchand (édition + toggle exceptionnel)
 *   readOnly=false, sans onToggleManuallyClose → formulaire d'inscription (étape 4)
 */
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import {
  DAY_KEYS,
  DAY_LABELS,
  DayKey,
  DayHours,
  WeekHours,
  DEFAULT_WEEK_HOURS,
  computeStatus,
  formatDayHours,
  formatHour,
} from '../../services/hours';

const formatHeure = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + ':' + digits.slice(2);
};

interface Props {
  hours: WeekHours | null;
  isManuallyClose: boolean;
  readOnly?: boolean;
  onChange?: (h: WeekHours) => void;
  onToggleManuallyClose?: () => void;
}

export default function OpeningHoursCard({
  hours,
  isManuallyClose,
  readOnly = false,
  onChange,
  onToggleManuallyClose,
}: Props) {
  // Merge over defaults so every day key is always present (guards against partial JSONB)
  const eff: WeekHours = { ...DEFAULT_WEEK_HOURS, ...(hours ?? {}) };
  const status = computeStatus(hours ? eff : null, isManuallyClose);

  const updateDay = (day: DayKey, patch: Partial<DayHours>) => {
    onChange?.({ ...eff, [day]: { ...eff[day], ...patch } });
  };

  // ── Mode lecture seule (client) ─────────────────────────────────────────────
  if (readOnly) {
    const dotColor = status.isPause ? colors.accent : status.isOpen ? colors.success : colors.danger;
    const txtColor = status.isPause ? colors.accent : status.isOpen ? colors.success : colors.danger;

    // Collecte les pauses configurées pour tous les jours (affichage en bas)
    const todayKey = (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[new Date().getDay()];
    const todayPause = eff[todayKey];
    const pauseStr =
      todayPause && !todayPause.closed && todayPause.pauseStart && todayPause.pauseEnd
        ? `Pause : ${formatHour(todayPause.pauseStart)} – ${formatHour(todayPause.pauseEnd)}`
        : null;

    return (
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={[styles.statusTxt, { color: txtColor }]}>{status.label}</Text>
          {!!status.nextChange && <Text style={styles.nextChangeTxt}> · {status.nextChange}</Text>}
        </View>

        {DAY_KEYS.map(day => (
          <View key={day} style={styles.dayRow}>
            <Text style={styles.dayName}>{DAY_LABELS[day]}</Text>
            <Text style={[styles.dayVal, eff[day].closed && styles.dayValClosed]}>
              {formatDayHours(eff[day])}
            </Text>
          </View>
        ))}

        {pauseStr && (
          <Text style={styles.pauseInfo}>{pauseStr}</Text>
        )}
      </View>
    );
  }

  // ── Mode édition (marchand) ─────────────────────────────────────────────────
  return (
    <View style={styles.card}>
      {DAY_KEYS.map((day, idx) => {
        const dh = eff[day];
        return (
          <View
            key={day}
            style={[styles.dayBlock, idx < DAY_KEYS.length - 1 && styles.dayBlockBorder]}
          >
            {/* Ligne principale : jour + horaires + toggle */}
            <View style={styles.editRow}>
              <Text style={styles.editDayName}>{DAY_LABELS[day].slice(0, 3)}</Text>

              {dh.closed ? (
                <Text style={styles.closedTxt}>Fermé</Text>
              ) : (
                <View style={styles.timeRange}>
                  <TextInput
                    style={styles.timeInput}
                    value={dh.open}
                    onChangeText={v => updateDay(day, { open: formatHeure(v) })}
                    keyboardType="number-pad"
                    maxLength={5}
                    placeholder="07:00"
                    placeholderTextColor={colors.muted}
                  />
                  <Text style={styles.timeDash}>–</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={dh.close}
                    onChangeText={v => updateDay(day, { close: formatHeure(v) })}
                    keyboardType="number-pad"
                    maxLength={5}
                    placeholder="22:00"
                    placeholderTextColor={colors.muted}
                  />
                </View>
              )}

              <TouchableOpacity
                style={[styles.toggleBtn, !dh.closed && styles.toggleBtnOpen]}
                onPress={() => updateDay(day, { closed: !dh.closed })}
                activeOpacity={0.75}
              >
                <Text style={[styles.toggleTxt, !dh.closed && styles.toggleTxtOpen]}>
                  {dh.closed ? 'Fermé' : 'Ouvert'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Ligne pause — uniquement si le jour est ouvert */}
            {!dh.closed && (
              <View style={styles.pauseRow}>
                <Text style={styles.pauseLabel}>Pause</Text>
                <TextInput
                  style={styles.pauseInput}
                  value={dh.pauseStart ?? ''}
                  onChangeText={v => updateDay(day, { pauseStart: formatHeure(v) || undefined })}
                  keyboardType="number-pad"
                  maxLength={5}
                  placeholder="--:--"
                  placeholderTextColor={colors.muted}
                />
                <Text style={styles.timeDash}>–</Text>
                <TextInput
                  style={styles.pauseInput}
                  value={dh.pauseEnd ?? ''}
                  onChangeText={v => updateDay(day, { pauseEnd: formatHeure(v) || undefined })}
                  keyboardType="number-pad"
                  maxLength={5}
                  placeholder="--:--"
                  placeholderTextColor={colors.muted}
                />
              </View>
            )}
          </View>
        );
      })}

      {/* Toggle "Exceptionnellement fermé" — uniquement sur la vitrine en service */}
      {onToggleManuallyClose && (
        <View style={styles.manualRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.manualTitle}>Exceptionnellement fermé</Text>
            <Text style={styles.manualSub}>Override les horaires jusqu'à demain matin</Text>
          </View>
          <Switch
            value={isManuallyClose}
            onValueChange={onToggleManuallyClose}
            trackColor={{ false: colors.border, true: 'rgba(255,90,90,.45)' }}
            thumbColor={isManuallyClose ? '#ff5a5a' : colors.muted}
          />
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  // Lecture seule
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 7,
  },
  statusTxt: {
    fontFamily: fonts.title,
    fontSize: 14,
  },
  nextChangeTxt: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  dayName: {
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  dayVal: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  dayValClosed: {
    color: colors.muted,
  },

  // Édition
  dayBlock: {
    paddingVertical: 6,
  },
  dayBlockBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,.04)',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  editDayName: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 11,
    width: 32,
    textTransform: 'uppercase',
  },
  timeRange: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeInput: {
    flex: 1,
    height: 40,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 0,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  timeDash: {
    color: colors.muted,
    fontSize: 14,
  },
  closedTxt: {
    flex: 1,
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontStyle: 'italic',
  },
  pauseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 40,
    paddingBottom: 4,
  },
  pauseLabel: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 10,
    letterSpacing: 0.5,
    width: 36,
  },
  pauseInput: {
    width: 54,
    height: 30,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 0,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 11,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  pauseInfo: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(224,122,122,.12)',
    borderWidth: 1,
    borderColor: 'rgba(224,122,122,.3)',
  },
  toggleBtnOpen: {
    backgroundColor: 'rgba(95,211,138,.12)',
    borderColor: 'rgba(95,211,138,.3)',
  },
  toggleTxt: {
    color: colors.danger,
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  toggleTxtOpen: {
    color: colors.success,
  },

  // Toggle manuel
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  manualTitle: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 13.5,
    marginBottom: 2,
  },
  manualSub: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11.5,
  },
});
