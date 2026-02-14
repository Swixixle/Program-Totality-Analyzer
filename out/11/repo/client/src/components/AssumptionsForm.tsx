import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanInputs } from "@/lib/sovereigntyEngine";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface AssumptionsFormProps {
  inputs: PlanInputs;
  onChange: (newInputs: PlanInputs) => void;
}

export function AssumptionsForm({ inputs, onChange }: AssumptionsFormProps) {
  const handleChange = (field: keyof PlanInputs, value: number) => {
    onChange({
      ...inputs,
      [field]: value
    });
  };

  return (
    <Card className="h-full border-border bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
          Assumptions & Inputs
        </CardTitle>
        <RefreshCw className="w-4 h-4 text-muted-foreground opacity-50" />
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="homePrice" className="text-xs font-mono uppercase text-muted-foreground">Home Price ($)</Label>
            <Input 
              id="homePrice" 
              type="number" 
              value={inputs.homePrice} 
              onChange={(e) => handleChange('homePrice', Number(e.target.value))}
              className="font-mono bg-background/50 border-muted"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="downPaymentPct" className="text-xs font-mono uppercase text-muted-foreground">Down Payment (%)</Label>
            <Input 
              id="downPaymentPct" 
              type="number" 
              value={inputs.downPaymentPct} 
              onChange={(e) => handleChange('downPaymentPct', Number(e.target.value))}
              className="font-mono bg-background/50 border-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="startingSavings" className="text-xs font-mono uppercase text-muted-foreground">Starting Savings ($)</Label>
            <Input 
              id="startingSavings" 
              type="number" 
              value={inputs.startingSavings} 
              onChange={(e) => handleChange('startingSavings', Number(e.target.value))}
              className="font-mono bg-background/50 border-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="effectiveTaxRate" className="text-xs font-mono uppercase text-muted-foreground">Tax Rate (0-1)</Label>
            <Input 
              id="effectiveTaxRate" 
              type="number" 
              step="0.01"
              value={inputs.effectiveTaxRate} 
              onChange={(e) => handleChange('effectiveTaxRate', Number(e.target.value))}
              className="font-mono bg-background/50 border-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthlyPersonalExpenses" className="text-xs font-mono uppercase text-muted-foreground">Monthly Personal Burn ($)</Label>
            <Input 
              id="monthlyPersonalExpenses" 
              type="number" 
              value={inputs.monthlyPersonalExpenses} 
              onChange={(e) => handleChange('monthlyPersonalExpenses', Number(e.target.value))}
              className="font-mono bg-background/50 border-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="weeklyCompanyBudget" className="text-xs font-mono uppercase text-muted-foreground">Weekly Company Budget ($)</Label>
            <Input 
              id="weeklyCompanyBudget" 
              type="number" 
              value={inputs.weeklyCompanyBudget} 
              onChange={(e) => handleChange('weeklyCompanyBudget', Number(e.target.value))}
              className="font-mono bg-background/50 border-muted"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
