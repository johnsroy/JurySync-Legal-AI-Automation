import Products from './pages/Products';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes that don't require authentication */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/products" element={<Products />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/contact" element={<Contact />} />
        
        {/* Protected routes */}
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/documents" element={<Documents />} />
          {/* ...other protected routes */}
        </Route>
      </Routes>
    </Router>
  );
} 