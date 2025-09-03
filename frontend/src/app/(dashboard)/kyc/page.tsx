import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ShieldCheck } from "lucide-react"

export default function KycPage() {
  const kycStatus = 'verified'; // can be 'unverified', 'pending', 'verified'

  return (
    <div className="container mx-auto py-4">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>KYC Verification</CardTitle>
          <CardDescription>
            Verify your identity to unlock all features of QuantumMint.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-4 rounded-md border p-4">
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium leading-none">
                Current Status
              </p>
              <p className="text-sm text-muted-foreground">
                Your identity verification status.
              </p>
            </div>
            <div>
              {kycStatus === 'verified' && <Badge className="bg-green-500 hover:bg-green-600">Verified</Badge>}
              {kycStatus === 'pending' && <Badge variant="secondary">Pending Review</Badge>}
              {kycStatus === 'unverified' && <Badge variant="destructive">Not Verified</Badge>}
            </div>
          </div>

          {kycStatus === 'verified' && (
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>You are all set!</AlertTitle>
              <AlertDescription>
                Your identity has been successfully verified. You have full access to all features.
              </AlertDescription>
            </Alert>
          )}

          {kycStatus !== 'verified' && (
            <div>
                <h3 className="text-lg font-medium mb-4">Submit Documents</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="id-document">Identity Document (Passport, Driver's License)</Label>
                    <Input id="id-document" type="file" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address-proof">Proof of Address (Utility Bill, Bank Statement)</Label>
                    <Input id="address-proof" type="file" />
                  </div>
                </div>
            </div>
          )}

        </CardContent>
        {kycStatus !== 'verified' && (
          <CardFooter>
            <Button disabled={kycStatus === 'pending'}>
              {kycStatus === 'pending' ? 'Submission Under Review' : 'Submit for Verification'}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
