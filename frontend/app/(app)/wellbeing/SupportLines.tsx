import { DEFAULT_REGION, SUPPORT_RESOURCES, type SupportLine } from "@/lib/support-resources";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const LINK_BUTTON = `inline-block rounded border border-black/25 px-3 py-1 text-sm font-medium hover:bg-black/[.05] dark:border-white/30 dark:hover:bg-white/[.08] ${FOCUS}`;

const resources = SUPPORT_RESOURCES[DEFAULT_REGION];

function LineActions({ line }: { line: SupportLine }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a href={`tel:${line.tel}`} className={LINK_BUTTON}>
        Call {line.display.split(" ")[0]}
      </a>
      {line.canText && (
        <a href={`sms:${line.tel}`} className={LINK_BUTTON}>
          Text {line.display.split(" ")[0]}
        </a>
      )}
    </div>
  );
}

/** Shown first, above everything else, when the server flags item 10. */
export function CrisisSupport() {
  const crisis = resources.crisisLine;
  return (
    <section
      aria-labelledby="crisis-heading"
      className="flex flex-col gap-3 rounded-lg border-2 border-red-700 bg-red-50 p-4 text-red-950 dark:border-red-400 dark:bg-red-950 dark:text-red-50"
    >
      <h2 id="crisis-heading" className="text-lg font-semibold">
        Please reach out for support now
      </h2>
      <p>
        You said the thought of harming yourself has occurred to you. You don&apos;t have to wait,
        and you don&apos;t have to handle this alone.
      </p>
      <p className="font-medium">
        {crisis.name}: call or text <span className="text-xl font-bold">{crisis.display}</span>,
        any time, 24/7.
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href={`tel:${crisis.tel}`}
          className={`rounded bg-red-800 px-4 py-2 font-semibold text-white hover:bg-red-900 dark:bg-red-200 dark:text-red-950 ${FOCUS}`}
        >
          Call {crisis.display}
        </a>
        <a
          href={`sms:${crisis.tel}`}
          className={`rounded border-2 border-red-800 px-4 py-2 font-semibold hover:bg-red-100 dark:border-red-200 dark:hover:bg-red-900 ${FOCUS}`}
        >
          Text {crisis.display}
        </a>
      </div>
      <p className="font-semibold">
        If you are in immediate danger, call {resources.emergencyNumber} (or your local emergency
        number) now.
      </p>
      <p className="text-sm">
        These are {resources.regionName} numbers. Outside the US, contact your local emergency
        number or health service.
      </p>
    </section>
  );
}

export function SupportLines() {
  return (
    <section aria-labelledby="support-lines-heading" className="flex flex-col gap-3">
      <h2 id="support-lines-heading" className="text-lg font-medium">
        Postpartum support lines
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        These are {resources.regionName} resources. Outside the US, contact your local emergency
        number or health service.
      </p>
      <ul className="flex flex-col gap-3">
        {resources.postpartumLines.map((line) => (
          <li
            key={line.name}
            className="flex flex-col gap-2 rounded border border-black/15 px-4 py-3 dark:border-white/20"
          >
            <p className="font-medium">{line.name}</p>
            <p className="text-sm">
              <span className="font-medium">{line.display}</span> -- {line.description}
            </p>
            <LineActions line={line} />
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Source:{" "}
              <a href={line.sourceUrl} className="underline" target="_blank" rel="noreferrer">
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
