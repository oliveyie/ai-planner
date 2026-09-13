const SIZES = {
  sm: { box: "h-7 w-7", eye: "h-[3px] w-[3px]", gap: "gap-[5px]", mouth: "text-[9px]", top: "top-[36%]" },
  md: { box: "h-16 w-16", eye: "h-[5px] w-[5px]", gap: "gap-2", mouth: "text-xl", top: "top-[37%]" },
  lg: { box: "h-28 w-28", eye: "h-2 w-2", gap: "gap-3.5", mouth: "text-4xl", top: "top-[38%]" },
} as const;

// Whimble: a small derpy bean who plans your goals. An organic "blob" shape
// (asymmetric border-radius, a CSS trick for a hand-drawn feel — an actual
// SVG bean outline was overkill for two dots and a "ᴗ") with dot eyes and a
// literal "ᴗ" for a mouth, matching the character's original ASCII sketch.
export function WhimbleMascot({
  size = "md",
  className = "",
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];

  return (
    <div
      role="img"
      aria-label="Whimble"
      className={`relative shrink-0 ${s.box} ${className}`}
      style={{
        background: "linear-gradient(160deg, #fef3d0 0%, #fbdf9a 100%)",
        borderRadius: "58% 42% 53% 47% / 58% 46% 54% 42%",
        boxShadow: "inset -3px -5px 8px rgba(184,138,63,0.22), 0 3px 8px rgba(184,138,63,0.16)",
      }}
    >
      <div className={`absolute left-1/2 ${s.top} flex -translate-x-1/2 items-center ${s.gap}`}>
        <span className={`block ${s.eye} rounded-full bg-[#4a3a22]`} />
        <span className={`block ${s.eye} rounded-full bg-[#4a3a22]`} />
      </div>
      <span
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/4 ${s.mouth} leading-none text-[#4a3a22]`}
      >
        ᴗ
      </span>
    </div>
  );
}
