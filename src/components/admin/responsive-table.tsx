import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveTable({ children, className }: ResponsiveTableProps) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <Table className={className}>
          {children}
        </Table>
      </div>
    </>
  );
}

interface OrganizationCardProps {
  organization: any;
  children: React.ReactNode;
}

export function OrganizationMobileCard({ organization, children }: OrganizationCardProps) {
  return (
    <Card className="md:hidden">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium font-headline text-foreground truncate">{organization.name}</h3>
              <p className="text-sm text-muted-foreground">{organization.location}</p>
            </div>
            <Badge 
              variant={
                organization.status === 'approved' ? 'default' : 
                organization.status === 'rejected' ? 'destructive' : 'secondary'
              }
              className="ml-2 flex-shrink-0"
            >
              {organization.status}
            </Badge>
          </div>
          <div className="flex justify-end">
            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface UserCardProps {
  user: any;
  children: React.ReactNode;
}

export function UserMobileCard({ user, children }: UserCardProps) {
  return (
    <Card className="md:hidden">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium font-headline text-foreground truncate">{user.name}</h3>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'}>
                  {user.role}
                </Badge>
                <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                  {user.status || 'active'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              Joined: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
            </p>
            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
