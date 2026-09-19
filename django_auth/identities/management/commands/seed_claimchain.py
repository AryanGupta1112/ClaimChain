import os

from django.core.management.base import BaseCommand

from identities.models import User


class Command(BaseCommand):
    help = "Creates ClaimChain's local demo accounts when the auth database is empty."

    def handle(self, *_args, **_options):
        if User.objects.exists():
            return
        password = os.environ.get("AUTH_BOOTSTRAP_PASSWORD") or "ClaimChainDemo!2026"
        accounts = [
            ("admin", "admin@claimchain.local", "Aarav Mehta", User.Role.ADMIN, {"caseIds": [], "storeIds": []}),
            ("operator", "operator@claimchain.local", "Nisha Rao", User.Role.OPERATOR, {"caseIds": ["case-1", "case-2", "case-4"], "storeIds": ["store-1", "store-2"]}),
            ("auditor", "auditor@claimchain.local", "Kabir Shah", User.Role.AUDITOR, {"caseIds": [], "storeIds": []}),
        ]
        for username, email, display_name, role, scopes in accounts:
            User.objects.create_user(username, email, display_name, password, role=role, scopes=scopes, verified=True, is_staff=role == User.Role.ADMIN)
        self.stdout.write(self.style.SUCCESS("Created ClaimChain Django demo accounts."))
