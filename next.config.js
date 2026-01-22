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
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
        pathname: '/**',
      },
    ],
    unoptimized: false,
  },
  webpack: (config, { isServer }) => {
    // Ignore canvas module to prevent SSR issues with Konva
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
    }
    
    // Exclude canvas from being bundled
    config.externals = config.externals || []
    if (isServer) {
      config.externals.push('canvas')
    } else {
      config.externals.push({
        canvas: false,
      })
    }
    
    return config
  },
}

module.exports = nextConfig

