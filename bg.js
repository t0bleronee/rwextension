const sqlite3 = require('sqlite3').verbose();

// Open the database
const db = new sqlite3.Database('./profiles.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
        return;
    }
    console.log('Connected to database');
    viewDatabase();
});

function viewDatabase() {
    console.log('\n=== DATABASE CONTENTS ===\n');
    
    // View users
    db.all('SELECT * FROM users', [], (err, users) => {
        if (err) {
            console.error('Error reading users:', err);
        } else {
            console.log('USERS:');
            console.log('ID | Username | Display Name | Created | Public');
            console.log('---|----------|--------------|---------|-------');
            users.forEach(user => {
                console.log(`${user.id} | ${user.username} | ${user.displayName} | ${user.createdAt} | ${user.isPublic}`);
            });
            console.log(`\nTotal users: ${users.length}\n`);
        }
        
        // View reading list items
        db.all('SELECT * FROM reading_list ORDER BY addedAt DESC', [], (err, items) => {
            if (err) {
                console.error('Error reading items:', err);
            } else {
                console.log('READING LIST ITEMS:');
                console.log('ID | User ID | Title | URL | Added');
                console.log('---|---------|-------|-----|------');
                items.forEach(item => {
                    const shortTitle = item.title.length > 30 ? item.title.substring(0, 30) + '...' : item.title;
                    const shortUrl = item.url.length > 30 ? item.url.substring(0, 30) + '...' : item.url;
                    console.log(`${item.id} | ${item.userId} | ${shortTitle} | ${shortUrl} | ${item.addedAt}`);
                });
                console.log(`\nTotal items: ${items.length}\n`);
            }
            
            // Show summary
            db.get('SELECT COUNT(*) as userCount FROM users', [], (err, userCount) => {
                db.get('SELECT COUNT(*) as itemCount FROM reading_list', [], (err, itemCount) => {
                    console.log('SUMMARY:');
                    console.log(`- Users: ${userCount.userCount}`);
                    console.log(`- Reading list items: ${itemCount.itemCount}`);
                    console.log('\n=== END DATABASE CONTENTS ===\n');
                    
                    // Close database
                    db.close((err) => {
                        if (err) {
                            console.error('Error closing database:', err);
                        } else {
                            console.log('Database connection closed');
                        }
                    });
                });
            });
        });
    });
} 
