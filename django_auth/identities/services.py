import base64
import hashlib
import hmac
import json
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import password_validation
from django.core.cache import cache
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from .models import AuthCode, SecurityAudit, User, UserSession

ROLE_CAPABILITIES = {
    User.Role.ADMIN: [
        "view_dashboard", "view_cases", "create_cases", "manage_cases",
        "amend_financials", "record_payments", "manage_evidence",
        "prepare_documents", "manage_tasks", "export_packets",
        "view_inventory", "manage_inventory", "view_activity",
        "manage_workspace", "manage_users", "manage_simulation",
    ],
    User.Role.OPERATOR: [
        "view_dashboard", "view_cases", "manage_cases", "record_payments",
        "manage_evidence", "prepare_documents", "manage_tasks",
        "export_packets", "view_inventory", "manage_inventory", "view_activity",
    ],
    User.Role.AUDITOR: [
        "view_dashboard", "view_cases", "export_packets", "view_inventory",
        "view_activity",
    ],
}
ROLE_DETAILS = [
    {"id": User.Role.ADMIN, "label": "Workspace administrator", "description": "Manages the workspace, accounts and recovery operations.", "capabilities": ROLE_CAPABILITIES[User.Role.ADMIN]},
    {"id": User.Role.OPERATOR, "label": "Recovery operator", "description": "Works assigned recovery cases and stock handoffs.", "capabilities": ROLE_CAPABILITIES[User.Role.OPERATOR]},
    {"id": User.Role.AUDITOR, "label": "Read-only auditor", "description": "Reviews records and security history without changing them.", "capabilities": ROLE_CAPABILITIES[User.Role.AUDITOR]},
]


def user_payload(user):
    return {
        "id": str(user.id), "username": user.username, "email": user.email,
        "displayName": user.display_name, "role": user.role, "verified": user.verified,
        "active": user.is_active, "scopes": user.scopes,
        "capabilities": ROLE_CAPABILITIES[user.role],
        "createdAt": user.created_at.isoformat(), "updatedAt": user.updated_at.isoformat(),
        "lastLoginAt": user.last_login.isoformat() if user.last_login else None,
    }


def _b64(value):
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


def issue_token(user, session_id):
    now = timezone.now()
    payload = {
        "sub": str(user.id), "username": user.username, "email": user.email,
        "displayName": user.display_name, "role": user.role, "scopes": user.scopes,
        "verified": user.verified, "active": user.is_active, "sid": str(session_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=settings.AUTH_SESSION_TTL_HOURS)).timestamp()),
    }
    encoded = _b64(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode())
    signature = _b64(hmac.new(settings.AUTH_TOKEN_SECRET.encode(), encoded.encode(), hashlib.sha256).digest())
    return f"{encoded}.{signature}"


def create_session(user):
    expires_at = timezone.now() + timedelta(hours=settings.AUTH_SESSION_TTL_HOURS)
    session = UserSession.objects.create(user=user, token_hash="pending", expires_at=expires_at)
    token = issue_token(user, session.id)
    session.token_hash = hashlib.sha256(token.encode()).hexdigest()
    session.save(update_fields=["token_hash"])
    return session, token


def audit(request, action, detail, actor=None, target_id="", actor_label="Anonymous"):
    SecurityAudit.objects.create(
        actor=actor, actor_label=actor.display_name if actor else actor_label,
        target_id=str(target_id), action=action, detail=detail[:500],
        ip=request.META.get("REMOTE_ADDR", ""), user_agent=request.META.get("HTTP_USER_AGENT", "")[:300],
    )


def check_rate(key, limit=5, window_seconds=600):
    current = cache.get(key, 0)
    if current >= limit:
        raise ValueError("RATE_LIMITED")
    cache.set(key, current + 1, timeout=window_seconds)


def issue_code(user, code_type):
    now = timezone.now()
    AuthCode.objects.filter(user=user, type=code_type, used_at__isnull=True, invalidated_at__isnull=True).update(invalidated_at=now)
    code = f"{secrets.randbelow(900000) + 100000}"
    record = AuthCode.objects.create(
        user=user, type=code_type,
        code_hash=hashlib.sha256(f"{settings.SECRET_KEY}:{code}".encode()).hexdigest(),
        expires_at=now + timedelta(minutes=settings.AUTH_CODE_TTL_MINUTES),
    )
    return record, code


def consume_code(code_type, request_id, code):
    with transaction.atomic():
        try:
            record = AuthCode.objects.select_for_update().select_related("user").get(id=request_id, type=code_type)
        except AuthCode.DoesNotExist:
            raise ValueError("REQUEST_NOT_FOUND")
        if record.used_at:
            raise ValueError("REQUEST_USED")
        if record.invalidated_at or record.expires_at <= timezone.now():
            raise ValueError("REQUEST_EXPIRED")
        if record.attempts >= 5:
            raise ValueError("RATE_LIMITED")
        expected = hashlib.sha256(f"{settings.SECRET_KEY}:{code}".encode()).hexdigest()
        if not hmac.compare_digest(record.code_hash, expected):
            record.attempts += 1
            record.save(update_fields=["attempts"])
            raise ValueError("INVALID_CODE")
        record.used_at = timezone.now()
        record.save(update_fields=["used_at"])
        return record.user


def deliver_code(user, code, code_type):
    subject = "Verify your ClaimChain account" if code_type == AuthCode.Type.VERIFICATION else "Reset your ClaimChain password"
    purpose = "verification" if code_type == AuthCode.Type.VERIFICATION else "password reset"
    send_mail(subject, f"Hello {user.display_name},\n\nYour ClaimChain {purpose} code is: {code}\n\nIt expires in {settings.AUTH_CODE_TTL_MINUTES} minutes.", settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)


def validate_password(password, user):
    password_validation.validate_password(password, user)
    if not all([any(c.islower() for c in password), any(c.isupper() for c in password), any(c.isdigit() for c in password), any(not c.isalnum() for c in password)]):
        from django.core.exceptions import ValidationError

        raise ValidationError("Use uppercase, lowercase, a number, and a symbol.")
