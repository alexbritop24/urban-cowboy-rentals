# Release 1 Security Roles and Rollout Gate

This document defines the Sprint 2A.6 authorization seam. It does not introduce customer profiles or Release 2 role management.

## Rollout Gate

The database flag `private.release_feature_flags.multi_item_rental_requests` is the server-authoritative Release 1 gate. Its migration default is `false`.

The browser flag and database flag must both be enabled before the multi-item workflow can operate. Enabling only the browser flag must result in a server rejection. Production activation requires an intentional database administration change after migrations, role claims, validation, and rollback procedures have been approved.

Application clients must never receive direct access to the private flag table.

## Release 1 Roles

- `anon`: May execute the public request-creation RPC only after server activation. It cannot read or write normalized request-item rows directly.
- Authenticated customer: Reserved for a future customer workflow. Authentication alone grants no request-item access.
- `staff`: May read normalized request items and use staff RPCs after server activation.
- `admin`: Has the same Release 1 application permissions as staff and is the extension point for later role administration.
- Supabase `service_role`: Operational server role only. It must never be exposed to a browser.

## Staff Claim Contract

Release 1 recognizes a user as staff when a trusted JWT contains either:

- `app_metadata.role = "staff"` or `"admin"`; or
- top-level `app_role = "staff"` or `"admin"`.

Do not use user-editable metadata for authorization. Before activation, existing staff accounts must receive trusted claims through an administrative process and refresh their sessions so new JWTs contain the claim.

Future role tables or custom-claim hooks may replace this implementation, provided `private.is_staff()` remains the policy extension point.

## Write Boundary

`rental_request_items` is directly readable only by staff and is not directly writable by application roles. Creation and replacement must go through the transactional RPCs so catalog resolution, lifecycle protection, legacy summaries, availability invalidation, and validation cannot be bypassed.

The authoritative catalog and internal serial numbers remain in the private schema. Public request payloads contain only equipment IDs, requested dates, quantities, and notes.
