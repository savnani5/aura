# Ohm

**AI First Video Conferencing App**

Ohm is a modern, real-time video conferencing application built with Next.js and powered by LiveKit. Experience seamless video calls with AI-enhanced features.


## Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript
- **Real-time Communication**: LiveKit
- **Styling**: CSS Modules, LiveKit Components
- **Package Manager**: npm

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm (recommended) or pnpm

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd ohm
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```bash
   touch .env.local
   ```
   
   Add the following content to `.env.local`:
   ```env
   # LiveKit Configuration
   # Required: Get these from your LiveKit Cloud project settings
   LIVEKIT_API_KEY=your_livekit_api_key_here
   LIVEKIT_API_SECRET=your_livekit_api_secret_here
   LIVEKIT_URL=wss://your-project.livekit.cloud

   # Deepgram Configuration
   # Required for speech-to-text functionality
   DEEPGRAM_API_KEY=your_deepgram_api_key_here

   # OpenAI Configuration
   # Required for AI-powered features
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Fill in your actual LiveKit credentials** (see Environment Variables section below for how to get these)

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

That's it! 🎉

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `LIVEKIT_API_KEY` | Your LiveKit API key | ✅ |
| `LIVEKIT_API_SECRET` | Your LiveKit API secret | ✅ |
| `LIVEKIT_URL` | Your LiveKit server URL (e.g., `wss://your-domain.livekit.cloud`) | ✅ |
| `DEEPGRAM_API_KEY` | Your Deepgram API key for speech-to-text functionality | ✅ |
| `OPENAI_API_KEY` | Your OpenAI API key for AI-powered features | ✅ |
| `LIVEKIT_URL_<REGION>` | Regional LiveKit URLs (optional, for multi-region support) | ❌ |

### Getting API Credentials

#### LiveKit
1. Sign up at [LiveKit Cloud](https://cloud.livekit.io/)
2. Create a new project
3. Copy your API Key and Secret from the project settings
4. Use your LiveKit server URL (usually in format: `wss://your-project.livekit.cloud`)

#### Deepgram
1. Sign up at [Deepgram](https://deepgram.com/)
2. Navigate to your project dashboard
3. Go to API Keys section
4. Create a new API key or copy your existing key

#### OpenAI
1. Sign up at [OpenAI](https://platform.openai.com/)
2. Navigate to the API section
3. Go to API Keys in your account settings
4. Create a new secret key

## Project Structure

```
ohm/
├── app/                 # Next.js app directory
│   ├── api/            # API routes
│   ├── components/     # React components
│   ├── rooms/          # Room pages
│   └── layout.tsx      # Root layout
├── lib/                # Utility functions and types
├── public/             # Static assets
│   └── images/         # Images and icons
├── styles/             # Global styles
└── package.json        # Dependencies and scripts
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions, please [open an issue](https://github.com/your-username/ohm/issues) on GitHub.
