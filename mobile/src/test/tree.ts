/**
 * Depth-first walk of a rendered tree collecting its markers — testIDs
 * and text leaves, in order. The order is the behavior carrier for the
 * floating chrome: RN hit-tests later siblings first, so the header's
 * pills only receive presses when they render AFTER the screen's
 * content (the home's own pattern, issue #196). RTL's fireEvent
 * bypasses hit-testing, so the composition is what these assertions
 * pin (issue #199, the dead static-page pills).
 */

export type MarkerNode = {
  props?: { testID?: string };
  children?: Array<MarkerNode | string>;
};

export function collectMarkers(
  root: MarkerNode | MarkerNode[] | null,
): string[] {
  const markers: string[] = [];

  const walk = (
    node: MarkerNode | Array<MarkerNode | string> | string | null,
  ) => {
    if (node == null || typeof node !== 'object') {
      if (typeof node === 'string') markers.push(node);
      return;
    }
    for (const child of Array.isArray(node) ? node : [node]) {
      if (typeof child === 'string') {
        markers.push(child);
        continue;
      }
      if (child.props?.testID != null) markers.push(child.props.testID);
      walk(child.children ?? []);
    }
  };

  walk(root);
  return markers;
}
