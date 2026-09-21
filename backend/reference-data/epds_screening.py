"""
Edinburgh Postnatal Depression Scale (EPDS) -- item text, scoring
rules, and risk-band cutoffs.

SOURCE (retrieved 2026-09-21):
  Black Dog Institute, "The Edinburgh Postnatal Depression Scale
  (EPDS)" -- patient form, clinical scoring guide, and score-range
  interpretation, reproducing:
    Cox, J.L., Holden, J.M., & Sagovsky, R. (1987). "Detection of
    postnatal depression: Development of the 10-item Edinburgh
    Postnatal Depression Scale." British Journal of Psychiatry,
    150, 782-786.
    Murray, L., & Cox, J.L. (1990) -- cited alongside the above for
    the reverse-scoring key.
  https://www.blackdoginstitute.org.au/wp-content/uploads/2020/04/edinburgh-postnatal-depression-scale.pdf

ITEM WORDING AND RESPONSE OPTIONS: transcribed verbatim from that
PDF's patient-facing form (all 10 items, all 4 response options each,
in the printed top-to-bottom order).

SCORING: per the PDF's "Clinical Scoring Guide" page --
  - Items 1, 2, 4: NOT reverse-scored. Top option = 0, bottom = 3.
  - Items 3, 5, 6, 7, 8, 9, 10 (marked with * in the source):
    reverse-scored. Top option = 3, bottom = 0.
  Encoded directly below via each item's `reverse_scored` flag, so
  there is one auditable place this mapping is defined, rather than a
  separately hand-computed score list to trust per item.

RISK BANDS ("Range of EPDS Scores" section of the same source):
  0-9   : mild, likely-transient symptoms.
  10-12 : symptoms of distress that may be discomforting; monitor,
          repeat screening in ~2 weeks.
  13+   : high likelihood of depression; further assessment/referral
          warranted.

ITEM 10 SAFETY RULE (stated twice in the source -- once on the
patient form, once on the scoring guide): "Scores 1, 2 or 3 on Item
10: IF ANY THOUGHTS OF SELF HARM ENQUIRE FURTHER and ensure SAFETY."
That is: ANY non-zero score on item 10 (self-harm ideation) --
anything other than "Never" -- requires immediate follow-up,
independent of the total score. score_epds() below enforces this as
an unconditional override on risk_level: item_10_flag is computed
from item 10 alone, and forces risk_level to "high" regardless of
what the total-score band would otherwise say. There is no code path
here that computes a risk level without that check.

NOT A DIAGNOSTIC TOOL: the EPDS screens for possible depressive
symptoms; it does not diagnose. Callers of this module should always
frame a result as suggesting a conversation with a provider, never as
a diagnosis the app has made.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EPDSItem:
    number: int
    text: str
    # 4 response options, in the order printed on the source form
    # (index 0 = top/first option, index 3 = bottom/last option).
    options: tuple[str, str, str, str]
    # False: the selected option's index IS its point value (top=0 ..
    #   bottom=3).
    # True: point value is reversed (top=3 .. bottom=0).
    reverse_scored: bool

    def score_for(self, option_index: int) -> int:
        if option_index not in (0, 1, 2, 3):
            raise ValueError(f"option_index must be 0-3, got {option_index!r}")
        return (3 - option_index) if self.reverse_scored else option_index


EPDS_ITEMS: tuple[EPDSItem, ...] = (
    EPDSItem(
        1,
        "I have been able to laugh and see the funny side of things",
        ("As much as I always could", "Not quite as much now",
         "Definitely not so much now", "Not at all"),
        reverse_scored=False,
    ),
    EPDSItem(
        2,
        "I have looked forward with enjoyment to things",
        ("As much as I ever did", "Rather less than I used to",
         "Definitely less than I used to", "Hardly at all"),
        reverse_scored=False,
    ),
    EPDSItem(
        3,
        "I have blamed myself unnecessarily when things went wrong",
        ("Yes, most of the time", "Yes, some of the time",
         "Not very often", "No, never"),
        reverse_scored=True,
    ),
    EPDSItem(
        4,
        "I have been anxious or worried for no good reason",
        ("No, not at all", "Hardly ever", "Yes, sometimes", "Yes, very often"),
        reverse_scored=False,
    ),
    EPDSItem(
        5,
        "I have felt scared or panicky for no very good reason",
        ("Yes, quite a lot", "Yes, sometimes", "No, not much", "No, not at all"),
        reverse_scored=True,
    ),
    EPDSItem(
        6,
        "Things have been getting on top of me",
        ("Yes, most of the time I haven't been able to cope at all",
         "Yes, sometimes I haven't been coping as well as usual",
         "No, most of the time I have coped quite well",
         "No, I have been coping as well as ever"),
        reverse_scored=True,
    ),
    EPDSItem(
        7,
        "I have been so unhappy that I have had difficulty sleeping",
        ("Yes, most of the time", "Yes, sometimes", "Not very often", "No, not at all"),
        reverse_scored=True,
    ),
    EPDSItem(
        8,
        "I have felt sad or miserable",
        ("Yes, most of the time", "Yes, quite often", "Not very often", "No, not at all"),
        reverse_scored=True,
    ),
    EPDSItem(
        9,
        "I have been so unhappy that I have been crying",
        ("Yes, most of the time", "Yes, quite often", "Only occasionally", "No, never"),
        reverse_scored=True,
    ),
    EPDSItem(
        10,
        "The thought of harming myself has occurred to me",
        ("Yes, quite often", "Sometimes", "Hardly ever", "Never"),
        reverse_scored=True,
    ),
)

ITEM_10_NUMBER = 10

source_version = (
    "EPDS (Cox, Holden & Sagovsky 1987; Murray & Cox 1990 scoring), "
    "per Black Dog Institute clinical scoring guide, retrieved 2026-09-21"
)


@dataclass(frozen=True)
class EPDSResult:
    total_score: int
    item_scores: dict[int, int]
    item_10_flag: bool
    risk_level: str  # "low" | "moderate" | "high"


def score_epds(answers: list[int]) -> EPDSResult:
    """Scores a completed EPDS. `answers` is a list of 10 option indices
    (0-3, top-to-bottom as printed on the form), one per item, in item
    order: answers[0] -> item 1, ..., answers[9] -> item 10.

    item_10_flag (and, through it, a "high" risk_level) is driven ONLY
    by item 10's own score, computed independently of and
    unconditionally ORed onto the total-score band below -- nothing
    here can suppress that check regardless of how low the total is.
    """
    if len(answers) != len(EPDS_ITEMS):
        raise ValueError(f"answers must have exactly {len(EPDS_ITEMS)} entries, got {len(answers)}")

    item_scores = {
        item.number: item.score_for(option_index)
        for item, option_index in zip(EPDS_ITEMS, answers)
    }
    total_score = sum(item_scores.values())

    item_10_score = item_scores[ITEM_10_NUMBER]
    item_10_flag = item_10_score > 0

    if total_score >= 13:
        band = "high"
    elif total_score >= 10:
        band = "moderate"
    else:
        band = "low"

    risk_level = "high" if item_10_flag else band

    return EPDSResult(
        total_score=total_score,
        item_scores=item_scores,
        item_10_flag=item_10_flag,
        risk_level=risk_level,
    )
