import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthRow } from "@/lib/sovereigntyEngine";

interface GapChartProps {
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

export function GapChart({ data }: GapChartProps) {
  return (
    <Card className="h-full border-border bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
          Gap Remaining
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorGap" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0}/>
              </linearGradient>
            </defs>
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
            
            <Area 
              type="monotone" 
              dataKey="gapRemaining" 
              name="Gap Remaining"
              stroke="hsl(var(--chart-4))" 
              fillOpacity={1} 
              fill="url(#colorGap)" 
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
