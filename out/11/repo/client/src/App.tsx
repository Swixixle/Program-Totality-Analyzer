import { useState, useEffect } from "react";
import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ConfigProvider, useReadOnlyMode } from "./lib/config";
import { AuthProvider, useAuth, apiGet } from "./lib/auth";
import { TutorialProvider, useTutorial } from "./lib/tutorial";
import { TutorialOverlay } from "./components/TutorialOverlay";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, LogOut, GraduationCap } from "lucide-react";
import ClaimSpace from "@/pages/claim-space";
import AnchorView from "@/pages/anchor-view";
import Constraints from "@/pages/constraints";
import Snapshots from "@/pages/snapshots";
import SnapshotDetail from "@/pages/snapshot-detail";
import Library from "@/pages/library";
import Cases from "@/pages/cases";
import Dashboard from "@/pages/dashboard";
import LanternCore from "@/pages/lantern-core";
import LanternExtract from "@/pages/lantern-extract";
import DossierEditor from "@/pages/dossier-editor";
import DossierReport from "@/pages/dossier-report";
import DossierComparison from "@/pages/dossier-comparison";
import HowItWorks from "@/pages/how-it-works";
import Intake from "@/pages/intake";
import AnchorBrowser from "@/pages/anchor-browser";
import EvidencePacket from "@/pages/evidence-packet";
import Ledger from "@/pages/ledger";
import Sources from "@/pages/sources";
import Review from "@/pages/review";
import AnchorProof from "@/pages/anchor-proof";
import ReviewBundle from "@/pages/review-bundle";
import ReviewAuditLines from "@/pages/review-audit-lines";
import VerifiedRecord from "@/pages/verified-record";
import IncidentReport from "@/pages/incident-report";
import NotFound from "@/pages/not-found";
import { Button } from "@/components/ui/button";
import { Menu, X, BookOpen, Home, FileSearch, GitCompare, FolderOpen, Layers, AlertTriangle, Camera, FileUp, ScrollText, Eye, FileText, Anchor } from "lucide-react";
import { useSearch } from "wouter";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, setApiKey, logout } = useAuth();
  const { isReadOnly, loading: configLoading } = useReadOnlyMode();
  const [keyInput, setKeyInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !autoLoginAttempted && !configLoading && !isReadOnly) {
      setAutoLoginAttempted(true);
      setAutoLoggingIn(true);
      fetch("/api/auth/demo-key")
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.key) {
            setApiKey(data.key);
          }
        })
        .catch(() => {})
        .finally(() => setAutoLoggingIn(false));
    }
  }, [isAuthenticated, autoLoginAttempted, configLoading, isReadOnly, setApiKey]);

  const handleDemoLogin = async () => {
    setAutoLoggingIn(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/demo-key");
      if (res.ok) {
        const data = await res.json();
        if (data.key) {
          setApiKey(data.key);
        }
      } else {
        setError("Demo login not available");
      }
    } catch {
      setError("Failed to connect");
    }
    setAutoLoggingIn(false);
  };

  if (configLoading || autoLoggingIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isReadOnly) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!keyInput.trim()) return;

      setChecking(true);
      setError(null);
      
      setApiKey(keyInput.trim());
      
      const result = await apiGet("/api/auth/status");
      
      if (!result.ok) {
        setApiKey(null);
        setError("Invalid API key");
        setChecking(false);
        return;
      }
      
      setChecking(false);
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Lantern</h1>
            <p className="text-muted-foreground mt-2">Enter your API key to access the platform</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="lantern-..."
                className="mt-1"
                data-testid="input-api-key"
                autoFocus
              />
            </div>
            
            {error && (
              <p className="text-sm text-red-500" data-testid="auth-error">{error}</p>
            )}
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={checking || !keyInput.trim()}
              data-testid="button-login"
            >
              {checking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Access Platform"
              )}
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>
            
            <Button 
              type="button"
              variant="outline"
              className="w-full" 
              onClick={handleDemoLogin}
              disabled={autoLoggingIn}
              data-testid="button-demo-login"
            >
              {autoLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading Demo...
                </>
              ) : (
                "Demo Login (Investor Preview)"
              )}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function LogoutButton() {
  const { isAuthenticated, logout } = useAuth();
  const { isReadOnly } = useReadOnlyMode();
  
  if (isReadOnly || !isAuthenticated) return null;
  
  return (
    <button
      onClick={logout}
      className="fixed top-4 left-4 z-50 p-2 bg-background/80 backdrop-blur border border-border/50 rounded-lg print:hidden flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      title="Logout"
      data-testid="button-logout"
    >
      <LogOut className="w-4 h-4" />
    </button>
  );
}

function TutorialButton() {
  const { isAuthenticated } = useAuth();
  const { isReadOnly } = useReadOnlyMode();
  const { startTutorial, hasCompletedTutorial, isActive } = useTutorial();
  
  useEffect(() => {
    if (isAuthenticated && !hasCompletedTutorial && !isActive) {
      const timer = setTimeout(() => {
        startTutorial();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, hasCompletedTutorial, isActive, startTutorial]);
  
  if (isReadOnly || !isAuthenticated || isActive) return null;
  
  return (
    <button
      onClick={startTutorial}
      className="fixed top-4 left-14 z-50 p-2 bg-background/80 backdrop-blur border border-border/50 rounded-lg print:hidden flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      title="Start Tutorial"
      data-testid="button-tutorial"
    >
      <GraduationCap className="w-4 h-4" />
    </button>
  );
}

function ReadOnlyNav({ corpusId }: { corpusId: string | null }) {
  if (!corpusId) return null;
  
  return (
    <nav 
      className="fixed top-10 left-0 right-0 z-30 bg-background/95 backdrop-blur border-b border-border py-2 px-4 print:hidden"
      data-testid="readonly-nav"
    >
      <div className="max-w-4xl mx-auto flex items-center gap-4 text-sm">
        <Link href={`/?corpusId=${corpusId}`}>
          <Button variant="ghost" size="sm" className="text-xs">
            <Layers className="w-3 h-3 mr-1" />
            Claim Space
          </Button>
        </Link>
        <Link href={`/sources?corpusId=${corpusId}`}>
          <Button variant="ghost" size="sm" className="text-xs">
            <FileText className="w-3 h-3 mr-1" />
            Sources
          </Button>
        </Link>
        <Link href={`/anchors/browse?corpusId=${corpusId}`}>
          <Button variant="ghost" size="sm" className="text-xs">
            <Anchor className="w-3 h-3 mr-1" />
            Anchors
          </Button>
        </Link>
        <Link href={`/ledger?corpusId=${corpusId}`}>
          <Button variant="ghost" size="sm" className="text-xs">
            <ScrollText className="w-3 h-3 mr-1" />
            Ledger
          </Button>
        </Link>
        <Link href={`/snapshots?corpusId=${corpusId}`}>
          <Button variant="ghost" size="sm" className="text-xs">
            <Camera className="w-3 h-3 mr-1" />
            Snapshots
          </Button>
        </Link>
      </div>
    </nav>
  );
}

function Router() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isReadOnly } = useReadOnlyMode();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const corpusIdFromQuery = params.get("corpusId");

  return (
    <div className="relative">
      {/* v1.11 Review Mode Banner */}
      {isReadOnly && (
        <div 
          className="fixed top-0 left-0 right-0 z-40 bg-amber-600 text-white text-center py-2 px-4 font-medium print:hidden"
          data-testid="banner-review-mode"
        >
          <Eye className="w-4 h-4 inline-block mr-2" />
          Review Mode (Read-Only)
        </div>
      )}
      
      {/* v1.12 Read-Only Navigation */}
      {isReadOnly && <ReadOnlyNav corpusId={corpusIdFromQuery} />}
      
      {/* Hamburger Menu Button - hidden in read-only mode */}
      {!isReadOnly && (
        <button 
          onClick={() => setMenuOpen(!menuOpen)}
          className="fixed top-4 right-4 z-50 p-2 bg-background/80 backdrop-blur border border-border/50 rounded-lg print:hidden"
          aria-label="Menu"
          data-testid="button-menu"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      )}

      {/* Menu Panel - hidden in read-only mode */}
      {menuOpen && !isReadOnly && (
        <div className="fixed top-16 right-4 z-50 bg-background border border-border rounded-lg shadow-lg p-2 min-w-[200px] print:hidden">
          <nav className="flex flex-col gap-1">
            <Link href="/intake" onClick={() => setMenuOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full justify-start text-sm">
                <FileUp className="w-4 h-4 mr-2" />
                Corpus Intake
              </Button>
            </Link>
            <Link href="/" onClick={() => setMenuOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full justify-start text-sm">
                <Layers className="w-4 h-4 mr-2" />
                Claim Space
              </Button>
            </Link>
            <Link href="/constraints" onClick={() => setMenuOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full justify-start text-sm">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Constraints & Friction
              </Button>
            </Link>
            <Link href="/snapshots" onClick={() => setMenuOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full justify-start text-sm">
                <Camera className="w-4 h-4 mr-2" />
                Snapshot & Export
              </Button>
            </Link>
            <Link href="/ledger" onClick={() => setMenuOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full justify-start text-sm">
                <ScrollText className="w-4 h-4 mr-2" />
                Revision Ledger
              </Button>
            </Link>
            <Link href="/library" onClick={() => setMenuOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full justify-start text-sm">
                <Home className="w-4 h-4 mr-2" />
                Library
              </Button>
            </Link>
            <Link href="/extract" onClick={() => setMenuOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full justify-start text-sm">
                <FileSearch className="w-4 h-4 mr-2" />
                Extract
              </Button>
            </Link>
            <Link href="/compare" onClick={() => setMenuOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full justify-start text-sm">
                <GitCompare className="w-4 h-4 mr-2" />
                Compare
              </Button>
            </Link>
            <Link href="/cases" onClick={() => setMenuOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full justify-start text-sm">
                <FolderOpen className="w-4 h-4 mr-2" />
                Cases
              </Button>
            </Link>
            <div className="border-t border-border my-1" />
            <Link href="/reference" onClick={() => setMenuOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full justify-start text-sm text-muted-foreground">
                <BookOpen className="w-4 h-4 mr-2" />
                How Lantern Works
              </Button>
            </Link>
          </nav>
        </div>
      )}

      <Switch>
        <Route path="/review/:corpusId/bundle" component={ReviewBundle} />
        <Route path="/review/:corpusId/audit_lines" component={ReviewAuditLines} />
        <Route path="/review/:corpusId" component={Review} />
        <Route path="/intake" component={Intake} />
        <Route path="/" component={ClaimSpace} />
        <Route path="/sources" component={Sources} />
        <Route path="/anchors/browse" component={AnchorBrowser} />
        <Route path="/packets/:packetId" component={EvidencePacket} />
        <Route path="/ledger" component={Ledger} />
        <Route path="/anchors" component={AnchorView} />
        <Route path="/anchors/proof" component={AnchorProof} />
        <Route path="/constraints" component={Constraints} />
        <Route path="/snapshots" component={Snapshots} />
        <Route path="/snapshots/:snapshot_id" component={SnapshotDetail} />
        <Route path="/verified-record" component={VerifiedRecord} />
        <Route path="/incident-report" component={IncidentReport} />
        <Route path="/incident-report/:reportId" component={IncidentReport} />
        <Route path="/library" component={Library} />
        <Route path="/extract" component={LanternExtract} />
        <Route path="/dossier/:id" component={DossierEditor} />
        <Route path="/dossier/:id/report" component={DossierReport} />
        <Route path="/compare" component={DossierComparison} />
        <Route path="/cases" component={Cases} />
        <Route path="/reference" component={HowItWorks} />
        <Route path="/legacy" component={Dashboard} />
        <Route path="/legacy/core" component={LanternCore} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider>
        <AuthProvider>
          <TutorialProvider>
            <Toaster />
            <AuthGate>
              <LogoutButton />
              <TutorialButton />
              <TutorialOverlay />
              <Router />
            </AuthGate>
          </TutorialProvider>
        </AuthProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default App;
