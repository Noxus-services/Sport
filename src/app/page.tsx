'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { hasUserProfile } from '@/db/userProfileService';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    hasUserProfile().then((has) => {
      router.replace(has ? '/dashboard' : '/onboarding');
    });
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-orange-500 flex items-center justify-center">
          <span className="text-3xl font-black text-white">A</span>
        </div>
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}
