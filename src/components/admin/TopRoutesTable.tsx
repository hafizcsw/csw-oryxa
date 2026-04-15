import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

interface TopRoute {
  route: string;
  pageviews: number;
}

interface TopRoutesTableProps {
  routes: TopRoute[];
  loading?: boolean;
}

export function TopRoutesTable({ routes, loading }: TopRoutesTableProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            أكثر الصفحات زيارة (آخر 24 ساعة)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
        </CardContent>
      </Card>
    );
  }

  if (!routes || routes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            أكثر الصفحات زيارة (آخر 24 ساعة)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">لا توجد بيانات</div>
        </CardContent>
      </Card>
    );
  }

  const maxViews = Math.max(...routes.map(r => r.pageviews));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          أكثر الصفحات زيارة (آخر 24 ساعة)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">#</TableHead>
              <TableHead className="text-right">المسار</TableHead>
              <TableHead className="text-right">المشاهدات</TableHead>
              <TableHead className="text-right">التوزيع</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.map((route, index) => {
              const percentage = (route.pageviews / maxViews) * 100;
              
              return (
                <TableRow key={index}>
                  <TableCell className="font-medium">
                    <Badge variant={index < 3 ? "default" : "secondary"}>
                      {index + 1}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {route.route || '/'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{route.pageviews}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-primary h-full rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
