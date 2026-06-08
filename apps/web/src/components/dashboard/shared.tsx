import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LucideIcon } from "lucide-react";

type TableRowData = Record<string, unknown>;

export function MetricCard({ icon: Icon, label, value }: { icon: LucideIcon, label: string, value: string | number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export function DataTableCard({ title, icon: Icon, columns, rows, emptyText }: {
  title: string;
  icon: LucideIcon;
  columns: [string, string][];
  rows: TableRowData[];
  emptyText?: string;
}) {
  return (
    <Card className="col-span-1">
      <CardHeader className="flex flex-row items-center gap-2">
        <Icon className="h-5 w-5" />
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText || "No data available."}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(([key, label]) => <TableHead key={key}>{label}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={String(row.id ?? index)}>
                  {columns.map(([key]) => (
                    <TableCell key={key}>
                      {String(getNestedValue(row, key) ?? "-")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function getNestedValue(row: TableRowData, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as TableRowData)[key];
  }, row);
}
