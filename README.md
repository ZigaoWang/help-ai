# AI Team Buddy

An AI-powered team communication platform that helps teams communicate more effectively by having an AI assistant as a virtual team member.

## Features

- **AI Active Participation**: AI joins team discussions in real-time, offering suggestions and summarizing viewpoints
- **Expression Refinement**: AI helps transform unclear or emotional expressions into more neutral and understandable language
- **Automatic Summarization**: AI automatically generates discussion points and brief meeting minutes
- **Voice Input Support**: Speak directly instead of typing, with AI transcribing your speech to text

## Tech Stack

- Frontend: React.js
- Backend: Node.js
- Real-time Communication: Socket.io
- AI Integration: OpenAI API
- Voice Recognition: Web Speech API

## Project Structure

```
help-ai/
├── frontend/           # React frontend application
├── backend/           # Node.js backend server
└── README.md          # Project documentation
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- OpenAI API key

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. Set up environment variables:
   - Create `.env` file in backend directory
   - Add your OpenAI API key:
     ```
     OPENAI_API_KEY=your_api_key_here
     ```

4. Start the development servers:
   ```bash
   # Start backend server
   cd backend
   npm run dev

   # Start frontend server
   cd frontend
   npm start
   ```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 

