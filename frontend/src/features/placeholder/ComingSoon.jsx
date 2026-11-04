import { Hammer } from 'lucide-react';

/** Honest placeholder for modules that are not built yet. Shows no fake data or controls. */
export default function ComingSoon({ item }) {
  const Icon = item.icon;
  return (
    <section className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center shadow-card">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Icon size={26} aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-xl font-bold">{item.label}</h1>
      <p className="mx-auto mt-2 flex max-w-md items-center justify-center gap-2 text-sm text-muted">
        <Hammer size={16} aria-hidden="true" />
        Not built yet. This module is scheduled in the Phase 1 plan.
      </p>
    </section>
  );
}
