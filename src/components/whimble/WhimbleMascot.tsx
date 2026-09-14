import Image from "next/image";

const SIZE_CLASSES = {
  sm: "h-7 w-7",
  md: "h-16 w-16",
  lg: "h-28 w-28",
  xl: "h-56 w-56",
} as const;

// Layer order (bottom to top): body, then each arm, then face details
// (mouth, blush, eyes), then the hat on top since it sits above the head.
// Each part stays its own <img> (rather than a single flattened image)
// specifically so a later pass can animate individual parts — a blink, a
// waving arm — by targeting these elements instead of redrawing artwork.
//
// "body" swaps for "half-body" (cropped off partway down, like he's peeking
// up) on the goal-entry page. The two aren't the same height, so each lives
// in its own composed/<variant>/ subfolder with its own tight crop (see
// scripts/compose-whimble.mjs) — sharing one crop sized for the taller full
// body would leave empty space under the shorter half body. Every layer
// within one variant's subfolder shares that subfolder's crop, so they stay
// aligned to each other.
const OTHER_LAYERS = ["left-arm", "right-arm", "mouth", "blush", "eyes", "hat"] as const;

export function WhimbleMascot({
  size = "md",
  bodyVariant = "full",
  className = "",
}: {
  size?: keyof typeof SIZE_CLASSES;
  bodyVariant?: "full" | "half";
  className?: string;
}) {
  const bodyPart = bodyVariant === "half" ? "half-body" : "body";

  return (
    <div role="img" aria-label="Whimble" className={`relative shrink-0 ${SIZE_CLASSES[size]} ${className}`}>
      {[bodyPart, ...OTHER_LAYERS].map((part) => (
        <Image
          key={part}
          src={`/whimble/composed/${bodyVariant}/whimble-${part}.png`}
          alt=""
          fill
          sizes="224px"
          data-whimble-part={part}
          draggable={false}
          className="select-none object-contain"
        />
      ))}
    </div>
  );
}
