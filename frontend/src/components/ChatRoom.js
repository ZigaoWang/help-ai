import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Container,
  CircularProgress,
  Alert,
} from '@mui/material';

const ChatRoom = ({ roomId, userName, userId }) => {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const audioElementRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const localAudioTrackRef = useRef(null);
  const rtpSenderRef = useRef(null);

  useEffect(() => {
    console.log('ChatRoom useEffect running...');
    let pc = null;

    const initRealtimeConnection = async () => {
      try {
        setError(null);
        setIsProcessing(true);
        console.log('Initializing Realtime connection...');

        // Get ephemeral token from our server
        console.log('Fetching session token...');
        const tokenResponse = await fetch('http://localhost:5000/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({})
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          console.error('Token fetch error:', errorData);
          throw new Error(errorData.details || `HTTP error! status: ${tokenResponse.status}`);
        }

        const sessionData = await tokenResponse.json();
        console.log('Session data received:', sessionData);

        if (!sessionData.client_secret || !sessionData.client_secret.value) {
          throw new Error('No client secret value in session response');
        }
        const EPHEMERAL_KEY = sessionData.client_secret.value;
        console.log('Ephemeral key obtained.');

        // Create peer connection
        console.log('Creating RTCPeerConnection...');
        pc = new RTCPeerConnection();
        peerConnectionRef.current = pc;

        // Set up audio element for model's responses
        console.log('Setting up audio element...');
        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.volume = 0.8;
        audioElementRef.current = audioEl;
        document.body.appendChild(audioEl);

        // Handle incoming audio tracks
        pc.ontrack = (e) => {
          console.log(`Received track: Kind=${e.track.kind}, ID=${e.track.id}, StreamID=${e.streams[0]?.id}`);
          if (audioElementRef.current && !audioElementRef.current.srcObject && e.track.kind === 'audio' && e.streams && e.streams[0]) {
            console.log(`Assigning remote audio stream ${e.streams[0].id} to audio element.`);
            audioElementRef.current.srcObject = e.streams[0];
          } else if (audioElementRef.current && audioElementRef.current.srcObject) {
            console.log(`Audio element already has a stream. Ignoring new track ${e.track.id}.`);
          } else {
            console.log(`Could not assign track ${e.track.id} - audio element missing, track is not audio, or stream missing.`);
          }
        };

        // Add local audio track
        await addMicrophoneTrack(pc);

        // Set up data channel for events
        console.log('Creating data channel...');
        const dc = pc.createDataChannel('oai-events');
        dataChannelRef.current = dc;

        dc.onopen = () => console.log('Data channel opened.');
        dc.onclose = () => console.log('Data channel closed.');
        dc.onerror = (error) => console.error('Data channel error:', error);

        dc.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // console.log('Received event:', data); // Reduce console noise slightly

            if (data.type === 'transcript') {
              const messageObj = {
                id: Date.now(), userId, userName,
                content: data.text, timestamp: new Date().toISOString(), type: 'user'
              };
              setMessages(prev => [...prev, messageObj]);
            } else if (data.type === 'response') {
              const messageObj = {
                id: Date.now() + 1, userId: 'ai', userName: 'AI Assistant',
                content: data.text, timestamp: new Date().toISOString(), type: 'ai'
              };
              setMessages(prev => [...prev, messageObj]);
            }
          } catch (e) {
            console.error('Error parsing data channel message:', e);
          }
        };

        // Create and set local description
        console.log('Creating offer...');
        const offer = await pc.createOffer();
        console.log('Setting local description...');
        await pc.setLocalDescription(offer);

        // Connect to Realtime API
        console.log('Connecting to Realtime API...');
        const baseUrl = 'https://api.openai.com/v1/realtime';
        const model = 'gpt-4o-realtime-preview-2024-12-17';
        const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
          method: 'POST',
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${EPHEMERAL_KEY}`,
            'Content-Type': 'application/sdp',
            'OpenAI-Beta': 'realtime=v1'
          },
        });

        if (!sdpResponse.ok) {
          const errorText = await sdpResponse.text();
          console.error('SDP Response Error Text:', errorText);
          throw new Error(`WebRTC connection error: ${sdpResponse.status}`);
        }
        console.log('SDP Response OK.');

        const answerSdp = await sdpResponse.text();
        console.log('Received answer SDP.');
        const answer = {
          type: 'answer',
          sdp: answerSdp,
        };
        console.log('Setting remote description...');
        await pc.setRemoteDescription(answer);
        console.log('Remote description set.');

        setIsConnected(true);
        setIsProcessing(false);
        console.log('Realtime connection established.');

      } catch (error) {
        console.error('Error initializing Realtime connection:', error);
        setError(error.message || 'Unknown initialization error');
        setIsConnected(false);
        setIsProcessing(false);
      }
    };

    // Helper function to add microphone track
    const addMicrophoneTrack = async (peerConnection) => {
      try {
        console.log('Getting user media (audio)...');
        const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Store stream for later access
        mediaStreamRef.current = mediaStream;
        
        // Get audio track
        const audioTracks = mediaStream.getAudioTracks();
        if (audioTracks.length > 0) {
          localAudioTrackRef.current = audioTracks[0];
          console.log(`Adding local audio track: ${localAudioTrackRef.current.id}, State: ${localAudioTrackRef.current.readyState}`);
          
          // Add track to peer connection
          rtpSenderRef.current = peerConnection.addTrack(localAudioTrackRef.current, mediaStream);
          
          return true;
        } else {
          console.error('Could not get local audio track!');
          return false;
        }
      } catch (error) {
        console.error('Error accessing microphone:', error);
        setError('Failed to access microphone. Please check permissions.');
        return false;
      }
    };

    initRealtimeConnection();

    // Cleanup function
    return () => {
      console.log('Cleaning up ChatRoom component...');
      
      // Stop tracks and release resources
      if (mediaStreamRef.current) {
        console.log('Stopping media stream tracks.');
        mediaStreamRef.current.getTracks().forEach(track => {
          console.log(`Stopping track: ${track.id}`);
          track.stop();
        });
        mediaStreamRef.current = null;
      }
      
      // Clean up RTCPeerConnection
      if (pc) {
        console.log('Closing peer connection.');
        rtpSenderRef.current = null;
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.ondatachannel = null;
        pc.close();
        pc = null;
      }
      
      // Clean up audio element
      if (audioElementRef.current) {
        console.log('Removing audio element.');
        const audioEl = audioElementRef.current;
        audioEl.pause();
        audioEl.srcObject = null;
        audioEl.remove();
        audioElementRef.current = null;
      }
      
      localAudioTrackRef.current = null;
      peerConnectionRef.current = null;
      console.log('Cleanup complete.');
    };
  }, [roomId, userId, userName]); // Dependencies for useEffect

  // Scroll to bottom effect
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Render component
  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6">Room: {roomId}</Typography>
            {isProcessing && <CircularProgress size={20} />}
            <Typography variant="body2" color={isConnected ? 'success.main' : 'error.main'}>
              {isConnected ? 'Connected' : 'Connecting...'}
            </Typography>
          </Box>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </Box>
        
        <List sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
          {messages.map((message) => (
            <ListItem
              key={message.id}
              sx={{
                flexDirection: message.userId === userId ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
              }}
            >
              <ListItemAvatar>
                <Avatar>{message.userName.charAt(0)}</Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={message.userName}
                secondary={message.content}
                sx={{
                  bgcolor: message.type === 'user' ? 'primary.light' : 
                          message.type === 'ai' ? 'grey.100' : 
                          'warning.light',
                  p: 1,
                  borderRadius: 2,
                  maxWidth: '70%',
                  wordBreak: 'break-word', // Ensure long words don't overflow
                }}
              />
            </ListItem>
          ))}
          <div ref={messagesEndRef} />
        </List>
      </Paper>
    </Container>
  );
};

export default ChatRoom; 