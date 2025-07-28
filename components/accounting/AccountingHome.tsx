// components/accounting/AccountingHome.tsx
import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, FileText, Search, RefreshCcw, ListChecks } from 'lucide-react';

const features = [
  { title: 'Chart of Accounts', href: '/accounting/chart-of-accounts', icon: BookOpen },
  { title: 'Create Journal Entries', href: '/accounting/journal-entries/new', icon: FileText },
  { title: 'Search Journal Entries', href: '/accounting/search-journal', icon: Search },
  { title: 'Frequent Postings', href: '/accounting/frequent-postings', icon: ListChecks },
  { title: 'Closing Entries', href: '/accounting/closing-entries', icon: RefreshCcw },
];

export default function AccountingHome() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Overview</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map(({ title, href, icon: Icon }) => (
          <Link key={title} href={href}>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="flex items-center gap-4 p-6">
                <Icon className="w-6 h-6 text-blue-600" />
                <span className="text-lg font-medium text-gray-800 dark:text-white">
                  {title}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
