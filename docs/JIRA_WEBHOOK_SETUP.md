# JIRA Webhook Setup Guide

This guide explains how to configure JIRA webhooks to sync real-time updates to the Project Management App.

## Prerequisites

- JIRA Cloud instance with admin access
- Project Management App deployed and accessible via HTTPS
- JIRA webhook secret configured in backend `.env`

## Step 1: Generate Webhook Secret

Generate a secure random secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env`:
```
JIRA_WEBHOOK_SECRET=<generated-secret>
```

## Step 2: Configure JIRA Webhook

1. Go to JIRA Settings → Apps → Webhooks
2. Click "Create a webhook"
3. Fill in the form:
   - **Name**: Project Management App Sync
   - **URL**: `https://yourdomain.com/api/webhooks/jira`
   - **Events**: Select:
     - Issue created
     - Issue updated
     - Issue deleted
   - **Exclude body**: Unchecked

4. Click Create

## Step 3: Add Authentication (Optional)

If you want additional security:

1. In webhook details, add custom headers:
   - **Header**: `Authorization`
   - **Value**: `Bearer <your-secret>`

2. Update webhook handler to verify this header

## Step 4: Test Webhook

1. Create/update a JIRA issue in a synced project
2. Check app logs for webhook processing
3. Verify task is updated in the app

## Troubleshooting

### Webhook not received
- Check JIRA webhook logs: Settings → Apps → Webhooks → View logs
- Verify URL is publicly accessible
- Check firewall/security rules

### Invalid signature error
- Ensure `JIRA_WEBHOOK_SECRET` matches JIRA configuration
- Webhook handler verifies `X-Hub-Signature` header

### Rate limiting
- JIRA may rate limit webhook delivery
- App implements exponential backoff retry

## Events Supported

| Event | Action |
|-------|--------|
| issue.created | Log event (future: create task) |
| issue.updated | Update task status/priority/dates |
| issue.deleted | Remove JIRA link from task |

## Advanced: Custom Field Sync

To sync custom JIRA fields:

1. Update `JiraWebhookHandler.handleIssueUpdated()`
2. Map custom fields to task fields
3. Restart backend
