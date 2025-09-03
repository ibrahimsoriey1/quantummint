import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { CreditCard, Banknote } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-4">
       <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="payments">Payment Methods</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Manage your personal information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" defaultValue="John Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue="john.doe@example.com" />
              </div>
            </CardContent>
            <CardFooter>
              <Button>Save Changes</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Enhance your account's security.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="flex items-center justify-between space-x-4 rounded-md border p-4">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      Two-Factor Authentication (2FA)
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Add an extra layer of security to your account.
                    </p>
                  </div>
                  <Switch id="2fa-switch" />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Change Password</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input id="current-password" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input id="new-password" type="password" />
                  </div>
                </CardContent>
                 <CardFooter>
                    <Button>Update Password</Button>
                 </CardFooter>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Manage your connected payment methods for deposits and cashouts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-md border p-4">
                    <div className="flex items-center gap-4">
                        <CreditCard className="w-8 h-8 text-muted-foreground" />
                        <div>
                            <p className="font-medium">Visa **** 4242</p>
                            <p className="text-sm text-muted-foreground">Expires 12/2028</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm">Remove</Button>
                </div>
                 <div className="flex items-center justify-between rounded-md border p-4">
                    <div className="flex items-center gap-4">
                        <Banknote className="w-8 h-8 text-muted-foreground" />
                        <div>
                            <p className="font-medium">Chase Bank **** 6789</p>
                            <p className="text-sm text-muted-foreground">Checking Account</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm">Remove</Button>
                </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline">Add New Method</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
