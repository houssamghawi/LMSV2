import { EmptyState } from '@/components/ui/empty-state'
import Link from 'next/link'

export default function NotFound() {
  return (
    <EmptyState
      title="404 - Page Not Found"
      description="The page you're looking for doesn't exist or has been moved."
      icon="notFound"
      actionUrl="/"
      actionLabel="Go Home"
      className="min-h-screen"
    />
  )
}
