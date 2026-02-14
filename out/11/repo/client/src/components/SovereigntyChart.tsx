import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Area, AreaChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const data = [
  { year: 1, phase: "Cold Build", revenue: 30000, draw: 0, savings: 0, totalSavings: 15000 },
  { year: 2, phase: "First Proof", revenue: 100000, draw: 40000, savings: 0, totalSavings: 15000 },
  { year: 3, phase: "MVSR Entry", revenue: 184000, draw: 112000, savings: 45000, totalSavings: 60000 },
  { year: 4, phase: "Stability", revenue: 210000, draw: 130000, savings: 58000, totalSavings: 118000 },
  { year: 5, phase: "Home Buy", revenue: 250000, draw: 160000, savings: 82000, totalSavings: 200000 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border p-3 rounded-none shadow-xl">
        <p className="font-mono text-sm text-muted-foreground mb-2">Year {label}</p>
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

export function SovereigntyChart() {
  return (
    <Card className="h-full border-border bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
          Trajectory Visualization
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
            <XAxis 
              dataKey="year" 
              stroke="hsl(var(--muted-foreground))" 
              tick={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}
              tickFormatter={(value) => `Y${value}`}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))" 
              tick={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}
              tickFormatter={(value) => `$${value / 1000}k`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }} />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              name="Revenue"
              stroke="hsl(var(--chart-1))" 
              fillOpacity={1} 
              fill="url(#colorRevenue)" 
              strokeWidth={2}
            />
            <Area 
              type="monotone" 
              dataKey="totalSavings" 
              name="Total Savings"
              stroke="hsl(var(--chart-2))" 
              fillOpacity={1} 
              fill="url(#colorSavings)" 
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
