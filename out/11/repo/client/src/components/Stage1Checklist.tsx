import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Unlock, CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const STAGE_1_ITEMS = [
  { id: 1, label: "Define the Instrument Core", completed: true },
  { id: 2, label: "Setup Solo Environment", completed: true },
  { id: 3, label: "Establish Revenue Pipeline", completed: false },
  { id: 4, label: "First Working Session", completed: false },
  { id: 5, label: "Validate 'Cold Build' Metrics", completed: false },
];

export function Stage1Checklist() {
  const [isLocked, setIsLocked] = useState(true);
  const [items, setItems] = useState(STAGE_1_ITEMS);

  useEffect(() => {
    const unlocked = localStorage.getItem("stage1_unlocked") === "true";
    if (unlocked) setIsLocked(false);
    
    const savedItems = localStorage.getItem("stage1_items");
    if (savedItems) {
      try {
        setItems(JSON.parse(savedItems));
      } catch (e) {
        console.error("Failed to parse saved checklist items", e);
      }
    }
  }, []);

  const handleUnlock = () => {
    setIsLocked(false);
    localStorage.setItem("stage1_unlocked", "true");
  };

  const toggleItem = (id: number) => {
    const newItems = items.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setItems(newItems);
    localStorage.setItem("stage1_items", JSON.stringify(newItems));
  };

  return (
    <Card className="h-full border-border bg-card/50 backdrop-blur-sm relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
          Stage 1: First Working Instrument
        </CardTitle>
        {isLocked ? (
          <Lock className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Unlock className="w-4 h-4 text-emerald-500" />
        )}
      </CardHeader>
      
      <CardContent className="relative z-10">
        <AnimatePresence mode="wait">
          {isLocked ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12 space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 border border-muted-foreground/20">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="font-mono text-sm text-center text-muted-foreground max-w-[250px]">
                "The gate is locked. You cannot reach Year 3 without a working Stage 1 instrument."
              </p>
              <Button 
                variant="outline" 
                className="mt-4 border-amber-500/50 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400 font-mono text-xs uppercase tracking-wider"
                onClick={handleUnlock}
              >
                Access Checklist
              </Button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground mb-6">
                Executing the move from "frozen document" to "functioning engine".
              </p>
              <div className="space-y-2">
                {items.map((item) => (
                  <div 
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-md border transition-all cursor-pointer group",
                      item.completed 
                        ? "bg-emerald-500/10 border-emerald-500/20" 
                        : "bg-background border-muted hover:border-muted-foreground/50"
                    )}
                    onClick={() => toggleItem(item.id)}
                  >
                    {item.completed ? (
                      <CheckSquare className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Square className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
                    )}
                    <span className={cn(
                      "font-mono text-sm",
                      item.completed ? "text-emerald-500 line-through opacity-70" : "text-foreground"
                    )}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>

      {/* Background Pattern for locked state */}
      {isLocked && (
        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.2)_10px,rgba(0,0,0,0.2)_20px)] pointer-events-none" />
      )}
    </Card>
  );
}
