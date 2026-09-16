# HelpWork (working title) — Platform Architecture v3
Updated: post Meeting #2 (16 Sep 2026)

## 1. Positioning
- New company (same owners as HelpHome) builds a multi-tenant SaaS care platform.
- HelpHome = tenant #1; future tenants = other coordinator organisations (e.g. Jewish Care-style providers).
- Competes with Mable/HireUp/LikeFamily as a registered-provider-grade platform (full compliance liability retained).

## 2. Roles
client · worker (independent contractor, ABN) · coordinator (org staff; replaces "manager") · admin (platform super-admin).

## 3. Tenancy
- tenant_id on every row; strict siloing between coordinators.
- Platform admin sees aggregate health only, never tenant care data.

## 4. System boundaries
- Front office (this platform, Azure AU): bookings/shifts, job postings, progress notes, consent, wellness, comms, documents, invoices draft.
- Back office (per tenant): VisualCare = CRM/roster/compliance; Xero = payroll/AR. Sync via VisualCare API. No direct Xero calls.

## 5. Claims & billing
- tenant.registered_provider = false → invoices routed to plan manager (PlanCare etc.) → claims Services Australia.
- true (post-registration) → platform generates direct NDIS/HCP claims.

## 6. Identity & security
- Coordinators/staff: Microsoft 365 Entra ID SSO + MFA (non-negotiable, Evgeny).
- Clients/workers: standalone auth + MFA/magic link.
- Worker profiles hidden by default; consent_to_display required (Privacy Act).
- Client PII (full name, DOB, address, phone) stored for commission reporting; DOB never displayed.
- Documents encrypted at rest; masked in-app calling/messaging (no personal numbers exposed).
- Data residency: Australia only (Azure Australia East).

## 7. Compliance features
- Progress notes mandatory per completed shift; attached to invoice; immutable once approved (legal proof of service).
- Worker documents captured with issue + expiry dates; expiry alerts.
- Accessibility: WCAG 2.1 AA mandatory (client base includes people with disability).

## 8. Phases
0 — pilot demo live (frozen). 
1 — multi-tenant core: auth+MFA, self-service requests, job postings, shifts, progress notes, documents, consent. 
2 — VisualCare sync per tenant, wellness module, masked comms. 
3 — direct claiming engine post-registration, payments, reviews.

## 9. Non-goals (phase 1)
Direct Xero integration · community forums · profile browsing without consent · replacing VisualCare back office.