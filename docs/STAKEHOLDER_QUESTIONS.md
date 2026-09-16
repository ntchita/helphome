# Decisions Log & Open Items
Supersedes the pre-meeting question list. Answers captured in Meetings #1 (14 Sep) and #2 (16 Sep).

## Answered
- Scope: new-company multi-tenant SaaS; HelpHome = tenant #1; integration layer over VisualCare, not replacement.
- Roles: coordinator replaces manager; admin = platform super-admin.
- Workers: independent contractors (ABN, tax invoices); profile display requires explicit consent.
- Matching: availability-first; no public profile browsing ("not a dating site").
- Client portal wedge validated: VisualCare client module not licensed (extra cost) → our self-service portal justified.
- Progress notes: mandatory legal evidence, approved before invoicing, attached to invoice.
- Identity: M365 SSO + MFA for staff (Evgeny, non-negotiable).
- Claims: via plan managers (PlanCare etc.) until registration; direct claiming post-registration (next year).
- VisualCare API exists with documentation; sync per tenant.
- Accessibility (WCAG) required; client PII (name/DOB/address/phone) required for commission reporting.

## Open (decide before Phase 1 build)
1. Platform name (HelpWork?) + domain.
2. MVP feature cut & priority order (self-service requests, job postings, progress notes, documents, consent).
3. Client budget visibility in app: MVP or Phase 2?
4. Integration ownership: each tenant brings own VisualCare/Xero, or platform-managed?
5. Registration timeline → which claim route ships first.
6. Budget & go-ahead for Phase 1.
7. Masked-call provider choice (Twilio AU vs native WebRTC) — technical, Nikolai to propose.

## Next
Commit these docs → start DB layer on branch `feature/multitenant` → Phase 1 build.