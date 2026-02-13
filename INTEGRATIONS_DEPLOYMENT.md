# Integrations Deployment Guide

Quick reference for deploying JIRA and Microsoft integrations.

## 1. Database Migration

```bash
cd packages/database
pnpm db:migrate
# This creates: SyncConfiguration, updates Organization model
```

## 2. Environment Variables

Add to `packages/backend/.env`:

```env
# JIRA Integration
JIRA_WEBHOOK_SECRET=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" >

# Microsoft OAuth
MICROSOFT_CLIENT_ID=<from Azure Portal>
MICROSOFT_CLIENT_SECRET=<from Azure Portal>
MICROSOFT_REDIRECT_URI=https://yourdomain.com/api/auth/microsoft/callback
MICROSOFT_TENANT_ID=common

# Existing
REDIS_HOST=localhost
REDIS_PORT=6379
FRONTEND_URL=http://localhost:3000
```

## 3. Backend Build & Deploy

```bash
cd packages/backend
pnpm install
pnpm build
pnpm start
```

## 4. Frontend Build & Deploy

```bash
cd packages/frontend
pnpm install
pnpm build
pnpm preview
```

## 5. Verify Deployments

### JIRA Integration
1. Go to Settings → JIRA Integration
2. Enter JIRA credentials (domain, email, API token)
3. Click "Test Connection" → Should succeed
4. Click "Import Projects" → Should list JIRA projects

### Microsoft OAuth
1. Go to Login page
2. See "Sign in with Microsoft" button
3. Click → Redirects to Microsoft login
4. Complete auth → Should redirect back and login

## 6. Configure Webhooks (Optional)

See [JIRA_WEBHOOK_SETUP.md](./docs/JIRA_WEBHOOK_SETUP.md)

```env
# Set webhook secret
JIRA_WEBHOOK_SECRET=<generated-secret>
```

## 7. Test Full Workflow

### JIRA Export
1. Create task in app
2. Click menu → "Export to JIRA"
3. Select JIRA project key
4. Verify issue created in JIRA

### JIRA Import
1. Go to Settings
2. Click "Import Projects"
3. Select JIRA project
4. Verify tasks created in app

### Bidirectional Sync
1. Export task to JIRA
2. Update task in app
3. Go to sync status → "Sync Now"
4. Verify JIRA updated
5. Update issue in JIRA
6. Wait for sync (or click sync)
7. Verify task updated

### Microsoft OAuth
1. Logout
2. Click "Sign in with Microsoft"
3. Complete authentication
4. Should redirect to dashboard

### Account Linking
1. Login with email/password
2. Go to Settings → Microsoft Integration
3. Click "Connect Microsoft"
4. Complete authentication
5. Should show connected status

## 8. Monitoring

### Logs

```bash
# Backend logs
docker logs backend-container

# Frontend console
browser DevTools → Console
```

### Database

```bash
# Check SyncConfiguration
pnpm db:studio
# Navigate to sync_configurations table
```

### JIRA Webhook Status

1. JIRA → Settings → Apps → Webhooks
2. Click webhook name
3. View "Recent deliveries"
4. Check "Response code" and "Response body"

## 9. Troubleshooting

| Issue | Solution |
|-------|----------|
| JIRA connection fails | Check domain, email, API token |
| Webhook not received | Check URL is publicly accessible, firewall rules |
| OAuth redirect fails | Verify redirect URI matches Azure config |
| Sync fails | Check logs, verify credentials, ensure org exists |
| Tasks not updating | Check sync history, verify webhook secret |

## 10. Production Checklist

- [ ] Database migrations run
- [ ] All env vars set (JIRA_WEBHOOK_SECRET, MICROSOFT_CLIENT_*)
- [ ] HTTPS enabled
- [ ] JIRA credentials saved and tested
- [ ] Microsoft app registered in Azure
- [ ] JIRA webhooks configured
- [ ] Sync history accessible in Settings
- [ ] Export/import tested
- [ ] OAuth tested on login
- [ ] Error handling works
- [ ] Logs are monitoring
- [ ] Backups configured

## 11. Files Modified/Created

**Backend**
- `/src/services/jiraIntegration.ts` - Enhanced with export
- `/src/services/jiraSyncService.ts` - Sync logic (NEW)
- `/src/services/jiraWebhookHandler.ts` - Webhook handler (NEW)
- `/src/services/microsoftAuthService.ts` - OAuth (NEW)
- `/src/routes/integrations.ts` - Export/sync endpoints
- `/src/routes/auth.ts` - OAuth endpoints
- `/src/routes/webhooks.ts` - Webhook receiver (NEW)
- `/src/queues/microsoftSyncQueue.ts` - Profile sync (NEW)
- `/src/server.ts` - Webhook route registration

**Frontend**
- `/src/pages/Login.tsx` - Microsoft login button
- `/src/components/tasks/TaskList.tsx` - Export button
- `/src/components/integrations/JiraSyncStatus.tsx` - Sync UI (NEW)
- `/src/components/integrations/MicrosoftConnect.tsx` - Connect UI (NEW)
- `/src/services/api/integrations.ts` - Export/sync methods
- `/src/services/api/auth.ts` - Microsoft auth method

**Database**
- `schema.prisma` - SyncConfiguration model

**Docs**
- `/docs/JIRA_WEBHOOK_SETUP.md`
- `/docs/MICROSOFT_OAUTH_SETUP.md`
- `/docs/INTEGRATIONS_GUIDE.md`
- `/INTEGRATIONS_DEPLOYMENT.md` (this file)

## 12. Support Resources

- [JIRA Webhook Setup](./docs/JIRA_WEBHOOK_SETUP.md)
- [Microsoft OAuth Setup](./docs/MICROSOFT_OAUTH_SETUP.md)
- [Complete Integrations Guide](./docs/INTEGRATIONS_GUIDE.md)

## Next Steps

1. ✅ Implement features (DONE)
2. Deploy to staging
3. Test integrations
4. Configure webhooks
5. Deploy to production
6. Monitor logs
7. Gather user feedback
8. Iterate on features
