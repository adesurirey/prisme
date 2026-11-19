/**
 * The jest stand-in for the real UISegmentedControl (issue #197): the
 * native control draws its labels natively, so they never exist in the
 * JS tree Jest renders. The mock mirrors the real contract — values,
 * selectedIndex, and an onChange event carrying
 * nativeEvent.selectedSegmentIndex — as plain pressables Jest can find
 * and press. Wired in package.json's moduleNameMapper, like the
 * true-sheet mock.
 */

import { Pressable, Text, View } from 'react-native';

export function MockSegmentedControl({
  values,
  selectedIndex,
  onChange,
  testID,
}: {
  values: string[];
  selectedIndex?: number;
  onChange?: (event: {
    nativeEvent: { value: string; selectedSegmentIndex: number };
  }) => void;
  testID?: string;
}) {
  return (
    <View testID={testID}>
      {values.map((value, index) => (
        <Pressable
          key={value}
          testID={`sort-segment-${index}`}
          accessibilityRole="button"
          accessibilityState={{ selected: index === selectedIndex }}
          onPress={() =>
            onChange?.({ nativeEvent: { value, selectedSegmentIndex: index } })
          }
        >
          <Text>{value}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default MockSegmentedControl;
