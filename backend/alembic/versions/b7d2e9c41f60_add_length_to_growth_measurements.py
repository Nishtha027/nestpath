"""add length to growth measurements

Revision ID: b7d2e9c41f60
Revises: a0fb9949d9ff
Create Date: 2026-10-08 12:00:00.000000

Additive and safe to run before the new code is deployed: the old code
always writes weight, so relaxing NOT NULL and adding nullable columns
doesn't affect it.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d2e9c41f60'
down_revision: Union[str, Sequence[str], None] = 'a0fb9949d9ff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('growth_measurements', sa.Column('length_cm', sa.Float(), nullable=True))
    op.add_column('growth_measurements', sa.Column('length_percentile', sa.Float(), nullable=True))
    op.add_column('growth_measurements', sa.Column('length_z_score', sa.Float(), nullable=True))
    op.alter_column('growth_measurements', 'weight_kg', existing_type=sa.Float(), nullable=True)
    op.alter_column('growth_measurements', 'percentile', existing_type=sa.Float(), nullable=True)
    op.alter_column('growth_measurements', 'z_score', existing_type=sa.Float(), nullable=True)


def downgrade() -> None:
    """Downgrade schema. Fails if any length-only rows exist (weight NULL)."""
    op.alter_column('growth_measurements', 'z_score', existing_type=sa.Float(), nullable=False)
    op.alter_column('growth_measurements', 'percentile', existing_type=sa.Float(), nullable=False)
    op.alter_column('growth_measurements', 'weight_kg', existing_type=sa.Float(), nullable=False)
    op.drop_column('growth_measurements', 'length_z_score')
    op.drop_column('growth_measurements', 'length_percentile')
    op.drop_column('growth_measurements', 'length_cm')
