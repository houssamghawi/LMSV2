import { Skeleton } from "@/components/ui/skeleton";

export default function EnrollmentsLoading() {
    return (
        <div className="space-y-6">
            <div>
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-6 w-96 mt-2" />
            </div>
            <Skeleton className="h-10 w-full max-w-md" />
            <Skeleton className="h-[400px] w-full" />
        </div>
    );
}

