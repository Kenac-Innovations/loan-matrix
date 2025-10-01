'use client'

import { useEffect } from 'react'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to console for debugging
    console.error('Server Component Error:', error)
    console.error('Error digest:', error.digest)
    console.error('Error stack:', error.stack)
  }, [error])

  return (
    <div className="flex h-[50vh] flex-col items-center justify-center">
      <h2 className="text-xl font-semibold text-red-600">Something went wrong!</h2>
      <p className="mt-2 text-gray-600">Error digest: {error.digest}</p>
      <button
        onClick={reset}
        className="mt-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
      >
        Try again
      </button>
    </div>
  )
}

