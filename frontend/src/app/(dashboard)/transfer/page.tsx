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
import { Textarea } from '@/components/ui/textarea';

export default function TransferPage() {
  return (
    <div className="container mx-auto py-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Transfer Funds</CardTitle>
          <CardDescription>
            Send money to another QuantumMint user instantly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient</Label>
            <Input id="recipient" placeholder="Enter username or email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" type="number" placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note (Optional)</Label>
            <Textarea id="note" placeholder="For dinner last night..." />
          </div>
        </CardContent>
        <CardFooter>
          <Button>Send Money</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
