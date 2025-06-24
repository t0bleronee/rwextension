// background.js

// API base URL
const API_BASE = 'http://localhost:3000/api';

// User state
let currentUser = null;
let userInitializationPromise = null;

// Check server connectivity
async function checkServerConnectivity() {
  try {
    const response = await fetch(`${API_BASE}/users/public`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log("[BACKGROUND] Server connectivity check:", response.ok ? "SUCCESS" : "FAILED");
    return response.ok;
  } catch (error) {
    console.error("[BACKGROUND] Server connectivity check failed:", error);
    return false;
  }
}

// Initialize user on extension load
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Service Worker: Installed");
  await checkServerConnectivity();
  await initializeUser();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log("Service Worker: Startup");
  await checkServerConnectivity();
  await initializeUser();
});

// Initialize or get user - with promise caching
async function initializeUser() {
  // If already initializing, wait for that promise
  if (userInitializationPromise) {
    return await userInitializationPromise;
  }
  
  // Create new initialization promise
  userInitializationPromise = createUserInitializationPromise();
  return await userInitializationPromise;
}

async function createUserInitializationPromise() {
  try {
    console.log("[BACKGROUND] Starting user initialization...");
    
    // Check server connectivity first
    const serverAvailable = await checkServerConnectivity();
    
    // Check if we have a stored user ID
    const result = await chrome.storage.local.get(['userId']);
    
    if (result.userId && serverAvailable) {
      console.log("[BACKGROUND] Found stored user ID:", result.userId);
      
      // Get existing user
      const response = await fetch(`${API_BASE}/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: result.userId })
      });
      
      if (response.ok) {
        const data = await response.json();
        currentUser = data.user;
        console.log("✅ User loaded:", currentUser);
        return currentUser;
      } else {
        console.log("[BACKGROUND] Stored user not found, creating new one");
        // User not found, create new one
        return await createNewUser();
      }
    } else {
      console.log("[BACKGROUND] No stored user ID or server unavailable, creating new user");
      // No user ID stored, create new user
      return await createNewUser();
    }
  } catch (error) {
    console.error("[BACKGROUND] Error initializing user:", error);
    // Create a basic user object as fallback
    currentUser = {
      id: 'temp_' + Date.now(),
      username: 'user_' + Math.random().toString(36).substr(2, 6),
      displayName: 'User',
      isPublic: true
    };
    return currentUser;
  } finally {
    // Clear the promise so next initialization can proceed
    userInitializationPromise = null;
  }
}

async function createNewUser() {
  try {
    console.log("[BACKGROUND] Creating new user...");
    const response = await fetch(`${API_BASE}/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (response.ok) {
      const data = await response.json();
      currentUser = data.user;
      
      // Store user ID locally
      await chrome.storage.local.set({ userId: currentUser.id });
      console.log("✅ New user created:", currentUser);
      return currentUser;
    } else {
      throw new Error('Failed to create user on server');
    }
  } catch (error) {
    console.error("[BACKGROUND] Error creating user:", error);
    // Create a local user as fallback
    const fallbackUser = {
      id: 'local_' + Date.now(),
      username: 'user_' + Math.random().toString(36).substr(2, 6),
      displayName: 'Local User',
      isPublic: true
    };
    currentUser = fallbackUser;
    await chrome.storage.local.set({ userId: fallbackUser.id });
    return fallbackUser;
  }
}

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  console.log("[BACKGROUND] Received message:", msg);
  
  if (msg.type === "PAGE_CAPTURE") {
    chrome.tabs.sendMessage(sender.tab.id, {
      type: "SUMMARIZE_WITH_WEBLLM",
      title: msg.title,
      content: msg.content,
      url: msg.url,
    });
  }

  if (msg.type === "SUMMARY_RESULT") {
    const { title, summary, url, time } = msg;

    // Generate a unique ID for the item
    const itemId = crypto.randomUUID();

    // Save locally with item ID
    chrome.storage.local.set({
      [url]: { 
        id: itemId,
        title, 
        summary, 
        url, 
        time 
      },
    });

    // Sync to server if user is available
    if (currentUser && currentUser.id && !currentUser.id.startsWith('temp_') && !currentUser.id.startsWith('local_') && !currentUser.id.startsWith('fallback_')) {
      try {
        await fetch(`${API_BASE}/user/${currentUser.id}/reading-list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: itemId,
            title,
            summary,
            url,
            type: 'article'
          })
        });
        console.log("✅ Summary synced to server for:", url);
      } catch (error) {
        console.error("Error syncing to server:", error);
      }
    }

    console.log("✅ Summary saved for:", url);
  }

  // Handle user management messages
  if (msg.type === "GET_USER_INFO") {
    // Ensure user is initialized
    if (!currentUser) {
      try {
        await initializeUser();
      } catch (error) {
        console.error("[BACKGROUND] Failed to initialize user for popup:", error);
      }
    }
    
    sendResponse({ user: currentUser });
    return true;
  }

  if (msg.type === "UPDATE_USER_PROFILE") {
    console.log("[BACKGROUND] Starting profile update handler...");
    
    // Ensure user is initialized
    if (!currentUser) {
      try {
        await initializeUser();
      } catch (error) {
        console.error("[BACKGROUND] Failed to initialize user for profile update:", error);
        sendResponse({ success: false, error: 'User not initialized' });
        return true;
      }
    }
    
    try {
      console.log("[BACKGROUND] Updating user profile:", currentUser.id, msg.data);
      
      const response = await fetch(`${API_BASE}/user/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg.data)
      });
      
      console.log("[BACKGROUND] Server response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("[BACKGROUND] Server response data:", data);
        currentUser = data.user;
        console.log("[BACKGROUND] Profile updated successfully:", currentUser);
        
        const responseToSend = { success: true, user: currentUser };
        console.log("[BACKGROUND] Sending response to popup:", responseToSend);
        sendResponse(responseToSend);
        console.log("[BACKGROUND] Response sent to popup successfully");
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("[BACKGROUND] Server error:", response.status, errorData);
        const errorResponse = { success: false, error: errorData.error || 'Failed to update profile' };
        console.log("[BACKGROUND] Sending error response to popup:", errorResponse);
        sendResponse(errorResponse);
      }
    } catch (error) {
      console.error("[BACKGROUND] Network error updating profile:", error);
      const errorResponse = { success: false, error: 'Network error. Please check your connection.' };
      console.log("[BACKGROUND] Sending network error response to popup:", errorResponse);
      sendResponse(errorResponse);
    }
    return true;
  }

  if (msg.type === "GET_PUBLIC_PROFILE_URL") {
    // Ensure user is initialized
    if (!currentUser) {
      try {
        await initializeUser();
      } catch (error) {
        console.error("[BACKGROUND] Failed to initialize user for profile URL:", error);
        sendResponse({ error: 'User not initialized' });
        return true;
      }
    }
    
    if (currentUser && currentUser.username) {
      const profileUrl = `http://localhost:3000/?user=${currentUser.username}`;
      sendResponse({ url: profileUrl });
    } else {
      sendResponse({ error: 'No user found' });
    }
    return true;
  }

  if (msg.type === "GET_CURRENT_USER_ID") {
    // Ensure user is initialized
    if (!currentUser) {
      try {
        await initializeUser();
      } catch (error) {
        console.error("[BACKGROUND] Failed to initialize user for user ID:", error);
        sendResponse({ error: 'User not initialized' });
        return true;
      }
    }
    
    if (currentUser && currentUser.id) {
      sendResponse({ userId: currentUser.id });
    } else {
      sendResponse({ error: 'No user found' });
    }
    return true;
  }

  return true; // for async sendResponse
});


