import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BASE_DIR.parent


def load_project_env(path):
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_project_env(PROJECT_DIR / ".env")
DATA_DIR = Path(os.environ.get("DATA_DIR", PROJECT_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "claimchain-local-django-secret-not-for-production")
DEBUG = os.environ.get("DJANGO_DEBUG", "true").lower() == "true"
ALLOWED_HOSTS = [host for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",") if host]

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "identities",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]
ROOT_URLCONF = "claimchain_auth.urls"
TEMPLATES = []
WSGI_APPLICATION = "claimchain_auth.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": DATA_DIR / "claimchain-auth.sqlite3",
    }
}
AUTH_USER_MODEL = "identities.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 12}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
LANGUAGE_CODE = "en-in"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

AUTH_COOKIE_NAME = os.environ.get("AUTH_COOKIE_NAME", "claimchain_session")
AUTH_COOKIE_SECURE = os.environ.get("AUTH_COOKIE_SECURE", "false").lower() == "true"
AUTH_SESSION_TTL_HOURS = max(1, int(os.environ.get("AUTH_SESSION_TTL_HOURS", "12")))
AUTH_CODE_TTL_MINUTES = max(5, int(os.environ.get("AUTH_CODE_TTL_MINUTES", "10")))
AUTH_EXPOSE_CODES = os.environ.get("AUTH_EXPOSE_CODES", "false").lower() == "true"
AUTH_TOKEN_SECRET = os.environ.get("AUTH_TOKEN_SECRET", "claimchain-local-django-token-secret-not-for-production")

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend" if os.environ.get("SMTP_HOST") else "django.core.mail.backends.console.EmailBackend"
EMAIL_HOST = os.environ.get("SMTP_HOST", "")
EMAIL_PORT = int(os.environ.get("SMTP_PORT", "587"))
EMAIL_USE_TLS = os.environ.get("SMTP_SECURE", "false").lower() != "true"
EMAIL_USE_SSL = os.environ.get("SMTP_SECURE", "false").lower() == "true"
EMAIL_HOST_USER = os.environ.get("SMTP_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.environ.get("SMTP_FROM", "ClaimChain <noreply@claimchain.local>")
