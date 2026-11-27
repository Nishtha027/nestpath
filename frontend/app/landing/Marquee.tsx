import { Icon, type IconName } from "../ui/Icon";

type Item = { icon: IconName; text: string };

const TOP: Item[] = [
  { icon: "bottle", text: "Bottle · 120 ml" },
  { icon: "moon", text: "Nap · 1 h 20 min" },
  { icon: "diaper", text: "Wet diaper" },
  { icon: "calendar", text: "DTaP dose 2" },
  { icon: "trendUp", text: "6.4 kg · 50th percentile" },
  { icon: "breast", text: "Left side · 14 min" },
  { icon: "clock", text: "Check-up Thu 10:30" },
  { icon: "heart", text: "Dinner drop-off claimed" },
];

const BOTTOM: Item[] = [
  { icon: "shield", text: "CDC schedule" },
  { icon: "trendUp", text: "WHO growth standards" },
  { icon: "heart", text: "Postpartum check-in" },
  { icon: "list", text: "History by day" },
  { icon: "barChart", text: "7 and 30 day insights" },
  { icon: "print", text: "Pediatrician summary" },
  { icon: "share", text: "Invite codes" },
  { icon: "calendar", text: "Race-safe booking" },
];

function Row({ items, className }: { items: Item[]; className: string }) {
  // Two copies side by side: the track slides by half its width and loops.
  return (
    <div className={className}>
      {[0, 1].map((copy) => (
        <ul key={copy} className="flex shrink-0 items-center">
          {items.map((item) => (
            <li key={item.text} className="flex items-center gap-3 px-5 whitespace-nowrap">
              <Icon name={item.icon} className="h-5 w-5 opacity-80" />
              <span>{item.text}</span>
              <span className="pl-5 text-xs opacity-60">✦</span>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

/** Two ribbons crossing under the hero: things a family actually logs, and
 * what NestPath does with them. Decorative; every item is covered below. */
export function Marquee() {
  return (
    <div aria-hidden="true" className="np-marquee relative z-10 -my-6 overflow-x-clip py-14 select-none">
      <div className="relative z-10 -mx-6 rotate-[-2.5deg] bg-primary-ink py-4 font-heading text-lg font-medium text-on-primary sm:text-xl">
        <Row items={TOP} className="np-loop-marquee" />
      </div>
      <div className="-mx-6 mt-[-3.25rem] rotate-[2.5deg] border-y border-primary bg-lime py-3 text-base font-bold text-ink sm:mt-[-3.6rem]">
        <Row items={BOTTOM} className="np-loop-marquee-back" />
      </div>
    </div>
  );
}
