"""add biometric violations column

Revision ID: 8a9c8e0aec96
Revises: 7829d91b0590
Create Date: 2026-02-17 12:06:35.883428

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8a9c8e0aec96'
down_revision = '7829d91b0590'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'biometric_violations',
                sa.Integer(),
                nullable=False,
                server_default="0"
            )
        )
        
    # ### end Alembic commands ###

def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('biometric_violations')

    # ### end Alembic commands ###
