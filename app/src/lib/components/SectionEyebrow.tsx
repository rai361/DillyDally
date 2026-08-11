export default function SectionEyebrow({ icon, children }: { icon: string, children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span
        className="h-px flex-1 opacity-40"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, #8b5e34 0px, #8b5e34 4px, transparent 4px, transparent 9px)',
        }}
      />
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#8b5e34]">
        <span aria-hidden>{icon}</span>
        {children}
      </span>
      <span
        className="h-px flex-1 opacity-40"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, #8b5e34 0px, #8b5e34 4px, transparent 4px, transparent 9px)',
        }}
      />
    </div>
  );
}