// API base URL
const API_BASE = 'http://localhost:3000/api';

// DOM elements
const discoverySection = document.getElementById('discovery');
const userProfileSection = document.getElementById('userProfile');
const usersList = document.getElementById('usersList');
const readingList = document.getElementById('readingList');
const usernameSearch = document.getElementById('usernameSearch');
const searchBtn = document.getElementById('searchBtn');
const backToDiscoveryBtn = document.getElementById('backToDiscovery');

// State
let currentUser = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Check if there's a user parameter in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('user');
    
    if (userParam) {
        // Direct link to user profile
        viewUserProfile(userParam);
    } else {
        // Show discovery page
        loadPublicUsers();
    }
    
    setupEventListeners();
});

function setupEventListeners() {
    searchBtn.addEventListener('click', handleSearch);
    usernameSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    backToDiscoveryBtn.addEventListener('click', showDiscovery);
}

async function handleSearch() {
    const username = usernameSearch.value.trim();
    if (!username) return;
    
    try {
        const response = await fetch(`${API_BASE}/user/by-username/${username}`);
        if (response.ok) {
            const data = await response.json();
            showUserProfile(data.user, data.readingList);
        } else {
            showError('User not found');
        }
    } catch (error) {
        console.error('Search error:', error);
        showError('Failed to search for user');
    }
}

async function loadPublicUsers() {
    try {
        showLoading(usersList);
        const response = await fetch(`${API_BASE}/users/public`);
        const data = await response.json();
        
        if (data.users.length === 0) {
            usersList.innerHTML = `
                <div class="loading">
                    <h3>No public users yet</h3>
                    <p>Be the first to share your reading list!</p>
                </div>
            `;
            return;
        }
        
        displayUsers(data.users);
    } catch (error) {
        console.error('Error loading users:', error);
        showError(usersList, 'Failed to load users');
    }
}

function displayUsers(users) {
    const usersHTML = users.map(user => `
        <div class="user-card" onclick="viewUserProfile('${user.username}')">
            <h3>${escapeHtml(user.displayName)}</h3>
            <p class="username">@${user.username}</p>
            <p class="stats">${user.readingListCount} items in reading list</p>
        </div>
    `).join('');
    
    usersList.innerHTML = usersHTML;
}

async function viewUserProfile(username) {
    try {
        const response = await fetch(`${API_BASE}/user/by-username/${username}`);
        if (response.ok) {
            const data = await response.json();
            showUserProfile(data.user, data.readingList);
            
            // Update URL without page reload
            const newUrl = `${window.location.origin}${window.location.pathname}?user=${username}`;
            window.history.pushState({ user: username }, '', newUrl);
        } else {
            showError('User not found');
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        showError('Failed to load user profile');
    }
}

function showUserProfile(user, readingList) {
    currentUser = user;
    
    // Update profile header
    document.getElementById('profileName').textContent = user.displayName;
    document.getElementById('profileUsername').textContent = `@${user.username}`;
    document.getElementById('profileStats').textContent = `${readingList.length} items in reading list`;
    
    // Display reading list
    if (readingList.length === 0) {
        document.getElementById('readingList').innerHTML = `
            <div class="loading">
                <h3>No items yet</h3>
                <p>This user hasn't added any content to their reading list.</p>
            </div>
        `;
    } else {
        displayReadingList(readingList);
    }
    
    // Show profile section
    discoverySection.classList.add('hidden');
    userProfileSection.classList.remove('hidden');
}

function displayReadingList(items) {
    const readingListHTML = items.map(item => {
        const date = new Date(item.addedAt).toLocaleDateString();
        const domain = extractDomain(item.url);
        
        return `
            <div class="reading-item">
                <div class="type-badge">${item.type || 'article'}</div>
                <h3>${escapeHtml(item.title)}</h3>
                <p class="summary">${escapeHtml(item.summary)}</p>
                <div class="meta">
                    <span class="domain">${domain}</span>
                    <span class="date">${date}</span>
                </div>
                <a href="${item.url}" target="_blank" class="btn btn-primary" style="margin-top: 15px; display: inline-block;">
                    Read Article
                </a>
            </div>
        `;
    }).join('');
    
    document.getElementById('readingList').innerHTML = readingListHTML;
}

function showDiscovery() {
    userProfileSection.classList.add('hidden');
    discoverySection.classList.remove('hidden');
    currentUser = null;
    usernameSearch.value = '';
    
    // Update URL to remove user parameter
    const newUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.pushState({}, '', newUrl);
}

// Handle browser back/forward buttons
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.user) {
        viewUserProfile(event.state.user);
    } else {
        showDiscovery();
    }
});

function showLoading(container) {
    container.innerHTML = '<div class="loading">Loading...</div>';
}

function showError(container, message) {
    container.innerHTML = `<div class="error">${message}</div>`;
}

function extractDomain(url) {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return 'unknown';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
} 
