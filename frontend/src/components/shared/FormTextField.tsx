import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { TextInput, type TextInputProps } from '@astryxdesign/core/TextInput';
import { Eye, EyeOff } from 'lucide-react';

type FormTextFieldProps = TextInputProps & Pick<InputHTMLAttributes<HTMLInputElement>, 'required' | 'minLength' | 'maxLength'>;

export function FormTextField({ required, containerClassName, controlClassName, ...props }: FormTextFieldProps) {
  return <TextInput {...props} {...{ required }} isRequired={required} aria-label={props['aria-label'] ?? props.label}
    width="100%" containerClassName={`dashboard-form-field ${containerClassName ?? ''}`}
    controlClassName={`dashboard-form-control ${controlClassName ?? ''}`} />;
}

export function FormPasswordField({ visible, onToggle, hint, ...props }: Omit<FormTextFieldProps, 'type'> & {
  visible?: boolean;
  onToggle?: () => void;
  hint?: string;
}) {
  const hintId = useId();
  return (
    <div className="dashboard-password-field">
      <div className="relative">
        <FormTextField {...props} type={visible ? 'text' : 'password'}
          aria-describedby={hint ? hintId : undefined}
          controlClassName={onToggle ? 'dashboard-password-control' : undefined} />
        {onToggle && (
          <Button label={visible ? 'Ocultar senha' : 'Exibir senha'} isIconOnly size="sm" variant="ghost"
            className="dashboard-password-toggle" icon={visible ? <EyeOff size={16} /> : <Eye size={16} />}
            onClick={onToggle} aria-pressed={Boolean(visible)} />
        )}
      </div>
      {hint && <p id={hintId} className="dashboard-form-hint">{hint}</p>}
    </div>
  );
}
