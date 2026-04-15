import { Card, CardContent } from "@/components/ui/card";

interface SectionShellProps {
  children: React.ReactNode;
}

/** Wrapper for tab content sections — provides consistent spacing */
export function SectionShell({ children }: SectionShellProps) {
  return <div className="space-y-4 mt-4">{children}</div>;
}

/** Empty state for sections with no data */
export function SectionEmpty({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
