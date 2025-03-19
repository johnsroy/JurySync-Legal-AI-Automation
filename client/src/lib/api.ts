// API utilities for making requests to the backend

/**
 * Make an API request with the provided options
 */
export const apiRequest = async (
  url: string,
  options: RequestInit = {}
): Promise<any> => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
};

/**
 * API wrapper for common operations
 */
export const api = {
  get: (url: string) => apiRequest(url),
  
  post: (url: string, data: any) => 
    apiRequest(url, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  put: (url: string, data: any) =>
    apiRequest(url, {
      method: 'PUT', 
      body: JSON.stringify(data),
    }),
  
  delete: (url: string) =>
    apiRequest(url, {
      method: 'DELETE',
    }),
};
