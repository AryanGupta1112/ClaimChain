import hashlib
import json
from functools import wraps

from django.conf import settings
from django.contrib.auth import authenticate
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from .models import AuthCode, SecurityAudit, User, UserSession
from .services import ROLE_DETAILS, audit, check_rate, consume_code, create_session, deliver_code, issue_code, user_payload, validate_password


def data(request):
    try:
        return json.loads(request.body or "{}")
    except json.JSONDecodeError:
        raise ValueError("Invalid JSON request")


def fail(message, status=400, code="INVALID_INPUT"):
    return JsonResponse({"error": message, "code": code}, status=status)


def token_from(request):
    return request.COOKIES.get(settings.AUTH_COOKIE_NAME, "")


def signed_session(request):
    # Django owns token issue and user state. `me` also checks live state so
    # disabled users and changed roles take effect immediately in auth flows.
    from .services import _b64  # noqa: PLC0415
    import base64, hashlib, hmac

    token = token_from(request)
    try:
        encoded, signature = token.split(".", 1)
        expected = _b64(hmac.new(settings.AUTH_TOKEN_SECRET.encode(), encoded.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(expected, signature):
            return None
        padded = encoded + "=" * (-len(encoded) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded))
        if payload["exp"] <= int(timezone.now().timestamp()):
            return None
        session = UserSession.objects.select_related("user").filter(
            id=payload["sid"], token_hash=hashlib.sha256(token.encode()).hexdigest(),
            revoked_at__isnull=True, expires_at__gt=timezone.now(), user__id=payload["sub"],
            user__is_active=True, user__verified=True,
        ).first()
        return session
    except (ValueError, KeyError, json.JSONDecodeError):
        return None


def signed_user(request):
    session = signed_session(request)
    return session.user if session else None


def required(capability=None):
    def decorator(view):
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            user = signed_user(request)
            if not user:
                return fail("Sign in to continue", 401, "UNAUTHENTICATED")
            if capability and capability not in user_payload(user)["capabilities"]:
                audit(request, "Authorization denied", f"Missing {capability} for {request.method} {request.path}", actor=user)
                return fail("You do not have permission for this action", 403, "FORBIDDEN")
            request.claimchain_user = user
            return view(request, *args, **kwargs)
        return wrapped
    return decorator


def set_session(response, token):
    response.set_cookie(settings.AUTH_COOKIE_NAME, token, max_age=settings.AUTH_SESSION_TTL_HOURS * 3600, httponly=True, secure=settings.AUTH_COOKIE_SECURE, samesite="Lax", path="/")
    return response


@require_GET
def health(_request):
    return JsonResponse({"status": "ok", "authentication": "django"})


@csrf_exempt
@require_http_methods(["POST"])
def login(request):
    try:
        body = data(request)
        identifier, password = str(body.get("identifier", "")).strip(), str(body.get("password", ""))
        check_rate(f"login:{request.META.get('REMOTE_ADDR', '')}", 10)
        user = User.objects.filter(Q(username__iexact=identifier) | Q(email__iexact=identifier)).first()
        if not user or not user.check_password(password):
            audit(request, "Login failed", "Invalid credentials", actor_label=identifier)
            return fail("The email, username, or password is incorrect", 401, "INVALID_CREDENTIALS")
        if not user.is_active:
            return fail("This account has been disabled", 403, "ACCOUNT_DISABLED")
        if not user.verified:
            return fail("Verify your email before signing in", 403, "VERIFICATION_REQUIRED")
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        audit(request, "Login succeeded", "Django session issued", actor=user, target_id=user.id)
        _session, token = create_session(user)
        return set_session(JsonResponse({"user": user_payload(user)}), token)
    except ValueError as error:
        if str(error) == "RATE_LIMITED":
            return fail("Too many requests. Try again later.", 429, "RATE_LIMITED")
        return fail(str(error))


@require_GET
@required()
def me(request):
    return JsonResponse({"user": user_payload(request.claimchain_user)})


@require_GET
def internal_session(request):
    user = signed_user(request)
    if not user:
        return fail("Sign in to continue", 401, "UNAUTHENTICATED")
    return JsonResponse({"user": user_payload(user)})


@csrf_exempt
@require_http_methods(["POST"])
def logout(request):
    session = signed_session(request)
    if session:
        session.revoked_at = timezone.now()
        session.save(update_fields=["revoked_at"])
        audit(request, "Logout", "Django session revoked", actor=session.user, target_id=session.user.id)
    response = JsonResponse({"ok": True})
    response.delete_cookie(settings.AUTH_COOKIE_NAME, path="/")
    return response


def code_response(record, code, message):
    result = {"ok": True, "message": message, "requestId": str(record.id), "expiresAt": record.expires_at.isoformat()}
    if settings.AUTH_EXPOSE_CODES:
        result["developmentCode"] = code
    return JsonResponse(result)


@csrf_exempt
@require_http_methods(["POST"])
def send_verification(request):
    try:
        identifier = str(data(request).get("identifier", "")).strip()
        check_rate(f"verify:{request.META.get('REMOTE_ADDR', '')}:{identifier.lower()}")
        user = User.objects.filter(Q(username__iexact=identifier) | Q(email__iexact=identifier)).first()
        message = "If verification is required, a code has been sent."
        if not user or not user.is_active or user.verified:
            return JsonResponse({"ok": True, "message": message})
        record, code = issue_code(user, AuthCode.Type.VERIFICATION)
        deliver_code(user, code, AuthCode.Type.VERIFICATION)
        audit(request, "Verification requested", "Django verification code issued", target_id=user.id, actor_label=identifier)
        return code_response(record, code, message)
    except ValueError as error:
        if str(error) == "RATE_LIMITED":
            return fail("Too many requests. Try again later.", 429, "RATE_LIMITED")
        return fail(str(error))
    except Exception:
        return fail("We could not send a verification code. Please try again.", 503, "DELIVERY_FAILED")


@csrf_exempt
@require_http_methods(["POST"])
def confirm_verification(request):
    try:
        body = data(request)
        user = consume_code(AuthCode.Type.VERIFICATION, body.get("requestId", ""), str(body.get("code", "")))
        identifier = str(body.get("identifier", "")).strip().lower()
        if identifier not in {user.username.lower(), user.email.lower()}:
            return fail("The verification request does not match this account", 400, "INVALID_CODE")
        user.verified = True
        user.save(update_fields=["verified", "updated_at"])
        audit(request, "Email verified", "Verification completed", actor=user, target_id=user.id)
        return JsonResponse({"ok": True})
    except ValueError as error:
        messages = {"REQUEST_NOT_FOUND": ("Request not found", 404), "REQUEST_USED": ("This code has already been used", 409), "REQUEST_EXPIRED": ("This code has expired", 409), "RATE_LIMITED": ("Too many incorrect attempts", 429), "INVALID_CODE": ("The code is incorrect", 400)}
        message, status = messages.get(str(error), (str(error), 400))
        return fail(message, status, str(error))


@csrf_exempt
@require_http_methods(["POST"])
def forgot_password(request):
    try:
        identifier = str(data(request).get("identifier", "")).strip()
        check_rate(f"reset:{request.META.get('REMOTE_ADDR', '')}:{identifier.lower()}")
        user = User.objects.filter(Q(username__iexact=identifier) | Q(email__iexact=identifier)).first()
        message = "If the account can be recovered, a reset code has been sent."
        if not user or not user.is_active or not user.verified:
            return JsonResponse({"ok": True, "message": message})
        record, code = issue_code(user, AuthCode.Type.RESET)
        deliver_code(user, code, AuthCode.Type.RESET)
        audit(request, "Password reset requested", "Django reset code issued", target_id=user.id, actor_label=identifier)
        return code_response(record, code, message)
    except ValueError as error:
        if str(error) == "RATE_LIMITED":
            return fail("Too many requests. Try again later.", 429, "RATE_LIMITED")
        return fail(str(error))
    except Exception:
        return fail("We could not send a reset code. Please try again.", 503, "DELIVERY_FAILED")


@csrf_exempt
@require_http_methods(["POST"])
def reset_password(request):
    try:
        body = data(request)
        user = consume_code(AuthCode.Type.RESET, body.get("requestId", ""), str(body.get("code", "")))
        password = str(body.get("password", ""))
        validate_password(password, user)
        user.set_password(password)
        user.save(update_fields=["password", "updated_at"])
        UserSession.objects.filter(user=user, revoked_at__isnull=True).update(revoked_at=timezone.now())
        audit(request, "Password reset completed", "Password changed", actor=user, target_id=user.id)
        response = JsonResponse({"ok": True})
        response.delete_cookie(settings.AUTH_COOKIE_NAME, path="/")
        return response
    except ValidationError as error:
        return fail(". ".join(error.messages), 400, "INVALID_PASSWORD")
    except ValueError as error:
        return fail(str(error), 400, "INVALID_CODE")


@require_GET
@required("manage_users")
def roles(_request):
    return JsonResponse({"roles": ROLE_DETAILS})


@csrf_exempt
@require_http_methods(["GET", "POST"])
@required("manage_users")
def users(request):
    if request.method == "GET":
        page, page_size = max(1, int(request.GET.get("page", 1))), min(50, max(5, int(request.GET.get("pageSize", 10))))
        query = request.GET.get("q", "").strip()
        records = User.objects.all().order_by("created_at")
        if query:
            records = records.filter(Q(username__icontains=query) | Q(email__icontains=query) | Q(display_name__icontains=query))
        total = records.count()
        return JsonResponse({"items": [user_payload(user) for user in records[(page - 1) * page_size:page * page_size]], "page": page, "pageSize": page_size, "total": total, "pages": max(1, (total + page_size - 1) // page_size)})
    try:
        body = data(request)
        user = User.objects.create_user(body["username"], body["email"], body["displayName"], body["password"], role=body["role"], scopes=body.get("scopes", {}), verified=False)
        audit(request, "Account provisioned", f"{user.username} as {user.role}; verification required", actor=request.claimchain_user, target_id=user.id)
        return JsonResponse(user_payload(user), status=201)
    except (KeyError, ValidationError, ValueError) as error:
        return fail(". ".join(getattr(error, "messages", [str(error)])))


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
@required("manage_users")
def user_detail(request, user_id):
    user = User.objects.filter(id=user_id).first()
    if not user:
        return fail("Account not found", 404, "USER_NOT_FOUND")
    if request.method == "DELETE":
        if user.id == request.claimchain_user.id:
            return fail("You cannot delete your own account", 409, "LAST_ADMIN")
        if user.role == User.Role.ADMIN and user.is_active and User.objects.filter(role=User.Role.ADMIN, is_active=True).count() <= 1:
            return fail("Keep at least one active workspace administrator", 409, "LAST_ADMIN")
        audit(request, "Account deleted", user.username, actor=request.claimchain_user, target_id=user.id)
        user.delete()
        return JsonResponse({"ok": True})
    try:
        body = data(request)
        for source, target in [("username", "username"), ("email", "email"), ("displayName", "display_name"), ("role", "role"), ("verified", "verified")]:
            if source in body:
                setattr(user, target, body[source])
        if "active" in body:
            user.is_active = bool(body["active"])
        if "scopes" in body:
            user.scopes = body["scopes"]
        if body.get("password"):
            validate_password(str(body["password"]), user)
            user.set_password(str(body["password"]))
        user.full_clean()
        user.save()
        if any(key in body for key in ("active", "role", "verified", "password")):
            UserSession.objects.filter(user=user, revoked_at__isnull=True).update(revoked_at=timezone.now())
        audit(request, "Account updated", f"{user.username}; role {user.role}; {'active' if user.is_active else 'disabled'}", actor=request.claimchain_user, target_id=user.id)
        return JsonResponse(user_payload(user))
    except (ValidationError, ValueError) as error:
        return fail(". ".join(getattr(error, "messages", [str(error)])))


@csrf_exempt
@require_http_methods(["POST"])
@required("manage_users")
def resend_verification(request, user_id):
    user = User.objects.filter(id=user_id).first()
    if not user:
        return fail("Account not found", 404, "USER_NOT_FOUND")
    if user.verified:
        return JsonResponse({"ok": True, "message": "Account is already verified"})
    try:
        record, code = issue_code(user, AuthCode.Type.VERIFICATION)
        deliver_code(user, code, AuthCode.Type.VERIFICATION)
        audit(request, "Verification resent", user.username, actor=request.claimchain_user, target_id=user.id)
        return code_response(record, code, "Verification code sent.")
    except Exception:
        return fail("We could not send a verification code. Please try again.", 503, "DELIVERY_FAILED")


@require_GET
@required("manage_users")
def security_audit(request):
    page, page_size = max(1, int(request.GET.get("page", 1))), min(50, max(5, int(request.GET.get("pageSize", 10))))
    records = SecurityAudit.objects.order_by("-created_at")
    total = records.count()
    items = [{"id": str(row.id), "actorId": str(row.actor_id) if row.actor_id else None, "actorLabel": row.actor_label, "targetId": row.target_id or None, "action": row.action, "detail": row.detail, "ip": row.ip, "userAgent": row.user_agent, "createdAt": row.created_at.isoformat()} for row in records[(page - 1) * page_size:page * page_size]]
    return JsonResponse({"items": items, "page": page, "pageSize": page_size, "total": total, "pages": max(1, (total + page_size - 1) // page_size)})
