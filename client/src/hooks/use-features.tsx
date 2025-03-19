import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export function useFeatures() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const checkFeatureAvailability = async (feature: string) => {
    const response = await apiRequest("GET", `/api/features/check/${feature}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to check feature availability");
    }
    
    return await response.json();
  };

  const useFeatureMutation = useMutation({
    mutationFn: async (feature: string) => {
      const response = await apiRequest("POST", `/api/features/use/${feature}`);
      
      if (!response.ok) {
        const error = await response.json();
        
        // If subscription needed, redirect to pricing
        if (error.subscriptionNeeded) {
          navigate("/pricing");
          throw new Error("Please subscribe to use this feature");
        }
        
        throw new Error(error.error || "Failed to use feature");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Feature Usage Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Helper function to check and use a feature
  const useFeature = async (feature: string) => {
    try {
      // First check if feature is available
      const availability = await checkFeatureAvailability(feature);
      
      if (!availability.available) {
        // If not available, show toast and redirect to pricing
        toast({
          title: "Feature not available",
          description: "You've already used this feature. Please subscribe for unlimited access.",
          variant: "destructive",
        });
        
        navigate("/pricing");
        return false;
      }
      
      // If available, mark as used
      if (availability.reason === "trial") {
        await useFeatureMutation.mutateAsync(feature);
        
        // Notify user they're using a trial feature
        toast({
          title: "Trial Feature Used",
          description: "You're using this feature in trial mode. Subscribe for unlimited access.",
        });
      }
      
      return true;
    } catch (error) {
      console.error("Feature use error:", error);
      return false;
    }
  };

  return {
    useFeature,
    isUsingFeature: useFeatureMutation.isPending,
  };
} 