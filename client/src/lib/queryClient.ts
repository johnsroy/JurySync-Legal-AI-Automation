import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    console.log(`[Query] Fetching ${queryKey[0]}`); // Debug log
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      console.log(`[Auth] Not authenticated, returning null`); // Debug log
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Configure the QueryClient with optimized caching settings
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // Data stays fresh for 5 minutes
      gcTime: 30 * 60 * 1000, // Cache persists for 30 minutes
      retry: 2, // Retry failed requests twice
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

// Add cache prefetching for legal documents
export const prefetchLegalDocuments = async () => {
  await queryClient.prefetchQuery({
    queryKey: ["/api/legal/documents"],
    staleTime: 5 * 60 * 1000,
  });
};

// Add cache invalidation helpers
export const invalidateLegalDocuments = () => {
  return queryClient.invalidateQueries({ queryKey: ["/api/legal/documents"] });
};

// Add optimistic updates helper
export const optimisticUpdateDocument = (documentId: number, updatedData: any) => {
  queryClient.setQueryData(["/api/legal/documents"], (old: any[]) => {
    return old?.map(doc => 
      doc.id === documentId ? { ...doc, ...updatedData } : doc
    );
  });
};