"use client";

export function StarRating({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, idx) => (
        <button
          key={idx + 1}
          type="button"
          onClick={() => onChange(idx + 1 === value ? 0 : idx + 1)}
          aria-label={`${idx + 1} star${idx === 0 ? '' : 's'}`}
          className="text-2xl leading-none transition hover:scale-110"
        >
          <span className={idx + 1 <= value ? 'text-[#c9a13b]' : 'text-[#4a3f2f]/20'}>★</span>
        </button>
      ))}
    </div>
  );
}