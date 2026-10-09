import { DEFAULT_REGION, SUPPORT_RESOURCES, type SupportLine } from "@/lib/support-resources";
import { BUTTON_SECONDARY, CARD, LINK, LIST_ITEM, MUTED, SECTION_TITLE } from "@/lib/ui";
import { Icon } from "../../ui/Icon";

const LINK_BUTTON = BUTTON_SECONDARY;

const resources = SUPPORT_RESOURCES[DEFAULT_REGION];

function LineActions({ line }: { line: SupportLine }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a href={`tel:${line.tel}`} className={LINK_BUTTON}>
        <Icon name="phone" className="h-4 w-4" />
        Call {line.display.split(" ")[0]}
      </a>
      {line.canText && (
        <a href={`sms:${line.tel}`} className={LINK_BUTTON}>
          <Icon name="message" className="h-4 w-4" />
          Text {line.display.split(" ")[0]}
        </a>
      )}
    </div>
  );
}

/** Shown first, above everything else, when the server flags item 10.
 * It has its own treatment (crisis tokens, a thick left border, an icon)
 * that nothing else in the app uses, so it is always the most prominent
 * thing on the page. */
export function CrisisSupport() {
  const crisis = resources.crisisLine;
  return (
    <section
      aria-labelledby="crisis-heading"
      className="flex flex-col gap-4 rounded-2xl border-l-8 border-crisis-accent bg-crisis-bg p-5 font-semibold text-crisis-ink sm:p-6"
    >
      <h2 id="crisis-heading" className="flex items-center gap-3 text-xl font-bold">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-crisis-accent text-on-crisis">
          <Icon name="heart" className="h-6 w-6" />
        </span>
        Please reach out for support now
      </h2>
      <p>
        You said the thought of harming yourself has occurred to you. You don&apos;t have to wait,
        and you don&apos;t have to handle this alone.
      </p>
      <p>
        {crisis.name}: call or text <span className="text-2xl font-extrabold">{crisis.display}</span>,
        any time, 24/7.
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href={`tel:${crisis.tel}`}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-crisis-accent px-5 text-base font-bold text-on-crisis hover:opacity-90"
        >
          <Icon name="phone" />
          Call {crisis.display}
        </a>
        <a
          href={`sms:${crisis.tel}`}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-crisis-accent bg-surface px-5 text-base font-bold text-crisis-ink"
        >
          <Icon name="message" />
          Text {crisis.display}
        </a>
      </div>
      <p className="font-bold">
        If you are in immediate danger, call {resources.emergencyNumber} (or your local emergency
        number) now.
      </p>
      <p className="text-sm font-medium">
        These are {resources.regionName} numbers. Outside the US, contact your local emergency
        number or health service.
      </p>
    </section>
  );
}

export function SupportLines() {
  return (
    <section aria-labelledby="support-lines-heading" className={CARD}>
      <h2 id="support-lines-heading" className={SECTION_TITLE}>
        Postpartum support lines
      </h2>
      <p className={MUTED}>
        These are {resources.regionName} resources. Outside the US, contact your local emergency
        number or health service.
      </p>
      <ul className="flex flex-col gap-3">
        {resources.postpartumLines.map((line) => (
          <li key={line.name} className={`flex flex-col gap-2 ${LIST_ITEM}`}>
            <p className="font-bold">{line.name}</p>
            <p className="text-sm">
              <span className="font-semibold">{line.display}</span> -- {line.description}
            </p>
            <LineActions line={line} />
            <p className="text-xs text-muted">
              Source:{" "}
              <a href={line.sourceUrl} className={LINK} target="_blank" rel="noreferrer">
                {new URL(line.sourceUrl).hostname}
              </a>{" "}
              · last checked {line.lastVerified}
            </p>
          </li>
        ))}
      </ul>
      <p className="text-sm">
        In a crisis, call or text {resources.crisisLine.display} ({resources.crisisLine.name}), or{" "}
        {resources.emergencyNumber} if you are in immediate danger.
      </p>
    </section>
  );
}
