# ClaimChain Glossary

This glossary uses plain language first. Technical detail is included only where it helps a reader understand how ClaimChain behaves.

| Term | Meaning in ClaimChain |
| --- | --- |
| **Case** | A managed recovery matter, such as an unpaid invoice, a missing document, or an evidence dispute. A case is the central record for actions, evidence, payments, drafts, and follow-ups. |
| **Case packet** | A downloadable PDF summary that brings together case facts, the timeline, financial position, and prepared documents for review or handoff. It does not embed original uploaded files. |
| **Counterparty** | The person or organisation on the other side of a recovery matter, for example a supplier, customer, or licensing office. |
| **Evidence** | A file or note used to support a case, such as an invoice, receipt, photograph, or correspondence. ClaimChain records a cryptographic hash for each uploaded file so later changes can be detected. |
| **Evidence hash** | A fixed digital fingerprint calculated from a file. The same file produces the same fingerprint; a changed file produces a different one. |
| **Follow-up** | A dated operational task attached to a case, such as calling a supplier or reviewing new evidence. |
| **Inventory lot** | A tracked quantity of a specific product held by a specific store. |
| **Stock handoff** | A controlled movement of inventory from one store to another. ClaimChain reserves the quantity before dispatch and records receipt once confirmed. |
| **Recovery operator** | A user role that can work only the cases and stores assigned to them. Operators do not manage accounts, workspace policy, or the synthetic ingestion control. |
| **Workspace administrator** | The highest current role. Administrators can manage the workspace, users, recovery operations, inventory, settings, and simulation. |
| **Read-only auditor** | A role that can review dashboard, cases, inventory, activity, and exports but cannot change operational records. |
| **RBAC** | Role-based access control. It is the rule set that gives different roles different actions and record access. ClaimChain enforces it in the browser experience and on the server. |
| **Session** | The signed, time-limited sign-in state stored in a secure browser cookie. Django creates it after successful authentication; it can be revoked when an account changes or a password is reset. |
| **Email verification** | Confirmation that a user can receive email at the address on their account. ClaimChain requires verification before a new account can sign in. |
| **Synthetic ingestion** | A clearly fictional data generator for the demonstration workspace. It creates sample recovery, payment, task, and stock updates when no external system is connected. It is not a live business feed. |
| **Pagination** | Showing a large list in smaller numbered pages. ClaimChain uses this for account and security-audit lists to keep screens responsive and readable. |
| **Amazon EC2** | A virtual server on AWS. The recommended deployment runs ClaimChain's application services on a single EC2 instance for the competition-scale architecture. |
| **Amazon EBS** | Persistent block storage attached to EC2. It holds the application data volume, including the SQLite databases and original local evidence files. |
| **Amazon S3** | Private object storage. In the current application, it can receive an explicit mirror of evidence while the local evidence file remains available. |
| **Amazon Textract** | An AWS service that extracts printed text from supported image evidence when it is configured and a user requests extraction. |
| **Amazon Bedrock** | An AWS service used to create a draft based on case facts. A person must review and edit the draft before using it. |
| **Amazon SES** | AWS email delivery. It can replace local console email or generic SMTP for verification and password-reset messages after sender and domain configuration. |
| **Amazon CloudFront** | AWS content delivery and edge security layer. It is part of the selected deployment architecture for serving the public application efficiently over HTTPS. |
| **IAM** | AWS Identity and Access Management. IAM roles and policies give the application only the AWS permissions it needs, without embedding long-lived access keys in code. |
| **CloudWatch** | AWS monitoring and logging service. It is used to observe instance health, errors, capacity, and application signals in deployment. |
| **RPO / RTO** | Recovery Point Objective and Recovery Time Objective. RPO is how much recent data loss may be acceptable after a failure; RTO is how quickly the service should be restored. |
