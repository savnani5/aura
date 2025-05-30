# Ohm - AI First Video Conferencing App

An intelligent video conferencing application built with Next.js 15, React 18, TypeScript, and LiveKit. Features real-time video/audio communication, live transcription, chat functionality, and an integrated AI assistant powered by OpenAI.

## Features

- 🎥 **Real-time Video/Audio**: High-quality video conferencing with LiveKit
- 📝 **Live Transcription**: Automatic speech-to-text using Deepgram
- 💬 **Chat System**: Real-time messaging with participants
- 🤖 **AI Assistant**: Context-aware chatbot using OpenAI GPT-4
- 🎨 **Modern UI**: Clean, intuitive interface with dark theme

## AI Assistant Features

The integrated AI assistant (Ohm) provides intelligent meeting support:

- **Context Awareness**: Accesses current meeting transcripts and previous meeting history
- **Vector Search**: Uses embeddings to find relevant information from past meetings
- **Real-time Help**: Answers questions about ongoing discussions
- **Meeting Insights**: Provides summaries, action items, and key points
- **Easy Access**: Simply type `@ohm` followed by your question in the chat

### Using the AI Assistant

1. In the chat tab, type `@ohm` followed by your question
2. Examples:
   - `@ohm summarize the key points discussed so far`
   - `@ohm what decisions were made in previous meetings about this topic?`
   - `@ohm create action items from today's discussion`
   - `@ohm who mentioned the budget requirements?`

The AI assistant will analyze current transcripts and search through previous meeting data to provide comprehensive, context-aware responses.

## Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript
- **Video/Audio**: LiveKit
- **Transcription**: Deepgram API
- **AI/ML**: OpenAI GPT-4, Text Embeddings
- **Styling**: CSS Modules with responsive design
- **Deployment**: Vercel-ready

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ohm
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory:
```bash
cp .env.local.example .env.local
```

4. Fill in your environment variables in `.env.local`:
```env
# LiveKit Configuration
LIVEKIT_API_KEY=your_livekit_api_key_here
LIVEKIT_API_SECRET=your_livekit_api_secret_here
LIVEKIT_URL=wss://your-project.livekit.cloud

# Deepgram API (for transcription)
NEXT_PUBLIC_DEEPGRAM_API_KEY=your_deepgram_api_key_here

# OpenAI API (for AI assistant)
OPENAI_API_KEY=your_openai_api_key_here
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) to access the application.

## Environment Variables

| Variable | Description | Required | Where to Get |
|----------|-------------|----------|--------------|
| `LIVEKIT_API_KEY` | LiveKit API key for authentication | Yes | [LiveKit Console](https://cloud.livekit.io) |
| `LIVEKIT_API_SECRET` | LiveKit API secret for authentication | Yes | [LiveKit Console](https://cloud.livekit.io) |
| `LIVEKIT_URL` | LiveKit WebSocket URL for your project | Yes | [LiveKit Console](https://cloud.livekit.io) |
| `DEEPGRAM_API_KEY` | Deepgram API key for speech-to-text | Yes | [Deepgram Console](https://console.deepgram.com) |
| `OPENAI_API_KEY` | OpenAI API key for AI assistant | Yes | [OpenAI Platform](https://platform.openai.com) |

### Getting API Keys

#### LiveKit
1. Sign up at [LiveKit Cloud](https://cloud.livekit.io)
2. Create a new project
3. Copy the API Key, API Secret, and WebSocket URL from your project settings

#### Deepgram
1. Sign up at [Deepgram Console](https://console.deepgram.com)
2. Create a new project
3. Generate an API key from the project dashboard

#### OpenAI
1. Sign up at [OpenAI Platform](https://platform.openai.com)
2. Add billing information (required for API access)
3. Generate an API key from the API keys section
4. Ensure you have access to GPT-4 models

## Building for Production

```bash
npm run build
npm start
```

## Deployment

The application is ready for deployment on Vercel:

1. Connect your repository to Vercel
2. Add the environment variables in the Vercel dashboard
3. Deploy!

## Usage

1. **Join a Meeting**: Enter a room name and your name to join
2. **Video/Audio**: Use camera and microphone controls in the toolbar
3. **Transcription**: Enable live transcription to see real-time captions
4. **Chat**: Send messages to other participants
5. **AI Assistant**: Use `@ohm` commands to interact with the AI assistant
6. **Settings**: Customize camera settings including background effects

## AI Assistant Capabilities

- **Current Meeting Analysis**: Understands ongoing conversations
- **Historical Context**: Searches previous meeting transcripts
- **Smart Responses**: Provides relevant, context-aware answers
- **Meeting Support**: Helps with summaries, action items, and insights
- **Multi-participant**: Works in meetings with multiple participants

## License

MIT License - see LICENSE file for details.

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

## Support

For support and questions, please [open an issue](https://github.com/your-username/ohm/issues) on GitHub.
