import {
  Scale,
  Shield,
  Book,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function DocumentProcessingStatus({
  stage,
  progress,
}: {
  stage: string;
  progress: number;
}) {
  const stages = [
    { name: "Document Analysis", icon: Scale, color: "text-blue-600" },
    { name: "Compliance Check", icon: Shield, color: "text-green-600" },
    { name: "Legal Research", icon: Book, color: "text-purple-600" },
    { name: "Final Review", icon: CheckCircle, color: "text-emerald-600" },
  ];

  const currentStageIndex = stages.findIndex((s) => s.name === stage);

  return (
    <div className="space-y-6 p-4">
      <Progress value={progress} className="h-2" />
      <div className="grid grid-cols-4 gap-4">
        {stages.map((s, index) => {
          const Icon = s.icon;
          const isActive = index === currentStageIndex;
          const isComplete = index < currentStageIndex;

          return (
            <div
              key={s.name}
              className={`flex flex-col items-center p-4 rounded-lg transition-all duration-300
                 ${isActive ? "bg-gray-50 scale-105" : ""}
                 ${isComplete ? "text-gray-400" : ""}`}
            >
              <div className="relative">
                <Icon
                  className={`h-8 w-8 ${s.color} ${isActive ? "animate-pulse" : ""}`}
                />
                {isActive && (
                  <div className="absolute inset-0 h-8 w-8 animate-ping opacity-75 rounded-full bg-current" />
                )}
              </div>
              <span className="mt-2 text-sm font-medium">{s.name}</span>
              {isActive && <Loader2 className="h-4 w-4 mt-2 animate-spin" />}
              {isComplete && (
                <CheckCircle className="h-4 w-4 mt-2 text-green-500" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
