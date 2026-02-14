import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { FlightPlanTable } from "@/components/FlightPlanTable";
import { SavingsChart } from "@/components/SavingsChart";
import { CashflowChart } from "@/components/CashflowChart";
import { GapChart } from "@/components/GapChart";
import { Stage1Checklist } from "@/components/Stage1Checklist";
import { AssumptionsForm } from "@/components/AssumptionsForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpRight, ShieldCheck, Target, TrendingUp, Settings2, LayoutDashboard, GitCompare } from "lucide-react";
import generatedTexture from "@assets/generated_images/subtle_dark_technical_grid_pattern_texture.png";
import { runSovereigntyPlan, PlanInputs } from "@/lib/sovereigntyEngine";
import { buildColdStartRevenueRamp, buildDrawRamp } from "@/lib/defaultRamps";

export default function Dashboard() {
  // Initial Plan State
  const [inputs, setInputs] = useState<PlanInputs>({
    homePrice: 350000,
    downPaymentPct: 60, // UI shows 60, engine expects normalized or handles it? Let's check engine.
                        // Engine: inputs.homePrice * (inputs.downPaymentPct / 100); 
                        // So we store as whole number 60.
    startingSavings: 15000,
    monthlyPersonalExpenses: 3500,
    weeklyCompanyBudget: 1000,
    effectiveTaxRate: 0.25,
    revenueByMonth: buildColdStartRevenueRamp(),
    personalDrawGrossByMonth: buildDrawRamp(),
  });

  // Derived Data
  const data = useMemo(() => runSovereigntyPlan(inputs), [inputs]);

  // Current Stats (Year 1 Month 1 or current projection?)
  // Let's take the last month of Year 1 as "Current Projection" or just the first month?
  // Spec says: "Top KPIs: current savings, target savings, gap, monthly burn, runway months"
  // Let's use the first month for "Current" or maybe Month 12 for "Year 1 Projection".
  // Let's use Month 12 (index 11) for the metrics to show where we aim to be in Y1.
  const currentMetric = data[11]; // End of Year 1
  const latestMetric = data[0]; // Start of Year 1 (Current Reality)

  const finalMetric = data[data.length - 1]; // End of Year 5

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden font-sans selection:bg-amber-500/30">
      {/* Background Texture Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-0 mix-blend-overlay"
        style={{ backgroundImage: `url(${generatedTexture})`, backgroundSize: 'cover' }}
      />

      <div className="relative z-10 max-w-7xl mx-auto p-6 md:p-8 lg:p-12 space-y-8">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-8">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-mono font-bold tracking-tighter text-foreground">
              LANTERN
            </h1>
            <p className="text-muted-foreground font-mono uppercase tracking-widest text-sm">
              Sovereignty Navigation System v1.0
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="text-xs font-mono text-muted-foreground uppercase">Current Phase</div>
            <div className="text-xl font-bold text-amber-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              COLD BUILD (Y1)
            </div>
            <Link href="/compare">
                <Button variant="secondary" size="sm" className="mt-2 text-xs font-mono uppercase">
                    <GitCompare className="w-3 h-3 mr-2" /> Compare Dossiers
                </Button>
            </Link>
          </div>
        </header>

        <Tabs defaultValue="dashboard" className="w-full space-y-8">
          <TabsList className="bg-muted/50 border border-border p-1">
            <TabsTrigger value="dashboard" className="gap-2 font-mono uppercase text-xs">
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="inputs" className="gap-2 font-mono uppercase text-xs">
              <Settings2 className="w-4 h-4" /> Plan Inputs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {/* Top Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard 
                label="Target Savings" 
                value={`$${currentMetric.targetDownPayment.toLocaleString()}`}
                subValue={`For ${inputs.homePrice.toLocaleString()} Home`}
                icon={<Target className="w-4 h-4 text-muted-foreground" />}
              />
              <MetricCard 
                label="Gap Remaining" 
                value={`$${latestMetric.gapRemaining.toLocaleString()}`}
                subValue="To Target"
                icon={<TrendingUp className="w-4 h-4 text-amber-500" />}
              />
              <MetricCard 
                label="Current Liquid" 
                value={`$${latestMetric.totalSavings.toLocaleString()}`}
                subValue="Starting Capital"
                icon={<ShieldCheck className="w-4 h-4 text-emerald-500" />}
              />
              <MetricCard 
                label="Monthly Burn" 
                value={`$${(currentMetric.companyCosts + currentMetric.personalExpenses).toLocaleString()}`}
                subValue="Personal + Company"
                icon={<ArrowUpRight className="w-4 h-4 text-destructive" />}
              />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-[350px]">
                  <SavingsChart data={data} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[300px]">
                  <CashflowChart data={data} />
                  <GapChart data={data} />
                </div>
              </div>
              <div className="lg:col-span-1 space-y-6">
                <div className="h-full">
                  <Stage1Checklist />
                </div>
              </div>
            </div>

            {/* Data Table */}
            <div className="w-full">
              <FlightPlanTable data={data} />
            </div>
          </TabsContent>

          <TabsContent value="inputs" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AssumptionsForm inputs={inputs} onChange={setInputs} />
          </TabsContent>
        </Tabs>

        {/* Footer / Manifesto Quote */}
        <footer className="pt-12 pb-6 text-center border-t border-border mt-12">
          <p className="font-mono text-xs text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            "By anchoring to the home, we have turned a five-year window into a series of achievable, math-driven waypoints."
          </p>
        </footer>
      </div>
    </div>
  );
}

function MetricCard({ label, value, subValue, icon }: { label: string, value: string, subValue: string, icon: React.ReactNode }) {
  return (
    <Card className="bg-card/50 border-border backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-mono tracking-tight">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
      </CardContent>
    </Card>
  );
}
