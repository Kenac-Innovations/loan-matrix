import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { BookOpen, FileText, Search, RefreshCcw, ListChecks } from 'lucide-react';

const tabs = [
  { label: 'Home', href: '/accounting', icon: RefreshCcw },
  { label: 'Chart of Accounts', href: '/accounting/chart-of-accounts', icon: BookOpen },
  { label: 'Journal Entries', href: '/accounting/journal-entries', icon: FileText },
  { label: 'Search Journal', href: '/accounting/search-journal', icon: Search },
  { label: 'Frequent Postings', href: '/accounting/frequent-postings', icon: ListChecks },
];

interface AccountingLayoutProps {
  children: React.ReactNode;
}

export default function AccountingLayout({ children }: AccountingLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Breadcrumb / Title */}
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Accounting</h1>
        <nav className="flex space-x-4">
          {tabs.map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-1 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
              <Icon className="w-5 h-5" />
              <span className="font-medium">{label}</span>
            </Link>
          ))}
        </nav>
      </header>

      <hr className="border-gray-200 dark:border-[#1a2035] my-4" />

      {/* Content area for child pages */}
      <section className="p-4 bg-white dark:bg-[#0d121f] rounded-lg shadow-sm">
        {children}
      </section>
    </div>
  );
}
