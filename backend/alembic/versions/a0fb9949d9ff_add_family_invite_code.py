"""add family invite code

Revision ID: a0fb9949d9ff
Revises: c4b260e4db30
Create Date: 2026-10-03 21:48:51.322796

"""
import secrets
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a0fb9949d9ff'
down_revision: Union[str, Sequence[str], None] = 'c4b260e4db30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Frozen copy of app/invite_codes.py's alphabet/length -- a migration
# shouldn't import app code that may change after it ships.
_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_CODE_LENGTH = 8


def _new_code() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(_CODE_LENGTH))


def upgrade() -> None:
    """Upgrade schema."""
    # Added nullable first: families that already exist need a code
    # before the column can become NOT NULL.
    op.add_column('families', sa.Column('invite_code', sa.String(), nullable=True))

    conn = op.get_bind()
    used: set[str] = set()
    for (family_id,) in conn.execute(sa.text("SELECT id FROM families")).fetchall():
        code = _new_code()
        while code in used:
            code = _new_code()
        used.add(code)
        conn.execute(
            sa.text("UPDATE families SET invite_code = :code WHERE id = :id"),
            {"code": code, "id": family_id},
        )

    op.alter_column('families', 'invite_code', nullable=False)
    op.create_unique_constraint('uq_families_invite_code', 'families', ['invite_code'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_families_invite_code', 'families', type_='unique')
    op.drop_column('families', 'invite_code')
