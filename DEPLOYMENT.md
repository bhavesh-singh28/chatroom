# Deployment Guide: Render (Backend) + Netlify (Frontend)

This guide walks you through deploying **Our Chat** to production using:
- **Backend & Socket.IO**: [Render](https://render.com) (Free Web Service)
- **Frontend (React + Vite)**: [Netlify](https://netlify.com) (Free Starter Tier)
- **Database**: [MongoDB Atlas](https://www.mongodb.com/atlas) (Free M0 Cluster)

---

## 🏗️ Architecture in Production

```
   [ User Browser / Mobile ]
        │             │
        │ HTTPS       │ WSS / HTTPS (Socket.IO)
        ▼             ▼
  ┌───────────┐  ┌───────────────────────┐
  │  Netlify  │  │        Render         │
  │ (Frontend)│  │ (Backend & Socket.IO) │
  └───────────┘  └───────────┬───────────┘
                             │
                             │ Mongoose
                             ▼
                 ┌───────────────────────┐
                 │     MongoDB Atlas     │
                 │    (Cloud Database)   │
                 └───────────────────────┘
```

---

## Step 1: Set Up Free MongoDB Atlas Database

Since Render instances are stateless, your production chat history needs a cloud-hosted MongoDB database:

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas) and sign in or create a free account.
2. Click **Create** to deploy a new database:
   - Select **M0 Free** (Shared).
   - Choose your preferred cloud provider and region closest to you.
   - Name your cluster (e.g. `Cluster0`) and click **Create Deployment**.
3. **Set Up Security & Credentials**:
   - **Database User**: Create a username and password (e.g., username `chatuser`, generate a strong password). Save these credentials.
   - **Network Access**: Under *Network Access*, click **Add IP Address** and choose **Allow Access from Anywhere** (`0.0.0.0/0`). This allows Render servers to connect to your database.
4. **Get Connection String**:
   - Go to **Database** ➔ Click **Connect** on your cluster.
   - Select **Drivers** (Node.js).
   - Copy the connection URI. It will look like:
     ```
     mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/our-chat?retryWrites=true&w=majority
     ```
   - Replace `<username>` and `<password>` with your database user credentials.

---

## Step 2: Push Your Project to GitHub

Ensure your project is pushed to a GitHub repository:

```bash
cd /path/to/chatroom
git init
git add .
git commit -m "Initial commit: Our Chat app"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

---

## Step 3: Deploy Backend on Render

1. Log into your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** in the top navigation bar and select **Web Service**.
3. Connect your GitHub account and select your repository.
4. Configure the service settings:

| Setting | Value |
|---|---|
| **Name** | `our-chat-backend` (or your preferred name) |
| **Region** | Choose the region closest to you or your MongoDB cluster |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |
| **Instance Type** | `Free` |

5. Scroll down to **Environment Variables** and add:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | `mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/our-chat?retryWrites=true&w=majority` |

6. Click **Deploy Web Service**.
7. Render will build and deploy your Node.js application. Once deployment completes, copy your backend URL from the top of the page:
   ```
   https://our-chat-backend.onrender.com
   ```
8. **Verify Backend Health**:
   Open `https://<your-backend-name>.onrender.com/api/health` in your browser. You should see:
   ```json
   {
     "status": "ok",
     "mongoStatus": "connected",
     "onlineUsersCount": 0
   }
   ```

> 💡 **Render Free Tier Note**: Free Render web services spin down after 15 minutes of inactivity. When a user first opens the chat after idle time, the backend may take 30–50 seconds to cold start.

---

## Step 4: Deploy Frontend on Netlify

1. Log into your [Netlify Dashboard](https://app.netlify.com).
2. Click **Add new site** ➔ **Import an existing project**.
3. Connect with GitHub and select your repository.
4. The project includes a `netlify.toml` file at the root, which automatically pre-configures build settings:

| Setting | Value |
|---|---|
| **Base directory** | `frontend` |
| **Build command** | `npm run build` |
| **Publish directory** | `dist` (or `frontend/dist`) |

5. Under **Environment variables**, click **Add a variable**:

| Key | Value |
|---|---|
| `VITE_SERVER_URL` | `https://our-chat-backend.onrender.com` *(your Render backend URL from Step 3, without a trailing slash)* |

6. Click **Deploy our-chat** (or Deploy site).
7. Netlify will build the frontend. Once complete, you will receive a public URL such as:
   ```
   https://our-chat-xyz.netlify.app
   ```

---

## Step 5: Test Your Live Chat Room

1. Open your Netlify URL (`https://<your-app>.netlify.app`) on your computer.
2. Enter your username (e.g. `Alex`) and click **Join Chat**.
3. Open the same Netlify URL on your mobile phone or another browser tab / incognito window.
4. Enter another username (e.g. `Sarah`) and click **Join Chat**.
5. **Verify**:
   - Both users see each other in the **Online Members** list.
   - Messages sent from either device appear immediately in real time.
   - Disconnecting a device triggers the `left the room` notification.
   - Refreshing or closing the tab and rejoining retrieves all previously sent messages from MongoDB.

---

## 🛠️ Troubleshooting & FAQ

### 1. "Failed to connect" or Socket.IO connection timeout
- Check that `VITE_SERVER_URL` in Netlify does **not** have a trailing slash:
  - ✅ `https://our-chat-backend.onrender.com`
  - ❌ `https://our-chat-backend.onrender.com/`
- If you change the environment variable on Netlify, go to **Deploys** ➔ **Trigger deploy** ➔ **Clear cache and deploy site** so Vite re-builds with the new value.

### 2. MongoDB connection errors on Render
- Ensure in MongoDB Atlas ➔ **Network Access** that `0.0.0.0/0` (Allow access from anywhere) is active.
- Verify that your database username and password in `MONGODB_URI` are correct and special characters in passwords are URL-encoded if applicable.

### 3. Page refresh gives 404 on Netlify
- The project includes `frontend/public/_redirects` and `netlify.toml` with `/* /index.html 200` to handle client-side routing.

### 4. Custom domain names
- **Netlify**: Go to *Domain management* ➔ *Add custom domain* to bind your own domain (e.g. `chat.example.com`).
- **Render**: Go to *Settings* ➔ *Custom Domains* to bind your backend API domain (e.g. `api-chat.example.com`). If you do this, remember to update `VITE_SERVER_URL` in Netlify.

