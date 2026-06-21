"""Add Manatal-style client fields and related tables

Revision ID: 002_client_manatal
Revises: 001_initial
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_client_manatal"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE client_stage AS ENUM ('prospect', 'lead', 'active', 'customer', 'inactive')")

    op.add_column("clients", sa.Column("address", sa.String(length=500), nullable=True))
    op.add_column("clients", sa.Column("description", sa.Text(), nullable=True))
    op.add_column(
        "clients",
        sa.Column("stage", sa.Enum("prospect", "lead", "active", "customer", "inactive", name="client_stage"), nullable=False, server_default="prospect"),
    )
    op.add_column("clients", sa.Column("owner_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_clients_owner_id", "clients", "users", ["owner_id"], ["id"])
    op.create_index("ix_clients_stage", "clients", ["stage"])
    op.create_index("ix_clients_owner_id", "clients", ["owner_id"])

    op.alter_column("clients", "contact_person", server_default="")
    op.alter_column("clients", "email", server_default="")

    op.create_table(
        "client_contacts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("title", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_client_contacts_client_id", "client_contacts", ["client_id"])

    op.create_table(
        "client_team_members",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("client_id", "user_id", name="uq_client_team"),
    )

    op.create_table(
        "client_guests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("client_guests")
    op.drop_table("client_team_members")
    op.drop_table("client_contacts")
    op.drop_constraint("fk_clients_owner_id", "clients", type_="foreignkey")
    op.drop_index("ix_clients_owner_id", "clients")
    op.drop_index("ix_clients_stage", "clients")
    op.drop_column("clients", "owner_id")
    op.drop_column("clients", "stage")
    op.drop_column("clients", "description")
    op.drop_column("clients", "address")
    op.execute("DROP TYPE IF EXISTS client_stage")
