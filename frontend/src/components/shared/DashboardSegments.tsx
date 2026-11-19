import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';

interface Segment<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  title?: string;
}

interface DashboardSegmentsProps<T extends string> {
  label: string;
  value: T;
  options: readonly Segment<T>[];
  onChange: (value: T) => void;
}

export default function DashboardSegments<T extends string>({ label, value, options, onChange }: DashboardSegmentsProps<T>) {
  return (
    <SegmentedControl size="sm" label={label} value={value} onChange={next => {
      const option = options.find(item => item.value === next);
      if (option && !option.disabled) onChange(option.value);
    }}>
      {options.map(item => (
        <SegmentedControlItem key={item.value} value={item.value} label={item.label}
          isDisabled={item.disabled} aria-description={item.title} />
      ))}
    </SegmentedControl>
  );
}
