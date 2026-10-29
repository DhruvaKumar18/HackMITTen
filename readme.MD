# Chatvia - Real-Time Multi-User Chat Application

A modern real-time chat application inspired by the **Chatvia** React UI template built with **React + TypeScript + Vite** frontend, **Node.js + Express + WebSockets** backend, and **PostgreSQL** database.

---

## 🌟 Key Features

1. **PostgreSQL Database**:
   - Stores users, friend requests, and messages with relational integrity.
   - Host: `localhost:5432` | User: `postgres` | Password: `help` | Database: `postgres`.

2. **Dedicated Storage Folders**:
   - All uploaded and conversation data is organized in structured folders under `server/storage/`:
     - `server/storage/chat/`: Automatic JSON conversation history files (`chat_{user1}_{user2}.json`).
     - `server/storage/images/`: Uploaded image attachments (`.png, .jpg, .gif, .webp`).
     - `server/storage/files/`: Uploaded documents and files (`.zip, .pdf, .docx, .txt`).
     - `server/storage/avatars/`: Profile avatars.

3. **Privacy-Preserving User ID Lookup**:
   - *"Do not show the user name until they enter the user id"*:
   - Usernames and profiles are hidden from public listing until a user enters the exact **User ID** (e.g. `UID-7001`, `UID-7002`).
   - Entering a User ID reveals the user's card and enables sending a friend request.

4. **Structured User Profile**:
   - Clean profile card displaying avatar with online dot, Full Name, and bio.
   - **User ID Chip** (e.g. `UID-7001`) with a 1-click **Copy ID** button to easily share with friends.
   - Information list: Username (`@doris`), Gmail ID (`doris@gmail.com`), Database status, and Storage info.
   - **Edit Profile** feature to update Full Name and Bio.

5. **Emojis and File/Image Sending**:
   - **Emoji Picker**: Interactive popover with 28+ categorized emojis (Smileys, gestures, hearts, celebration).
   - **Image Attachment (📷)**: Uploads images to `storage/images/` and displays rich preview bubbles.
   - **File Attachment (📎)**: Uploads documents/archives to `storage/files/` and displays downloadable file cards with file name and size.

6. **End-to-End Encryption (E2EE)**:
   - **Zero-Knowledge Architecture**: Messages and media captions are encrypted on the sender's client before transmission. The backend server and PostgreSQL database only ever see and persist unreadable ciphertext (`e2ee:{"v":1,"iv":"...","ct":"..."}`).
   - **Key Agreement**: **ECDH (Elliptic-Curve Diffie-Hellman)** on **NIST Curve P-256 (secp256r1)**.
   - **Symmetric Cipher**: **AES-256-GCM** (Galois/Counter Mode, 256-bit key) with a unique 96-bit (12-byte) cryptographically secure random IV per message and 128-bit authentication tag (AEAD).
   - **Key Custody**: Private keys are generated and retained exclusively in browser client storage (`localStorage`) and never leave the device.
   - **Security Inspection Modal**: Click the **🔒 E2EE Active** badge in the chat header or the in-chat encryption banner to inspect the cryptographic protocol, key exchange status, and fingerprints.

7. **Image Steganography & View-Once Vanishing Messages (🎭)**:
   - **Secret Inside Public Cover**: Users can hide confidential private images or secret notes inside an innocuous public cover photo using **4-bit LSB (Least Significant Bit) Image Steganography** (based on the uploaded steganography engine).
   - **Algorithm**:
     - **Upper 4 bits** of each RGB channel represent the public cover image (`cover[i] & 0xF0`).
     - **Lower 4 bits** carry the private secret image's most significant nibbles (`secret[i] >> 4`).
     - The output is encoded as a lossless PNG, rendering visually identical to the public photo.
   - **Menu Button & Decrypt Option**:
     - In the chat timeline, the image displays as the normal public photo.
     - A `⋮` menu button on the public image and a prominent action button `[ 🔓 Decrypt Private Image ]` (with a red `VIEW ONCE` pill) allow the receiver to decrypt.
   - **Self-Destruct & Auto-Vanish at Receiver End**:
     - When clicked, a high-security View-Once overlay displays the decrypted private secret with a **15-second countdown timer** and animated progress bar.
     - Once closed or when the timer expires, the private image **vanishes completely** from memory and client storage.
     - The message updates to `🔒 Private image has vanished (viewed once)` and notifies the sender in real-time (`👁️ Private image opened & vanished by receiver`).

8. **Friend-Gated Messaging**:
   - Direct messaging is strictly restricted to accepted friends.
   - Real-time WebSocket notifications for friend requests, message delivery, and typing indicators.

9. **Split-Screen Demo Mode**:
   - Click the **⚡ icon** on the left rail to view two users (e.g. Doris and Patrick) chatting side-by-side in real time!

---

## 🚀 How to Run Manually

### 1. Start the Server (Backend)
```bash
cd server
npm install
npm run dev
```
> Runs at `http://localhost:5000` with WebSocket at `ws://localhost:5000/ws`.

### 2. Start the Client (Frontend)
```bash
cd client
npm install
npm run dev
```
> Runs at `http://localhost:5173`.

---

## 🔑 Pre-Seeded Demo Accounts

| Full Name | User ID | Username | Gmail ID / Email | Password |
| :--- | :--- | :--- | :--- | :--- |
| **Doris Brown** | `UID-7001` | `doris` | `doris@gmail.com` | `doris123` |
| **Patrick Hendricks** | `UID-7002` | `patrick` | `patrick@gmail.com` | `patrick123` |
| **Steve Walker** | `UID-7004` | `steve` | `steve@gmail.com` | `steve123` |
| **Mark Messer** | `UID-7003` | `mark` | `mark@gmail.com` | `mark123` |
| **Emily Clark** | `UID-7005` | `emily` | `emily@gmail.com` | `emily123` |

*(You can also click **Sign Up** to create any new account with custom username, Gmail ID, and password).*

---

## 👥 How to Test User ID Connect & File Sending

### 1. Connecting via User ID:
1. Log in as **Doris Brown** (`UID-7001`).
2. Click the **👥 Friends** tab on the left rail.
3. In the **"Find User by User ID"** box, type `UID-7004` (Steve Walker) and click **"Search ID"**.
4. Steve's profile is revealed with his name, `@steve`, and avatar.
5. Click **"+ Send Friend Request"**.
6. In another tab or window, log in as Steve (`steve` / `steve@gmail.com` / `steve123`), open the **👥 Friends** tab, and click **"Accept"**.
7. They now appear in each other's **Chats** list!

### 2. Sending Emojis and Files:
1. Open the chat with your friend.
2. Click **😊** to open the emoji picker and select emojis.
3. Click **📷** to upload and send an image (saved to `server/storage/images/`).
4. Click **📎** to upload and send any document or zip file (saved to `server/storage/files/`).
5. Check `server/storage/chat/` to see the conversation backup transcript automatically updated!
