'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Building2,
  Calendar as CalendarIcon,
  MessageSquare,
  ArrowLeft,
  Save
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Office {
  id: number;
  name: string;
  nameDecorated: string;
  externalId?: string;
  openingDate: number[];
  hierarchy: string;
  parentId?: number;
  parentName?: string;
}

export default function CreateClosurePage() {
  const router = useRouter();
  
  // Form state
  const [officeId, setOfficeId] = useState<string>('');
  const [closingDate, setClosingDate] = useState<Date | undefined>(undefined);
  const [comments, setComments] = useState<string>('');

  // Data fetching
  const [offices, setOffices] = useState<Office[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch offices on component mount
  useEffect(() => {
    const fetchOffices = async () => {
      try {
        const response = await fetch('/api/fineract/offices?orderBy=id');
        const data = await response.json();
        setOffices(data);
        
        // Set default office if available
        if (data.length > 0) {
          setOfficeId(data[0].id.toString());
        }
        
        // Set default date to today
        setClosingDate(new Date());
      } catch (error) {
        console.error('Error fetching offices:', error);
        toast({
          title: "Error",
          description: "Failed to load offices. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchOffices();
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!officeId || !closingDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        officeId: parseInt(officeId),
        closingDate: format(closingDate, 'dd MMMM yyyy'),
        comments,
        dateFormat: 'dd MMMM yyyy',
        locale: 'en'
      };

      const response = await fetch('/api/fineract/glclosures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.defaultUserMessage || 'Failed to create closing entry');
      }

      const result = await response.json();
      
      toast({
        title: "Success",
        description: "Closing entry created successfully.",
        variant: "success"
      });

      // Redirect to the closing entry view page
      router.push(`/accounting/closing-entries/${result.resourceId}`);
    } catch (error: any) {
      console.error('Error creating closing entry:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create closing entry. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-20 animate-pulse"></div>
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48 animate-pulse"></div>
        </div>
        <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i}>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-2 animate-pulse"></div>
                  <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-full animate-pulse"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Create Closing Entry</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Create a new GL closure for period-end procedures
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Form Card */}
        <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 max-w-2xl">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Closure Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Office Selection */}
            <div>
              <Label htmlFor="office" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Office *
              </Label>
              <Select value={officeId} onValueChange={setOfficeId} required>
                <SelectTrigger className="mt-1 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600">
                  <Building2 className="w-4 h-4 mr-2 text-slate-400" />
                  <SelectValue placeholder="Select office" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600">
                  {offices.map((office) => (
                    <SelectItem key={office.id} value={office.id.toString()} className="text-slate-900 dark:text-slate-100">
                      {office.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Closing Date */}
            <div>
              <Label htmlFor="closingDate" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Closing Date *
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal mt-1 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600",
                      !closingDate && "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {closingDate ? format(closingDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600">
                  <Calendar
                    mode="single"
                    selected={closingDate}
                    onSelect={setClosingDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Comments */}
            <div>
              <Label htmlFor="comments" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Comments
              </Label>
              <div className="relative mt-1">
                <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <textarea
                  id="comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-slate-900 dark:text-slate-100 resize-none"
                  rows={3}
                  placeholder="Enter comments about this closure"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 max-w-2xl">
          <CardContent className="pt-6">
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !officeId || !closingDate}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Creating...' : 'Create Closure'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
} 