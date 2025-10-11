'use client';

import { useState, useEffect } from 'react';
import { DashboardChat } from '@/components/dashboard/DashboardChat';
import { LoginPage } from '@/components/auth/LoginPage';
import PocTermsModal from '@/components/auth/PocTermsModal';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [showPocTerms, setShowPocTerms] = useState(false);
  const [checkingTerms, setCheckingTerms] = useState(true);

  useEffect(() => {
    const checkPocTermsStatus = async () => {
      if (isAuthenticated && user) {
        console.log('Checking POC terms for user:', user);
        console.log('pocTermsAccepted value:', user.pocTermsAccepted);
        console.log('pocTermsAccepted type:', typeof user.pocTermsAccepted);

        // Check if user has accepted POC terms
        // Check for undefined, false, or explicitly false
        if (user.pocTermsAccepted !== true) {
          console.log('User has NOT accepted terms, showing modal');
          setShowPocTerms(true);
        } else {
          console.log('User has already accepted terms');
        }
        setCheckingTerms(false);
      } else if (!isLoading && !isAuthenticated) {
        // Not authenticated, stop checking
        setCheckingTerms(false);
      }
    };

    if (!isLoading) {
      checkPocTermsStatus();
    }
  }, [isAuthenticated, isLoading, user]);

  const handleAcceptTerms = async () => {
    try {
      await api.post('/api/auth/accept-poc-terms');

      // Update user in localStorage
      const storedUser = localStorage.getItem('auth_user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        userData.pocTermsAccepted = true;
        localStorage.setItem('auth_user', JSON.stringify(userData));
      }

      setShowPocTerms(false);
      toast.success('Terms accepted successfully');
      // Reload to refresh the user state
      window.location.reload();
    } catch (error) {
      console.error('Failed to accept terms:', error);
      toast.error('Failed to accept terms. Please try again.');
    }
  };

  const handleDeclineTerms = () => {
    // Redirect to Impact Networking
    window.location.href = 'https://impactnetworking.com';
  };

  if (isLoading || checkingTerms) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#2D7D32]"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Show POC terms modal if user hasn't accepted yet
  if (showPocTerms) {
    return (
      <PocTermsModal
        onAccept={handleAcceptTerms}
        onDecline={handleDeclineTerms}
        userName={user?.name}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <DashboardChat />
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'text-sm',
          duration: 4000,
          style: {
            background: '#fff',
            color: '#374151',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e5e7eb',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </AuthProvider>
  );
}