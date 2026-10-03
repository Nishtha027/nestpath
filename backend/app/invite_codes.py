"""Family invite codes: short codes a caregiver shares so a second
caregiver can join their family at registration (see auth.register).

No imports from app.models on purpose -- models.py uses
generate_invite_code as a column default.
"""

import secrets

# Unambiguous alphabet for codes people read aloud or type from a text
# message: no 0/O or 1/I/L lookalikes. 31 symbols ** 8 chars ~ 8.5e11
# codes, so a collision is vanishingly unlikely -- the unique constraint
# on families.invite_code is the backstop.
_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
INVITE_CODE_LENGTH = 8


def generate_invite_code() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(INVITE_CODE_LENGTH))


def normalize_invite_code(raw: str) -> str:
    """Canonical form for lookup: uppercase, with the spaces/hyphens a
    person might add when typing "ABCD-EFGH" removed.
    """
    return "".join(ch for ch in raw.upper() if ch.isalnum())
