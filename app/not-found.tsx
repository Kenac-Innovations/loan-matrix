import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center mb-4">
            <FileQuestion className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-xl font-semibold">Page Not Found</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <p className="text-xs text-muted-foreground">
            If you believe this is an error, please contact your administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
