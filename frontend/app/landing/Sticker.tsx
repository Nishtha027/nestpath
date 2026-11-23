import { Chick } from "../ui/illustrations";

/** A round lime sticker with its text running around the edge. The ring
 * turns slowly (np-loop-spin on the HTML box, not the SVG); the chick in
 * the middle stays upright. Decorative. */
export function Sticker({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`relative ${className}`}>
      <div className="np-loop-spin h-full w-full">
        <svg viewBox="0 0 200 200" className="h-full w-full">
          <defs>
            <path id="np-sticker-ring" d="M100,100 m-76,0 a76,76 0 1,1 152,0 a76,76 0 1,1 -152,0" />
          </defs>
          <circle cx="100" cy="100" r="99" fill="var(--np-lime)" />
          <circle cx="100" cy="100" r="56" fill="none" stroke="var(--np-night)" strokeWidth="1.5" strokeDasharray="2 5" />
          <text fontSize="17" fontWeight="700" fill="var(--np-night)" letterSpacing="2">
            <textPath href="#np-sticker-ring" textLength="470" lengthAdjust="spacing">
              MADE FOR 3AM FEEDS ✦ SHARED LIVE ✦
            </textPath>
          </text>
        </svg>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <Chick className="h-[46%] w-[46%]" />
      </div>
    </div>
  );
}
