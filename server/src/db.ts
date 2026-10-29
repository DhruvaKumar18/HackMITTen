import pkg from "pg";
const { Pool } = pkg;
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// PostgreSQL Pool Connection
export const pool = new Pool({
  host: process.env.PG_HOST || "localhost",
  port: Number(process.env.PG_PORT) || 5432,
  user: process.env.PG_USER || "postgres",
  password: process.env.PG_PASSWORD || "help",
  database: process.env.PG_DATABASE || "postgres",
});

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function generateUserIdCode(): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `UID-${randomNum}`;
}

// Storage folders structure setup
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const STORAGE_DIR = path.resolve(__dirname, "../storage");
export const CHAT_DIR = path.join(STORAGE_DIR, "chat");
export const IMAGES_DIR = path.join(STORAGE_DIR, "images");
export const FILES_DIR = path.join(STORAGE_DIR, "files");
export const AVATARS_DIR = path.join(STORAGE_DIR, "avatars");

export function initStorageFolders() {
  [STORAGE_DIR, CHAT_DIR, IMAGES_DIR, FILES_DIR, AVATARS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Save chat transcript to storage/chat/ folder
export function backupChatToFile(user1: string, user2: string, messages: any[]) {
  try {
    const pairKey = [user1, user2].sort().join("_");
    const filePath = path.join(CHAT_DIR, `chat_${pairKey}.json`);
    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write chat file to storage/chat:", err);
  }
}

export async function initDatabase() {
  initStorageFolders();

  const client = await pool.connect();
  try {
    // 1. Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        user_id_code VARCHAR(32) UNIQUE NOT NULL,
        username VARCHAR(64) UNIQUE NOT NULL,
        email VARCHAR(128) UNIQUE NOT NULL,
        full_name VARCHAR(128) NOT NULL,
        password_hash VARCHAR(128) NOT NULL,
        avatar TEXT,
        bio TEXT DEFAULT 'Hey there! I am using Chatvia.',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS friend_requests (
        id VARCHAR(64) PRIMARY KEY,
        sender_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
        receiver_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sender_id, receiver_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(64) PRIMARY KEY,
        sender_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
        receiver_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        message_type VARCHAR(20) DEFAULT 'text' CHECK(message_type IN ('text', 'image', 'file')),
        file_url TEXT,
        file_name VARCHAR(255),
        file_size VARCHAR(64),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_messages_pair_pg ON messages (sender_id, receiver_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_users_id_code ON users (user_id_code);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

      ALTER TABLE users ADD COLUMN IF NOT EXISTS public_key TEXT;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_stego BOOLEAN DEFAULT FALSE;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_vanished BOOLEAN DEFAULT FALSE;
    `);

    // Ensure demo users have public keys for E2EE
    const demoKeys: Record<string, string> = {
      u_doris: JSON.stringify({ key_ops: [], ext: true, kty: "EC", x: "DytdV38Hk_yFbhhnvwFeWxSBJM12lgLAeORqYvBmWnE", y: "1mllunFdQIGm31iUmOIWp3yWDtMl2thWi41fMSoB60Y", crv: "P-256" }),
      u_patrick: JSON.stringify({ key_ops: [], ext: true, kty: "EC", x: "i1OK_GwWlbj0S46-6vXqRnab2KxOywNxxEbRUwip8Ys", y: "sAgdAWs8rxg_7mMiZzv0TQTBw5q2st37LnBF4ilsYc8", crv: "P-256" }),
      u_steve: JSON.stringify({ key_ops: [], ext: true, kty: "EC", x: "i0XNjB8ZQnI-QTzZ51eakTJRbEFwJlcvO0thhxNIpoI", y: "kzNna8I2AXY8ymOYUG72eZi1GmkWlvxRa8XViOWT2Lo", crv: "P-256" }),
      u_mark: JSON.stringify({ key_ops: [], ext: true, kty: "EC", x: "Tcb5WolQ42kos_aopvh7I9gMOno8T7T_bYB2i3BxQPE", y: "18UaVglMkGjC4ZeMXNiOTdYogoPWaQ9PgRVDzaIW4jQ", crv: "P-256" }),
      u_emily: JSON.stringify({ key_ops: [], ext: true, kty: "EC", x: "7aTbM365DjSeT47_ATI8FFChhSJsI13ZGDdN8TXLu8w", y: "4quwgg4VY_3TxFgedD-Rz00AxEJ8CyTVDuGIO6JZ5ec", crv: "P-256" }),
    };
    for (const [uid, pkey] of Object.entries(demoKeys)) {
      await client.query(`UPDATE users SET public_key = $1 WHERE id = $2 AND public_key IS NULL`, [pkey, uid]);
    }

    // 2. Check if users table is empty; if so, seed demo users
    const userCountRes = await client.query("SELECT COUNT(*) FROM users");
    const count = parseInt(userCountRes.rows[0].count, 10);

    if (count === 0) {
      console.log("Seeding initial users into PostgreSQL...");

      const demoUsers = [
        {
          id: "u_doris",
          user_id_code: "UID-1001",
          username: "doris",
          email: "doris@gmail.com",
          fullName: "Doris Brown",
          passwordHash: hashPassword("doris123"),
          avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
          bio: "Product Designer & Tech Enthusiast 🎨",
        },
        {
          id: "u_patrick",
          user_id_code: "UID-1002",
          username: "patrick",
          email: "patrick@gmail.com",
          fullName: "Patrick Hendricks",
          passwordHash: hashPassword("patrick123"),
          avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
          bio: "Software Architect & Coffee lover ☕",
        },
        {
          id: "u_steve",
          user_id_code: "UID-1003",
          username: "steve",
          email: "steve@gmail.com",
          fullName: "Steve Walker",
          passwordHash: hashPassword("steve123"),
          avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
          bio: "DevOps Engineer | Cloud Infrastructure ☁️",
        },
        {
          id: "u_mark",
          user_id_code: "UID-1004",
          username: "mark",
          email: "mark@gmail.com",
          fullName: "Mark Messer",
          passwordHash: hashPassword("mark123"),
          avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
          bio: "Full-Stack Developer 💻",
        },
        {
          id: "u_emily",
          user_id_code: "UID-1005",
          username: "emily",
          email: "emily@gmail.com",
          fullName: "Emily Clark",
          passwordHash: hashPassword("emily123"),
          avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150",
          bio: "UI/UX Researcher & Writer 📚",
        },
      ];

      for (const u of demoUsers) {
        await client.query(
          `INSERT INTO users (id, user_id_code, username, email, full_name, password_hash, avatar, bio)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [u.id, u.user_id_code, u.username, u.email, u.fullName, u.passwordHash, u.avatar, u.bio]
        );
      }

      // Seed accepted friendships
      // Doris & Patrick are friends
      await client.query(
        `INSERT INTO friend_requests (id, sender_id, receiver_id, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (sender_id, receiver_id) DO NOTHING`,
        ["fr_1", "u_patrick", "u_doris", "accepted"]
      );

      // Doris & Mark are friends
      await client.query(
        `INSERT INTO friend_requests (id, sender_id, receiver_id, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (sender_id, receiver_id) DO NOTHING`,
        ["fr_2", "u_mark", "u_doris", "accepted"]
      );

      // Seed initial messages matching screenshot
      const initialMessages = [
        {
          id: "m_1",
          senderId: "u_doris",
          receiverId: "u_patrick",
          content: "Good morning",
          messageType: "text",
          timestamp: new Date(Date.now() - 3600000),
        },
        {
          id: "m_2",
          senderId: "u_doris",
          receiverId: "u_patrick",
          content: "Yeah everything is fine",
          messageType: "text",
          timestamp: new Date(Date.now() - 3500000),
        },
        {
          id: "m_3",
          senderId: "u_doris",
          receiverId: "u_patrick",
          content: "& Next meeting tomorrow 10.00AM",
          messageType: "text",
          timestamp: new Date(Date.now() - 3400000),
        },
      ];

      for (const m of initialMessages) {
        await client.query(
          `INSERT INTO messages (id, sender_id, receiver_id, content, message_type, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [m.id, m.senderId, m.receiverId, m.content, m.messageType, m.timestamp]
        );
      }

      // Backup initial conversation to storage/chat
      backupChatToFile("u_doris", "u_patrick", initialMessages);
    }

    console.log("PostgreSQL database initialized successfully.");
  } finally {
    client.release();
  }
}
