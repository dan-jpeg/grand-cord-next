import { NextResponse, type NextRequest } from 'next/server'

/**
 * Forwards the request path to server components as `x-pathname`.
 *
 * The admin layout needs to know which route it is rendering so it can turn
 * anonymous visitors away while still letting /admin/login render signed out.
 * Layouts do not receive the pathname, so it comes through here. Session
 * verification stays in the layout — this runs on the edge, where the
 * credentials provider's bcrypt import cannot follow.
 */
export function middleware(request: NextRequest) {
    const headers = new Headers(request.headers)
    headers.set('x-pathname', request.nextUrl.pathname)
    return NextResponse.next({ request: { headers } })
}

export const config = {
    matcher: '/admin/:path*',
}
