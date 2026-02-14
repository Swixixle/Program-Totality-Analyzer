import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuditBanner } from "@/components/audit-banner";
import Verify from "@/pages/verify";
import Lantern from "@/pages/lantern";
import Receipts from "@/pages/receipts";
import ReceiptDetail from "@/pages/receipt-detail";
import Compare from "@/pages/compare";
import Sensors from "@/pages/sensors";
import Governance from "@/pages/governance";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Verify} />
      <Route path="/verify" component={Verify} />
      <Route path="/lantern" component={Lantern} />
      <Route path="/receipts" component={Receipts} />
      <Route path="/receipts/:receiptId" component={ReceiptDetail} />
      <Route path="/receipt-viewer" component={ReceiptDetail} />
      <Route path="/sensors" component={Sensors} />
      <Route path="/receipts/:receiptId/sensors" component={Sensors} />
      <Route path="/compare" component={Compare} />
      <Route path="/governance" component={Governance} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <AuditBanner />
              <header className="flex items-center gap-2 p-2 border-b shrink-0">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
              </header>
              <main className="flex-1 overflow-auto">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
