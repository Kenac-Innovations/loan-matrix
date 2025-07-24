'use client';

import useSWR from 'swr';
import { Card } from '@/components/ui/card';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ChartOfAccountsPage() {
  const { data, error } = useSWR('/api/fineract/chart-of-accounts', fetcher);

  if (error) return <div>Error loading chart of accounts</div>;
  if (!data) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      {data?.chartAccounts?.map((acc: any) => (
        <Card key={acc.id} className="p-4">
          <p className="font-semibold">{acc.name}</p>
          <p className="text-sm text-muted">GL Code: {acc.glCode}</p>
        </Card>
      ))}
    </div>
  );
}