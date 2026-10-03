from fastapi import APIRouter, Depends

from .. import schemas
from ..deps import get_current_caregiver
from ..models import Caregiver, Family

router = APIRouter(tags=["family"])


@router.get("/family", response_model=schemas.FamilyResponse)
def get_my_family(caregiver: Caregiver = Depends(get_current_caregiver)) -> Family:
    """The caller's own family, including the invite code another
    caregiver can use to join it (POST /auth/register with invite_code).
    """
    return caregiver.family
