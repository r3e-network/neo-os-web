/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  output: 'standalone',
  // Enable build cache indicators to make it easier to understand caching behaviors
  experimental: {
    outputFileTracingIncludes: {
      '/*': ['./cache/**/*']
    }
  },
  // Configure React 18 SWC compiler for faster builds
  swcMinify: true,
  compiler: {
    // Allow emotion/styled-components if needed
    // styledComponents: true,
  },
  // Configure caching to improve build speeds
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 60 * 60 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 5,
  },
  // Uncomment to improve production performance
  // productionBrowserSourceMaps: false,
  
  // Add any required rewrites or redirects
  // async rewrites() {
  //   return [];
  // },
};

module.exports = nextConfig;
