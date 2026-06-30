'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { toastError, toastSuccess } from '@/lib/toast-helpers';
import { useRouter } from 'next/navigation';
import { Loader2, CreditCard, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function CheckoutForm({ courseId, coursePrice, courseTitle, userId, userEmail, userName }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [error, setError] = useState('');

  const handlePayment = async () => {
    setError('');
    startTransition(async () => {
      try {
        const response = await fetch('/api/payments/mock/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            courseId,
            simulateFailure,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
          const errorMsg = data.error || data.message || 'Payment failed. Please try again.';
          setError(errorMsg);
          toastError('Payment Failed', errorMsg);
          return;
        }

        // Success - redirect to success page
        toastSuccess('Payment Successful!', 'You have been enrolled in the course.');
        router.push(`/enroll-success?referenceId=${data.referenceId}&courseId=${courseId}`);
      } catch (err) {
        const errorMsg = err?.message || 'An unexpected error occurred. Please try again.';
        setError(errorMsg);
        toastError('Payment Failed', errorMsg);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* User Info */}
      <div className="space-y-2">
        <Label>Customer Name</Label>
        <div className="text-sm text-muted-foreground">{userName}</div>
      </div>

      <div className="space-y-2">
        <Label>Email</Label>
        <div className="text-sm text-muted-foreground">{userEmail}</div>
      </div>

      {/* Payment Amount */}
      <div className="space-y-2">
        <Label>Amount to Pay</Label>
        <div className="text-2xl font-bold">${coursePrice.toFixed(2)}</div>
      </div>

      {/* Simulation Toggle */}
      <div className="flex items-center space-x-2 p-4 border rounded-md bg-muted/50">
        <Checkbox
          id="simulate-failure"
          checked={simulateFailure}
          onCheckedChange={(checked) => setSimulateFailure(checked === true)}
        />
        <Label
          htmlFor="simulate-failure"
          className="text-sm font-normal cursor-pointer"
        >
          Simulate payment failure (for testing)
        </Label>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Info Alert */}
      <Alert>
        <CreditCard className="h-4 w-4" />
        <AlertDescription>
          This is a simulated payment. No real charges will be made. Click "Pay Now" to complete the demo purchase.
        </AlertDescription>
      </Alert>

      {/* Payment Button */}
      <Button
        onClick={handlePayment}
        disabled={isPending}
        className="w-full"
        size="lg"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            Pay Now (Simulated)
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        By clicking "Pay Now", you agree that this is a demo payment and no real transaction will occur.
      </p>
    </div>
  );
}

