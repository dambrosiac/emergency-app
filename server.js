const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- API Routes ---

// Join (Name only)
app.post('/api/join', (req, res) => {
    const { username } = req.body;

    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });

        if (user) {
            // User exists, update last_active
            db.run(`UPDATE users SET last_active = ? WHERE id = ?`, [Date.now(), user.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ id: user.id, username: user.username, message: user.message });
            });
        } else {
            // New user
            db.run(`INSERT INTO users (username, last_active) VALUES (?, ?)`,
                [username, Date.now()],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ id: this.lastID, username });
                }
            );
        }
    });
});

// Update Location
// Update Location & Message
app.post('/api/update-location', (req, res) => {
    const { userId, lat, lng, message } = req.body;
    const now = Date.now();
    db.run(`UPDATE users SET lat = ?, lng = ?, message = ?, last_active = ? WHERE id = ?`,
        [lat, lng, message, now, userId],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });

            // Get updated user data
            db.get(`SELECT id, username, lat, lng, message, last_active FROM users WHERE id = ?`, [userId], (err, user) => {
                if (err) return res.status(500).json({ error: err.message });

                // Broadcast location update to all clients
                io.emit('location_update', { userId, lat: user.lat, lng: user.lng, message: user.message, last_active: user.last_active });
                res.json({ success: true, user: user });
            });
        }
    );
});

// Get Nearby Users (Simulated "nearby" by returning all active users)
// Get Nearby Users (Active in last 48 hours)
app.get('/api/users', (req, res) => {
    // Return users active in last 48 hours
    const fortyEightHoursAgo = Date.now() - (48 * 60 * 60 * 1000);
    db.all(`SELECT id, username, lat, lng, message, last_active FROM users WHERE last_active > ?`, [fortyEightHoursAgo], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// --- Socket.io (Chat) ---

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('join', (userId) => {
        socket.join(userId); // Join a room named after the user ID
    });

    socket.on('send_message', (data) => {
        const { senderId, receiverId, content } = data;
        const timestamp = Date.now();

        // Save to DB
        db.run(`INSERT INTO messages (sender_id, receiver_id, content, timestamp) VALUES (?, ?, ?, ?)`,
            [senderId, receiverId, content, timestamp],
            (err) => {
                if (!err) {
                    // Emit to receiver
                    io.to(receiverId).emit('receive_message', {
                        senderId,
                        content,
                        timestamp
                    });
                    // Emit back to sender (for UI confirmation)
                    io.to(senderId).emit('message_sent', {
                        receiverId,
                        content,
                        timestamp
                    });
                }
            }
        );
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
