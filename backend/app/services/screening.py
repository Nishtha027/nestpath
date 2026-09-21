"""Scores an EPDS submission and stores it as a ScreeningResponse.

Pure scoring logic lives in reference-data/epds_screening.py (same
sys.path shim as timeline.py/growth.py, independently testable without
the API layer); this module wraps that with non-diagnostic,
provider-facing copy and persistence.
"""

import sys
from pathlib import Path
from uuid import UUID

from sqlalchemy.orm import Session

_REFERENCE_DATA_DIR = Path(__file__).resolve().parents[2] / "reference-data"
if str(_REFERENCE_DATA_DIR) not in sys.path:
    sys.path.insert(0, str(_REFERENCE_DATA_DIR))

from epds_screening import score_epds, source_version  # noqa: E402

from ..models import ScreeningResponse  # noqa: E402

_RISK_MESSAGES = {
    "low": (
        "Your responses don't suggest significant distress right now. "
        "If that changes, you're always welcome to check in again."
    ),
    "moderate": (
        "Your responses suggest some symptoms of distress. It may help "
        "to check in with your provider, especially if this continues "
        "or your responses worsen over the next couple of weeks."
    ),
    "high": "Your responses suggest speaking with a provider soon.",
}

_SELF_HARM_NOTICE = (
    " You indicated having thoughts of harming yourself. Please reach "
    "out to your provider today, or contact the 988 Suicide & Crisis "
    "Lifeline (call or text 988, available 24/7) -- you don't have to "
    "wait."
)


def message_for_risk(risk_level: str, item_10_flag: bool) -> str:
    """Non-diagnostic, provider-facing framing for a stored result --
    this is a screening signal, never a diagnosis the app makes.
    """
    message = _RISK_MESSAGES[risk_level]
    if item_10_flag:
        message += _SELF_HARM_NOTICE
    return message


def submit_screening(
    db: Session, caregiver_id: UUID, family_id: UUID, answers: list[int]
) -> ScreeningResponse:
    """Scores `answers` and stages a ScreeningResponse row (caller
    commits). Raises ValueError (via score_epds) if answers isn't
    exactly 10 entries of 0-3.
    """
    result = score_epds(answers)
    response = ScreeningResponse(
        caregiver_id=caregiver_id,
        family_id=family_id,
        answers=answers,
        total_score=result.total_score,
        risk_level=result.risk_level,
        item_10_flag=result.item_10_flag,
        source_version=source_version,
    )
    db.add(response)
    db.flush()
    return response
