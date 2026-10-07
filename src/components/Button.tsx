import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';

type Variant = 'primary' | 'secondary' | 'reject';

const STYLES: Record<Variant, string> = {
  primary: 'button button-primary',
  secondary: 'button button-secondary',
  reject: 'button reject-button',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export function Button({ variant = 'primary', className, children, ...rest }: ButtonProps) {
  return (
    <button className={[STYLES[variant], className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </button>
  );
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  to: string;
  children: ReactNode;
}

export function ButtonLink({ variant = 'primary', to, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link to={to} className={[STYLES[variant], className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Link>
  );
}