import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { CheckCircle as CheckIcon, Adb as MicrosoftIcon } from '@mui/icons-material';
import { authApi } from '../../services/api/auth';

export default function MicrosoftConnect() {
  const [linking, setLinking] = useState(false);
  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => authApi.getCurrentUser(),
  });

  const handleConnect = () => {
    setLinking(true);
    // Initiate OAuth flow
    window.location.href = '/api/auth/microsoft';
  };

  const isMicrosoftLinked = user?.microsoftId;

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <MicrosoftIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">Microsoft Integration</Typography>
            <Typography variant="body2" color="text.secondary">
              {isMicrosoftLinked ? 'Connected to your Microsoft account' : 'Connect to your Microsoft account'}
            </Typography>
          </Box>
          {isMicrosoftLinked && <CheckIcon sx={{ color: 'success.main' }} />}
        </Box>

        {isMicrosoftLinked && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Your Microsoft account is connected. You can now sign in with Microsoft.
          </Alert>
        )}
      </CardContent>
      <CardActions>
        {!isMicrosoftLinked && (
          <Button
            variant="contained"
            startIcon={linking ? <CircularProgress size={20} /> : <MicrosoftIcon />}
            onClick={handleConnect}
            disabled={linking}
          >
            {linking ? 'Connecting...' : 'Connect Microsoft'}
          </Button>
        )}
      </CardActions>
    </Card>
  );
}
