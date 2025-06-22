const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('./profiles.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    // Create users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        displayName TEXT,
        createdAt TEXT,
        isPublic BOOLEAN DEFAULT 1
    )`, (err) => {
        if (err) {
            console.error('Error creating users table:', err);
        } else {
            console.log('Users table ready');
        }
    });

    // Create reading_list table
    db.run(`CREATE TABLE IF NOT EXISTS reading_list (
        id TEXT PRIMARY KEY,
        userId TEXT,
        title TEXT,
        summary TEXT,
        url TEXT,
        type TEXT DEFAULT 'article',
        addedAt TEXT,
        FOREIGN KEY (userId) REFERENCES users (id)
    )`, (err) => {
        if (err) {
            console.error('Error creating reading_list table:', err);
        } else {
            console.log('Reading list table ready');
        }
    });
}

// Generate a unique user ID for new users
function generateUserId() {
    return uuidv4().replace(/-/g, '').substring(0, 12);
}

// Database helper functions
function getUserById(userId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function getUserByUsername(username) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function createUser(user) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO users (id, username, displayName, createdAt, isPublic) VALUES (?, ?, ?, ?, ?)',
            [user.id, user.username, user.displayName, user.createdAt, user.isPublic],
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

function updateUser(userId, updates) {
    return new Promise((resolve, reject) => {
        const fields = [];
        const values = [];
        
        if (updates.username !== undefined) {
            fields.push('username = ?');
            values.push(updates.username);
        }
        if (updates.displayName !== undefined) {
            fields.push('displayName = ?');
            values.push(updates.displayName);
        }
        if (updates.isPublic !== undefined) {
            fields.push('isPublic = ?');
            values.push(updates.isPublic);
        }
        
        if (fields.length === 0) {
            resolve();
            return;
        }
        
        values.push(userId);
        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
        
        db.run(query, values, function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function getReadingList(userId) {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM reading_list WHERE userId = ? ORDER BY addedAt DESC', [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function addReadingItem(item) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT OR REPLACE INTO reading_list (id, userId, title, summary, url, type, addedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [item.id, item.userId, item.title, item.summary, item.url, item.type, item.addedAt],
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

function deleteReadingItem(itemId, userId) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM reading_list WHERE id = ? AND userId = ?', [itemId, userId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function clearUserReadingList(userId) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM reading_list WHERE userId = ?', [userId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function getAllPublicUsers() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT u.id, u.username, u.displayName, u.isPublic, COUNT(r.id) as readingListCount
            FROM users u
            LEFT JOIN reading_list r ON u.id = r.userId
            WHERE u.isPublic = 1
            GROUP BY u.id
            ORDER BY readingListCount DESC
        `, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Create or get user profile
app.post('/api/user', async (req, res) => {
    try {
        const { userId, username, displayName } = req.body;
        
        if (!userId) {
            // Create new user
            const newUserId = generateUserId();
            const user = {
                id: newUserId,
                username: username || `user_${newUserId.substring(0, 6)}`,
                displayName: displayName || `User ${newUserId.substring(0, 6)}`,
                createdAt: new Date().toISOString(),
                isPublic: true
            };
            
            await createUser(user);
            res.json({ user, success: true });
        } else {
            // Get existing user
            const user = await getUserById(userId);
            if (user) {
                res.json({ user, success: true });
            } else {
                res.status(404).json({ error: 'User not found' });
            }
        }
    } catch (error) {
        console.error('Error in /api/user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user profile
app.put('/api/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { username, displayName, isPublic } = req.body;
        
        const user = await getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        await updateUser(userId, { username, displayName, isPublic });
        
        // Get updated user
        const updatedUser = await getUserById(userId);
        res.json({ user: updatedUser, success: true });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user's reading list
app.get('/api/user/:userId/reading-list', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (!user.isPublic) {
            return res.status(403).json({ error: 'Reading list is private' });
        }
        
        const readingList = await getReadingList(userId);
        res.json({ readingList, user });
    } catch (error) {
        console.error('Error getting reading list:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add item to reading list
app.post('/api/user/:userId/reading-list', async (req, res) => {
    try {
        const { userId } = req.params;
        const { title, summary, url, type = 'article' } = req.body;
        
        const user = await getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const newItem = {
            id: uuidv4(),
            userId,
            title,
            summary,
            url,
            type,
            addedAt: new Date().toISOString()
        };
        
        await addReadingItem(newItem);
        res.json({ item: newItem, success: true });
    } catch (error) {
        console.error('Error adding reading item:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove specific item from reading list
app.delete('/api/user/:userId/reading-list/:itemId', async (req, res) => {
    try {
        const { userId, itemId } = req.params;
        
        const user = await getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const changes = await deleteReadingItem(itemId, userId);
        if (changes > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Item not found' });
        }
    } catch (error) {
        console.error('Error deleting reading item:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Clear all reading list items for a user
app.delete('/api/user/:userId/reading-list', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const changes = await clearUserReadingList(userId);
        res.json({ success: true, deletedCount: changes });
    } catch (error) {
        console.error('Error clearing reading list:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get public users (for discovery)
app.get('/api/users/public', async (req, res) => {
    try {
        const users = await getAllPublicUsers();
        res.json({ users });
    } catch (error) {
        console.error('Error getting public users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user by username
app.get('/api/user/by-username/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        const user = await getUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (!user.isPublic) {
            return res.status(403).json({ error: 'User profile is private' });
        }
        
        const readingList = await getReadingList(user.id);
        res.json({ user, readingList });
    } catch (error) {
        console.error('Error getting user by username:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}); 