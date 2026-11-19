/**
 * The share seam behind every chrome share pill (issues #198/#199):
 * fire-and-forget — a dismissal still resolves, a failure never crashes
 * the screen. Android's chooser reads only `message`/`title` (RN 0.88),
 * so the URL rides `message` there; iOS shares the URL itself.
 */

import { Platform, Share } from 'react-native';

export function shareLink(url: string): void {
  void Share.share(
    Platform.OS === 'android' ? { message: url } : { url },
  ).catch(() => undefined);
}
