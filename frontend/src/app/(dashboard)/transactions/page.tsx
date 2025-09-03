import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function TransactionsPage() {
  return (
    <div className="container mx-auto py-4">
      <h1 className="text-2xl font-bold mb-4">Transactions</h1>
      <Tabs defaultValue="history">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="deposit">Deposit</TabsTrigger>
          <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
        </TabsList>
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>A list of your recent transactions.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Deposit</TableCell>
                    <TableCell><Badge>Completed</Badge></TableCell>
                    <TableCell>2024-07-25</TableCell>
                    <TableCell>From Bank **** 6789</TableCell>
                    <TableCell className="text-right text-green-500">+$1,500.00</TableCell>
                  </TableRow>
                   <TableRow>
                    <TableCell>Transfer</TableCell>
                    <TableCell><Badge>Completed</Badge></TableCell>
                    <TableCell>2024-07-24</TableCell>
                    <TableCell>To @johndoe</TableCell>
                    <TableCell className="text-right">-$250.00</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Generation</TableCell>
                    <TableCell><Badge>Completed</Badge></TableCell>
                    <TableCell>2024-07-23</TableCell>
                    <TableCell>QuantumLeap Method</TableCell>
                    <TableCell className="text-right text-green-500">+$50.00</TableCell>
                  </TableRow>
                   <TableRow>
                    <TableCell>Cashout</TableCell>
                    <TableCell><Badge variant="secondary">Pending</Badge></TableCell>
                    <TableCell>2024-07-22</TableCell>
                    <TableCell>To Bank **** 1234</TableCell>
                    <TableCell className="text-right">-$5,000.00</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Transfer</TableCell>
                    <TableCell><Badge variant="destructive">Failed</Badge></TableCell>
                    <TableCell>2024-07-21</TableCell>
                    <TableCell>To @janedoe</TableCell>
                    <TableCell className="text-right">-$100.00</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="deposit">
          <Card>
            <CardHeader>
              <CardTitle>Deposit Funds</CardTitle>
              <CardDescription>Add money to your QuantumMint account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deposit-amount">Amount</Label>
                <Input id="deposit-amount" type="number" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deposit-source">From</Label>
                <Input id="deposit-source" defaultValue="Bank Account **** 6789" disabled />
              </div>
            </CardContent>
            <CardFooter>
              <Button>Deposit</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="withdraw">
           <Card>
            <CardHeader>
              <CardTitle>Withdraw Funds</CardTitle>
              <CardDescription>Transfer money from QuantumMint to your bank.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="withdraw-amount">Amount</Label>
                <Input id="withdraw-amount" type="number" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="withdraw-destination">To</Label>
                <Input id="withdraw-destination" defaultValue="Bank Account **** 1234" disabled />
              </div>
            </CardContent>
            <CardFooter>
              <Button>Withdraw</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
