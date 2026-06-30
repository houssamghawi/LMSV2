import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function UsersLoading() {
    return (
        <div className="space-y-6">
            <div>
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-6 w-96 mt-2" />
            </div>

            <Card>
                <CardContent className="p-6">
                    <div className="space-y-4">
                        {/* Search bar */}
                        <Skeleton className="h-10 w-full max-w-md" />
                        
                        {/* Table */}
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <Skeleton className="h-12 w-12 rounded-full" />
                                    <Skeleton className="h-4 flex-1" />
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-4 w-16" />
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

