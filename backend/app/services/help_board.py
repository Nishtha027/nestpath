"""Claims a HelpRequest for a caregiver.

Race-safe the same way slot booking is in booking.py: SELECT ... FOR
UPDATE locks the request row for the rest of the transaction, so a
second, concurrent claim attempt on the same request blocks at the
database level until the first request commits (or rolls back) -- it
then sees the request as already claimed and fails cleanly, rather
than racing to double-claim it.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import HelpRequest, HelpRequestStatus


class HelpRequestNotFoundError(Exception):
    pass


class HelpRequestAlreadyClaimedError(Exception):
    pass


class CannotClaimOwnRequestError(Exception):
    pass


class HelpRequestNotClaimedError(Exception):
    pass


def claim_request(db: Session, request_id: UUID, caregiver_id: UUID) -> HelpRequest:
    """Atomically claims an open help request. Locks the request row for
    the rest of this transaction, so a concurrent claim attempt for the
    same request blocks here until this transaction commits or rolls
    back, then correctly sees it as already claimed. Caller is
    responsible for committing (on success) or rolling back (on error).
    """
    help_request = db.execute(
        select(HelpRequest).where(HelpRequest.id == request_id).with_for_update()
    ).scalar_one_or_none()
    if help_request is None:
        raise HelpRequestNotFoundError(f"Help request {request_id} not found")
    if help_request.created_by == caregiver_id:
        raise CannotClaimOwnRequestError("Cannot claim your own help request")
    if help_request.status != HelpRequestStatus.OPEN:
        raise HelpRequestAlreadyClaimedError(f"Help request {request_id} is already claimed")

    help_request.status = HelpRequestStatus.CLAIMED
    help_request.claimed_by = caregiver_id
    db.flush()
    return help_request


def complete_request(db: Session, request_id: UUID, caregiver_id: UUID) -> HelpRequest:
    """Marks a claimed help request as completed. Only the caregiver who
    claimed it can complete it.
    """
    help_request = db.execute(
        select(HelpRequest).where(HelpRequest.id == request_id).with_for_update()
    ).scalar_one_or_none()
    if help_request is None:
        raise HelpRequestNotFoundError(f"Help request {request_id} not found")
    if help_request.status != HelpRequestStatus.CLAIMED or help_request.claimed_by != caregiver_id:
        raise HelpRequestNotClaimedError(
            f"Help request {request_id} is not claimed by this caregiver"
        )

    help_request.status = HelpRequestStatus.COMPLETED
    db.flush()
    return help_request
