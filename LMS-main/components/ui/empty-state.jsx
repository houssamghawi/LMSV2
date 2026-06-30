"use client";

import { Inbox, Search, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const icons = {
  default: Inbox,
  search: Search,
  notFound: FileQuestion,
};

/**
 * Reusable Empty State Component
 * Use this for displaying empty states (no data, no results, etc.)
 * 
 * @param {string} title - Title text
 * @param {string} description - Description text
 * @param {string} icon - Icon variant: "default" | "search" | "notFound"
 * @param {Function} action - Optional click handler (for client components)
 * @param {string} actionUrl - Optional URL for Link (for server components)
 * @param {string} actionLabel - Label for action button
 * @param {string} className - Additional CSS classes
 */
export function EmptyState({
  title = "No items found",
  description = "There are no items to display at this time.",
  icon = "default",
  action,
  actionUrl,
  actionLabel,
  className = "",
}) {
  const Icon = icons[icon] || icons.default;

  return (
    <div className={`flex min-h-[300px] items-center justify-center p-4 ${className}`}>
      <Card className="w-full max-w-md border-dashed">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {(action || actionUrl) && actionLabel && (
          <CardContent className="text-center">
            {actionUrl ? (
              <Button asChild>
                <Link href={actionUrl}>{actionLabel}</Link>
              </Button>
            ) : (
              <Button onClick={action}>{actionLabel}</Button>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

