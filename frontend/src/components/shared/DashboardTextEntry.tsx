import type { ComponentPropsWithRef } from 'react';
import { TextInput, type TextInputProps } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';

type EntryAttributes = 'id' | 'value' | 'onChange' | 'placeholder' | 'disabled' | 'className' | 'style'
  | 'maxLength' | 'required' | 'aria-label' | 'onBlur' | 'onKeyDown' | 'title';

export function DashboardInput({
  type, value, onChange, className, style, title, label, required, placeholder, disabled,
  'aria-label': ariaLabel, ...props
}: Pick<ComponentPropsWithRef<'input'>, EntryAttributes | 'autoComplete'> &
  Pick<TextInputProps, 'inputMode' | 'type' | 'startIcon'> & { label?: string }) {
  const name = ariaLabel ?? label ?? title ?? placeholder ?? 'Valor';
  return <TextInput {...props} {...{ required, disabled }} type={type} label={name} aria-label={name} isLabelHidden isDisabled={disabled}
    value={value == null ? '' : String(value)}
    onChange={(_, event) => onChange?.(event)} placeholder={placeholder} width="100%"
    controlClassName={`dashboard-inline-input ${className ?? ''}`} controlStyle={style} />;
}

export function DashboardTextArea({
  value, onChange, className, style, title, label, required, placeholder, disabled,
  'aria-label': ariaLabel, ...props
}: Pick<ComponentPropsWithRef<'textarea'>, EntryAttributes> & { label?: string }) {
  const name = ariaLabel ?? label ?? title ?? placeholder ?? 'Descrição';
  return <TextArea {...props} {...{ required, disabled }} label={name} aria-label={name} isLabelHidden isDisabled={disabled}
    value={value == null ? '' : String(value)}
    onChange={(_, event) => onChange?.(event)} placeholder={placeholder} width="100%"
    controlClassName={`dashboard-inline-input ${className ?? ''}`} controlStyle={style} />;
}
