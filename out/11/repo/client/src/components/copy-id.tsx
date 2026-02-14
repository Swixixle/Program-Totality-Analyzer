import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner"; // Assuming sonner is installed/used, or use generic alert/toast
import { cn } from "@/lib/utils";

interface CopyIDProps {
    id: string;
    className?: string;
    variant?: "icon" | "full";
}

export function CopyID({ id, className, variant = "icon" }: CopyIDProps) {
    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(id);
        toast.success(`ID copied: ${id.slice(0, 8)}...`);
    };

    if (variant === "full") {
         return (
            <div 
                className={cn("flex items-center gap-1 text-[10px] font-mono text-muted-foreground cursor-pointer hover:text-foreground", className)}
                onClick={handleCopy}
                title="Click to copy ID"
            >
                <span>ID: {id.slice(0, 8)}</span>
                <Copy className="w-3 h-3" />
            </div>
        );
    }

    return (
        <Button 
            variant="ghost" 
            size="icon" 
            className={cn("h-4 w-4 text-muted-foreground hover:text-foreground", className)} 
            onClick={handleCopy}
            title={`Copy ID: ${id}`}
        >
            <Copy className="w-3 h-3" />
        </Button>
    );
}
