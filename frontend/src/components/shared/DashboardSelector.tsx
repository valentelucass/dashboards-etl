import { Children, isValidElement, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Selector } from '@astryxdesign/core/Selector';

interface DashboardSelectorProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  onValueChange: (value: string) => void;
  label?: string;
}

function optionText(children: ReactNode): string {
  return Children.toArray(children).map(child => {
    if (typeof child === 'string' || typeof child === 'number') return String(child);
    return isValidElement<{ children?: ReactNode }>(child) ? optionText(child.props.children) : '';
  }).join('');
}

function optionValue(value: string) {
  return value === '' ? 'dashboard-option-empty' : value;
}

export default function DashboardSelector({
  children, value, onValueChange, label, disabled, className, style, required, id,
  'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy,
}: DashboardSelectorProps) {
  const options = Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ children?: ReactNode; value?: string | number; disabled?: boolean }>(child) || child.type !== 'option') return [];
    const text = optionText(child.props.children).trim();
    return [{ label: text, value: optionValue(String(child.props.value ?? text)), disabled: child.props.disabled }];
  });
  return (
    <Selector id={id} label={ariaLabel ?? label ?? 'Selecionar opção'} aria-labelledby={ariaLabelledBy} isLabelHidden
      value={value == null ? undefined : optionValue(String(value))}
      onChange={next => onValueChange(next === 'dashboard-option-empty' ? '' : next)}
      options={options} size="sm" isDisabled={disabled} isRequired={required}
      controlClassName={`dashboard-core-selector ${className ?? ''}`} controlStyle={style} />
  );
}
