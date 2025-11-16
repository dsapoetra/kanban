'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  Users,
  Settings,
  LogOut,
  Home,
  ArrowLeft
} from 'lucide-react';
import { PublicUser } from '@/types/auth';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get user data from localStorage
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (userData && token) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } catch (error) {
        console.error('Error parsing user data:', error);
        // Clear invalid data
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setIsLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Clear the cookie as well
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/auth/login');
  };

  // Don't show navbar on auth pages or home page
  const hideNavbarPaths = ['/auth/login', '/auth/register', '/'];
  if (hideNavbarPaths.includes(pathname)) {
    return null;
  }

  // Show loading state
  if (isLoading) {
    return (
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="h-6 w-32 bg-gray-200 animate-pulse rounded"></div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="h-8 w-20 bg-gray-200 animate-pulse rounded"></div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // Don't show navbar if user is not authenticated
  if (!user) {
    return null;
  }

  // Get page title and navigation context
  const getPageContext = () => {
    if (pathname === '/dashboard') {
      return {
        title: 'Dashboard',
        showBackButton: false,
      };
    } else if (pathname === '/boards') {
      return {
        title: 'My Boards',
        showBackButton: false,
      };
    } else if (pathname.startsWith('/boards/')) {
      return {
        title: 'Board',
        showBackButton: true,
        backUrl: '/boards',
      };
    }
    return {
      title: 'Kanban App',
      showBackButton: false,
    };
  };

  const pageContext = getPageContext();

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-4">
            {pageContext.showBackButton && (
              <button
                onClick={() => router.push(pageContext.backUrl || '/boards')}
                className="text-gray-600 hover:text-gray-900 p-1 rounded"
                title="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center space-x-4">
              <Link 
                href="/dashboard" 
                className="flex items-center space-x-2 text-xl font-semibold text-gray-900 hover:text-indigo-600"
              >
                <Home className="w-6 h-6" />
                <span>{pageContext.title}</span>
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Navigation Links */}
            <Link
              href="/dashboard"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === '/dashboard'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-1" />
              Dashboard
            </Link>
            
            <Link
              href="/boards"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === '/boards' || pathname.startsWith('/boards/')
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Users className="w-4 h-4 inline mr-1" />
              My Boards
            </Link>

            {/* User Info */}
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-700">
                Welcome, {user.email}
              </span>
              
              {/* Settings Button (placeholder for future) */}
              <button
                className="text-gray-500 hover:text-gray-700 p-1 rounded"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
