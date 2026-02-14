import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthRow } from "@/lib/sovereigntyEngine";

interface SavingsChartProps {
  data: MonthRow[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border p-3 rounded-none shadow-xl">
        <p className="font-mono text-sm text-muted-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2" style={{ backgroundColor: entry.color }} />
            <span className="font-mono text-xs uppercase text-muted-foreground">
              {entry.name}:
            </span>
            <span className="font-mono text-sm font-bold text-foreground">
              ${entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function SavingsChart({ data }: SavingsChartProps) {
  const targetDownPayment = data[0]?.targetDownPayment || 0;

  return (
    <Card className="h-full border-border bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
          Savings Trajectory (60 Months)
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
            <XAxis 
              dataKey="label" 
              stroke="hsl(var(--muted-foreground))" 
              tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
              interval={5}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))" 
              tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
              tickFormatter={(value) => `$${value / 1000}k`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }} />
            
            <ReferenceLine y={targetDownPayment} stroke="hsl(var(--chart-1))" strokeDasharray="3 3" label={{ position: 'right', value: 'Target', fill: 'hsl(var(--chart-1))', fontSize: 10 }} />
            
            <Line 
              type="monotone" 
              dataKey="totalSavings" 
              name="Total Savings"
              stroke="hsl(var(--chart-2))" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
