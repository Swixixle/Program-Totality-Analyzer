import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertProject, type Project, type Analysis } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// GET /api/projects
export function useProjects() {
  return useQuery({
    queryKey: [api.projects.list.path],
    queryFn: async () => {
      const res = await fetch(api.projects.list.path);
      if (!res.ok) throw new Error("Failed to fetch projects");
      return api.projects.list.responses[200].parse(await res.json());
    },
  });
}

// GET /api/projects/:id
export function useProject(id: number) {
  return useQuery({
    queryKey: [api.projects.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.projects.get.path, { id });
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch project");
      return api.projects.get.responses[200].parse(await res.json());
    },
    refetchInterval: (query) => {
      // Poll if status is pending or analyzing
      const data = query.state.data as Project | undefined;
      if (data && (data.status === 'pending' || data.status === 'analyzing')) {
        return 2000; // Poll every 2 seconds
      }
      return false;
    },
  });
}

// GET /api/projects/:id/analysis
export function useAnalysis(projectId: number) {
  return useQuery({
    queryKey: [api.projects.getAnalysis.path, projectId],
    queryFn: async () => {
      const url = buildUrl(api.projects.getAnalysis.path, { id: projectId });
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch analysis");
      return api.projects.getAnalysis.responses[200].parse(await res.json());
    },
    enabled: !!projectId, // Only fetch if we have an ID
  });
}

// POST /api/projects
export function useCreateProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertProject) => {
      const res = await fetch(api.projects.create.path, {
        method: api.projects.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.projects.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create project");
      }
      return api.projects.create.responses[201].parse(await res.json());
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
      toast({
        title: "Project Initialized",
        description: "Analysis sequence starting...",
      });
      // Immediately trigger analysis
      fetch(buildUrl(api.projects.analyze.path, { id: project.id }), {
        method: api.projects.analyze.method
      }).catch(console.error);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Initialization Failed",
        description: error.message,
      });
    },
  });
}

export function useAnalyzeReplit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (): Promise<Project> => {
      const res = await fetch(api.projects.analyzeReplit.path, {
        method: api.projects.analyzeReplit.method,
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to start Replit workspace analysis");
      const data = await res.json();
      return data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
      toast({
        title: "Workspace Analysis Started",
        description: "Scanning this Replit workspace...",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Workspace Analysis Failed",
        description: error.message,
      });
    },
  });
}

// POST /api/projects/:id/analyze (Manual trigger if needed)
export function useTriggerAnalysis() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.projects.analyze.path, { id });
      const res = await fetch(url, { method: api.projects.analyze.method });
      if (!res.ok && res.status !== 202) throw new Error("Failed to trigger analysis");
      return res.json();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [api.projects.get.path, id] });
      toast({
        title: "Analysis Queued",
        description: "The system is processing the repository.",
      });
    }
  });
}
