import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './styles/theme';
import Router from './Router';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router />
    </ThemeProvider>
  );
}

export default App;
