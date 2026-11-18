import { useId, type ComponentPropsWithRef } from 'react';
import { Button } from '@astryxdesign/core/Button';

export default function DashboardButton({
  children,
  className,
  disabled,
  title,
  type = 'button',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...props
}: ComponentPropsWithRef<'button'>) {
  const contentId = useId();
  const label = ariaLabel ?? (typeof children === 'string' ? children : title ?? '');
  return (
    <Button
      {...props}
      {...{ disabled }}
      type={type}
      label={label}
      aria-labelledby={ariaLabelledBy ?? (ariaLabel || typeof children === 'string' || !children ? undefined : contentId)}
      isDisabled={disabled}
      size="sm"
      variant={type === 'submit' ? 'primary' : 'ghost'}
      tooltip={title}
      className={`dashboard-control-button ${className ?? ''}`}
    >
      <span id={contentId} className="dashboard-control-button-label">{children}</span>
    </Button>
  );
}
