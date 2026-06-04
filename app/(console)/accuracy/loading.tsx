import { PageHeaderSkeleton, KpiRowSkeleton } from "@/components/shared/skeletons";
export default function Loading() { return <div className="mx-auto max-w-7xl space-y-5"><PageHeaderSkeleton /><KpiRowSkeleton count={5} /></div>; }
