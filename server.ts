import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const MESSAGES_FILE = path.join(process.cwd(), "chat_messages.json");
const AVATARS_FILE = path.join(process.cwd(), "chat_avatars.json");

app.use(express.json({ limit: "10mb" }));

// Disable API caching for all /api/* routes to prevent caching issues on platforms like Render
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});

// Set up and serve uploads folder
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use("/uploads", express.static(UPLOADS_DIR));

// Dual-Storage Layer: Maintain state in-memory so operations are 100% reliable and instantaneous,
// with a background write/sync to disk for persistence.
let inMemoryMessages: any[] = [];
let inMemoryAvatars: any[] = [];

// Initialize messages in-memory from disk if available
try {
  if (fs.existsSync(MESSAGES_FILE)) {
    inMemoryMessages = JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf8"));
  } else {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify([], null, 2), "utf8");
    inMemoryMessages = [];
  }
} catch (error) {
  console.error("Error reading initial MESSAGES_FILE:", error);
  inMemoryMessages = [];
}

const initialAvatarsList = [
  { id: "1", name: "روبوت ذكي", imageUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=Smarty" },
  { id: "2", name: "قطة مرحة", imageUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=Mia" },
  { id: "3", name: "ثعلب غامض", imageUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=Fox" },
  { id: "4", name: "بطل كرتوني", imageUrl: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Hero" },
  { id: "5", name: "شخصية أنيقة", imageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Style" },
  { id: "6", name: "رائد فضاء", imageUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=Astro" }
];

// Initialize avatars in-memory from disk if available
try {
  if (fs.existsSync(AVATARS_FILE)) {
    inMemoryAvatars = JSON.parse(fs.readFileSync(AVATARS_FILE, "utf8"));
  } else {
    fs.writeFileSync(AVATARS_FILE, JSON.stringify(initialAvatarsList, null, 2), "utf8");
    inMemoryAvatars = initialAvatarsList;
  }
} catch (error) {
  console.error("Error reading initial AVATARS_FILE:", error);
  inMemoryAvatars = initialAvatarsList;
}

// Read messages helper
function readMessages() {
  return inMemoryMessages;
}

// Write messages helper
function writeMessages(messages: any[]) {
  inMemoryMessages = messages;
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing chat messages file:", error);
  }
}

// Read avatars helper
function readAvatars() {
  return inMemoryAvatars;
}

// Write avatars helper
function writeAvatars(avatars: any[]) {
  inMemoryAvatars = avatars;
  try {
    fs.writeFileSync(AVATARS_FILE, JSON.stringify(avatars, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing avatars file:", error);
  }
}

// API Routes
app.get("/api/chat", (req, res) => {
  const messages = readMessages();
  res.json(messages);
});

app.post("/api/chat", (req, res) => {
  const { userId, username, avatarUrl, content, avatarBgColor, replyTo } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: "Message content is required" });
  }

  const messages = readMessages();
  const newMessage = {
    id: Math.random().toString(36).substring(2, 11),
    userId: userId || "guest",
    username: username || "زائر",
    avatarUrl: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(username || "زائر")}&background=0D8ABC&color=fff`,
    avatarBgColor: avatarBgColor || "#E0E7FF",
    content: content.trim(),
    createdAt: new Date().toISOString(),
    replyTo: replyTo || null,
  };

  messages.push(newMessage);
  
  // Limit history to last 200 messages to save memory/storage
  if (messages.length > 200) {
    messages.shift();
  }

  writeMessages(messages);
  res.status(201).json(newMessage);
});

// POST to toggle a reaction on a chat message
app.post("/api/chat/react", (req, res) => {
  const { messageId, emoji, userId } = req.body;
  if (!messageId || !emoji || !userId) {
    return res.status(400).json({ error: "messageId, emoji, and userId are required" });
  }

  const messages = readMessages();
  const msgIndex = messages.findIndex((m: any) => m.id === messageId);
  if (msgIndex !== -1) {
    const message = messages[msgIndex];
    if (!message.reactions) {
      message.reactions = {};
    }
    
    const userList = message.reactions[emoji] || [];
    const hasReacted = userList.includes(userId);
    
    if (hasReacted) {
      // Remove reaction
      message.reactions[emoji] = userList.filter((uid: string) => uid !== userId);
      if (message.reactions[emoji].length === 0) {
        delete message.reactions[emoji];
      }
    } else {
      // Add reaction
      message.reactions[emoji] = [...userList, userId];
    }
    
    messages[msgIndex] = message;
    writeMessages(messages);
    return res.json(message);
  } else {
    return res.status(404).json({ error: "Message not found" });
  }
});

// GET list of admin-created avatar templates
app.get("/api/avatars", (req, res) => {
  const avatars = readAvatars();
  res.json(avatars);
});

// POST to create a new avatar template
app.post("/api/avatars", (req, res) => {
  const { name, imageUrl } = req.body;
  if (!name || !name.trim() || !imageUrl || !imageUrl.trim()) {
    return res.status(400).json({ error: "Name and Image URL are required" });
  }

  const avatars = readAvatars();
  const newAvatar = {
    id: Math.random().toString(36).substring(2, 11),
    name: name.trim(),
    imageUrl: imageUrl.trim(),
  };

  avatars.push(newAvatar);
  writeAvatars(avatars);
  res.status(201).json(avatars);
});

// DELETE an avatar template
app.delete("/api/avatars/:id", (req, res) => {
  const { id } = req.params;
  console.log(`[Admin] Attempting to delete avatar template with ID: "${id}"`);
  
  let avatars = readAvatars();
  const originalLength = avatars.length;
  
  // Robust matching with string conversion and trimming
  avatars = avatars.filter((av: any) => {
    if (!av || av.id === undefined || av.id === null) return true;
    return av.id.toString().trim() !== id.toString().trim();
  });

  if (avatars.length === originalLength) {
    console.warn(`[Admin] Deletion failed. Avatar with ID "${id}" not found.`);
    return res.status(404).json({ 
      error: "الافتار غير موجود في المجموعة", 
      requestedId: id,
      availableIds: avatars.map((av: any) => av.id)
    });
  }

  writeAvatars(avatars);
  console.log(`[Admin] Successfully deleted avatar template with ID: "${id}"`);
  res.json(avatars);
});

// DELETE clear all chat history
app.delete("/api/chat/clear", (req, res) => {
  console.log("[Admin] Clearing all chat messages history");
  writeMessages([]);
  res.json({ success: true });
});

app.post("/api/auto-upload", async (req, res) => {
  try {
    const { userId, defaultUrl, username } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Check if user already has an uploaded avatar
    const files = fs.readdirSync(UPLOADS_DIR);
    const existingFileName = files.find(f => f.startsWith(`avatar_${userId}.`));

    if (existingFileName) {
      return res.json({ avatarUrl: `/uploads/${existingFileName}?t=${Date.now()}`, alreadyExists: true });
    }

    // Download defaultUrl and save it!
    const targetUrl = defaultUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(username || "User")}&background=0369a1&color=fff&bold=true`;

    let ext = "png";
    if (targetUrl.includes(".jpg") || targetUrl.includes(".jpeg")) {
      ext = "jpg";
    } else if (targetUrl.includes(".gif")) {
      ext = "gif";
    }

    const fileName = `avatar_${userId}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, fileName);

    try {
      const response = await fetch(targetUrl);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(filePath, buffer);
        return res.json({ avatarUrl: `/uploads/${fileName}?t=${Date.now()}`, alreadyExists: false });
      } else {
        throw new Error("Failed to fetch image");
      }
    } catch (err) {
      console.error("Failed to auto-download default avatar", err);
      return res.json({ avatarUrl: targetUrl, alreadyExists: false });
    }
  } catch (error) {
    console.error("Error in auto-upload:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
