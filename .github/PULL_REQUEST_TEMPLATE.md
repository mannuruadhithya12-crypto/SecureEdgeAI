# Pull Request

## Summary

Brief description of what this PR does and why.

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing behavior)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code cleanup / refactor

## Related Issue

Closes #___

## Changes Made

List the specific files and changes:

- `src/screens/...` — 
- `src/services/...` — 
- `docs/...` — 

## Architecture Constraints Check

- [ ] BlazeFace model unchanged
- [ ] MobileFaceNet model unchanged
- [ ] SQLite schema — additive only (no DROP or RENAME)
- [ ] No new mandatory network calls
- [ ] APK size impact: ___ MB (Total after: ___ MB, Budget: < 19 MB)
- [ ] Security controls not weakened
- [ ] New PII fields encrypted via `encryption.ts`
- [ ] New auth events logged via `auditLogger.ts`

## QA Validation

Device tested on: ___  
Android version: ___

**QA log output:**
```
Paste relevant [QA] log lines here
```

**Test cases verified:**
- [ ] TC-01: Registration
- [ ] TC-02: Password Login
- [ ] TC-03: Face Login (correct user)
- [ ] TC-04: Face Re-registration
- [ ] TC-05: Attendance visibility
- [ ] TC-06: APK size < 19 MB
- [ ] TC-07: Offline operation

## Screenshots (if UI change)

| Before | After |
|:---:|:---:|
| | |

## Checklist

- [ ] TypeScript passes: `npx tsc --noEmit`
- [ ] Lint passes: `npm run lint`
- [ ] Tests pass: `npm test`
- [ ] Documentation updated if behavior changed
- [ ] `.ai/PROJECT_CONTEXT.md` updated if stack/schema changed
