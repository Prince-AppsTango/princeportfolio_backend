import express from "express";
import cors from "cors";
import axios from "axios";
import cvData from "./cv.json" with { type: "json" };
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

// Convert CV chunks to readable text
function chunkToText(chunk) {
  const parts = [];
  const skipFields = new Set(["id", "type", "category"]);

  for (const [key, value] of Object.entries(chunk)) {
    if (skipFields.has(key)) continue;

    if (Array.isArray(value)) {
      parts.push(`${key}: ${value.join(", ")}`);
    } else if (typeof value === "object" && value !== null) {
      parts.push(`${key}: ${JSON.stringify(value)}`);
    } else if (value) {
      parts.push(`${key}: ${value}`);
    }
  }

  return parts.join(" | ");
}

// Prepare candidate info
const candidateInfo = `Name: ${cvData.candidate.name}
Location: ${cvData.candidate.location}
Email: ${cvData.candidate.email}
LinkedIn: ${cvData.candidate.linkedin}
Experience: ${cvData.candidate.experience_years} years
Role: ${cvData.candidate.primary_role}`;

// Prepare full CV context once
const fullCVContext = [candidateInfo, ...cvData.cvChunks.map((chunk) => chunkToText(chunk))]
  .join("\n\n");

app.post("/chat", async (req, res) => {
  try {
    const userQuestion = req.body.message;

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant answering questions about Prince Kumar Yadav's CV.
Only answer using the CV information provided.
If answer not found, say: "I don't have that information in the CV."`
          },
          {
            role: "user",
            content: `
CV Data:
${fullCVContext}

User Question:
${userQuestion}
`
          }
        ],
        temperature: 0.3
      },
      {
        headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({
      reply: response.data.choices[0].message.content
    });

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/", (req, res) => {
  res.send("Groq CV Chatbot Running 🚀");
});

app.listen(3001, () => {
  console.log("Server running on port 3001 🚀");
});
