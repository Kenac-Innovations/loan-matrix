'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar, Play } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export default function AccrualsPage() {
  const [tillDate, setTillDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRunAccruals = async () => {
    if (!tillDate) {
      toast({
        title: "Validation Error",
        description: "Please select a date to run accruals.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Format the date as required by the API
      const date = new Date(tillDate);
      const formattedDate = date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

      const response = await fetch('/api/fineract/runaccruals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateFormat: 'dd MMMM yyyy',
          locale: 'en',
          tillDate: formattedDate
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.defaultUserMessage || errorData.developerMessage || 'Failed to run accruals');
      }

      const result = await response.json();
      
      toast({
        title: "Success",
        description: "Accruals have been run successfully.",
        variant: "success"
      });

      // Reset form
      setTillDate('');
      
    } catch (error: any) {
      console.error('Error running accruals:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to run accruals. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/accounting">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Run Periodic Accruals
          </h1>
          <p className="text-muted-foreground mt-2">
            Calculate and process periodic accruals for your financial accounts
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl">
        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Accrual Configuration
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Select the date until which you want to run periodic accruals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date Input */}
            <div className="space-y-2">
              <Label htmlFor="tillDate" className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Accrue Till Date *
              </Label>
              <div className="relative">
                <Input
                  id="tillDate"
                  type="date"
                  value={tillDate}
                  onChange={(e) => setTillDate(e.target.value)}
                  className="pl-10 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Select date"
                />
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Link href="/accounting">
                <Button 
                  variant="outline" 
                  className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-600"
                >
                  Cancel
                </Button>
              </Link>
              <Button
                onClick={handleRunAccruals}
                disabled={!tillDate || isLoading}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Run Periodic Accruals
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 