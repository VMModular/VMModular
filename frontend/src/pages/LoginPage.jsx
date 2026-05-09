import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initializeGoogle = async () => {
      try {
        const response = await fetch('/auth/google/client-id');
        if (!response.ok) {
          throw new Error('Failed to load Google OAuth configuration');
        }

        const { clientId } = await response.json();
        if (!clientId) {
          throw new Error('Google OAuth client ID is missing');
        }

        const scriptId = 'google-identity-services';
        if (!document.getElementById(scriptId)) {
          const script = document.createElement('script');
          script.id = scriptId;
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          document.head.appendChild(script);
        }

        const waitForGoogle = () => new Promise((resolve, reject) => {
          const startedAt = Date.now();
          const interval = window.setInterval(() => {
            if (window.google?.accounts?.id) {
              window.clearInterval(interval);
              resolve();
              return;
            }
            if (Date.now() - startedAt > 10000) {
              window.clearInterval(interval);
              reject(new Error('Google script load timed out'));
            }
          }, 100);
        });

        await waitForGoogle();
        if (!mounted) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async ({ credential }) => {
            if (!credential) {
              setError('Google did not return a login token');
              return;
            }

            setLoading(true);
            setError('');
            try {
              const u = await loginWithGoogle(credential);
              navigate(u.role === 'SALES_EXECUTIVE' ? '/leads' : '/dashboard');
            } catch (err) {
              setError(err.message || 'Google login failed');
            } finally {
              setLoading(false);
            }
          },
          auto_select: false,
          ux_mode: 'popup',
        });

        const buttonHost = document.getElementById('google-signin-button');
        if (buttonHost) {
          buttonHost.innerHTML = '';
          window.google.accounts.id.renderButton(buttonHost, {
            theme: 'outline',
            size: 'large',
            width: 360,
            text: 'signin_with',
            shape: 'pill',
          });
        }

        setGoogleReady(true);
      } catch (err) {
        if (!mounted) return;
        setError(err.message || 'Failed to initialize Google login');
      }
    };

    initializeGoogle();

    return () => {
      mounted = false;
    };
  }, [loginWithGoogle, navigate]);

  if (user) {
    navigate(user.role === 'SALES_EXECUTIVE' ? '/leads' : '/dashboard');
    return null;
  }

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
          <div className="mb-4 flex justify-center" id="google-signin-button" />
          {!googleReady && (
            <p className="text-sm text-gray-500 mb-8 text-center">Preparing Google login...</p>
          )}
        </div>
      </div>
    </div>
  );
}
