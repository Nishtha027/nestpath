"""add structured care log fields

Revision ID: 98a7defffb47
Revises: b7d2e9c41f60
Create Date: 2026-10-11 12:00:00.000000

Additive and safe to run before the new code is deployed: every new column
is nullable (in_progress has a false default), so the old code's inserts of
type + notes keep working, and existing rows read back unchanged.

The downgrade drops the new columns, indexes and enum types; the structured
details of entries made since are lost, but the entries themselves (type,
time, notes) stay.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '98a7defffb47'
down_revision: Union[str, Sequence[str], None] = 'b7d2e9c41f60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Stored by name, like care_log_type.
feed_type = postgresql.ENUM('BREAST', 'BOTTLE', 'SOLID', name='feed_type', create_type=False)
feed_side = postgresql.ENUM('LEFT', 'RIGHT', 'BOTH', name='feed_side', create_type=False)
diaper_kind = postgresql.ENUM('WET', 'DIRTY', 'BOTH', name='diaper_kind', create_type=False)


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    for enum in (feed_type, feed_side, diaper_kind):
        enum.create(bind, checkfirst=True)

    op.add_column('care_logs', sa.Column('feed_type', feed_type, nullable=True))
    op.add_column('care_logs', sa.Column('amount_ml', sa.Integer(), nullable=True))
    op.add_column('care_logs', sa.Column('duration_min', sa.Integer(), nullable=True))
    op.add_column('care_logs', sa.Column('side', feed_side, nullable=True))
    op.add_column('care_logs', sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        'care_logs',
        sa.Column('in_progress', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.add_column('care_logs', sa.Column('diaper_kind', diaper_kind, nullable=True))
    op.add_column('care_logs', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True))

    op.create_index('ix_care_logs_child_id_timestamp', 'care_logs', ['child_id', 'timestamp'])
    op.create_index(
        'uq_care_logs_one_sleep_in_progress',
        'care_logs',
        ['child_id'],
        unique=True,
        postgresql_where=sa.text('in_progress'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('uq_care_logs_one_sleep_in_progress', table_name='care_logs')
    op.drop_index('ix_care_logs_child_id_timestamp', table_name='care_logs')
    for column in ('updated_at', 'diaper_kind', 'in_progress', 'ended_at', 'side', 'duration_min', 'amount_ml', 'feed_type'):
        op.drop_column('care_logs', column)
    bind = op.get_bind()
    for enum in (diaper_kind, feed_side, feed_type):
        enum.drop(bind, checkfirst=True)
