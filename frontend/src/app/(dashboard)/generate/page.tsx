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

export default function GeneratePage() {
  return (
    <div className="container mx-auto py-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Generate Money</h1>
        <p className="text-muted-foreground">
          Choose a method to generate new digital currency.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>QuantumLeap</CardTitle>
            <CardDescription>A steady and reliable generation method.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">Rate: $50 / hour</p>
            <p className="text-sm text-muted-foreground">Limit: $1,000 / day</p>
          </CardContent>
          <CardFooter>
            <Button>Generate Now</Button>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>ChronoBurst</CardTitle>
            <CardDescription>A high-yield, short-term burst of currency.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">Rate: $200 / 15 mins</p>
            <p className="text-sm text-muted-foreground">Cooldown: 24 hours</p>
          </CardContent>
          <CardFooter>
            <Button>Initiate Burst</Button>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>StarlightDrift</CardTitle>
            <CardDescription>A passive, low-energy generation stream.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">Rate: $0.10 / minute</p>
            <p className="text-sm text-muted-foreground">Max accumulated: $100</p>
          </CardContent>
          <CardFooter>
            <Button variant="secondary">Activate Stream</Button>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generation History</CardTitle>
          <CardDescription>A log of your recent generation activities.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount Generated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>QuantumLeap</TableCell>
                <TableCell><Badge>Completed</Badge></TableCell>
                <TableCell>2024-07-25 14:30</TableCell>
                <TableCell className="text-right text-green-500">+$50.00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>ChronoBurst</TableCell>
                <TableCell><Badge>Completed</Badge></TableCell>
                <TableCell>2024-07-24 09:00</TableCell>
                <TableCell className="text-right text-green-500">+$200.00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>QuantumLeap</TableCell>
                <TableCell><Badge>Completed</Badge></TableCell>
                <TableCell>2024-07-24 13:30</TableCell>
                <TableCell className="text-right text-green-500">+$50.00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>StarlightDrift</TableCell>
                <TableCell><Badge variant="secondary">Active</Badge></TableCell>
                <TableCell>Ongoing</TableCell>
                <TableCell className="text-right text-green-500">+$12.34</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
