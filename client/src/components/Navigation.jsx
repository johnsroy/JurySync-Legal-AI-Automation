import React from 'react';
import { Link } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button } from '@mui/material';

export default function Navigation() {
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component={Link} to="/" sx={{ flexGrow: 1, textDecoration: 'none', color: 'inherit' }}>
          {/* Your app name */}
        </Typography>
        
        {/* Public navigation links */}
        <Button color="inherit" component={Link} to="/products">
          Products
        </Button>
        
        {/* ... other navigation links based on authentication state */}
        
        {!isAuthenticated ? (
          <>
            <Button color="inherit" component={Link} to="/login">
              Login
            </Button>
            <Button 
              variant="contained" 
              color="secondary" 
              component={Link} 
              to="/register"
            >
              Start Free Trial
            </Button>
          </>
        ) : (
          // ... authenticated user navigation options
        )}
      </Toolbar>
    </AppBar>
  );
} 