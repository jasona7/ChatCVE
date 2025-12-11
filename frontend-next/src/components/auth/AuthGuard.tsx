'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Shield } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRoles?: ('admin' | 'user' | 'guest')[];
}

export function AuthGuard({ children, requiredRoles }: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, setupComplete, user } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    // If setup not complete, redirect to setup
    if (setupComplete === false) {
      router.push('/setup');
      return;
    }

    // If not authenticated, redirect to login
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // If roles specified, check if user has required role
    if (requiredRoles && user && !requiredRoles.includes(user.role)) {
      // Redirect to dashboard with insufficient permissions
      router.push('/');
    }
  }, [isLoading, isAuthenticated, setupComplete, user, requiredRoles, router]);

  // Show loading state
  if (isLoading || setupComplete === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mb-4 animate-pulse">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated yet - show loading while redirecting
  if (!isAuthenticated || setupComplete === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mb-4 animate-pulse">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-400">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Check role permissions
  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-slate-400">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
