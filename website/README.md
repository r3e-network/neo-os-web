# Neo N3 Service Layer Website

This is the official website for the Neo N3 Service Layer project. It provides documentation, interactive playground, and other resources for developers interested in using the Service Layer.

## Features

- **Modern Technology Stack**: Built with Next.js, TypeScript, and Tailwind CSS
- **Interactive Playground**: Test JavaScript functions in a simulated environment
- **Comprehensive Documentation**: Detailed guides and API references
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Netlify Integration**: Serverless functions for dynamic features

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/R3E-Network/service_layer.git
   cd service_layer/website
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the website.

## Project Structure

```
website/
├── content/                 # Markdown content for docs and blog
├── netlify/                 # Netlify serverless functions
│   └── functions/           # JavaScript serverless functions
├── public/                  # Static assets
├── src/                     # Source code
│   ├── app/                 # Next.js app router pages
│   ├── components/          # React components
│   │   ├── docs/            # Documentation-specific components
│   │   ├── layout/          # Layout components (Navbar, Footer, etc.)
│   │   ├── playground/      # Playground components
│   │   └── ui/              # Reusable UI components
│   └── lib/                 # Utility functions and libraries
├── .gitignore               # Git ignore file
├── netlify.toml             # Netlify configuration
├── next.config.ts           # Next.js configuration
├── package.json             # npm package file
├── postcss.config.mjs       # PostCSS configuration
├── tailwind.config.ts       # Tailwind CSS configuration
└── tsconfig.json            # TypeScript configuration
```

## Deployment

This website is automatically deployed to Netlify when changes are pushed to the main branch. For manual deployment:

1. Build the website:
   ```
   npm run build
   ```

2. Deploy to Netlify:
   ```
   npx netlify deploy --prod
   ```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.