# NutriMind AI — Release Process

## Versioning

Semantic versioning: `MAJOR.MINOR.PATCH`

| Type | Trigger | Example |
|------|---------|---------|
| PATCH | Bug fix, content update | `1.0.1` |
| MINOR | New feature, new phase | `1.1.0` |
| MAJOR | Breaking API or DB migration | `2.0.0` |

Android `versionCode` = `git rev-list --count HEAD`  
Android `versionName` = tag name without `v`

## Release Checklist

- [ ] All CI gates green on `main` branch
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] `flutter analyze` reports 0 issues
- [ ] Full API test suite passes (230+ tests)
- [ ] Emulator integration tests green
- [ ] `docs/DELIVERY_REPORT.md` items 1–8 verified
- [ ] `git tag vX.Y.Z` pushed → CD workflow triggers automatically

## Release Steps

```bash
# 1. Ensure main is clean and all tests pass
git checkout main
git pull

# 2. Tag the release
git tag v1.0.0
git push origin v1.0.0

# 3. CD workflow automatically:
#    - Builds Android AAB → uploads to Play Store (10% staged)
#    - Builds iOS IPA → uploads to TestFlight
#    - On manual approve in App Store Connect → 10% App Store rollout

# 4. Monitor
#    - Play Console → Android Vitals (crash rate, ANR rate)
#    - App Store Connect → TestFlight feedback
#    - Grafana → API error rate, LLM cost
```

## Rollback

### API rollback
Fastify is stateless. Revert by redeploying previous Docker image:
```bash
fly deploy --image registry.fly.io/nutrimind-api:vX.Y.Z-prev
```

### Mobile rollback
- Android: Halt staged rollout in Play Console (Releases → Halt)
- iOS: Remove from sale in App Store Connect; previous version remains active

### Database rollback
Supabase migrations are intentionally additive (no destructive DDL in releases).  
If a column must be removed, create a new migration with `ALTER TABLE ... DROP COLUMN`.

## Staged Rollout Policy

| Stage | Rollout % | Duration | Go/No-go signal |
|-------|-----------|----------|-----------------|
| Internal | 100% | 24h | No crashes in internal testing |
| 10% staged | 10% | 3 days | Crash-free rate > 99.5% |
| 50% | 50% | 2 days | Same |
| 100% | 100% | Permanent | Same |
