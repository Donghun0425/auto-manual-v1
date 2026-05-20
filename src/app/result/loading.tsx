import { Skeleton } from "@/components/ui/skeleton";
import { Container } from "@/components/layout/container";

export default function ResultLoading() {
  return (
    <Container className="py-8 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex gap-4 mb-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="grid lg:grid-cols-4 gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <div className="lg:col-span-3 space-y-4">
          <Skeleton className="h-10 rounded" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    </Container>
  );
}
