/**
 * The story route (issue #195): pushed full-screen over the home,
 * header hidden — the native edge-swipe and the Android back pop it.
 * The screen carries the chrome (back, mode, share — issue #199); the
 * body is #182.
 */

import { useLocalSearchParams } from 'expo-router';

import { Story } from '@/screens/story';

export default function StoryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Story id={id} />;
}
