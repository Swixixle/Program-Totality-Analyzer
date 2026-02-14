import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthRow } from "@/lib/sovereigntyEngine";

interface FlightPlanTableProps {
  data: MonthRow[];
}

// Helper to aggregate monthly data into yearly summaries
function aggregateYears(monthlyData: MonthRow[]) {
  const years = [];
  for (let i = 0; i < 5; i++) {
    const startIdx = i * 12;
    const endIdx = startIdx + 12;
    const yearMonths = monthlyData.slice(startIdx, endIdx);
    
    if (yearMonths.length === 0) continue;

    // Sums
    const revenue = yearMonths.reduce((sum, m) => sum + m.revenue, 0);
    const draw = yearMonths.reduce((sum, m) => sum + m.personalDrawGross, 0);
    const savings = yearMonths.reduce((sum, m) => sum + m.personalSavingsDelta, 0);
    
    // End of year snapshot
    const totalSavings = yearMonths[yearMonths.length - 1].totalSavings;

    let phase = "Cold Build";
    if (i === 1) phase = "First Proof";
    if (i === 2) phase = "MVSR Entry";
    if (i === 3) phase = "Stability";
    if (i === 4) phase = "Home Buy";

    years.push({
      year: i + 1,
      phase,
      revenue,
      draw,
      savings,
      totalSavings
    });
  }
  return years;
}

export function FlightPlanTable({ data }: FlightPlanTableProps) {
  const yearlyData = aggregateYears(data);

  return (
    <Card className="border-border bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
          5-Year Sovereignty Curve Data
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-muted">
              <TableHead className="w-[80px] font-mono text-muted-foreground">Year</TableHead>
              <TableHead className="font-mono text-muted-foreground">Phase</TableHead>
              <TableHead className="text-right font-mono text-muted-foreground">Revenue</TableHead>
              <TableHead className="text-right font-mono text-muted-foreground">Draw (Gross)</TableHead>
              <TableHead className="text-right font-mono text-muted-foreground">Savings</TableHead>
              <TableHead className="text-right font-mono text-muted-foreground">Total Liquid</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {yearlyData.map((row) => (
              <TableRow key={row.year} className="hover:bg-muted/50 border-muted group transition-colors">
                <TableCell className="font-mono font-bold text-muted-foreground group-hover:text-foreground">
                  0{row.year}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs font-normal border-muted-foreground/30 text-foreground bg-secondary/50">
                    {row.phase}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground group-hover:text-amber-500 transition-colors">
                  ${row.revenue.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground group-hover:text-foreground">
                  ${row.draw.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground group-hover:text-emerald-500 transition-colors">
                  ${row.savings.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-foreground">
                  ${row.totalSavings.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
