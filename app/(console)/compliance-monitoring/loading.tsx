import { PageHeaderSkeleton, KpiRowSkeleton, TableSkeleton } from "@/components/shared/skeletons";
export default function Loading() {
  return <div className="mx-auto max-w-7xl space-y-6"><PageHeaderSkeleton /><KpiRowSkeleton /><TableSkeleton /></div>;
}
