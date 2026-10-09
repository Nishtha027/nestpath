import { Disclosure } from "./Disclosure";

/** On every page: the short disclaimer, with the full text one click away. */
export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-3xl px-4 pt-2 pb-6 text-sm text-muted sm:px-8">
      <p>NestPath is not medical advice.</p>
      <Disclosure label="About NestPath">
        <p>
          NestPath helps your family keep track of a baby&apos;s care. It doesn&apos;t replace your
          pediatrician, midwife or doctor, who know your family and have the final say.
        </p>
        <p>
          Vaccine dates follow the US CDC schedule for healthy children (July 2, 2025). Growth
          charts use the WHO Child Growth Standards (0 to 24 months), from CDC&apos;s data files.
        </p>
        <p>In an emergency, call 911 or your local emergency number.</p>
      </Disclosure>
    </footer>
  );
}
