import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

const TUTORIAL_STORAGE_KEY = "lantern_tutorial_completed";
const TUTORIAL_STEP_KEY = "lantern_tutorial_step";

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  route?: string;
  position?: "center";
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Lantern",
    description: "Lantern is an investigative intelligence platform for managing claims and evidence. Let's take a quick tour of the key features.",
    position: "center",
  },
  {
    id: "claim_space",
    title: "Claim Space",
    description: "This is where you view and manage claims. Claims are categorized as Defensible (supported by evidence), Restricted (not supported), or Ambiguous (unclear).",
    route: "/?corpusId={corpusId}",
    position: "center",
  },
  {
    id: "sources",
    title: "Sources",
    description: "The Sources page shows all documents uploaded to a corpus. Each source has a cryptographic hash for verification.",
    route: "/sources?corpusId={corpusId}",
    position: "center",
  },
  {
    id: "anchors",
    title: "Evidence Anchors",
    description: "Anchors are verbatim quotes extracted from source documents. They provide the evidence foundation for claims with exact byte-level provenance.",
    route: "/anchors/browse?corpusId={corpusId}",
    position: "center",
  },
  {
    id: "ledger",
    title: "Revision Ledger",
    description: "The ledger is an append-only audit trail. Every corpus action is recorded with cryptographic hashes for verification.",
    route: "/ledger?corpusId={corpusId}",
    position: "center",
  },
  {
    id: "snapshots",
    title: "Snapshots",
    description: "Snapshots capture the complete corpus state at a point in time. They enable reproducible exports and verification.",
    route: "/snapshots?corpusId={corpusId}",
    position: "center",
  },
  {
    id: "complete",
    title: "You're Ready!",
    description: "You now know the core features of Lantern. Use the menu (top-right) to navigate between views. You can restart this tutorial anytime from the menu.",
    position: "center",
  },
];

export function getStepRoute(step: TutorialStep, corpusId: string): string | undefined {
  if (!step.route) return undefined;
  return step.route.replace("{corpusId}", corpusId);
}

interface TutorialContextValue {
  isActive: boolean;
  currentStep: number;
  currentStepData: TutorialStep | null;
  startTutorial: () => void;
  endTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  hasCompletedTutorial: boolean;
  totalSteps: number;
}

const TutorialContext = createContext<TutorialContextValue>({
  isActive: false,
  currentStep: 0,
  currentStepData: null,
  startTutorial: () => {},
  endTutorial: () => {},
  nextStep: () => {},
  prevStep: () => {},
  skipTutorial: () => {},
  hasCompletedTutorial: false,
  totalSteps: TUTORIAL_STEPS.length,
});

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(() => {
    const savedStep = localStorage.getItem(TUTORIAL_STEP_KEY);
    return savedStep !== null;
  });
  const [currentStep, setCurrentStep] = useState(() => {
    const savedStep = localStorage.getItem(TUTORIAL_STEP_KEY);
    return savedStep !== null ? parseInt(savedStep, 10) : 0;
  });
  const [hasCompletedTutorial, setHasCompletedTutorial] = useState(() => {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === "true";
  });

  const currentStepData = isActive ? TUTORIAL_STEPS[currentStep] || null : null;

  const startTutorial = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
    localStorage.setItem(TUTORIAL_STEP_KEY, "0");
  }, []);

  const endTutorial = useCallback(() => {
    setIsActive(false);
    setHasCompletedTutorial(true);
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
    localStorage.removeItem(TUTORIAL_STEP_KEY);
  }, []);

  const skipTutorial = useCallback(() => {
    setIsActive(false);
    setHasCompletedTutorial(true);
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
    localStorage.removeItem(TUTORIAL_STEP_KEY);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      localStorage.setItem(TUTORIAL_STEP_KEY, String(next));
    } else {
      endTutorial();
    }
  }, [currentStep, endTutorial]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      localStorage.setItem(TUTORIAL_STEP_KEY, String(prev));
    }
  }, [currentStep]);

  return (
    <TutorialContext.Provider
      value={{
        isActive,
        currentStep,
        currentStepData,
        startTutorial,
        endTutorial,
        nextStep,
        prevStep,
        skipTutorial,
        hasCompletedTutorial,
        totalSteps: TUTORIAL_STEPS.length,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  return useContext(TutorialContext);
}
