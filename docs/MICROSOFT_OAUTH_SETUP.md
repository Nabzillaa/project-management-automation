# Microsoft OAuth Setup Guide

This guide explains how to configure Microsoft OAuth for SSO and account linking.

## Prerequisites

- Microsoft Azure account
- Project Management App deployed
- Backend and frontend running

## Step 1: Register Application in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to Azure Active Directory → App registrations
3. Click "New registration"
4. Fill in:
   - **Name**: Project Management App
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: Web → `https://yourdomain.com/api/auth/microsoft/callback`
5. Click Register

## Step 2: Create Client Secret

1. Go to Certificates & secrets
2. Click "New client secret"
3. Description: "Production secret"
4. Expiry: 24 months
5. Copy the value immediately (won't be shown again)

## Step 3: Get Application ID

1. Go to Overview tab
2. Copy "Application (client) ID"

## Step 4: Configure Environment Variables

Add to backend `.env`:

```env
MICROSOFT_CLIENT_ID=<application-id>
MICROSOFT_CLIENT_SECRET=<client-secret-value>
MICROSOFT_REDIRECT_URI=https://yourdomain.com/api/auth/microsoft/callback
MICROSOFT_TENANT_ID=common
```

For single-tenant:
```env
MICROSOFT_TENANT_ID=<your-tenant-id>
```

## Step 5: API Permissions

1. Go to API permissions
2. Click "Add a permission"
3. Select Microsoft Graph → Delegated permissions
4. Add:
   - `profile` - Read user profile
   - `email` - Read user email
   - `openid` - OpenID Connect scopes
5. Click "Grant admin consent"

## Step 6: Test OAuth Flow

1. Go to login page
2. Click "Sign in with Microsoft"
3. Complete authentication
4. Should redirect back with tokens

## Step 7: Link Existing Account

1. Login with email/password
2. Go to Settings → Microsoft Integration
3. Click "Connect Microsoft"
4. Complete OAuth
5. Account should be linked

## Troubleshooting

### "Invalid redirect URI"
- Ensure redirect URI in Azure matches exactly
- Must be HTTPS in production

### "User profile not found"
- Check Microsoft Graph permissions granted
- Run migrations: `pnpm db:migrate`

### CORS errors
- Check CORS configuration in `server.ts`
- Verify `FRONTEND_URL` in `.env`

## Token Refresh

Tokens are automatically refreshed when:
- Access token expires
- Making API call with expired token
- Background job syncs profile daily

## Scopes Explained

| Scope | Purpose |
|-------|---------|
| profile | Read user profile (name, etc) |
| email | Read email address |
| openid | OpenID Connect authentication |
| offline_access | Get refresh token |

## Security Best Practices

1. Never commit secrets to git
2. Rotate secrets regularly
3. Use HTTPS in production
4. Enable MFA for Azure account
5. Limit API permissions to minimum needed
6. Monitor failed login attempts
