'use client';

/**
 * Never blue. Blue means proven, and a blue DEPOSIT would be a lie about what
 * the colour carries.
 */
export function Button({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button className="as-button" onClick={onClick} disabled={disabled} type={type}>
      {children}
    </button>
  );
}
