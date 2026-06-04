# Miniapp Runtime UI Audit

Generated: 2026-06-01T18:29:02.666Z
Base URL: http://127.0.0.1:57140
Catalog count: 60
Viewports: desktop 1440x1000, mobile 390x844
Total checks: 120
Passed: 120
Failed: 0
Warnings: 0
Screenshots: disabled

## Checks

- Each catalog miniapp loads `/miniapps/<slug>/index.html` with HTTP 200.
- The `#app` root renders children and enough visible text.
- No framework error overlay is visible.
- No horizontal document overflow is present at each audit viewport.
- Script, stylesheet, image, and font requests do not return 4xx/5xx.
- Relevant console errors and page errors fail the audit.
- Run with `--screenshots` to capture per-miniapp viewport screenshots for human visual review.

## Failures

None.

## Warnings

None.

