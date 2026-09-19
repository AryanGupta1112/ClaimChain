import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, username, email, display_name, password=None, **extra_fields):
        if not username or not email:
            raise ValueError("Username and email are required")
        user = self.model(
            username=username.strip(),
            email=self.normalize_email(email).lower(),
            display_name=display_name.strip(),
            **extra_fields,
        )
        user.set_password(password)
        user.full_clean()
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, display_name, password=None, **extra_fields):
        extra_fields.setdefault("role", User.Role.ADMIN)
        extra_fields.setdefault("verified", True)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(username, email, display_name, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        ADMIN = "workspace_admin", "Workspace administrator"
        OPERATOR = "recovery_operator", "Recovery operator"
        AUDITOR = "auditor", "Read-only auditor"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=80, unique=True)
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=160)
    role = models.CharField(max_length=32, choices=Role.choices, default=Role.OPERATOR)
    scopes = models.JSONField(default=dict)
    verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()
    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email", "display_name"]

    def clean(self):
        super().clean()
        self.username = self.username.strip()
        self.email = self.email.strip().lower()
        self.display_name = self.display_name.strip()
        self.scopes = {
            "caseIds": list(dict.fromkeys(map(str, self.scopes.get("caseIds", [])))),
            "storeIds": list(dict.fromkeys(map(str, self.scopes.get("storeIds", [])))),
        }


class AuthCode(models.Model):
    class Type(models.TextChoices):
        VERIFICATION = "verification", "Verification"
        RESET = "reset", "Reset"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="codes")
    type = models.CharField(max_length=16, choices=Type.choices)
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)
    invalidated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class UserSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sessions")
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class SecurityAudit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_events")
    actor_label = models.CharField(max_length=160)
    target_id = models.CharField(max_length=64, blank=True)
    action = models.CharField(max_length=160)
    detail = models.CharField(max_length=500)
    ip = models.CharField(max_length=64, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
