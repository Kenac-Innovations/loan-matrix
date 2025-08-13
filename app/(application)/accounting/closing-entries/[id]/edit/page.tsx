'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EditClosurePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;

  useEffect(() => {
    // Redirect to the view page with edit mode
    router.replace(`/accounting/closing-entries/${id}?edit=true`);
  }, [id, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-600 dark:text-slate-400">Redirecting to edit mode...</p>
      </div>
    </div>
  );
} 