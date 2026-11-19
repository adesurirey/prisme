import { collectMarkers, type MarkerNode } from './tree';

describe('collectMarkers', () => {
  test('walks testIDs and text leaves depth-first', () => {
    const tree: MarkerNode = {
      props: {},
      children: [
        {
          props: { testID: 'back-button' },
          children: [{ props: {}, children: [] }],
        },
        { props: {}, children: [] },
        {
          props: {},
          children: [
            { props: {}, children: ['Titre de page'] },
            { props: {}, children: ['Un paragraphe.'] },
          ],
        },
      ],
    };
    expect(collectMarkers(tree)).toEqual([
      'back-button',
      'Titre de page',
      'Un paragraphe.',
    ]);
  });
});
