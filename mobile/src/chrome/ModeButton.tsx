/**
 * The reading-mode pill and its sheet (issue #196): one global
 * Couverture/Exposition mode (mode.tsx), explained where it is chosen.
 * The two explanations are the web's own sentences (mode-toggle.ts) —
 * one reading, one vocabulary, both surfaces.
 *
 * The pill shows the short reading (« Couv. » / « Expo. », a stable
 * width — the Photos « Sélect. » pattern) on the salvaged GlassPill.
 * A tap presents the true-sheet; a long-press anywhere on the pill
 * flips the reading directly, with a haptic and no sheet.
 *
 * The sheet is @lodev09/react-native-true-sheet: it presents
 * UISheetPresentationController, so the detents, the grabber and
 * Liquid Glass on iOS 26 come from the system (no backgroundColor —
 * without one, iOS 26 renders the glass and older iOS the system
 * material). It replaced @expo/ui's BottomSheet: on 58.0.28 its
 * content receives no touches (expo/expo #48131).
 */

import { TrueSheet } from '@lodev09/react-native-true-sheet';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  flipMode,
  modeShortLabel,
  type ReadingMode,
  useMode,
} from '@/mode/mode';
import { useTheme } from '@/theme';

import { GlassPill, GlassPillText } from './GlassPill';

/** What a reading does — parity with the web's modeDescription. */
export function modeDescription(mode: ReadingMode): string {
  return mode === 'coverage'
    ? 'Les barres affichent combien de médias rapportent chaque sujet'
    : 'Les barres affichent la part de lecteurs touchés par chaque média pour un sujet';
}

const MODES: Array<{ mode: ReadingMode; label: string }> = [
  { mode: 'coverage', label: 'Couverture' },
  { mode: 'exposure', label: 'Exposition' },
];

export function ModeButton() {
  const theme = useTheme();
  const { mode, setMode } = useMode();
  const sheet = useRef<TrueSheet>(null);
  const current = MODES.find((m) => m.mode === mode) ?? MODES[0];

  return (
    <>
      <GlassPill
        accessibilityLabel={`Lecture des barres : ${current.label}. Choisir la lecture.`}
        testID="mode-button"
        onPress={() => void sheet.current?.present()}
        onLongPress={() => {
          // Fire-and-forget: a dead haptic never blocks the flip.
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
            () => undefined,
          );
          setMode(flipMode(mode));
        }}
      >
        {/* The fixed width keeps « Couv. » and « Expo. » the same pill. */}
        <GlassPillText style={styles.short}>
          {modeShortLabel(mode)}
        </GlassPillText>
      </GlassPill>

      <TrueSheet ref={sheet} detents={['auto']} grabber>
        {/* No background of our own: iOS 26 renders Liquid Glass, older iOS the
            system material, Android the M3 surface — all from the system. */}
        <View style={styles.sheet}>
          <Text style={[styles.title, { color: theme.ink }]}>
            Lecture des barres
          </Text>
          {MODES.map(({ mode: candidate, label }) => (
            <Pressable
              key={candidate}
              accessibilityRole="radio"
              accessibilityState={{ selected: candidate === mode }}
              testID={`mode-row-${candidate}`}
              onPress={() => {
                setMode(candidate);
                void sheet.current?.dismiss();
              }}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor:
                    candidate === mode
                      ? theme.toggleTrack
                      : pressed
                        ? theme.hover
                        : 'transparent',
                },
              ]}
            >
              <Text style={[styles.rowLabel, { color: theme.ink }]}>
                {label}
              </Text>
              <Text style={[styles.rowDescription, { color: theme.muted }]}>
                {modeDescription(candidate)}
              </Text>
              {candidate === mode && (
                <Text style={[styles.rowCheck, { color: theme.ink }]}>✓</Text>
              )}
            </Pressable>
          ))}
          <Text style={[styles.tip, { color: theme.faint }]}>
            Appui long : basculer directement.
          </Text>
        </View>
      </TrueSheet>
    </>
  );
}

const styles = StyleSheet.create({
  short: {
    minWidth: 44,
    textAlign: 'center',
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 4,
  },
  row: {
    borderRadius: 12,
    padding: 14,
    gap: 2,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowDescription: {
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 300,
  },
  rowCheck: {
    position: 'absolute',
    right: 14,
    top: 14,
    fontSize: 16,
    fontWeight: '700',
  },
  tip: {
    fontSize: 13,
    textAlign: 'center',
    paddingTop: 10,
  },
});
