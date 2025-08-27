/*
<!----------------------------------------------------------
Name: Saisaurav Samanta
Class: 9-B
School: The Newtown School, Kolkata
Version: 1.0
------------------------------------------------------------>
*/

import express from "express";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
import OpenAI from "openai";
import session from "express-session";

/* Add this to the top of the file, after the other imports */
import { Server } from "socket.io";

import { createServer } from "http";
const PORT = process.env.PORT || 5000;
dotenv.config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(session({
  secret: "eduassist-secret",
  resave: false,
  saveUninitialized: true
}));

/* Add this to the end of the file, just before the `app.listen` call */
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins for simplicity
    methods: ["GET", "POST"],
  },
});

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("joinClass", (classId) => {
    socket.join(classId);
    console.log(`Socket ${socket.id} joined class ${classId}`);
  });
  
  

  socket.on("liveCaption", (data) => {
    // Broadcast the caption to all sockets in the same room
    socket.to(data.classId).emit("receiveCaption", data.caption);
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});


/* Change `app.listen` to `httpServer.listen` to start the server */
httpServer.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});


import Database from "better-sqlite3";

const db = new Database("./database.db");

// Create table if not exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id TEXT UNIQUE,
    material TEXT,
    charts TEXT,
    quiz TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();



const upload = multer({ dest: "uploads/" });

const groqClient = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1", // 👈 key change for Groq
});



// Login handling
app.post("/login", (req, res) => {
  const { username, password, role } = req.body;

  // Simple dummy auth
  if (username && password) {
    req.session.user = { username, role };
    if (role === "teacher") {
      return res.redirect("/tc_dashboard.html");
    } else {
      return res.redirect("/st_dashboard.html");
    }
  }
  res.redirect("/login.html");
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.post("/process-material", upload.single("materialFile"), async (req, res) => {
  console.log("📄 Processing material...", req.body.material);
  try {
    let textContent = req.body.material || "";

    if (req.file) {
if (req.file.mimetype === "application/pdf") {
  const dataBuffer = fs.readFileSync(req.file.path);
  const data = await pdf(dataBuffer);  // ✅ works now
  textContent = data.text;
} else {
        textContent = fs.readFileSync(req.file.path, "utf-8");
      }
    }

    console.log(`📑 Extracted text length: ${textContent.length}`);

    const materialText = req.body.materialText || "";

    const specifications = req.body.specifications || "";

    // Split into smaller chunks (~1000 chars each)
let chunks = [];
if (textContent.length <= 5000) {
  chunks = [textContent]; // single call
} else {
  chunks = textContent.match(/[\s\S]{1,4000}/g) || [];
}
console.log(`📑 Length: ${textContent.length}, 🔪 Chunks: ${chunks.length}`);

console.log(`📑 Total material length: ${textContent.length} chars`);
console.log(`🔪 Split into ${chunks.length} chunks`);

async function processChunk(chunk, idx) {
  console.log(`\n🟦 Processing chunk #${idx + 1} (${chunk.length} chars)...`);

  const prompt = `
    You are an AI teaching assistant. Process the given course material.

    Input file:
    ${chunk}

    Input Text: ${materialText}

    Teacher specifications: ${specifications}

    note: If no file is given, refer to text and if no text is given, use the file.

    make sure to use actual image urls and not examples + use the direct path to the images from /commons
    make sure to provide charts with proper data and labels and they should be relevant to the study material.
    studyMaterial should be a processed version of the given material. It should be the largest part and main thing students will study.

    Return ONLY valid JSON with this structure (no explanation, no markdown):
    {
      "title": "...",
      "studyMaterial": "...",
      "summary": "...",
      "bulletPoints": ["...", "..."],
      "charts": [
        { "title": "...", "type": "bar || pie || line", "data": {"labels": ["...","..."], "values": [1,2]} }
      ],
      "images": [
        { "url": "...", "caption": "Image caption" }
      ]
    }
  `;

  let retries = 3;
  while (retries > 0) {
    try {
      console.log(`📨 Sending prompt to model (attempt ${4 - retries}/3)...`);

      const response = await groqClient.chat.completions.create({
        model: "llama3-8b-8192",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      let aiText = response.choices[0].message.content;
      console.log(`🤖 Raw AI response (truncated): ${aiText.slice(0, 200)}...`);

      // Clean: strip markdown and whitespace
      aiText = aiText.replace(/```json|```/g, "").trim();

      // Extract JSON
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("⚠️ No JSON object found. Full AI response:\n", aiText);
        throw new Error("No JSON object found in AI response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`✅ Successfully parsed JSON for chunk #${idx + 1}`);
      return parsed;

    } catch (err) {
      if (err.status === 429) {
        const wait = parseFloat(err.headers?.get("retry-after") || "30") * 1000;
        console.warn(`⏳ Rate limit hit. Waiting ${wait / 1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, wait));
        retries--;
      } else {
        console.error(`❌ Error on chunk #${idx + 1}:`, err.message);
        return null;
      }
    }
  }
  console.warn(`⚠️ Failed to process chunk #${idx + 1} after 3 retries.`);
  return null;
}

const results = [];
for (let i = 0; i < chunks.length; i++) {
  const result = await processChunk(chunks[i], i);
  if (result) results.push(result);
  await new Promise(resolve => setTimeout(resolve, 1000)); // pause
}

console.log("📝 Final merged results:", JSON.stringify(results, null, 2));

    // Merge results
    const finalResult = {
      title: results.map(r => r.title)[0],
      studyMaterial: results.map(r => r.studyMaterial).join(" "),
      summary: results.map(r => r.summary).join(" "),
      bulletPoints: results.flatMap(r => r.bulletPoints || []),
      charts: results.flatMap(r => r.charts || []),
      images: results.flatMap(r => r.images || []),
    };
    

    res.json(finalResult); // ✅ Only send once, after everything is merged

  } catch (error) {
    console.error("❌ Processing failed:", error);
    res.status(500).json({ error: "Failed to process material" });
  }
});

app.post("/generate-quiz", upload.none(), async (req, res) => {
  const { numQuestions, quizData } = req.body;
  
  // FIX: quizType is now an array directly from the formData
  const quizType = req.body.quizType;
  
  // Validate input. Check if quizType is an array and not empty
  if (!numQuestions || !quizType || (Array.isArray(quizType) && quizType.length === 0)) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  console.log("Quiz generation request received:", req.body);

  try {
    // Check if quizType is a single string or an array
    const typesToJoin = Array.isArray(quizType) ? quizType : [quizType];

    const prompt = `Generate a quiz with ${numQuestions} questions of type(s): ${typesToJoin.join(", ")} on this material: ${quizData}. Return it in JSON format like this:
    {
      "questions": [
        {
          "type": "multipleChoice" || "trueFalse" || "1wordAnswer" || "fillInTheBlanks",
          "question": "...",
          "options": ["...","..."], // only for multipleChoice
          "answer": "..." // for MultipleChoice questions, Only display the option (A,B,C,D)
        },
        ...
      ]
    }

    make sure to only use the types mentioned in the prompt and have the exact number of questions requested.`;
    console.log("Generated quiz prompt:", prompt);

    const response = await groqClient.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

      let aiText = response.choices[0].message.content;
      console.log(`🤖 Raw AI response (truncated): ${aiText.slice(0, 200)}...`);

      // Clean: strip markdown and whitespace
      aiText = aiText.replace(/```json|```/g, "").trim();

      // Extract JSON
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("⚠️ No JSON object found. Full AI response:\n", aiText);
        throw new Error("No JSON object found in AI response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      res.json(parsed);

  } catch (error) {
    console.error("❌ Quiz generation failed:", error);
    res.status(500).json({ error: "Failed to generate quiz" });
  }
});

app.post("/start-class", async (req, res) => {
  try {
    const { material, quiz } = req.body;

    // Generate random Class ID
    const classId = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Reuse the already-processed AI material (not aiResult anymore!)
    const materialData = {
      title: material.title || "Untitled",
      studyMaterial: material.studyMaterial || "",
      summary: material.summary || "",
      bulletPoints: material.bulletPoints || [],
      charts: material.charts || [],
      images: material.images || []
    };

    // Store in DB
    await db.prepare(`INSERT INTO classes (class_id, material, charts, quiz) VALUES (?, ?, ?, ?)`).run(
      classId,
      JSON.stringify(materialData), // ✅ keep structured JSON
      JSON.stringify(materialData.charts),
      JSON.stringify(quiz || [])
    );

    res.json({ success: true, classId });

  } catch (error) {
    console.error("❌ Failed to start class:", error);
    res.status(500).json({ error: "Failed to start class" });
  }
});

app.get("/join-class/:classId", async (req, res) => {
  const { classId } = req.params;
  const row = await db.prepare(`SELECT * FROM classes WHERE class_id = ?`).get([classId]);

  if (!row) return res.status(404).json({ error: "Class not found" });

res.json({
  material: safeParse(row.material),
  charts: safeParse(row.charts, []),
  quiz: safeParse(row.quiz, []),
});
function safeParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return str || fallback;
  }
}
});
app.get("/debug/classes", async (req, res) => {
  try {
    const rows = await db.prepare("SELECT * FROM classes ORDER BY created_at DESC").all();
    res.json(rows);
  } catch (err) {
    console.error("❌ DB fetch error:", err);
    res.status(500).json({ error: "Failed to fetch classes" });
  }
});




app.post("/doubtClear", async (req, res) => {
  try {
    const { doubt } = req.body;
    const prompt = `You are a helpful assistant and a student has a doubt: ${doubt}. Please provide a clear and concise answer in this JSON format:
    {
      "answer": "..."
    }`;
    console.log("Received doubt:", doubt);
        const response = await groqClient.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

      let aiText = response.choices[0].message.content;
      console.log(`🤖 Raw AI response (truncated): ${aiText.slice(0, 200)}...`);

      // Clean: strip markdown and whitespace
      aiText = aiText.replace(/```json|```/g, "").trim();

      // Extract JSON
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("⚠️ No JSON object found. Full AI response:\n", aiText);
        throw new Error("No JSON object found in AI response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      res.json(parsed);
  } catch (error) {
    console.error("Error processing doubt:", error);
    res.status(500).json({ error: "Failed to process doubt" });
  }
});

app.post("/generateNotes", async (req, res) => {
  try {
    // Change 'material' to 'courseContent' to match the frontend request body
    const { courseContent } = req.body;
    console.log("Generating notes for:", courseContent);
    const prompt = `You are a helpful assistant and a student has provided the following material: ${courseContent}. Please generate concise notes in this JSON format:
    {
      "title": "...",
      "paragraphs": ["...", "...", "..."], // as many as required
      "summary": "...",
      "key-points": ["..."],
      "useful-links": ["..."] // always add at least one
    }`;

    const response = await groqClient.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    let aiText = response.choices[0].message.content;

    // Clean: strip markdown and whitespace
    aiText = aiText.replace(/```json|```/g, "").trim();

    // Extract JSON
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("⚠️ No JSON object found. Full AI response:\n", aiText);
      throw new Error("No JSON object found in AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    console.log("Generated notes:", parsed);
    res.json(parsed);
  } catch (error) {
    console.error("Error generating notes:", error);
    res.status(500).json({ error: "Failed to generate notes" });
  }
});




app.post("/translate", async (req, res) => {
  try {
    const { text, targetLang } = req.body;

    // For now: just return the original text, or append "[Translated]" for demo
    let translated = text;
    if (targetLang !== "en") {
      translated = `[${targetLang}] ${text}`;
    }

    res.json({ translated });
  } catch (err) {
    console.error("Translation error:", err);
    res.json({ translated: text });
  }
});

