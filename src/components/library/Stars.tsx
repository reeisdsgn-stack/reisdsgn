export function Stars({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`tracking-[0.15em] ${className}`} aria-label={`${value} de 5 estrelas`}>
      <span className="text-accent">{"★".repeat(value)}</span>
      <span className="text-faint">{"★".repeat(5 - value)}</span>
    </span>
  );
}
