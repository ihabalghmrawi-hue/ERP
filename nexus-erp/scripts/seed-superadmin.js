const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(process.cwd(), "data");
const SAAS_FILE = path.join(DATA_DIR, "saas.json");
const DEFAULT_SAAS = {
  companies: [],
  superAdmins: [],
  globalCounters: { company: 1, subscription: 1 },
};

function uid() {
  return crypto.randomBytes(8).toString("hex");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function loadSaaSData() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(SAAS_FILE)) {
      return DEFAULT_SAAS;
    }
    const raw = fs.readFileSync(SAAS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to load saas data:", error);
    process.exit(1);
  }
}

function saveSaaSData(state) {
  try {
    fs.writeFileSync(SAAS_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save saas data:", error);
    process.exit(1);
  }
}

const email = "ihabalghmrawi@gmail.com";
const password = "Ehab8798@@";
const name = "Super Admin";

const saas = loadSaaSData();
const exists = saas.superAdmins.find((admin) => admin.email === email);
if (exists) {
  console.log("Super Admin already exists. No changes were made.");
  process.exit(0);
}

const hashedPassword = hashPassword(password);
const admin = {
  id: uid(),
  name,
  email,
  password: hashedPassword,
  role: "superadmin",
  createdAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
};

saas.superAdmins.push(admin);
saveSaaSData(saas);
console.log("Super Admin created successfully:", email);
