import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NodeProvider } from '@/chain/node.jsx';
import { useSyncStore } from '@/chain/useSyncStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      cacheTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Inner wrapper — must be inside NodeProvider so useNode() works. */
function ChainSync({ children }) {
  useSyncStore();
  return children;
}

export default function RootLayout({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <NodeProvider>
        <ChainSync>
          {children}
        </ChainSync>
      </NodeProvider>
    </QueryClientProvider>
  );
}