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
const followBtn = document.getElementById('followBtn');
const unfollowBtn = document.getElementById('unfollowBtn');
const allUsersTab = document.getElementById('allUsersTab');
const followingTab = document.getElementById('followingTab');

// State
let currentUser = null;
let currentViewingUser = null;
let currentUserId = null; // The logged-in user's ID (from extension)

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
    getCurrentUserId();
});

function setupEventListeners() {
    searchBtn.addEventListener('click', handleSearch);
    usernameSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    backToDiscoveryBtn.addEventListener('click', showDiscovery);
    followBtn.addEventListener('click', handleFollow);
    unfollowBtn.addEventListener('click', handleUnfollow);
    allUsersTab.addEventListener('click', () => switchTab('all'));
    followingTab.addEventListener('click', () => switchTab('following'));
}

// Add a logout button to the UI if logged in
function addLogoutButton() {
    let logoutBtn = document.getElementById('logoutBtn');
    if (!logoutBtn) {
        logoutBtn = document.createElement('button');
        logoutBtn.id = 'logoutBtn';
        logoutBtn.className = 'btn btn-secondary';
        logoutBtn.textContent = 'Log Out';
        logoutBtn.style.marginLeft = '1em';
        logoutBtn.addEventListener('click', handleLogout);
        const discoveryHeader = document.querySelector('.discovery-header');
        if (discoveryHeader) {
            discoveryHeader.appendChild(logoutBtn);
        }
    }
}

function handleLogout() {
    localStorage.removeItem('currentUserId');
    currentUserId = null;
    location.reload();
}

// Enhanced getCurrentUserId with validation
async function getCurrentUserId() {
    try {
        // Try to get from localStorage first (set by extension)
        const storedUserId = localStorage.getItem('currentUserId');
        if (storedUserId) {
            // Validate with backend
            const resp = await fetch(`${API_BASE}/user/${storedUserId}/validate`);
            const data = await resp.json();
            if (data.valid) {
                currentUserId = storedUserId;
                console.log('Validated user ID from localStorage:', currentUserId);
                addLogoutButton();
                return;
            } else {
                // Invalid user, clear and prompt
                localStorage.removeItem('currentUserId');
                currentUserId = null;
                showLoginPrompt();
                return;
            }
        }
        // If not in localStorage, try to get from extension
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            try {
                const response = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({ type: "GET_CURRENT_USER_ID" }, (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(response);
                        }
                    });
                });
                if (response && response.userId) {
                    // Validate with backend
                    const resp = await fetch(`${API_BASE}/user/${response.userId}/validate`);
                    const data = await resp.json();
                    if (data.valid) {
                        currentUserId = response.userId;
                        localStorage.setItem('currentUserId', currentUserId);
                        console.log('Validated user ID from extension:', currentUserId);
                        addLogoutButton();
                        return;
                    } else {
                        currentUserId = null;
                        showLoginPrompt();
                        return;
                    }
                }
            } catch (error) {
                console.log('Extension not available or error getting user ID:', error);
                showLoginPrompt();
            }
        } else {
            console.log('Chrome extension API not available');
            showLoginPrompt();
        }
    } catch (error) {
        console.error('Error getting current user ID:', error);
        showLoginPrompt();
    }
}

function showLoginPrompt() {
    // Add a login prompt to the discovery section
    const discoveryHeader = document.querySelector('.discovery-header');
    if (discoveryHeader && !document.getElementById('loginPrompt')) {
        const loginPrompt = document.createElement('div');
        loginPrompt.id = 'loginPrompt';
        loginPrompt.className = 'login-prompt';
        loginPrompt.innerHTML = `
            <div class="login-box">
                <h3>🔐 Login Required</h3>
                <p>To use follow features, you need to:</p>
                <ol>
                    <li>Install the Read & Watch Logger extension</li>
                    <li>Or enter your user ID manually below</li>
                </ol>
                <div class="login-input">
                    <input type="text" id="manualUserId" placeholder="Enter your user ID..." />
                    <button id="loginBtn" class="btn btn-primary">Login</button>
                </div>
                <p class="login-note">💡 You can find your user ID in the extension popup</p>
            </div>
        `;
        discoveryHeader.appendChild(loginPrompt);
        
        // Add event listener for manual login
        document.getElementById('loginBtn').addEventListener('click', handleManualLogin);
        document.getElementById('manualUserId').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleManualLogin();
        });
    }
}

async function handleManualLogin() {
    const userId = document.getElementById('manualUserId').value.trim();
    if (!userId) {
        alert('Please enter a user ID');
        return;
    }
    
    try {
        // Verify the user exists
        const response = await fetch(`${API_BASE}/user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUserId = data.user.id;
            localStorage.setItem('currentUserId', currentUserId);
            console.log('Manual login successful:', currentUserId);
            
            // Remove login prompt
            const loginPrompt = document.getElementById('loginPrompt');
            if (loginPrompt) {
                loginPrompt.remove();
            }
            addLogoutButton();
            // Refresh the current view
            if (followingTab.classList.contains('active')) {
                loadFollowingUsers();
            }
            
            alert('Login successful! You can now use follow features.');
        } else {
            alert('Invalid user ID. Please check and try again.');
        }
    } catch (error) {
        console.error('Manual login error:', error);
        alert('Login failed. Please try again.');
    }
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

async function loadFollowingUsers() {
    if (!currentUserId) {
        showError(usersList, 'Please log in to view following list');
        return;
    }
    
    try {
        showLoading(usersList);
        const response = await fetch(`${API_BASE}/user/${currentUserId}/following`);
        const data = await response.json();
        
        if (data.following.length === 0) {
            usersList.innerHTML = `
                <div class="loading">
                    <h3>Not following anyone yet</h3>
                    <p>Start following users to see them here!</p>
                </div>
            `;
            return;
        }
        
        displayUsers(data.following);
    } catch (error) {
        console.error('Error loading following users:', error);
        showError(usersList, 'Failed to load following list');
    }
}

function displayUsers(users) {
    const usersHTML = users.map(user => `
        <div class="user-card" onclick="viewUserProfile('${user.username}')">
            <h3>${escapeHtml(user.displayName)}</h3>
            <p class="username">@${user.username}</p>
            <p class="stats">${user.readingListCount || 0} items in reading list</p>
        </div>
    `).join('');
    
    usersList.innerHTML = usersHTML;
}

function switchTab(tab) {
    if (tab === 'all') {
        allUsersTab.classList.add('active');
        followingTab.classList.remove('active');
        loadPublicUsers();
    } else if (tab === 'following') {
        followingTab.classList.add('active');
        allUsersTab.classList.remove('active');
        loadFollowingUsers();
    }
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

async function showUserProfile(user, readingList) {
    currentViewingUser = user;
    
    // Update profile header
    document.getElementById('profileName').textContent = user.displayName;
    document.getElementById('profileUsername').textContent = `@${user.username}`;
    document.getElementById('profileStats').textContent = `${readingList.length} items in reading list`;
    
    // Show/hide follow buttons based on current user
    await updateFollowButtons(user);
    
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

async function updateFollowButtons(user) {
    const followBtn = document.getElementById('followBtn');
    const unfollowBtn = document.getElementById('unfollowBtn');
    
    // Hide both buttons initially
    followBtn.classList.add('hidden');
    unfollowBtn.classList.add('hidden');
    
    // If no current user or viewing own profile, don't show follow buttons
    if (!currentUserId || currentUserId === user.id) {
        return;
    }
    
    try {
        // Check if current user is following this user
        const response = await fetch(`${API_BASE}/user/${currentUserId}/following/${user.id}`);
        const data = await response.json();
        
        if (data.isFollowing) {
            unfollowBtn.classList.remove('hidden');
        } else {
            followBtn.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error checking follow status:', error);
    }
}

async function handleFollow() {
    if (!currentUserId || !currentViewingUser) return;
    
    try {
        const response = await fetch(`${API_BASE}/user/${currentUserId}/follow/${currentViewingUser.id}`, {
            method: 'POST'
        });
        
        if (response.ok) {
            await updateFollowButtons(currentViewingUser);
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to follow user');
        }
    } catch (error) {
        console.error('Error following user:', error);
        alert('Failed to follow user');
    }
}

async function handleUnfollow() {
    if (!currentUserId || !currentViewingUser) return;
    
    try {
        const response = await fetch(`${API_BASE}/user/${currentUserId}/follow/${currentViewingUser.id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await updateFollowButtons(currentViewingUser);
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to unfollow user');
        }
    } catch (error) {
        console.error('Error unfollowing user:', error);
        alert('Failed to unfollow user');
    }
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
    currentViewingUser = null;
    usernameSearch.value = '';
    
    // Update URL to remove user parameter
    const newUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.pushState({}, '', newUrl);
    
    // Load the appropriate tab content
    if (followingTab.classList.contains('active')) {
        loadFollowingUsers();
    } else {
        loadPublicUsers();
    }
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
