import React, { useState } from 'react';
import { Box, Container, TextField, Button, Typography, Paper } from '@mui/material';
import ChatRoom from './components/ChatRoom';

function App() {
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isJoined, setIsJoined] = useState(false);

  const handleJoin = () => {
    if (userName && roomId) {
      setIsJoined(true);
    }
  };

  if (!isJoined) {
    return (
      <Container maxWidth="sm">
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
            <Typography variant="h4" component="h1" gutterBottom align="center">
              AI Team Buddy
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Your Name"
                variant="outlined"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                fullWidth
              />
              <TextField
                label="Room ID"
                variant="outlined"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                fullWidth
              />
              <Button
                variant="contained"
                color="primary"
                onClick={handleJoin}
                disabled={!userName || !roomId}
                fullWidth
              >
                Join Room
              </Button>
            </Box>
          </Paper>
        </Box>
      </Container>
    );
  }

  return (
    <ChatRoom
      roomId={roomId}
      userName={userName}
      userId={Date.now().toString()} // Simple unique ID for demo
    />
  );
}

export default App;
