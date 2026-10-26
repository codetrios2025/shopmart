import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDB } from "./config/db.js";
import apiRoutes from "./routes/apiRoutes.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import adminRoutes from "./routes/adminRoutes.js";
import NewsletterCampaign from "./models/NewsletterCampaign.js";
import { startNewsletterCampaignProcessor } from "./utils/newsletterCampaign.js";

dotenv.config();

const app = express();
const backendDirectory = path.dirname(fileURLToPath(import.meta.url));

// Local development defaults to backend/uploads.
// Configure UPLOAD_DIR in Hostinger to a persistent writable directory outside hbuilds/current.
const uploadDirectory = path.resolve(
  process.env.UPLOAD_DIR || path.join(backendDirectory, "uploads"),
);

app.use(helmet());

const allowedOrigins = [
  "https://dimgrey-gorilla-195680.hostingersite.com",
  "https://shopmart.codetrios.com",
  "http://shopmart.codetrios.com",
];

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header, such as server-to-server calls.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(morgan("dev"));

app.use(
  "/uploads",
  helmet.crossOriginResourcePolicy({ policy: "cross-origin" }),
  express.static(uploadDirectory, {
    fallthrough: true,
    dotfiles: "deny",
    index: false,
  }),
);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", apiRoutes);
app.use("/api/admin", adminRoutes);

// Error Middlewares
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET must be configured before starting the server");
  }

  // Fail early if the configured upload location cannot be created/accessed.
  // The upload middleware also creates its individual subfolders on demand.
  await import("node:fs/promises").then(({ mkdir }) =>
    mkdir(uploadDirectory, { recursive: true }),
  );

  await connectDB();
  await NewsletterCampaign.updateMany(
    { status: "sending" },
    {
      $set: {
        status: "failed",
        completedAt: new Date(),
        lastError:
          "Delivery was interrupted by a server restart; some recipients may already have received this campaign.",
      },
    },
  );
  startNewsletterCampaignProcessor();
  app.listen(PORT, () => {
    console.log(
      "[UPLOAD DEBUG] Environment UPLOAD_DIR:",
      process.env.UPLOAD_DIR,
    );
    console.log("[UPLOAD DEBUG] Resolved directory:", uploadDirectory);
    console.log(`SHOPMART Backend Server running on port ${PORT}`);
    console.log(`Upload directory: ${uploadDirectory}`);
  });
};

startServer().catch((error) => {
  console.error(`SHOPMART failed to start: ${error.message}`);
  process.exitCode = 1;
});

export default app;
