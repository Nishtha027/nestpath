/** Two overlapping circles in the brand's pink and blue. Decorative. */
export function BrandMark() {
  return (
    <svg viewBox="0 0 32 24" aria-hidden="true" focusable="false" className="h-6 w-8">
      <circle cx="11" cy="12" r="9" fill="var(--np-pink-soft)" stroke="var(--np-secondary-ink)" strokeWidth="1.5" />
      <circle cx="21" cy="12" r="9" fill="var(--np-blue-soft)" fillOpacity="0.85" stroke="var(--np-primary-ink)" strokeWidth="1.5" />
    </svg>
  );
}
