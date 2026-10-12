"use client";

import { useId, type ReactNode } from "react";
import {
  DIAPER_LABELS,
  LIMITS,
  SIDE_LABELS,
  stepMinutes,
  stepVolume,
  toLocalInput,
  volumeNumber,
  withFeedType,
  type Draft,
  type VolumeUnit,
} from "@/lib/tracker";
import type { CareLogType, DiaperKind, FeedSide, FeedType } from "@/lib/types";
import { INPUT, LABEL, MUTED } from "@/lib/ui";
import { Icon, type IconName } from "../../ui/Icon";

// The building blocks of the Log page and the edit sheet in History.
// Choices are real radio buttons (arrow keys move between them), styled
// as segments, cards or chips; a choice is marked by weight, border and a
// tick as well as color.

type Option<T extends string> = { value: T; label: string; icon?: ReactNode };

const FOCUS_RING = "has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus";

export function ChoiceGroup<T extends string>({
  legend,
  hideLegend = false,
  options,
  value,
  onChange,
  variant,
}: {
  legend: string;
  hideLegend?: boolean;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  variant: "segment" | "card" | "chip";
}) {
  const name = useId();
  const layout = {
    segment: `grid gap-1 rounded-2xl bg-neutral-bg p-1 ${options.length === 4 ? "grid-cols-4" : "grid-cols-3"}`,
    card: `grid gap-2 ${options.length === 2 ? "grid-cols-2" : "grid-cols-3"}`,
    chip: "flex flex-wrap gap-2",
  }[variant];

  function itemClass(selected: boolean) {
    if (variant === "segment") {
      return `flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-sm ${
        selected ? "bg-surface font-bold text-primary-ink ring-1 ring-line-strong" : "font-semibold text-muted hover:text-ink"
      }`;
    }
    if (variant === "card") {
      return `relative flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-3 text-sm ${
        selected ? "border-primary-ink bg-blue-soft font-bold text-primary-ink" : "border-line bg-surface font-semibold text-ink hover:bg-page"
      }`;
    }
    return `inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm ${
      selected ? "border-primary-ink bg-blue-soft font-bold text-primary-ink" : "border-line-strong bg-surface font-semibold text-ink hover:bg-page"
    }`;
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className={hideLegend ? "sr-only" : `${LABEL} mb-2`}>{legend}</legend>
      <div className={layout}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label key={option.value} className={`np-press cursor-pointer ${FOCUS_RING} ${itemClass(selected)}`}>
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {variant === "card" && selected && <Icon name="check" className="absolute top-2 right-2 h-4 w-4" />}
              {variant === "chip" && selected && <Icon name="check" className="h-4 w-4" />}
              {option.icon}
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** − value + with large buttons. The value is announced as it changes. */
export function Stepper({
  label,
  value,
  unit,
  onStep,
  canDecrease = true,
  canIncrease = true,
  extra,
}: {
  label: string;
  value: string;
  unit: string;
  onStep: (direction: 1 | -1) => void;
  canDecrease?: boolean;
  canIncrease?: boolean;
  extra?: ReactNode;
}) {
  const labelId = useId();
  const button =
    "np-press inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-ink hover:bg-page disabled:cursor-not-allowed disabled:opacity-60";
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={labelId} className={LABEL}>
          {label}
        </span>
        {extra}
      </div>
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-page px-2 py-2">
        <button type="button" onClick={() => onStep(-1)} disabled={!canDecrease} aria-label={`Less (${label})`} className={button}>
          <Icon name="minus" />
        </button>
        <output aria-live="polite" className="flex items-baseline gap-1 text-ink tabular-nums">
          <span className="text-3xl font-bold">{value}</span>
          <span className="text-base font-semibold text-muted">{unit}</span>
        </output>
        <button type="button" onClick={() => onStep(1)} disabled={!canIncrease} aria-label={`More (${label})`} className={button}>
          <Icon name="plus" />
        </button>
      </div>
    </div>
  );
}

/** When it happened. With `allowNow`, the empty value means "now" (the
 * time it's saved), shown as "Now" with a Change button. */
export function TimeField({
  label,
  value,
  onChange,
  allowNow = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allowNow?: boolean;
}) {
  const id = useId();
  const linkButton = "np-press inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-primary-ink underline underline-offset-2";
  if (allowNow && value === "") {
    return (
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>{label}</span>
        <div className="flex items-center gap-2">
          <span className="inline-flex min-h-11 items-center gap-2 text-ink">
            <Icon name="clock" className="h-5 w-5 text-muted" />
            Now
          </span>
          <button type="button" onClick={() => onChange(toLocalInput(new Date()))} className={linkButton}>
            Change
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          className={`${INPUT} min-w-0 flex-1`}
        />
        {allowNow && (
          <button type="button" onClick={() => onChange("")} className={linkButton}>
            Use now
          </button>
        )}
      </div>
    </div>
  );
}

export function NotesField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        Note <span className="font-normal text-muted">(optional)</span>
      </label>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={LIMITS.notesMax}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT}
      />
    </div>
  );
}

const FEED_OPTIONS: Option<FeedType>[] = [
  { value: "breast", label: "Breast", icon: <Icon name="breast" className="h-7 w-7" /> },
  { value: "bottle", label: "Bottle", icon: <Icon name="bottle" className="h-7 w-7" /> },
  { value: "solid", label: "Solid", icon: <Icon name="bowl" className="h-7 w-7" /> },
];

const SIDE_OPTIONS: Option<FeedSide>[] = (["left", "right", "both"] as const).map((side) => ({
  value: side,
  label: side === "both" ? "Both" : SIDE_LABELS[side],
}));

const DIAPER_ICONS: Record<DiaperKind, IconName[]> = { wet: ["droplet"], dirty: ["diaper"], both: ["droplet", "diaper"] };
const DIAPER_OPTIONS: Option<DiaperKind>[] = (["wet", "dirty", "both"] as const).map((kind) => ({
  value: kind,
  label: kind === "both" ? "Both" : DIAPER_LABELS[kind],
  icon: (
    <span className="flex gap-0.5">
      {DIAPER_ICONS[kind].map((name) => (
        <Icon key={name} name={name} className="h-7 w-7" />
      ))}
    </span>
  ),
}));

export const TYPE_OPTIONS: Option<CareLogType>[] = [
  { value: "feed", label: "Feed" },
  { value: "sleep", label: "Sleep" },
  { value: "diaper", label: "Diaper" },
  { value: "medication", label: "Medicine" },
];

/** ml / oz, remembered per browser. */
export function UnitToggle({ unit, onChange }: { unit: VolumeUnit; onChange: (unit: VolumeUnit) => void }) {
  return (
    <ChoiceGroup
      legend="Unit"
      hideLegend
      variant="chip"
      options={[
        { value: "ml", label: "ml" },
        { value: "oz", label: "oz" },
      ]}
      value={unit}
      onChange={onChange}
    />
  );
}

type FieldsProps = { draft: Draft; onChange: (draft: Draft) => void };

export function FeedFields({ draft, onChange, unit, onUnitChange }: FieldsProps & { unit: VolumeUnit; onUnitChange: (u: VolumeUnit) => void }) {
  return (
    <>
      <ChoiceGroup
        legend="Feed"
        hideLegend
        variant="card"
        options={FEED_OPTIONS}
        value={draft.feedType}
        onChange={(feedType) => onChange(withFeedType(draft, feedType))}
      />
      {draft.feedType === "breast" ? (
        <>
          <Stepper
            label="Duration"
            value={draft.durationMin === null ? "-" : String(draft.durationMin)}
            unit="min"
            onStep={(d) => onChange({ ...draft, durationMin: stepMinutes(draft.durationMin, d) })}
            canDecrease={draft.durationMin === null || draft.durationMin > 5}
            canIncrease={draft.durationMin === null || draft.durationMin < LIMITS.feedMin.max}
          />
          <ChoiceGroup
            legend="Side"
            variant="chip"
            options={SIDE_OPTIONS}
            value={draft.side}
            onChange={(side) => onChange({ ...draft, side })}
          />
        </>
      ) : draft.feedType ? (
        <Stepper
          label="Amount"
          value={draft.amountMl === null ? "-" : volumeNumber(draft.amountMl, unit)}
          unit={unit}
          onStep={(d) => onChange({ ...draft, amountMl: stepVolume(draft.amountMl ?? 0, d, unit) })}
          canDecrease={draft.amountMl !== null && stepVolume(draft.amountMl, -1, unit) < draft.amountMl}
          canIncrease={draft.amountMl === null || stepVolume(draft.amountMl, 1, unit) > draft.amountMl}
          extra={<UnitToggle unit={unit} onChange={onUnitChange} />}
        />
      ) : null}
    </>
  );
}

export function DiaperFields({ draft, onChange }: FieldsProps) {
  return (
    <ChoiceGroup
      legend="Diaper"
      hideLegend
      variant="card"
      options={DIAPER_OPTIONS}
      value={draft.diaperKind}
      onChange={(diaperKind) => onChange({ ...draft, diaperKind })}
    />
  );
}

/** A past (or edited) sleep: when it started and ended. */
export function SleepRangeFields({ draft, onChange }: FieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TimeField label="Fell asleep" value={draft.occurredAt} onChange={(occurredAt) => onChange({ ...draft, occurredAt })} />
      {draft.inProgress ? (
        <p className={`${MUTED} self-end pb-3`}>Still sleeping. Stop the timer on the Log page.</p>
      ) : (
        <TimeField label="Woke up" value={draft.endedAt} onChange={(endedAt) => onChange({ ...draft, endedAt })} />
      )}
    </div>
  );
}

/** The fields for a draft of any type, as the edit sheet shows them. */
export function EntryFields({ draft, onChange, unit, onUnitChange }: FieldsProps & { unit: VolumeUnit; onUnitChange: (u: VolumeUnit) => void }) {
  return (
    <>
      {draft.type === "feed" && <FeedFields draft={draft} onChange={onChange} unit={unit} onUnitChange={onUnitChange} />}
      {draft.type === "diaper" && <DiaperFields draft={draft} onChange={onChange} />}
      {draft.type === "sleep" ? (
        <SleepRangeFields draft={draft} onChange={onChange} />
      ) : (
        <TimeField label="Time" value={draft.occurredAt} onChange={(occurredAt) => onChange({ ...draft, occurredAt })} />
      )}
      <NotesField value={draft.notes} onChange={(notes) => onChange({ ...draft, notes })} />
    </>
  );
}

const TYPE_ICONS: Record<CareLogType, IconName> = { feed: "bottle", sleep: "moon", diaper: "diaper", medication: "pill" };
const TYPE_TINTS: Record<CareLogType, string> = {
  feed: "bg-pink-soft text-secondary-ink",
  sleep: "bg-blue-soft text-primary-ink",
  diaper: "bg-success-bg text-success-ink",
  medication: "bg-warning-bg text-warning-ink",
};

/** A round badge with the entry type's icon (the type is also written
 * next to it, so the tint is never the only cue). */
export function TypeBadge({ type, feedType, size = "md" }: { type: CareLogType; feedType?: FeedType | null; size?: "md" | "lg" }) {
  const icon = type === "feed" && feedType === "breast" ? "breast" : type === "feed" && feedType === "solid" ? "bowl" : TYPE_ICONS[type];
  const box = size === "lg" ? "h-11 w-11" : "h-9 w-9";
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full ${box} ${TYPE_TINTS[type]}`}>
      <Icon name={icon} className={size === "lg" ? "h-6 w-6" : "h-5 w-5"} />
    </span>
  );
}
