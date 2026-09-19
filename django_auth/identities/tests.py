from django.test import TestCase, override_settings

from .models import User


@override_settings(AUTH_EXPOSE_CODES=True, EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class IdentityFlowsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            "unverified", "unverified@example.com", "Unverified User",
            "TemporaryPass!2026", role=User.Role.OPERATOR,
            scopes={"caseIds": [], "storeIds": []}, verified=False,
        )

    def test_verification_and_password_recovery(self):
        blocked = self.client.post("/auth/login", {"identifier": "unverified", "password": "TemporaryPass!2026"}, content_type="application/json")
        self.assertEqual(blocked.status_code, 403)
        verification = self.client.post("/auth/verify/send", {"identifier": "unverified"}, content_type="application/json").json()
        confirmed = self.client.post("/auth/verify/confirm", {"identifier": "unverified", "requestId": verification["requestId"], "code": verification["developmentCode"]}, content_type="application/json")
        self.assertEqual(confirmed.status_code, 200)
        login = self.client.post("/auth/login", {"identifier": "unverified", "password": "TemporaryPass!2026"}, content_type="application/json")
        self.assertEqual(login.status_code, 200)
        self.assertIn("claimchain_session", login.cookies)
        reset = self.client.post("/auth/forgot", {"identifier": "unverified"}, content_type="application/json").json()
        changed = self.client.post("/auth/reset", {"requestId": reset["requestId"], "code": reset["developmentCode"], "password": "ReplacementPass!2026"}, content_type="application/json")
        self.assertEqual(changed.status_code, 200)
        replacement = self.client.post("/auth/login", {"identifier": "unverified", "password": "ReplacementPass!2026"}, content_type="application/json")
        self.assertEqual(replacement.status_code, 200)

    def test_unknown_recovery_request_does_not_disclose_accounts(self):
        response = self.client.post("/auth/forgot", {"identifier": "missing@example.com"}, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["message"], "If the account can be recovered, a reset code has been sent.")
