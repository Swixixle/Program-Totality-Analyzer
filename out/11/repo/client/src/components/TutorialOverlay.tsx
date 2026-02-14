import { useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useTutorial, getStepRoute } from "@/lib/tutorial";
import { ChevronLeft, ChevronRight, X, GraduationCap } from "lucide-react";

const DEFAULT_CORPUS_ID = "corpus-demo-001";

export function TutorialOverlay() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const {
    isActive,
    currentStep,
    currentStepData,
    nextStep,
    prevStep,
    skipTutorial,
    totalSteps,
  } = useTutorial();

  const corpusId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get("corpusId") || DEFAULT_CORPUS_ID;
  }, [searchString]);

  useEffect(() => {
    if (isActive && currentStepData?.route) {
      const resolvedRoute = getStepRoute(currentStepData, corpusId);
      if (resolvedRoute) {
        navigate(resolvedRoute);
      }
    }
  }, [isActive, currentStepData, corpusId, navigate]);

  if (!isActive || !currentStepData) return null;

  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 z-[100] animate-in fade-in duration-200"
        data-testid="tutorial-backdrop"
      />
      
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <Card 
          className="w-full max-w-md shadow-2xl border-primary/20 animate-in zoom-in-95 duration-200"
          data-testid="tutorial-card"
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-lg">{currentStepData.title}</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={skipTutorial}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                data-testid="tutorial-skip"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {currentStepData.description}
            </p>
          </CardContent>
          
          <CardFooter className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">
              Step {currentStep + 1} of {totalSteps}
            </div>
            
            <div className="flex gap-2">
              {!isFirst && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevStep}
                  data-testid="tutorial-prev"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              )}
              
              <Button
                size="sm"
                onClick={nextStep}
                className="bg-primary hover:bg-primary/90"
                data-testid="tutorial-next"
              >
                {isLast ? (
                  "Finish"
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </CardFooter>
          
          <div className="px-6 pb-4">
            <div className="flex gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= currentStep ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
