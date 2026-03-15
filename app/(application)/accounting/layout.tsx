import React from 'react';

interface AccountingLayoutProps {
  children: React.ReactNode;
}

export default function AccountingLayout({ children }: AccountingLayoutProps) {
  return (
    <div className="space-y-6">
      <section className="p-4 bg-white dark:bg-[#0d121f] rounded-lg shadow-sm">
        {children}
      </section>
    </div>
  );
}