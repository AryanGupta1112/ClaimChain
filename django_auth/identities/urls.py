from django.urls import path

from . import views

urlpatterns = [
    path("health", views.health),
    path("login", views.login),
    path("me", views.me),
    path("internal/session", views.internal_session),
    path("logout", views.logout),
    path("verify/send", views.send_verification),
    path("verify/confirm", views.confirm_verification),
    path("forgot", views.forgot_password),
    path("reset", views.reset_password),
    path("admin/roles", views.roles),
    path("admin/users", views.users),
    path("admin/users/<uuid:user_id>", views.user_detail),
    path("admin/users/<uuid:user_id>/resend-verification", views.resend_verification),
    path("admin/security-audit", views.security_audit),
]
