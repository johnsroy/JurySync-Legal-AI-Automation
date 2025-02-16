import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HelpBubbleProps {
  title: string;
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}

const bubbleVariants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { 
    scale: 1, 
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 20 }
  },
  exit: { 
    scale: 0.8, 
    opacity: 0,
    transition: { duration: 0.2 }
  }
};

export function HelpBubble({ title, content, position = "right", className = "" }: HelpBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <TooltipProvider>
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`rounded-full p-2 hover:bg-primary/10 ${className}`}
          >
            <HelpCircle className="h-5 w-5 text-primary/80" />
          </Button>
        </TooltipTrigger>
        <AnimatePresence>
          {isOpen && (
            <TooltipContent 
              side={position}
              className="max-w-[300px] p-4 bg-white shadow-lg rounded-lg border border-primary/20"
              asChild
            >
              <motion.div
                variants={bubbleVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <h4 className="font-medium text-sm mb-2">{title}</h4>
                <p className="text-sm text-muted-foreground">{content}</p>
              </motion.div>
            </TooltipContent>
          )}
        </AnimatePresence>
      </Tooltip>
    </TooltipProvider>
  );
}
