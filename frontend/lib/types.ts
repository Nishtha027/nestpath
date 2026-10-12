export type Child = {
  id: string;
  name: string | null;
  birth_date: string;
  region: string | null;
};

export type Family = {
  id: string;
  invite_code: string;
};

export type ScheduleItem = {
  id: string;
  child_id: string;
  type: string;
  vaccine_id: string;
  dose_number: number | null;
  due_date: string;
  status: string;
  administered_date: string | null;
  notes: string | null;
  source_version: string | null;
  /** First date this dose is no longer recommended (hard age limit), if any. */
  window_closes_on: string | null;
  /** Parent-facing explanation of that age limit. */
  age_window_note: string | null;
};

export type GrowthMeasurement = {
  id: string;
  child_id: string;
  measured_at: string;
  age_months: number;
  sex: string;
  // A measurement has a weight, a length, or both.
  weight_kg: number | null;
  percentile: number | null; // weight-for-age
  z_score: number | null; // weight-for-age
  length_cm: number | null;
  length_percentile: number | null;
  length_z_score: number | null;
  source_version: string | null;
};

/** One month of WHO chart percentile curves (GET /growth/reference). */
export type GrowthReferenceRow = {
  month: number;
  p3: number;
  p15: number;
  p50: number;
  p85: number;
  p97: number;
};

export type GrowthReference = {
  sex: "male" | "female";
  source: string;
  weight_kg: GrowthReferenceRow[];
  length_cm: GrowthReferenceRow[];
};

export type CareLogType = "feed" | "diaper" | "sleep" | "medication";
export type FeedType = "breast" | "bottle" | "solid";
export type FeedSide = "left" | "right" | "both";
export type DiaperKind = "wet" | "dirty" | "both";

/** One care-log entry. Entries made before the tracker have only type,
 * time and notes; every structured field is null on them. */
export type CareLog = {
  id: string;
  child_id: string;
  caregiver_id: string;
  caregiver_name: string | null;
  type: CareLogType;
  /** When it happened (a sleep: when it started). */
  occurred_at: string;
  /** Same as occurred_at; the older name. */
  timestamp: string;
  notes: string | null;
  feed_type: FeedType | null;
  amount_ml: number | null;
  duration_min: number | null;
  side: FeedSide | null;
  ended_at: string | null;
  /** A sleep whose timer is still running. */
  in_progress: boolean;
  diaper_kind: DiaperKind | null;
  updated_at: string | null;
};

/** GET /children/{id}/care-logs/latest: the newest entry of each type. */
export type CareLogLatest = Record<CareLogType, CareLog | null>;

export type CareLogDay = {
  /** YYYY-MM-DD, a calendar day in the timezone the summary was asked for. */
  day: string;
  feeds: number;
  feed_ml: number;
  avg_feed_ml: number | null;
  avg_feed_min: number | null;
  diapers_wet: number;
  diapers_dirty: number;
  diapers_both: number;
  diapers_other: number;
  sleep_min: number;
  longest_sleep_min: number | null;
};

export type CareLogSummary = {
  days: number;
  timezone: string;
  start: string;
  end: string;
  daily: CareLogDay[];
  /** Per day, over the days that have any entry. */
  averages: {
    days_with_entries: number;
    feeds_per_day: number | null;
    feed_ml_per_day: number | null;
    avg_feed_ml: number | null;
    avg_feed_min: number | null;
    diapers_per_day: number | null;
    sleep_min_per_day: number | null;
  };
  /** The same averages without today, which is still in progress. Missing
   * from servers before this field was added. */
  averages_excluding_today?: CareLogSummary["averages"];
};

export type Provider = {
  id: string;
  name: string;
  specialty: string | null;
};

export type AvailabilitySlot = {
  id: string;
  provider_id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
};

export type Appointment = {
  id: string;
  child_id: string;
  slot_id: string;
  caregiver_id: string;
  status: "booked" | "cancelled";
  checklist: string[];
};

export type ScoreBand = "low" | "moderate" | "high";

export type ScreeningSubmitResponse = {
  id: string;
  total_score: number;
  /** Total-score band only; item 10 is reported separately in item_10_flag. */
  score_band: ScoreBand;
  risk_level: "low" | "moderate" | "high";
  item_10_flag: boolean;
  message: string;
  created_at: string;
};

export type ScreeningHistoryItem = {
  id: string;
  total_score: number;
  score_band: ScoreBand;
  item_10_flag: boolean;
  created_at: string;
};

export type Alert = {
  id: string;
  caregiver_id: string;
  family_id: string;
  total_score: number;
  risk_level: string;
  item_10_flag: boolean;
  created_at: string;
};

export type HelpRequestStatus = "open" | "claimed" | "completed";

export type HelpRequest = {
  id: string;
  family_id: string;
  created_by: string;
  need_type: string;
  description: string | null;
  time_window_start: string;
  time_window_end: string;
  status: HelpRequestStatus;
  claimed_by: string | null;
};
