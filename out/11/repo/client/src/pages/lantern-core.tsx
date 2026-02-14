import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FileJson, FileText, Download, Scissors, RefreshCw, ChevronRight } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// Types
interface LanternReceipt {
  id: string;
  timestamp: string;
  sourceUrl: string;
  sourceTitle: string;
  selectedClaim: string;
  context: string;
  tags: string[];
}

export default function LanternCore() {
  const [step, setStep] = useState<"input" | "select" | "export">("input");
  const [rawText, setRawText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [selectedClaim, setSelectedClaim] = useState("");
  const [tags, setTags] = useState<string>("");
  
  const receiptRef = useRef<HTMLDivElement>(null);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      setSelectedClaim(selection.toString());
    }
  };

  const generateReceipt = () => {
    if (!selectedClaim) return;
    setStep("export");
  };

  const downloadPDF = async () => {
    if (!receiptRef.current) return;
    
    const canvas = await html2canvas(receiptRef.current, {
      scale: 2,
      backgroundColor: "#09090b", // Matches theme background
      logging: false,
    });
    
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: [canvas.width, canvas.height]
    });
    
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save(`lantern-receipt-${Date.now()}.pdf`);
  };

  const downloadJSON = () => {
    const data: LanternReceipt = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      sourceUrl,
      sourceTitle,
      selectedClaim,
      context: rawText.substring(0, 200) + "...", // Snippet of context
      tags: tags.split(",").map(t => t.trim()).filter(Boolean)
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lantern-receipt-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const reset = () => {
    setStep("input");
    setRawText("");
    setSelectedClaim("");
    setTags("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-12 font-sans selection:bg-amber-500/30">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="border-b border-border pb-6 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-mono font-bold tracking-tight">LANTERN<span className="text-amber-500">_CORE</span></h1>
            <p className="text-sm font-mono text-muted-foreground uppercase tracking-widest mt-2">
              Claim Extraction & Receipt Generator
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={reset} className="font-mono text-xs uppercase text-muted-foreground hover:text-foreground">
            <RefreshCw className="w-3 h-3 mr-2" /> Reset
          </Button>
        </header>

        <div className="grid grid-cols-1 gap-8">
          {/* Progress Indicator */}
          <div className="flex items-center gap-4 text-sm font-mono uppercase text-muted-foreground">
            <span className={step === "input" ? "text-foreground font-bold" : ""}>1. Input</span>
            <ChevronRight className="w-4 h-4" />
            <span className={step === "select" ? "text-foreground font-bold" : ""}>2. Select</span>
            <ChevronRight className="w-4 h-4" />
            <span className={step === "export" ? "text-foreground font-bold" : ""}>3. Export</span>
          </div>

          {/* STEP 1: INPUT */}
          {step === "input" && (
            <Card className="border-border bg-card/50 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2">
              <CardHeader>
                <CardTitle className="font-mono text-lg">Source Material</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">Source Title</Label>
                    <Input 
                      placeholder="e.g. The Future of Sovereignty" 
                      className="font-mono bg-background/50"
                      value={sourceTitle}
                      onChange={(e) => setSourceTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">Source URL (Optional)</Label>
                    <Input 
                      placeholder="https://..." 
                      className="font-mono bg-background/50"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Raw Text Content</Label>
                  <Textarea 
                    placeholder="Paste article text here..." 
                    className="min-h-[300px] font-mono text-sm bg-background/50 resize-y"
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter className="justify-end">
                <Button 
                  disabled={!rawText} 
                  onClick={() => setStep("select")}
                  className="font-mono uppercase"
                >
                  Next: Select Claim <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* STEP 2: SELECT */}
          {step === "select" && (
            <Card className="border-border bg-card/50 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2">
              <CardHeader>
                <CardTitle className="font-mono text-lg">Extract Claim</CardTitle>
                <p className="text-sm text-muted-foreground">Highlight the specific text you want to convert into a receipt.</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">Raw Text (Select Here)</Label>
                    <ScrollArea className="h-[400px] rounded-md border border-muted bg-background/50 p-4">
                      <div 
                        onMouseUp={handleTextSelection} 
                        className="font-mono text-sm whitespace-pre-wrap leading-relaxed cursor-text selection:bg-amber-500/50 selection:text-white"
                      >
                        {rawText}
                      </div>
                    </ScrollArea>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase text-amber-500">Selected Claim</Label>
                      <div className="p-4 rounded-md border border-amber-500/30 bg-amber-500/5 min-h-[150px] font-mono text-sm italic relative">
                        {selectedClaim || <span className="text-muted-foreground not-italic opacity-50">Highlight text on the left to select...</span>}
                        {selectedClaim && <Scissors className="absolute bottom-2 right-2 w-4 h-4 text-amber-500 opacity-50" />}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">Tags (Comma Separated)</Label>
                      <Input 
                        placeholder="e.g. economy, prediction, 2026" 
                        className="font-mono bg-background/50"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                      />
                    </div>

                    <div className="pt-4">
                      <Button 
                        disabled={!selectedClaim} 
                        onClick={generateReceipt} 
                        className="w-full font-mono uppercase bg-amber-500 text-black hover:bg-amber-400"
                      >
                        Generate Receipt
                      </Button>
                      <Button 
                        variant="ghost" 
                        onClick={() => setStep("input")} 
                        className="w-full mt-2 font-mono uppercase text-xs text-muted-foreground"
                      >
                        Back to Input
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 3: EXPORT */}
          {step === "export" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex flex-col justify-center space-y-6 order-2 lg:order-1">
                <Card className="border-border bg-card/50">
                  <CardHeader>
                    <CardTitle className="font-mono text-lg">Export Options</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button onClick={downloadJSON} variant="outline" className="w-full justify-start font-mono h-12">
                      <FileJson className="w-4 h-4 mr-3 text-emerald-500" /> 
                      Download JSON (Data)
                    </Button>
                    <Button onClick={downloadPDF} variant="outline" className="w-full justify-start font-mono h-12">
                      <FileText className="w-4 h-4 mr-3 text-amber-500" /> 
                      Download PDF (Receipt)
                    </Button>
                  </CardContent>
                  <CardFooter>
                    <Button onClick={() => setStep("select")} variant="ghost" className="w-full font-mono uppercase text-xs">
                      Back to Selection
                    </Button>
                  </CardFooter>
                </Card>
              </div>

              <div className="flex justify-center order-1 lg:order-2">
                {/* RECEIPT PREVIEW */}
                <div 
                  ref={receiptRef}
                  className="w-full max-w-md bg-zinc-950 border border-zinc-800 p-8 shadow-2xl relative overflow-hidden"
                  style={{ minHeight: '600px' }}
                >
                  {/* Receipt Holes */}
                  <div className="absolute top-0 left-0 right-0 flex justify-between px-2 -mt-2">
                    {[...Array(12)].map((_, i) => (
                      <div key={i} className="w-3 h-3 rounded-full bg-background" />
                    ))}
                  </div>

                  {/* Header */}
                  <div className="border-b-2 border-zinc-800 pb-6 mb-6 text-center space-y-2">
                    <h2 className="font-mono text-2xl font-bold tracking-tighter text-white">LANTERN<span className="text-amber-500">_CORE</span></h2>
                    <p className="font-mono text-xs text-zinc-500 uppercase tracking-widest">Digital Claim Verification</p>
                    <div className="font-mono text-[10px] text-zinc-600 mt-2">{new Date().toISOString()}</div>
                  </div>

                  {/* Claim Content */}
                  <div className="space-y-8 mb-12">
                    <div className="space-y-2">
                      <p className="font-mono text-[10px] uppercase text-zinc-500">Origin / Source</p>
                      <p className="font-mono text-sm text-zinc-300 break-words">{sourceTitle || "Untitled Source"}</p>
                      {sourceUrl && <p className="font-mono text-[10px] text-zinc-600 truncate">{sourceUrl}</p>}
                    </div>

                    <div className="space-y-2">
                      <p className="font-mono text-[10px] uppercase text-amber-500">Extracted Claim</p>
                      <div className="border-l-2 border-amber-500 pl-4 py-1">
                        <p className="font-mono text-lg text-white leading-relaxed">
                          "{selectedClaim}"
                        </p>
                      </div>
                    </div>

                    {tags && (
                      <div className="space-y-2">
                        <p className="font-mono text-[10px] uppercase text-zinc-500">Meta Tags</p>
                        <div className="flex flex-wrap gap-2">
                          {tags.split(",").map((tag, i) => (
                            <span key={i} className="px-2 py-1 bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400 uppercase rounded-sm">
                              #{tag.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer / ID */}
                  <div className="absolute bottom-8 left-8 right-8 border-t border-dashed border-zinc-800 pt-4">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="font-mono text-[10px] text-zinc-600 uppercase">Receipt ID</p>
                        <p className="font-mono text-xs text-zinc-400">{crypto.randomUUID().split('-')[0].toUpperCase()}</p>
                      </div>
                      <div className="text-right">
                         <p className="font-mono text-[10px] text-zinc-600 uppercase">Hash</p>
                         <div className="w-16 h-16 bg-white p-1 ml-auto mt-1">
                           {/* Placeholder for QR/Barcode */}
                           <div className="w-full h-full bg-black" /> 
                         </div>
                      </div>
                    </div>
                    <p className="mt-6 text-center font-mono text-[8px] text-zinc-700 uppercase">
                      Generated by Lantern Core System
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
