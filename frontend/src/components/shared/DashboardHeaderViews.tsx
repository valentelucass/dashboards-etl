import { Selector } from '@astryxdesign/core/Selector';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { PanelsTopLeft } from 'lucide-react';

interface DashboardHeaderViewsProps<T extends string> {
  label: string;
  panelId: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export default function DashboardHeaderViews<T extends string>({
  label, panelId, options, value, onChange,
}: DashboardHeaderViewsProps<T>) {
  function select(next: string) {
    const option = options.find(item => item.value === next);
    if (option) onChange(option.value);
  }

  return <>
    <div className="dashboard-header-tabs">
      <TabList role="tablist" aria-label={label} size="sm" value={value} onChange={select}>
        {options.map(option => <Tab key={option.value} id={panelId + '-' + option.value} panelId={panelId}
          label={option.label} aria-label={option.label} value={option.value} />)}
      </TabList>
    </div>
    <div className="dashboard-header-view-picker">
      <Selector label={label} isLabelHidden options={options} value={value} onChange={select}
        size="sm" variant="ghost" presentation="adaptive" width="var(--header-picker-width, auto)"
        renderValue={option => <span className="dashboard-view-selection">
          <PanelsTopLeft size={16} aria-hidden="true" /><span>{option.label}</span>
        </span>} />
    </div>
  </>;
}
