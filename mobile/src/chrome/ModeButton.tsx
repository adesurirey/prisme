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
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  flipMode,
  modeShortLabel,
  type ReadingMode,
  useMode,
} from '@/mode/mode';
import { useTheme } from '@/theme';

import { GlassPill, GlassPillText } from './GlassPill';

/** Extra pill styling from the host bar (the shared 38pt height). */
type ModeButtonStyle = Parameters<typeof GlassPill>[0]['style'];

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

export function ModeButton({ style }: { style?: ModeButtonStyle }) {
  const theme = useTheme();
  const { mode, setMode } = useMode();
  const sheet = useRef<TrueSheet>(null);
  const current = MODES.find((m) => m.mode === mode) ?? MODES[0];

  // The glass flip (issue #196): a spring pulse on the pill and the
  // short label rolling up — the flip reads as a change, not a swap.
  // The pulse answers the reader's flip, never the app opening. Deep
  // press-in, fast stiff spring back — a pop, not a squish.
  const pulse = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
  const renderedMode = useRef(mode);
  useEffect(() => {
    if (renderedMode.current === mode) return;
    renderedMode.current = mode;
    pulse.value = withSequence(
      withTiming(0.85, { duration: 70 }),
      withSpring(1, { damping: 17, stiffness: 420 }),
    );
  }, [mode, pulse]);

  return (
    <>
      <Animated.View style={pulseStyle}>
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
          style={style}
        >
          {/* The fixed width keeps « Couv. » and « Expo. » the same pill. */}
          <Animated.View
            key={mode}
            entering={FadeInDown.duration(130)}
            exiting={FadeOutUp.duration(85)}
          >
            <GlassPillText style={styles.short}>
              {modeShortLabel(mode)}
            </GlassPillText>
          </Animated.View>
        </GlassPill>
      </Animated.View>

      <TrueSheet ref={sheet} detents={['auto']} grabber>
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
                      ? theme.canvas
                      : pressed
                        ? theme.hover
                        : 'transparent',
                },
              ]}
            >
              <Text style={[styles.rowLabel, { color: theme.ink }]}>
                {label}
              </Text>
              <Text style={[styles.rowDescription, { color: theme.prose }]}>
                {/* The web toggle's own whisper sentences, one reading each. */}
                {modeDescription(candidate)}
              </Text>
              {candidate === mode && (
                <Text style={[styles.rowCheck, { color: theme.ink }]}>✓</Text>
              )}
            </Pressable>
          ))}
          <Text style={[styles.tip, { color: theme.muted }]}>
            Appui long : basculer directement
          </Text>
        </View>
      </TrueSheet>
    </>
  );
}

const styles = StyleSheet.create({
  short: {
    minWidth: 52,
    textAlign: 'center',
  },
  sheet: {
    paddingHorizontal: 10,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  row: {
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 6,
  },
  rowLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  rowDescription: {
    fontSize: 16,
    lineHeight: 21,
    maxWidth: 320,
  },
  rowCheck: {
    position: 'absolute',
    right: 16,
    top: 18,
    fontSize: 18,
    fontWeight: '700',
  },
  tip: {
    fontSize: 16,
    textAlign: 'center',
    paddingTop: 16,
  },
});
