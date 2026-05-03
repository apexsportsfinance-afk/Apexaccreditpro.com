export default function middleware(request) {
  // Explicitly allow all traffic to bypass any edge-level blocks
  return new Response(null, {
    headers: {
      'x-middleware-next': '1',
    },
  });
}

export const config = {
  matcher: '/:path*',
};
