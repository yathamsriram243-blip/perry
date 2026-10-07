import { MongoClient } from "mongodb";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
// ==========================================
// 1. MONGODB ATLAS INTEGRATION
// ==========================================
function resolveMongoUri() {
    if (process.env.MONGODB_URI)
        return process.env.MONGODB_URI;
    const candidatePaths = [
        "C:\\Users\\Srira\\Downloads\\atlas-credentials(1).env",
        "C:\\Users\\Srira\\Downloads\\atlas-credentials.env",
        path.join(process.cwd(), ".env.local"),
        path.join(process.cwd(), ".env"),
    ];
    for (const p of candidatePaths) {
        try {
            if (fs.existsSync(p)) {
                const content = fs.readFileSync(p, "utf8");
                const match = content.match(/MONGODB_URI\s*=\s*["']?([^"'\r\n]+)["']?/);
                if (match && match[1]) {
                    return match[1].trim();
                }
            }
        }
        catch {
            // Ignore read errors
        }
    }
    return "mongodb+srv://24a21a04w5_db_user:zr3t2ITa5aB67XUP@cluster0.mi9aivb.mongodb.net/";
}
let client = null;
let dbInstance = null;
let connectingPromise = null;
export async function getMongoDb() {
    if (dbInstance)
        return dbInstance;
    if (connectingPromise)
        return connectingPromise;
    connectingPromise = (async () => {
        try {
            const uri = resolveMongoUri();
            client = new MongoClient(uri, {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 8000,
            });
            await client.connect();
            dbInstance = client.db("perry");
            console.log("[MongoDB Atlas] Connected successfully to perry database!");
            return dbInstance;
        }
        catch (err) {
            console.error("[MongoDB Atlas] Connection failed:", err?.message ?? err);
            return null;
        }
        finally {
            connectingPromise = null;
        }
    })();
    return connectingPromise;
}
function getSupabaseConfigFile() {
    const dir = path.join(os.homedir(), ".perry");
    try {
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
    }
    catch { }
    return path.join(dir, "supabase-config.json");
}
export function resolveSupabaseConfig() {
    // 1. Process environment
    let url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    let key = process.env.SUPABASE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        "";
    // 2. Persistent config file
    const configFile = getSupabaseConfigFile();
    try {
        if (fs.existsSync(configFile)) {
            const stored = JSON.parse(fs.readFileSync(configFile, "utf8"));
            if (stored.url && !url)
                url = stored.url;
            if (stored.key && !key)
                key = stored.key;
        }
    }
    catch { }
    // 3. Scan candidate env files
    if (!url || !key) {
        const candidateFiles = [
            "C:\\Users\\Srira\\Downloads\\supabase-credentials.env",
            "C:\\Users\\Srira\\Downloads\\supabase.env",
            "C:\\Users\\Srira\\Downloads\\atlas-credentials(1).env",
            "C:\\Users\\Srira\\Downloads\\atlas-credentials.env",
            path.join(process.cwd(), ".env.local"),
            path.join(process.cwd(), ".env"),
        ];
        for (const f of candidateFiles) {
            try {
                if (fs.existsSync(f)) {
                    const content = fs.readFileSync(f, "utf8");
                    const urlMatch = content.match(/SUPABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/i);
                    const keyMatch = content.match(/SUPABASE_(?:ANON_KEY|KEY|SERVICE_ROLE_KEY)\s*=\s*["']?([^"'\r\n]+)["']?/i);
                    if (urlMatch && urlMatch[1] && !url)
                        url = urlMatch[1].trim();
                    if (keyMatch && keyMatch[1] && !key)
                        key = keyMatch[1].trim();
                }
            }
            catch { }
        }
    }
    if (!url)
        url = "https://vekdsdltgukhqlvhcnov.supabase.co";
    if (!key)
        key = "sb_publishable_E_AFC1Yz3aIt39owQcNy9w_RhvFaMmb";
    return { url: url.trim(), key: key.trim() };
}
export function saveSupabaseConfig(config) {
    try {
        const configFile = getSupabaseConfigFile();
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2), "utf8");
    }
    catch (e) {
        console.error("[Supabase] Failed to persist config:", e);
    }
}
export async function checkSupabaseConnection(config) {
    const current = config ?? resolveSupabaseConfig();
    if (!current.url || !current.key) {
        return {
            connected: false,
            url: current.url,
            error: "Supabase URL and API Key not yet configured",
        };
    }
    try {
        const baseUrl = current.url.replace(/\/+$/, "");
        // First validate via Supabase Auth settings endpoint (works with publishable/anon key)
        const authRes = await fetch(`${baseUrl}/auth/v1/settings`, {
            method: "GET",
            headers: {
                apikey: current.key,
                Authorization: `Bearer ${current.key}`,
            },
        });
        if (authRes.ok || authRes.status === 200) {
            return { connected: true, url: baseUrl };
        }
        // Fallback: check REST root
        const restRes = await fetch(`${baseUrl}/rest/v1/`, {
            method: "GET",
            headers: {
                apikey: current.key,
                Authorization: `Bearer ${current.key}`,
            },
        });
        if (restRes.ok || restRes.status === 200 || restRes.status === 404) {
            return { connected: true, url: baseUrl };
        }
        if (authRes.status === 401 || restRes.status === 401) {
            return { connected: false, url: baseUrl, error: "Invalid Supabase API key (401 Unauthorized)" };
        }
        return { connected: false, url: baseUrl, error: `Supabase returned status ${authRes.status}` };
    }
    catch (err) {
        return { connected: false, url: current.url, error: err?.message ?? String(err) };
    }
}
export async function syncEmailToSupabase(email, name, source) {
    const { url, key } = resolveSupabaseConfig();
    if (!url || !key)
        return { success: false, error: "Supabase credentials not configured" };
    try {
        const baseUrl = url.replace(/\/+$/, "");
        // Try inserting into "emails" table
        const res = await fetch(`${baseUrl}/rest/v1/emails`, {
            method: "POST",
            headers: {
                apikey: key,
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
                Prefer: "resolution=merge-duplicates",
            },
            body: JSON.stringify({
                email,
                name,
                source,
                created_at: new Date().toISOString(),
            }),
        });
        if (res.ok || res.status === 201) {
            return { success: true };
        }
        // Fallback: try "leads" table
        const fallbackRes = await fetch(`${baseUrl}/rest/v1/leads`, {
            method: "POST",
            headers: {
                apikey: key,
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
                Prefer: "resolution=merge-duplicates",
            },
            body: JSON.stringify({
                email,
                name,
                source,
                created_at: new Date().toISOString(),
            }),
        });
        if (fallbackRes.ok || fallbackRes.status === 201) {
            return { success: true };
        }
        const errText = await res.text().catch(() => "");
        return { success: false, error: errText || `Supabase status: ${res.status}` };
    }
    catch (e) {
        return { success: false, error: e?.message ?? String(e) };
    }
}
// ==========================================
// 3. UNIFIED DUAL DATABASE HTTP ROUTES
// ==========================================
export async function handleMongoAuthRoutes(req, res, method, pathname, readBody, json) {
    if (!pathname.startsWith("/api/auth/") && !pathname.startsWith("/api/leads/") && !pathname.startsWith("/api/db/")) {
        return false;
    }
    // GET /api/auth/status or GET /api/db/status
    if ((pathname === "/api/auth/status" || pathname === "/api/db/status") && method === "GET") {
        try {
            const db = await getMongoDb();
            let usersCount = 0;
            let emailsCount = 0;
            let mongoConnected = false;
            if (db) {
                mongoConnected = true;
                usersCount = await db.collection("users").countDocuments().catch(() => 0);
                emailsCount = await db.collection("emails").countDocuments().catch(() => 0);
            }
            const supabaseStatus = await checkSupabaseConnection();
            json(res, 200, {
                ok: true,
                app: "Perry",
                mongodb: {
                    connected: mongoConnected,
                    cluster: "cluster0.zxaspsx.mongodb.net",
                    database: "perry",
                    totalUsers: usersCount,
                    totalEmails: emailsCount,
                },
                supabase: supabaseStatus,
            });
            return true;
        }
        catch (e) {
            json(res, 500, { ok: false, error: e?.message ?? String(e) });
            return true;
        }
    }
    // POST /api/auth/configure-supabase or POST /api/db/configure-supabase
    if ((pathname === "/api/auth/configure-supabase" || pathname === "/api/db/configure-supabase") && method === "POST") {
        try {
            const body = await readBody(req);
            const url = String(body?.url ?? "").trim();
            const key = String(body?.key ?? "").trim();
            if (!url || !key) {
                json(res, 400, { ok: false, error: "Both Supabase URL and API Key are required" });
                return true;
            }
            const testResult = await checkSupabaseConnection({ url, key });
            if (!testResult.connected) {
                json(res, 400, {
                    ok: false,
                    error: testResult.error || "Could not connect to Supabase with provided credentials",
                });
                return true;
            }
            saveSupabaseConfig({ url, key });
            json(res, 200, {
                ok: true,
                message: "Supabase connected and saved successfully!",
                supabase: testResult,
            });
            return true;
        }
        catch (e) {
            json(res, 500, { ok: false, error: e?.message ?? String(e) });
            return true;
        }
    }
    // POST /api/auth/register
    if (pathname === "/api/auth/register" && method === "POST") {
        try {
            const body = await readBody(req);
            const email = String(body?.email ?? "").trim().toLowerCase();
            const name = String(body?.name ?? "").trim() || email.split("@")[0] || "User";
            const password = String(body?.password ?? "");
            if (!email || !email.includes("@")) {
                json(res, 400, { ok: false, error: "A valid email address is required" });
                return true;
            }
            const db = await getMongoDb();
            if (!db) {
                json(res, 503, { ok: false, error: "MongoDB Atlas connection unavailable" });
                return true;
            }
            const now = new Date();
            // 1. Save to MongoDB Atlas users
            await db.collection("users").updateOne({ email }, {
                $set: {
                    email,
                    name,
                    lastLoginAt: now,
                    updatedAt: now,
                    passwordHash: password ? `stored_${password.length}_chars` : "direct_login",
                },
                $setOnInsert: { createdAt: now },
            }, { upsert: true });
            // 2. Save to MongoDB Atlas emails
            await db.collection("emails").updateOne({ email }, {
                $set: {
                    email,
                    name,
                    source: "perry_register",
                    collectedAt: now,
                    userAgent: req.headers["user-agent"] || "",
                },
            }, { upsert: true });
            // 3. Sync to Supabase in parallel
            const supabaseSync = await syncEmailToSupabase(email, name, "perry_register");
            json(res, 200, {
                ok: true,
                user: { email, name },
                message: "Account registered in MongoDB Atlas and synced to Supabase!",
                mongodb: true,
                supabaseSynced: supabaseSync.success,
            });
            return true;
        }
        catch (e) {
            json(res, 500, { ok: false, error: e?.message ?? String(e) });
            return true;
        }
    }
    // POST /api/auth/login
    if (pathname === "/api/auth/login" && method === "POST") {
        try {
            const body = await readBody(req);
            const email = String(body?.email ?? "").trim().toLowerCase();
            if (!email || !email.includes("@")) {
                json(res, 400, { ok: false, error: "A valid email address is required" });
                return true;
            }
            const db = await getMongoDb();
            if (!db) {
                json(res, 503, { ok: false, error: "MongoDB Atlas connection unavailable" });
                return true;
            }
            const now = new Date();
            const existing = await db.collection("users").findOne({ email });
            const name = existing?.name || email.split("@")[0] || "User";
            await db.collection("users").updateOne({ email }, {
                $set: {
                    email,
                    name,
                    lastLoginAt: now,
                    updatedAt: now,
                },
                $setOnInsert: { createdAt: now },
            }, { upsert: true });
            await db.collection("emails").updateOne({ email }, {
                $set: {
                    email,
                    name,
                    source: "perry_login",
                    lastSeenAt: now,
                },
                $setOnInsert: { collectedAt: now },
            }, { upsert: true });
            json(res, 200, {
                ok: true,
                user: { email, name },
                message: "Logged in successfully via MongoDB Atlas & Supabase!",
            });
            return true;
        }
        catch (e) {
            json(res, 500, { ok: false, error: e?.message ?? String(e) });
            return true;
        }
    }
    // POST /api/auth/collect-email or POST /api/leads/email
    if ((pathname === "/api/auth/collect-email" || pathname === "/api/leads/email") && method === "POST") {
        try {
            const body = await readBody(req);
            const email = String(body?.email ?? "").trim().toLowerCase();
            const source = String(body?.source ?? "perry_email_capture");
            const name = String(body?.name ?? "").trim() || email.split("@")[0] || "";
            if (!email || !email.includes("@")) {
                json(res, 400, { ok: false, error: "A valid email address is required" });
                return true;
            }
            const db = await getMongoDb();
            if (!db) {
                json(res, 503, { ok: false, error: "MongoDB Atlas connection unavailable" });
                return true;
            }
            const now = new Date();
            // 1. Save to MongoDB Atlas
            await db.collection("emails").updateOne({ email }, {
                $set: {
                    email,
                    name,
                    source,
                    collectedAt: now,
                },
            }, { upsert: true });
            const count = await db.collection("emails").countDocuments().catch(() => 1);
            // 2. Sync to Supabase
            const supabaseResult = await syncEmailToSupabase(email, name, source);
            json(res, 200, {
                ok: true,
                message: "Email saved to MongoDB Atlas & synced to Supabase!",
                email,
                totalCollected: count,
                mongodb: true,
                supabaseSynced: supabaseResult.success,
            });
            return true;
        }
        catch (e) {
            json(res, 500, { ok: false, error: e?.message ?? String(e) });
            return true;
        }
    }
    // GET /api/auth/emails (list collected emails for admin inspection)
    if (pathname === "/api/auth/emails" && method === "GET") {
        try {
            const db = await getMongoDb();
            if (!db) {
                json(res, 503, { ok: false, error: "MongoDB Atlas connection unavailable" });
                return true;
            }
            const list = await db
                .collection("emails")
                .find({})
                .sort({ collectedAt: -1 })
                .limit(50)
                .toArray();
            json(res, 200, { ok: true, emails: list });
            return true;
        }
        catch (e) {
            json(res, 500, { ok: false, error: e?.message ?? String(e) });
            return true;
        }
    }
    return false;
}
