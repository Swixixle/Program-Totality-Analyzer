import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthRow } from "@/lib/sovereigntyEngine";

interface CashflowChartProps {
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

export function CashflowChart({ data }: CashflowChartProps) {
  return (
    <Card className="h-full border-border bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
          Cashflow Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
            <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }} />
            
            <Line 
              type="monotone" 
              dataKey="revenue" 
              name="Revenue"
              stroke="hsl(var(--chart-1))" 
              strokeWidth={2}
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="companyCosts" 
              name="Co. Costs"
              stroke="hsl(var(--destructive))" 
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="personalDrawGross" 
              name="Personal Draw"
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
