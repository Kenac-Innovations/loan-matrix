// components/accounting/AccountingHome.tsx
import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  FileText, 
  Search, 
  RefreshCcw, 
  ListChecks, 
  ArrowRight,
  Shield,
  Settings,
  Calculator
} from 'lucide-react';

const features = [
  { 
    title: 'Chart of Accounts', 
    href: '/accounting/chart-of-accounts', 
    icon: BookOpen,
    description: 'Manage your general ledger accounts and account structure',
    badge: 'Core',
    color: 'bg-blue-500'
  },
  { 
    title: 'Create Journal Entries', 
    href: '/accounting/journal-entries/new', 
    icon: FileText,
    description: 'Record financial transactions and post to general ledger',
    badge: 'New',
    color: 'bg-green-500'
  },
  { 
    title: 'Search Journal Entries', 
    href: '/accounting/search-journal', 
    icon: Search,
    description: 'Find and review posted journal entries',
    badge: 'Search',
    color: 'bg-purple-500'
  },
  { 
    title: 'Frequent Postings', 
    href: '/accounting/frequent-postings', 
    icon: ListChecks,
    description: 'Manage recurring and template journal entries',
    badge: 'Templates',
    color: 'bg-orange-500'
  },
  { 
    title: 'Closing Entries', 
    href: '/accounting/closing-entries', 
    icon: RefreshCcw,
    description: 'Month-end and year-end closing procedures',
    badge: 'Period End',
    color: 'bg-red-500'
  },
  { 
    title: 'Accounting Rules', 
    href: '/accounting/accounting-rules', 
    icon: Settings,
    description: 'Configure automatic journal entry rules and mappings',
    badge: 'Rules',
    color: 'bg-indigo-500'
  },
  { 
    title: 'Accruals', 
    href: '/accounting/accruals', 
    icon: Calculator,
    description: 'Run periodic accruals for financial calculations',
    badge: 'Periodic',
    color: 'bg-teal-500'
  },
];

export default function AccountingHome() {
  return (
    <div className="space-y-32">
      {/* Main Features */}
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Accounting Modules</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Access all your accounting tools and features
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Shield className="h-4 w-4" />
            <span>Secure & Compliant</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ title, href, icon: Icon, description, badge, color }) => (
            <Link key={title} href={href}>
              <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md bg-white dark:bg-slate-800 group h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className={`h-10 w-10 rounded-lg ${color} flex items-center justify-center`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <Badge variant="secondary" className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors">
                    {title}
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
                    {description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <span>Access module</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
