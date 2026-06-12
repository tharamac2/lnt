from datetime import datetime, timedelta
from typing import Optional, Union
from sqlmodel import Session, select
from .models import AuditLog, User, Inspector

AUDIT_LOG_RETENTION_DAYS = 30


def log_action(
    session: Session,
    user: Optional[Union[User, Inspector]],
    action: str,
    entity_type: str,
    entity_id: Optional[int],
    description: str,
    site: Optional[str] = None,
):
    """Record an audit trail entry. Caller is responsible for session.commit()."""
    if isinstance(user, Inspector):
        # Inspector accounts are not rows in the `user` table, so user_id (FK to
        # user.id) must stay None to avoid violating the foreign key constraint.
        user_id = None
        username = user.name
    else:
        user_id = user.id if user else None
        username = (user.full_name or user.username) if user else "System"

    entry = AuditLog(
        user_id=user_id,
        username=username,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        site=site,
    )
    session.add(entry)
    cleanup_old_audit_logs(session)


def cleanup_old_audit_logs(session: Session, days: int = AUDIT_LOG_RETENTION_DAYS):
    """Delete audit log entries older than the retention period. Caller is responsible for session.commit()."""
    cutoff = datetime.now() - timedelta(days=days)
    old_logs = session.exec(select(AuditLog).where(AuditLog.timestamp < cutoff)).all()
    for old_log in old_logs:
        session.delete(old_log)
