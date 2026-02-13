# Complete Integrations Guide

Overview of JIRA and Microsoft integrations.

## JIRA Integration

### Features

- **Import**: Pull projects and issues from JIRA
- **Export**: Push tasks to JIRA (create/update)
- **Bidirectional Sync**: Automatic sync every 15 minutes
- **Webhooks**: Real-time updates when JIRA issues change
- **Status Mapping**: Automatic mapping between JIRA and app statuses

### Setup

1. **Configure JIRA Credentials**
   - Go to Settings → JIRA Integration
   - Enter domain (e.g., yourcompany.atlassian.net)
   - Enter email and API token
   - Click "Test Connection"
   - Click "Save"

2. **Import Project**
   - Click "Import Projects"
   - Select JIRA project from list
   - Click "Import"

3. **Setup Webhooks** (optional, for real-time sync)
   - See [JIRA Webhook Setup Guide](./JIRA_WEBHOOK_SETUP.md)

4. **Export Tasks**
   - Open task
   - Click menu → "Export to JIRA"
   - Enter JIRA project key
   - Task creates issue in JIRA

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/integrations/jira/test` | POST | Test JIRA connection |
| `/api/integrations/jira/projects` | POST | List JIRA projects |
| `/api/integrations/jira/credentials` | POST | Save credentials |
| `/api/integrations/jira/export/:taskId` | POST | Export task to JIRA |
| `/api/integrations/jira/sync/:projectId` | POST | Trigger manual sync |
| `/api/integrations/jira/sync/history/:orgId` | GET | Get sync history |
| `/api/webhooks/jira` | POST | Receive JIRA webhooks |

## Microsoft Integration

### Features

- **OAuth SSO**: Sign in with Microsoft
- **Account Linking**: Link Microsoft to existing account
- **Profile Sync**: Auto-sync name and email from Microsoft

### Setup

1. **Register App in Azure**
   - See [Microsoft OAuth Setup Guide](./MICROSOFT_OAUTH_SETUP.md)

2. **Configure Environment Variables**
   ```env
   MICROSOFT_CLIENT_ID=<id>
   MICROSOFT_CLIENT_SECRET=<secret>
   MICROSOFT_REDIRECT_URI=https://yourdomain.com/api/auth/microsoft/callback
   MICROSOFT_TENANT_ID=common
   ```

3. **Test OAuth**
   - Go to login page
   - Click "Sign in with Microsoft"
   - Complete authentication

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/microsoft` | GET | Redirect to OAuth |
| `/api/auth/microsoft/callback` | GET | Handle OAuth callback |
| `/api/auth/microsoft/link` | POST | Link existing account |

## Deployment Checklist

Before deploying:

- [ ] Update environment variables
- [ ] Run database migrations: `pnpm db:migrate`
- [ ] Rebuild backend: `pnpm build`
- [ ] Rebuild frontend: `pnpm build`
- [ ] Test JIRA connection in Settings
- [ ] Test Microsoft OAuth on login page
- [ ] Configure JIRA webhooks
- [ ] Set webhook secret in backend
- [ ] Test webhook by creating JIRA issue
- [ ] Verify task is updated in real-time

## Status Mapping Reference

### JIRA → App

| JIRA Status | App Status |
|------------|-----------|
| To Do | todo |
| In Progress | in_progress |
| In Review | in_review |
| Done | completed |
| Blocked | blocked |

### App → JIRA

| App Status | JIRA Status |
|-----------|-----------|
| todo | To Do |
| in_progress | In Progress |
| in_review | In Review |
| completed | Done |
| blocked | Blocked |

## Priority Mapping

| JIRA | App |
|------|-----|
| Highest | critical |
| High | high |
| Medium | medium |
| Low | low |
| Lowest | low |

## Issue Type Mapping

| JIRA | App |
|------|-----|
| Bug | bug |
| Task | task |
| Story | task |
| Epic | milestone |

## Sync Configuration

Edit `SyncConfiguration` in database:

```prisma
SyncConfiguration {
  syncEnabled: boolean      // Enable/disable sync
  syncInterval: int         // Seconds between syncs
  lastSyncAt: DateTime      // Last sync timestamp
  statusMapping: Json       // Custom status mapping
  autoExport: boolean       // Auto-export tasks
  autoImport: boolean       // Auto-import from JIRA
}
```

## Error Handling

All integrations implement:

- Exponential backoff on failures
- Detailed error logging
- User-facing error messages
- Sync history for troubleshooting

## Limits & Quotas

- JIRA: 100 issues per import
- Microsoft: Standard Graph API limits
- Webhooks: Rate limited by JIRA
- Sync: Max 15-minute intervals

## Support

For issues:

1. Check logs: `docker logs <container>`
2. Review sync history in Settings
3. Test connectivity with "Test Connection"
4. See troubleshooting in respective setup guides
