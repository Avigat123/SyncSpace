import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve path to backend/.env relative to this config file:
// backend/src/config/env.js -> ../../.env => backend/.env
const envPath = path.resolve(__dirname, "../../.env");

dotenv.config({ path: envPath });

export default process.env;

