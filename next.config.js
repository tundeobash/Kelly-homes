/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // RESTART DEV SERVER REQUIRED after changing this config
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
        pathname: '/**',
      },
      // Allow all hosts in development (remove in production)
      ...(process.env.NODE_ENV === 'development' ? [{
        protocol: 'https',
        hostname: '**',
      }] : []),
    ],
  },
  webpack: (config, { isServer }) => {
    // Ignore canvas module to prevent SSR issues with Konva
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
      }
    }
    
    // Exclude canvas from being bundled
    config.externals = config.externals || []
    if (!isServer) {
      config.externals.push({
        canvas: 'canvas',
      })
    }
    
    return config
  },
}

module.exports = nextConfig

