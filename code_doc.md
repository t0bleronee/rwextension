
## 🛠️ Implementation Details

### 1. **Backend & API Design**

- **Framework:** The backend is built with [Express.js](https://expressjs.com/), exposing a RESTful API.
- **Endpoints:**  
  - **User Management:**  
    - `POST /api/user` — Create or fetch a user profile.  
    - `PUT /api/user/:userId` — Update user profile (username, display name).  
    - `GET /api/user/:userId/validate` — Validate if a user ID exists.  
    - `GET /api/user/by-username/:username` — Fetch user by username.  
  - **Reading List:**  
    - `GET /api/user/:userId/reading-list` — Fetch a user’s reading list (if public).  
    - `POST /api/user/:userId/reading-list` — Add an item to the reading list.  
    - `DELETE /api/user/:userId/reading-list` — Clear all items for a user.  
  - **Social Features:**  
    - `POST /api/user/:followerId/follow/:followingId` — Follow a user.  
    - `DELETE /api/user/:followerId/follow/:followingId` — Unfollow a user.  
    - `GET /api/user/:userId/following` — List users you follow.  
    - `GET /api/user/:followerId/following/:followingId` — Check if following.  
    - `GET /api/users/public` — List all public users for discovery.  
    - `GET /api/user/:userId/followers` — (Backend only) List your followers (no frontend UI).

- **Error Handling:** All endpoints return clear error messages and HTTP status codes for invalid requests or server errors.

---

### 2. **Database Structure**

- **Database:** Uses [SQLite](https://www.sqlite.org/index.html) for simplicity and portability.
- **Tables:**
  - **users**
    - `id` (TEXT, PRIMARY KEY)  
    - `username` (TEXT, UNIQUE)  
    - `displayName` (TEXT)  
    - `createdAt` (TEXT)  
    - `isPublic` (BOOLEAN, default true; used for filtering public users and reading lists)  
  - **reading_list**
    - `id` (TEXT, PRIMARY KEY)  
    - `userId` (TEXT, FOREIGN KEY)  
    - `title` (TEXT)  
    - `summary` (TEXT)  
    - `url` (TEXT)  
    - `type` (TEXT, e.g., 'article', 'video')  
    - `addedAt` (TEXT)  
  - **follows**
    - `id` (TEXT, PRIMARY KEY)  
    - `followerId` (TEXT, FOREIGN KEY)  
    - `followingId` (TEXT, FOREIGN KEY)  
    - `createdAt` (TEXT)  
    - `UNIQUE(followerId, followingId)`

- **Initialization:** Tables are created automatically on server startup if they do not exist.

---

### 3. **Frontend Logic**

- **Framework:** Vanilla JavaScript, HTML, and CSS.
- **User Authentication:**  
  - User ID is stored in `localStorage` and validated with the backend on every load.  
  - Manual login and logout are supported.  
- **API Integration:**  
  - All user actions (login, follow, add to reading list, etc.) are performed via AJAX calls to the backend API.  
  - UI updates dynamically based on API responses.  
- **Error Handling:**  
  - User-friendly error messages and prompts for all failed actions.  

---

### 4. **Chrome Extension Integration**

- **Purpose:**  
  - The extension can automatically set and retrieve the user ID, enabling seamless login and reading list logging from any page.  
- **Communication:**  
  - Uses `chrome.runtime.sendMessage` and `localStorage` to sync user identity between the extension and the web app.  
- **Manual Fallback:**  
  - Users can always enter their user ID manually if the extension is not available.

---

### 5. **LLM (Large Language Model) Integration**

- **Directory:**  
  - The `webllm/` folder contains scripts and models for optional LLM integration.  
- **Purpose:**  
  - Enables local summarization of articles or videos using models like TinyLlama.  
- **How it Works:**  
  - The web app or extension can call into the LLM scripts to generate summaries before saving to the reading list.  
  - Models and configuration files are included for easy setup and experimentation.  
- **Extensibility:**  
  - The architecture allows for easy swapping or upgrading of LLM models.

---

### 6. **Core Logic Highlights**

- **User Validation:**  
  - Every time the app loads, the stored user ID is validated with the backend to prevent stale or invalid sessions.  
- **Follow System:**  
  - Follows are managed with a dedicated table, supporting efficient queries for following relationships.  
- **Robust Session Management:**  
  - Users can log out and switch accounts at any time, and the app gracefully handles deleted or invalid users.


---
