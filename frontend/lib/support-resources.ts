// Support lines shown on the Wellbeing tab. This is the ONE place these
// names and numbers live. Every entry was checked against its official
// organization's own website on `lastVerified`; re-check them there (not
// against a third-party listing) before changing anything here.
//
// Grouped by region. Only the US is filled in; to add a region, add a key
// here and say on the page which region is shown.

export type SupportLine = {
  name: string;
  /** Human-readable number as the organization publishes it. */
  display: string;
  /** Digits for tel:/sms: links. */
  tel: string;
  canText: boolean;
  description: string;
  sourceUrl: string;
  lastVerified: string;
};

export type RegionResources = {
  regionName: string;
  emergencyNumber: string;
  crisisLine: SupportLine;
  postpartumLines: SupportLine[];
};

export const SUPPORT_RESOURCES: Record<string, RegionResources> = {
  US: {
    regionName: "United States",
    emergencyNumber: "911",
    crisisLine: {
      name: "988 Suicide & Crisis Lifeline",
      display: "988",
      tel: "988",
      canText: true,
      description: "Call or text 988, any time, 24/7.",
      sourceUrl: "https://988lifeline.org/",
      lastVerified: "2026-10-07",
    },
    postpartumLines: [
      {
        name: "National Maternal Mental Health Hotline",
        display: "1-833-852-6262 (1-833-TLC-MAMA)",
        tel: "18338526262",
        canText: true,
        description:
          "Free and confidential, 24/7, in English and Spanish. Call or text a trained counselor.",
        sourceUrl: "https://mchb.hrsa.gov/programs-impact/national-maternal-mental-health-hotline",
        lastVerified: "2026-10-07",
      },
      {
        name: "Postpartum Support International (PSI) HelpLine",
        display: "1-800-944-4773",
        tel: "18009444773",
        canText: true,
        description:
          "Call or text to leave a confidential message, and a trained volunteer will get back to you. Not a crisis line.",
        sourceUrl: "https://www.postpartum.net/get-help/",
        lastVerified: "2026-10-07",
      },
    ],
  },
};

export const DEFAULT_REGION = "US";
