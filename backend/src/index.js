require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const OpenAI = require('openai');
// Note: Google Cloud clients are kept for potential future use but are not used in the current Realtime API flow.
// const speech = require('@google-cloud/speech'); 
// const textToSpeech = require('@google-cloud/text-to-speech');

// Define the intended role for the AI Assistant
const AI_SYSTEM_PROMPT = `你是一个 AI 团队助手，正在参与团队的实时语音讨论。你的任务是倾听对话，并在适当的时候：
1.  **简洁地总结**关键讨论点。
2.  **澄清**可能模糊不清的地方。
3.  **提出**相关的后续步骤建议。
保持回答简短、有帮助，并专注于支持团队的沟通。`;

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Note: Google Cloud clients initialization removed as they are not currently used.
// const speechClient = new speech.SpeechClient();
// const ttsClient = new textToSpeech.TextToSpeechClient();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());

// Store active rooms and their messages (Potentially useful if combining with text chat later)
const rooms = new Map();

// Generate ephemeral token for Realtime API
app.post('/session', async (req, res) => {
  try {
    console.log('Creating session with OpenAI API...');
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is missing!');
      throw new Error('Server configuration error: OpenAI API key not found.');
    }
    console.log('Using API key: Present');

    // Create a session with the Realtime API
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'realtime=v1'
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "verse"
        // Note: Realtime API session creation might not directly support system prompts like Chat Completions.
        // The AI_SYSTEM_PROMPT constant defines the intended behavior.
      })
    });

    console.log('OpenAI API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error response text:', errorText);
      // Attempt to parse JSON if possible, otherwise use text
      let errorDetails = errorText;
      try {
        const jsonError = JSON.parse(errorText);
        errorDetails = jsonError.error?.message || errorText;
      } catch (e) { /* Ignore parsing error, use raw text */ }
      
      throw new Error(`OpenAI API error: ${response.status} - ${errorDetails}`);
    }

    const data = await response.json();
    console.log('Session created successfully:', data);
    res.json(data);
  } catch (error) {
    console.error('Error generating session:', error);
    res.status(500).json({ 
      error: 'Error generating session',
      details: error.message
    });
  }
});

// Note: Removed /process-speech and /text-to-speech endpoints as they are replaced by Realtime API flow.

// Socket.io connection handling (kept for potential future features like text chat sync)
io.on('connection', (socket) => {
  console.log('New client connected via Socket.IO');

  // Example: Join a room (useful if you add text chat features)
  socket.on('join_room', (roomId) => {
    console.log(`Socket ${socket.id} joining room ${roomId}`);
    socket.join(roomId);
    if (!rooms.has(roomId)) {
      rooms.set(roomId, []);
    }
    // Send room history (if applicable for text chat)
    // socket.emit('room_history', rooms.get(roomId));
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected via Socket.IO');
    // Add any room cleanup logic here if needed
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('AI Assistant intended behavior defined by AI_SYSTEM_PROMPT.');
}); 