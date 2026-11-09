/**
 * Indian mobile number input: the +91 country code is fixed (cannot be edited) and only
 * 10 digits can be typed. Pasting "+91 98765 43210" or "09876543210" is cleaned automatically.
 */
export function sanitizeMobile(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

export default function PhoneInput({ value, onChange, name, required = false, className = 'mt-1.5', placeholder = '10-digit mobile number' }) {
  return (
    <div className={`flex w-full overflow-hidden rounded-xl border border-border bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 ${className}`}>
      <span className="flex select-none items-center border-r border-border bg-surface-2 px-3 text-sm font-semibold text-muted" aria-hidden="true">+91</span>
      <input
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={10}
        pattern="[0-9]{10}"
        title="Enter a 10-digit mobile number"
        required={required}
        placeholder={placeholder}
        aria-label="Mobile number (country code +91)"
        value={sanitizeMobile(value)}
        onChange={(event) => onChange(sanitizeMobile(event.target.value))}
        className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-sm outline-none"
      />
    </div>
  );
}
