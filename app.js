import express from "express";
import cors from "cors";
import axios from "axios";
import cvData from "./cv.json" with { type: "json" };
const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(express.json());

// Helper function to convert chunk objects to text - includes ALL fields
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

// Cosine Similarity
function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
  return dot / (normA * normB);
}
const vectorStore = [];
// Generate embeddings at startup
async function generateEmbeddings() {
  const promises = cvData.cvChunks.map(async (chunk) => {
    const chunkText = chunkToText(chunk);

    const response = await axios.post(
      "http://localhost:11434/api/embeddings",
      {
        model: "nomic-embed-text",
        prompt: chunkText,
      }
    );

    return {
      id: chunk.id,
      text: chunkText,
      embedding: response.data.embedding,
    };
  });

  const results = await Promise.all(promises);
  vectorStore.push(...results);

  console.log("Embeddings Ready 🚀");
}


app.post("/chat", async (req, res) => {
  const userQuestion = req.body.message;
  console.log("Received question:", userQuestion);
  // User embedding
  const userEmbeddingResponse = await axios.post(
    "http://localhost:11434/api/embeddings",
    {
      model: "nomic-embed-text",
      prompt: userQuestion,
    },
  );

  const userEmbedding = userEmbeddingResponse.data.embedding;

  // Find top 5 matches
  const matches = vectorStore
    .map((item) => ({
      text: item.text,
      score: cosineSimilarity(userEmbedding, item.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const context = matches.map((m) => m.text).join("\n\n");
  // Generate answer from llama3
  const response = await axios.post("http://localhost:11434/api/generate", {
    model: "llama3",
    stream: false,
    prompt: `You are an AI assistant answering questions about Prince Kumar Yadav's CV/resume.

Context from CV:
${context}

User Question: ${userQuestion}

Instructions: Answer the question directly using ONLY the information provided in the context above. If the information is not in the context, say "I don't have that information in the CV." Be specific and mention relevant details like company names, technologies, and experience.`,
  });

  console.log("Generated response:", response.data.response);

  res.json({
    reply: response.data.response,
  });
});

app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

const startServer = async () => {
  await generateEmbeddings();
  app.listen(3001, () => console.log("Server running on 3001"));
};

startServer();
