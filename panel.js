// popup.js
// ... (full advanced code as provided by the user) ...
// The full code is already provided in the user message and will be inserted here.
// popup.js
document.addEventListener('DOMContentLoaded', async () => {
    const summaryList = document.getElementById('summaryList');
    const searchBox = document.getElementById('searchBox');
    const clearAllBtn = document.getElementById('clearAll');
    const shareBtn = document.getElementById('shareBtn');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const userUsername = document.getElementById('userUsername');
    const profileModal = document.getElementById('profileModal');
    const profileForm = document.getElementById('profileForm');
    const cancelBtn = document.getElementById('cancelBtn');
    
    let allSummaries = [];
    let currentUser = null;
    let webllmReady = false;
    
    // Reference to the Save button (update selector as needed)
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.title = 'AI summarizer is loading...';
    }
    
    // Initialize user profile with retry
    async function initializeUserProfile() {
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          console.log(`[POPUP] Attempting to load user profile (attempt ${retryCount + 1})`);
          const response = await chrome.runtime.sendMessage({ type: "GET_USER_INFO" });
          
          if (response && response.user) {
            currentUser = response.user;
            updateUserDisplay();
            console.log("[POPUP] User profile loaded successfully:", currentUser);
            return;
          } else {
            console.warn("[POPUP] No user data received from background");
          }
        } catch (error) {
          console.error(`[POPUP] Error loading user profile (attempt ${retryCount + 1}):`, error);
        }
        
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`[POPUP] Retrying in 1 second...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // If all retries failed, show a fallback user
      console.warn("[POPUP] Failed to load user profile, using fallback");
      currentUser = {
        id: 'fallback_' + Date.now(),
        username: 'user_' + Math.random().toString(36).substr(2, 6),
        displayName: 'User',
        isPublic: true
      };
      updateUserDisplay();
    }
    
    function updateUserDisplay() {
      console.log("[POPUP] updateUserDisplay called with currentUser:", currentUser);
      
      // Check if DOM elements exist
      if (!userAvatar || !userName || !userUsername) {
        console.error("[POPUP] DOM elements not found:", {
          userAvatar: !!userAvatar,
          userName: !!userName,
          userUsername: !!userUsername
        });
        return;
      }
      
      if (currentUser) {
        console.log("[POPUP] Updating display with:", {
          displayName: currentUser.displayName,
          username: currentUser.username,
          id: currentUser.id,
          avatar: currentUser.displayName.charAt(0).toUpperCase()
        });
        
        userAvatar.textContent = currentUser.displayName.charAt(0).toUpperCase();
        userName.textContent = currentUser.displayName;
        userUsername.textContent = `@${currentUser.username}`;
        
        // Update user ID display
        const userIdElement = document.getElementById('userId');
        if (userIdElement) {
          userIdElement.textContent = `ID: ${currentUser.id}`;
          userIdElement.style.cursor = 'pointer';
          userIdElement.title = 'Click to copy user ID';
          userIdElement.onclick = () => {
            navigator.clipboard.writeText(currentUser.id).then(() => {
              // Show a brief visual feedback
              const originalText = userIdElement.textContent;
              userIdElement.textContent = 'ID: Copied!';
              userIdElement.style.color = '#10b981';
              setTimeout(() => {
                userIdElement.textContent = originalText;
                userIdElement.style.color = '#6b7280';
              }, 1000);
            });
          };
        }
        
        console.log("[POPUP] Display updated successfully");
      } else {
        console.log("[POPUP] No currentUser, setting default values");
        userAvatar.textContent = 'U';
        userName.textContent = 'User';
        userUsername.textContent = '@user';
        
        // Update user ID display
        const userIdElement = document.getElementById('userId');
        if (userIdElement) {
          userIdElement.textContent = 'ID: Not available';
        }
      }
    }
    
    // Load all summaries from storage
    async function loadSummaries() {
        try {
            const result = await chrome.storage.local.get(null);
            allSummaries = Object.values(result).filter(item => 
                item && item.title && item.summary && item.url
            );
            
            // Sort by time (newest first)
            allSummaries.sort((a, b) => (b.time || 0) - (a.time || 0));
            
            displaySummaries(allSummaries);
        } catch (error) {
            console.error('Error loading summaries:', error);
            summaryList.innerHTML = '<div class="empty-state"><h3>Error</h3><p>Failed to load summaries</p></div>';
        }
    }
    
    // Display summaries in the UI
    function displaySummaries(summaries) {
        if (summaries.length === 0) {
            summaryList.innerHTML = `
                <div class="empty-state">
                    <h3>No summaries yet</h3>
                    <p>Browse some articles and they'll appear here automatically!</p>
                </div>
            `;
            return;
        }
        
        const summaryHTML = summaries.map(item => {
            const date = new Date(item.time || Date.now()).toLocaleDateString();
            const domain = extractDomain(item.url);
            const truncatedSummary = truncateText(item.summary, 150);
            
            return `
                <div class="summary-item" data-url="${encodeURIComponent(item.url)}" data-time="${item.time || Date.now()}">
                    <div class="summary-title">${escapeHtml(item.title)}</div>
                    <div class="summary-text">${escapeHtml(truncatedSummary)}</div>
                    <div class="summary-meta">
                        <span class="summary-date">${date}</span>
                        <span class="summary-domain">${domain}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        summaryList.innerHTML = summaryHTML;
        
        // Add click handlers to open URLs
        summaryList.querySelectorAll('.summary-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const url = decodeURIComponent(item.dataset.url);
                chrome.tabs.create({ url });
            });
        });
    }
    
    // Search functionality
    function filterSummaries(query) {
        if (!query.trim()) {
            displaySummaries(allSummaries);
            return;
        }
        
        const filtered = allSummaries.filter(item => 
            item.title.toLowerCase().includes(query.toLowerCase()) ||
            item.summary.toLowerCase().includes(query.toLowerCase()) ||
            extractDomain(item.url).toLowerCase().includes(query.toLowerCase())
        );
        
        displaySummaries(filtered);
    }
    
    // Clear all summaries
    async function clearAllSummaries() {
        if (confirm('Are you sure you want to delete all summaries? This cannot be undone.')) {
            try {
                // Clear local storage
                await chrome.storage.local.clear();
                
                // Clear from server if user is authenticated
                if (currentUser && currentUser.id && !currentUser.id.startsWith('temp_') && !currentUser.id.startsWith('local_') && !currentUser.id.startsWith('fallback_')) {
                    try {
                        await fetch(`http://localhost:3000/api/user/${currentUser.id}/reading-list`, {
                            method: 'DELETE'
                        });
                        console.log("✅ All items cleared from server");
                    } catch (error) {
                        console.error("Error clearing from server:", error);
                    }
                }
                
                allSummaries = [];
                displaySummaries([]);
                console.log('All summaries cleared');
            } catch (error) {
                console.error('Error clearing summaries:', error);
                alert('Failed to clear summaries. Please try again.');
            }
        }
    }
    
    // Share profile functionality
    async function shareProfile() {
      if (!currentUser) {
        console.log("[POPUP] No user found, attempting to initialize...");
        await initializeUserProfile();
      }
      
      if (!currentUser) {
        alert('Unable to load user profile. Please try refreshing the extension.');
        return;
      }
      
      try {
        const response = await chrome.runtime.sendMessage({ type: "GET_PUBLIC_PROFILE_URL" });
        if (response && response.url) {
          // Copy to clipboard
          await navigator.clipboard.writeText(response.url);
          alert('Profile URL copied to clipboard!');
          
          // Also open the profile in a new tab
          chrome.tabs.create({ url: response.url });
        } else {
          alert(response?.error || 'Failed to get profile URL');
        }
      } catch (error) {
        console.error('Error sharing profile:', error);
        alert('Failed to share profile. Please try again.');
      }
    }
    
    // Profile modal functionality
    function showProfileModal() {
      if (currentUser) {
        document.getElementById('displayName').value = currentUser.displayName || '';
        document.getElementById('username').value = currentUser.username || '';
      } else {
        // Clear fields if no user
        document.getElementById('displayName').value = '';
        document.getElementById('username').value = '';
      }
      profileModal.classList.add('show');
    }
    
    function hideProfileModal() {
      profileModal.classList.remove('show');
    }
    
    async function updateProfile(formData) {
      // Show loading state
      const submitBtn = document.querySelector('#profileForm button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Saving...';
      submitBtn.disabled = true;
      
      try {
        console.log("[POPUP] Updating profile with data:", formData);
        
        // Send message to background (we know it works from the logs)
        chrome.runtime.sendMessage({
          type: "UPDATE_USER_PROFILE",
          data: {
            displayName: formData.displayName,
            username: formData.username
          }
        });
        
        // Wait a moment for the background to process
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Reload user data from background
        console.log("[POPUP] Reloading user data...");
        const userResponse = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: "GET_USER_INFO" }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });
        
        if (userResponse && userResponse.user) {
          console.log("[POPUP] Got updated user data:", userResponse.user);
          currentUser = userResponse.user;
          updateUserDisplay();
          hideProfileModal();
          
          // Show success message
          const successDiv = document.createElement('div');
          successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease;
          `;
          successDiv.textContent = 'Profile updated successfully!';
          document.body.appendChild(successDiv);
          
          setTimeout(() => {
            if (successDiv.parentNode) {
              successDiv.parentNode.removeChild(successDiv);
            }
          }, 3000);
          
        } else {
          throw new Error('Failed to reload user data');
        }
        
      } catch (error) {
        console.error("[POPUP] Error updating profile:", error);
        
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #ef4444;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          z-index: 10000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          animation: slideIn 0.3s ease;
        `;
        errorDiv.textContent = 'Failed to update profile. Please try again.';
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
          if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
          }
        }, 4000);
      } finally {
        // Reset button state
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    }
    
    // Helper functions
    function extractDomain(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return 'unknown';
        }
    }
    
    function truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Event listeners
    searchBox.addEventListener('input', (e) => {
        filterSummaries(e.target.value);
    });
    
    clearAllBtn.addEventListener('click', clearAllSummaries);
    shareBtn.addEventListener('click', shareProfile);
    
    // Profile modal events
    userAvatar.addEventListener('click', showProfileModal);
    userName.addEventListener('click', showProfileModal);
    
    cancelBtn.addEventListener('click', hideProfileModal);
    
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = {
        displayName: document.getElementById('displayName').value,
        username: document.getElementById('username').value
      };
      await updateProfile(formData);
    });
    
    // Close modal when clicking outside
    profileModal.addEventListener('click', (e) => {
      if (e.target === profileModal) {
        hideProfileModal();
      }
    });
    
    // Initialize
    initializeUserProfile();
    loadSummaries();
    
    // Refresh summaries when storage changes
    chrome.storage.onChanged.addListener(() => {
        loadSummaries();
    });
    
    // --- LLM Integration for Summarization ---
    // 1. Add the LLM runner iframe (once)
    let llmIframe = document.getElementById('llm-runner-iframe');
    if (!llmIframe) {
      llmIframe = document.createElement('iframe');
      llmIframe.id = 'llm-runner-iframe';
      llmIframe.style.display = 'none';
      llmIframe.src = chrome.runtime.getURL('webllm/webllm-runner.html');
      document.body.appendChild(llmIframe);
    }
  
    // 2. Function to generate summary using LLM
    function generateSummaryWithLLM(articleContent) {
      return new Promise((resolve, reject) => {
        const id = 'summarize_' + Date.now();
        function handleMessage(event) {
          if (event.data && event.data.id === id) {
            window.removeEventListener('message', handleMessage);
            resolve(event.data.reply);
          }
        }
        window.addEventListener('message', handleMessage);
        llmIframe.contentWindow.postMessage({ id, content: articleContent }, '*');
      });
    }
  
    // Listen for ready message from LLM iframe
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'WEBLLM_READY') {
        webllmReady = true;
        console.log('[PANEL] WebLLM is now ready!');
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.title = '';
        }
      }
    });
  
    // Wait for LLM to be ready before generating summary
    async function safeGenerateSummary(articleContent) {
      let tries = 0;
      while (!webllmReady && tries < 60) { // wait up to 30 seconds
        if (tries === 0) {
          alert('The AI summarizer is still loading. Please wait a few seconds...');
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        tries++;
      }
      if (!webllmReady) {
        alert('The AI summarizer failed to load. Please try again later.');
        return 'Error: WebLLM not ready.';
      }
      return await generateSummaryWithLLM(articleContent);
    }
  
    // Use safeGenerateSummary in saveArticle
    async function saveArticle(title, url, articleContent) {
      if (!webllmReady) {
        alert('The AI summarizer is still loading. Please wait until it is ready.');
        return;
      }
      const summary = await safeGenerateSummary(articleContent);
      const item = { title, url, summary, time: Date.now() };
      await chrome.storage.local.set({ [url]: item });
      if (typeof loadSummaries === 'function') loadSummaries();
    }
  });
  
