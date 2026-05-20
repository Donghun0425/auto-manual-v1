import { Skeleton } from "@/components/ui/skeleton";
import { Container } from "@/components/layout/container";

export default function Loading() {
  return (
    <Container className="py-8 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </Container>
  );
}
