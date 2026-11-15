/**
 * The reading-mode button and its sheet (issue #180): one global
 * Couverture/Exposition mode (mode.tsx), explained where it is chosen.
 * The two explanations are the web's own sentences (mode-toggle.ts) —
 * one reading, one vocabulary, both surfaces.
 *
 * The trigger is a Liquid Glass pill (iOS 26). The sheet is a plain RN
 * Modal: on @expo/ui 58.0.28, content hosted in the native BottomSheet
 * — RN pressables and native ListItems alike — receives no touches
 * (expo/expo #48131 and friends), so nothing in it could be selected.
 * A Modal gives the same bottom-sheet feel with working rows; revisit
 * @expo/ui when its sheet touch dispatch is fixed.
 */

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type ReadingMode, useMode } from '@/mode/mode';
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
  const insets = useSafeAreaInsets();
  const { mode, setMode } = useMode();
  const [sheetOpen, setSheetOpen] = useState(false);
  const current = MODES.find((m) => m.mode === mode) ?? MODES[0];

  return (
    <>
      <GlassPill
        accessibilityLabel={`Lecture des barres : ${current.label}. Choisir la lecture.`}
        testID="mode-button"
        onPress={() => setSheetOpen(true)}
      >
        <GlassPillText>{current.label}</GlassPillText>
      </GlassPill>

      <Modal
        visible={sheetOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable
          accessibilityLabel="Fermer le choix de lecture"
          style={styles.backdrop}
          testID="mode-sheet-backdrop"
          onPress={() => setSheetOpen(false)}
        >
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: theme.surface,
                paddingBottom: insets.bottom + 16,
              },
            ]}
            testID="mode-sheet"
            onPress={() => undefined}
          >
            <View
              style={[styles.grabber, { backgroundColor: theme.lineStrong }]}
            />
            <Text style={[styles.sheetTitle, { color: theme.ink }]}>
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
                  setSheetOpen(false);
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
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 4,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 999,
    marginTop: 4,
    marginBottom: 8,
  },
  sheetTitle: {
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
});
