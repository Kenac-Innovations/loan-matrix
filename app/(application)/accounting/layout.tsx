import React from 'react';

interface AccountingLayoutProps {
  children: React.ReactNode;
}

export default function AccountingLayout({ children }: AccountingLayoutProps) {
  return <div className="space-y-6">{children}</div>;
}
