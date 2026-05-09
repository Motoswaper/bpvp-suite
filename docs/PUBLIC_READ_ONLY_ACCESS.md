# BPVP Public Read-Only Access

This document defines direct public endpoints that can be consumed without creating a user account.

## Purpose

Enable AI agents, researchers, and external tools to inspect the public BPVP surface in read-only mode, without login and without privileged access.

## Direct URLs

- Landing page: `https://testnet.btc-defi.com/`
- Sitemap: `https://testnet.btc-defi.com/sitemap.xml`
- Robots: `https://testnet.btc-defi.com/robots.txt`
- Public overview API: `https://testnet.btc-defi.com/api/public/overview`

## Public API Notes

- `GET /api/public/overview` is account-free and returns:
  - public endpoint map,
  - read-only usage constraints,
  - timestamped metadata for automated crawling.
- Session endpoint remains public for unauthenticated checks:
  - `GET /api/auth/session` (expected unauthenticated response).
- DID and marketplace public endpoints are also available for read-only use:
  - `/api/did/public/*`
  - `/api/marketplace/public/*`

## Security Boundary

- No admin, wallet, or privileged trading operations are exposed through this surface.
- Protected APIs continue to require authenticated sessions and role checks.
- Public endpoints remain subject to rate limiting and edge protections.
