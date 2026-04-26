import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEMO_USERS = [
  { email: 'owner@moducraft.com', name: 'Rajesh Kumar', role: 'Owner/CEO' },
  { email: 'sm1@moducraft.com', name: 'Rahul Sharma', role: 'Senior Sales Manager' },
  { email: 'se1@moducraft.com', name: 'Priya Singh', role: 'Sales Executive' },
];

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user) {
    navigate(user.role === 'SALES_EXECUTIVE' ? '/leads' : '/dashboard');
    return null;
  }

  const handleLogin = async (email) => {
    setLoading(true);
    setError('');
    try {
      const u = await login(email);
      navigate(u.role === 'SALES_EXECUTIVE' ? '/leads' : '/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: Image panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 flex flex-col justify-center items-center text-center p-12">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-8">
            <span className="text-white font-bold text-4xl">M</span>
          </div>
          <h2 className="text-4xl font-bold text-white mb-4">ModuCraft</h2>
          <p className="text-xl text-primary-200 mb-2">Furniture CRM</p>
          <p className="text-primary-300 max-w-md mt-4">
            Manage your sales pipeline, track leads, and grow your modular furniture business — all in one place.
          </p>
        </div>
        {/* Decorative elements */}
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-primary-500/30 rounded-full blur-3xl" />
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
      </div>

      {/* Right: Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-2xl">M</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-xl">ModuCraft</h1>
              <p className="text-sm text-gray-500">Furniture CRM</p>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-500 mb-8">Sign in to your account to continue</p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Google Login Button */}
          <button
            onClick={() => handleLogin(DEMO_USERS[0].email)}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all font-medium text-gray-700 mb-8"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading ? 'Signing in...' : 'Login with Google'}
          </button>

          {/* Demo user selector */}
          <div className="border-t border-gray-200 pt-6">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Demo Accounts</p>
            <div className="space-y-2">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.email}
                  onClick={() => handleLogin(u.email)}
                  disabled={loading}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-primary-50 hover:border-primary-200 transition-all text-left"
                >
                  <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold text-sm">
                    {u.name[0]}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.role}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
