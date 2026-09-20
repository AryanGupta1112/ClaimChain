import os

from django.core.management.base import BaseCommand, CommandError

from identities.models import User
from identities.services import validate_password


class Command(BaseCommand):
    help = "Creates demo accounts or one configured bootstrap administrator on an empty auth database."

    def handle(self, *_args, **_options):
        if User.objects.exists():
            return
        sample = os.environ.get("SEED_SAMPLE", "true").lower() != "false"
        password = os.environ.get("AUTH_BOOTSTRAP_PASSWORD") or (
            "ClaimChainDemo!2026" if sample else ""
        )
        if not password:
            raise CommandError(
                "AUTH_BOOTSTRAP_PASSWORD is required when SEED_SAMPLE=false"
            )
        try:
            validate_password(password, None)
        except Exception as error:
            raise CommandError(f"Invalid bootstrap password: {error}") from error
        accounts = (
            [
                ("admin", "admin@claimchain.local", "Aarav Mehta", User.Role.ADMIN, {"caseIds": [], "storeIds": []}),
                ("operator", "operator@claimchain.local", "Nisha Rao", User.Role.OPERATOR, {"caseIds": ["case-1", "case-2", "case-4"], "storeIds": ["store-1", "store-2"]}),
                ("auditor", "auditor@claimchain.local", "Kabir Shah", User.Role.AUDITOR, {"caseIds": [], "storeIds": []}),
            ]
            if sample
            else [
                (
                    os.environ.get("AUTH_BOOTSTRAP_USERNAME", "admin"),
                    os.environ.get("AUTH_BOOTSTRAP_EMAIL", "admin@example.com"),
                    "Workspace Administrator",
                    User.Role.ADMIN,
                    {"caseIds": [], "storeIds": []},
                )
            ]
        )
        for username, email, display_name, role, scopes in accounts:
            User.objects.create_user(username, email, display_name, password, role=role, scopes=scopes, verified=True, is_staff=role == User.Role.ADMIN)
        self.stdout.write(
            self.style.SUCCESS(
                "Created ClaimChain Django demo accounts."
                if sample
                else "Created ClaimChain bootstrap administrator."
            )
        )
