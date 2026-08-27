require("dotenv").config();
const fs = require("fs");
const csv = require("csv-parser");
const nodemailer = require("nodemailer");
const { GoogleGenAI } = require("@google/genai");

// --- 1. Configuration & Initializers ---
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS; // Must be a Google App Password, not your regular password

const emailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
require("dotenv").config();

console.log("--- CREDENTIAL CHECK ---");
console.log("User:", process.env.EMAIL_USER);
console.log("Pass Loaded:", process.env.EMAIL_PASS ? "Yes" : "No");
console.log("API Key Loaded:", process.env.GEMINI_API_KEY ? "Yes" : "No");
console.log("------------------------");

// The context extracted from your resume
const resumeContext = `
The candidate's name is Pratham Jha. He is a Backend Software Engineer with roughly 3 years of experience.
Key Skills: Node.js, TypeScript, Express.js, RESTful APIs, PostgreSQL, AWS, React.
Experience: 
- SDE-I at VERTO (delivered scalable Node.js microservices and automated payment workflows).
- Software Engineer at SHARDEUM (architected enterprise backend for 500+ blockchain nodes).
Projects: Multi-platform Price Tracker, Real-Time Chat Application handling 10+ rooms with 200ms latency.
`;

// --- 2. Gemini AI Agent Template ---
// --- 2. Gemini AI Agent Template ---
// --- 2. Local AI Agent Template (Ollama) ---
async function generateAIEmail(company = "your company") {
    // 1. Strict prompt forbidding conversational lead-ins
    const prompt = `You are a professional email drafting system.
Use this resume context: ${resumeContext}

Write ONLY the body paragraphs of a cold outreach email applying for a Software Engineering role at ${company}.

STRICT RULES:
- Output ONLY the raw email body text.
- NEVER include introductory remarks, meta-text, or lead-ins (e.g., "Here is a draft email:", "Sure! Here is a draft:").
- Do NOT include a subject line, greeting, or sign-off signature.
- Keep it under 130 words.`;

    const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "llama3",
            prompt: prompt,
            stream: false
        })
    });

    const data = await response.json();

    // 2. Regex cleanup to strip "Here is a draft email:", "Subject:", or other conversational filler if generated
    const cleanedBody = data.response
        .replace(/^(here is a draft email:?|here's a draft email:?|here is the draft:?|certainly[^\n]*|sure[^\n]*|subject:[^\n]*)/gim, '')
        .trim();

    const mySignature = `
Best regards,

Pratham Jha 
Backend Software Engineer
LinkedIn: https://linkedin.com/in/prathamjha
GitHub: https://github.com/PrathamJha1
`;

    // 3. Assemble clean final body
    const finalEmailBody = `Dear Hiring Team,\n\n${cleanedBody}\n\n${mySignature}`;

    return {
        subject: `Application for Software Engineer - Pratham Jha`,
        text: finalEmailBody
    };
}
// --- 3. CSV Processing Logic ---
const processEmailsCSV = (filePath) => {
  console.log("📧 Reading emails.csv...");
  const results = [];

  // 1. Read all rows into an array first
  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      console.log(
        `✅ Loaded ${results.length} emails. Starting sequential processing...`,
      );

      // 2. Loop through them sequentially
      for (const row of results) {
        if (row.email) {
          try {
            const domainMatch = row.email.match(/@(.+?)\./);
            const companyGuess = domainMatch ? domainMatch[1] : "your company";

            console.log(`🤖 AI drafting email for ${companyGuess}...`);
            const { subject, text } = await generateAIEmail(companyGuess);

            await emailTransporter.sendMail({
              from: EMAIL_USER,
              to: row.email.trim(),
              subject: subject,
              text: text,
              attachments: [
                {
                  filename: "./assets/Pratham_s_Resume_YOE_3.pdf",
                  path: "./assets/Pratham_s_Resume_YOE_3.pdf",
                },
              ],
            });
            console.log(
              `✅ AI Email with Resume successfully sent to: ${row.email}`,
            );

            // 3. Wait 4.5 seconds BEFORE starting the next iteration
            await new Promise((resolve) => setTimeout(resolve, 4500));
          } catch (error) {
            console.error(`❌ Email failed for ${row.email}:`, error.message);
          }
        }
      }
      console.log("🎉 Finished processing email list.");
    });
};
// --- 4. Run the Script ---
if (fs.existsSync("./assets/emails.csv")) {
  processEmailsCSV("./assets/emails.csv");
} else {
  console.error("❌ Error: emails.csv not found in the current directory.");
}
