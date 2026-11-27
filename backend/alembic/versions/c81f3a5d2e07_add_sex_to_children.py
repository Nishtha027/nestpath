"""add sex to children

Revision ID: c81f3a5d2e07
Revises: 98a7defffb47
Create Date: 2026-11-25 12:00:00.000000

Additive: a nullable column the old code never reads or writes.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c81f3a5d2e07'
down_revision: Union[str, Sequence[str], None] = '98a7defffb47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('children', sa.Column('sex', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('children', 'sex')
