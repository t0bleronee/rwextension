// popup.js
document.addEventListener('DOMContentLoaded', async () => {
  const summaryList = document.getElementById('summaryList');
  const searchBox = document.getElementById('searchBox');
  const clearAllBtn = document.getElementById('clearAll');
  
  let allSummaries = [];
  
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
              <div class="summary-item" data-url="${encodeURIComponent(item.url)}">
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
          item.addEventListener('click', () => {
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
              await chrome.storage.local.clear();
              allSummaries = [];
              displaySummaries([]);
              console.log('All summaries cleared');
          } catch (error) {
              console.error('Error clearing summaries:', error);
              alert('Failed to clear summaries. Please try again.');
          }
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
  
  // Load summaries on startup
  loadSummaries();
  
  // Refresh summaries when storage changes
  chrome.storage.onChanged.addListener(() => {
      loadSummaries();
  });
});