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
  IconButton,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';

const ChatRoom = ({ roomId, userName, userId }) => {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [isMicActive, setIsMicActive] = useState(true);
  const messagesEndRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const audioElementRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const localAudioTrackRef = useRef(null); // Use ref to store the track
  const rtpSenderRef = useRef(null); // Use ref to store the RTCRtpSender

  useEffect(() => {
    console.log('ChatRoom useEffect running...');
    let pc = null; // Define pc in the scope accessible by cleanup

    const initRealtimeConnection = async () => {
      try {
        setError(null);
        setIsProcessing(true);
        setIsMicActive(true); // Ensure mic starts active visually
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

        // Handle incoming audio tracks - ensure only one stream is used
        pc.ontrack = (e) => {
          console.log(`Received track: Kind=${e.track.kind}, ID=${e.track.id}, StreamID=${e.streams[0]?.id}`);
          if (audioElementRef.current && !audioElementRef.current.srcObject && e.track.kind === 'audio' && e.streams && e.streams[0]) {
            console.log(`Assigning remote audio stream ${e.streams[0].id} to audio element.`);
            audioElementRef.current.srcObject = e.streams[0];
          } else if (audioElementRef.current && audioElementRef.current.srcObject) {
            console.log(`Audio element already has a stream (ID: ${audioElementRef.current.srcObject.id}). Ignoring new track ${e.track.id}.`);
          } else {
            console.log(`Could not assign track ${e.track.id} - audio element missing, track is not audio, or stream missing.`);
          }
        };

        // Add local audio track
        console.log('Getting user media (audio)...');
        const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = mediaStream;
        const audioTracks = mediaStream.getAudioTracks();
        if (audioTracks.length > 0) {
            localAudioTrackRef.current = audioTracks[0]; // Store track in ref
            console.log(`Adding local audio track: ${localAudioTrackRef.current.id}, Initial state: ${localAudioTrackRef.current.enabled}`);
            // Store the sender returned by addTrack
            rtpSenderRef.current = pc.addTrack(localAudioTrackRef.current, mediaStream);
            if (!rtpSenderRef.current) {
                console.error('pc.addTrack did not return an RTCRtpSender.');
                throw new Error('Failed to add audio track sender.'); // Throw error if sender fails
            }
        } else {
            console.error('Could not get local audio track!');
            throw new Error('Microphone access denied or no audio track found.');
        }

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
              // Check the UI state for adding transcript
              if (isMicActive) {
                 setMessages(prev => [...prev, messageObj]);
              }
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

    initRealtimeConnection();

    // Cleanup function
    return () => {
      console.log('Cleaning up ChatRoom component...');
      if (pc) {
        console.log('Closing peer connection.');
        // No need to explicitly remove track via sender on cleanup if using replaceTrack(null)
        // Just ensure sender ref is cleared
        rtpSenderRef.current = null;
        pc.ontrack = null; // Remove event listeners
        pc.onicecandidate = null;
        pc.ondatachannel = null;
        pc.close();
        pc = null;
      }
      if (peerConnectionRef.current) {
          peerConnectionRef.current = null; // Also clear the ref
      }
      if (audioElementRef.current) {
        console.log('Removing audio element.');
        const audioEl = audioElementRef.current;
        audioEl.pause();
        audioEl.srcObject = null;
        audioEl.remove();
        audioElementRef.current = null;
      }
      // Stop the local media stream tracks
      if (mediaStreamRef.current) {
        console.log('Stopping media stream tracks.');
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      localAudioTrackRef.current = null; // Clear track reference
      console.log('Cleanup complete.');
    };
  }, [roomId, userId, userName]); // Dependencies for useEffect

  // Function to toggle microphone using replaceTrack
  const toggleMicrophone = async () => { // Make async for await replaceTrack
    const sender = rtpSenderRef.current;
    const track = localAudioTrackRef.current;

    if (sender && track) {
        const currentState = isMicActive;
        const nextState = !currentState;
        console.log(`Toggling microphone via replaceTrack. Current UI state: ${currentState}, Target state: ${nextState}`);

        try {
            if (nextState === false) { // Muting: Replace track with null
                 console.log(`Attempting to replace track ${track.id} with null...`);
                 await sender.replaceTrack(null);
                 console.log(`Track ${track.id} replaced with null (muted).`);
            } else { // Unmuting: Replace null with original track
                 // Ensure track is not stopped
                 if (track.readyState === 'ended') {
                    console.error('Cannot unmute: Track is ended. Need to reacquire.');
                    setError('Microphone track ended unexpectedly. Please refresh.');
                    return;
                 }
                 console.log(`Attempting to replace null with track ${track.id}...`);
                 await sender.replaceTrack(track);
                 console.log(`Track ${track.id} restored (unmuted).`);
            }

            // Update UI state only after successful replaceTrack
            setIsMicActive(nextState);
            console.log(`UI Mic Active state updated to: ${nextState}`);

            // Send system message
            const messageObj = {
              id: Date.now(),
              userId: 'system',
              userName: 'System',
              content: `Conversation ${nextState ? 'resumed' : 'paused'} - microphone ${nextState ? 'active' : 'muted'}`,
              timestamp: new Date().toISOString(),
              type: 'system'
            };
            setMessages(prev => [...prev, messageObj]);

        } catch (error) {
            console.error(`Error during replaceTrack (toggling to ${nextState}):`, error);
            setError(`Failed to ${nextState ? 'unmute' : 'mute'} microphone. Please try again.`);
        }
    } else {
        console.warn('Could not toggle microphone: RTCRtpSender or local track reference not found.', { sender, track });
    }
  };

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
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6">Room: {roomId}</Typography>
              {isProcessing && <CircularProgress size={20} />}
              <Typography variant="body2" color={isConnected ? 'success.main' : 'error.main'}>
                {isConnected ? 'Connected' : 'Connecting...'}
              </Typography>
            </Box>
            <IconButton 
              onClick={toggleMicrophone}
              color={isMicActive ? 'primary' : 'error'}
              title={isMicActive ? 'Mute microphone' : 'Unmute microphone'}
              disabled={!isConnected || !localAudioTrackRef.current || !rtpSenderRef.current} // Also disable if sender is missing
            >
              {isMicActive ? <MicIcon /> : <MicOffIcon />}
            </IconButton>
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