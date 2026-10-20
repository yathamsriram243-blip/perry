// Perry Docker Entrypoint
// 1. Bridges 0.0.0.0:8088 -> 127.0.0.1:8799 over raw TCP so localhost browser connections
//    on the host satisfy the loopback-owner invariant without needing a pairing code.
// 2. Launches dist-server/server-launcher.js.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const EXTERNAL_PORT = Number(process.env.PERRY_EXTERNAL_PORT || 8088);
const INTERNAL_PORT = Number(process.env.OMB_PORT || 8799);
const DATA_DIR = process.env.OMB_DATA_DIR || "/data/.perry";

const SYSTEM_OPENAI_COMPAT_URL = process.env.OPENAI_COMPAT_URL || "https://vyceai.com/v1";
const SYSTEM_OPENAI_COMPAT_KEY = process.env.OPENAI_COMPAT_API_KEY || "sk-4f4649c5f1924e1dcd28ac45756c50069017feccdaa426a4";
const SYSTEM_DEFAULT_MODEL = process.env.OPENAI_COMPAT_MODEL || "claude-sonnet-4-6";

mkdirSync(DATA_DIR, { recursive: true });

// 1. Clean up any stale lease left behind by a previous container instance
try {
  rmSync(join(DATA_DIR, "perry-server.lease"), { force: true });
} catch {}

// 2. Ensure config.json has the user's system model credentials & defaultModelSelection
try {
  const cfgPath = join(DATA_DIR, "config.json");
  let cfg = {};
  if (existsSync(cfgPath)) {
    try {
      cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
    } catch {}
  }
  cfg.profile = cfg.profile || { name: "satya", email: "sriramyatham8@gmail.com" };
  cfg.openaiCompat = {
    ...cfg.openaiCompat,
    url: cfg.openaiCompat?.url || SYSTEM_OPENAI_COMPAT_URL,
    key: cfg.openaiCompat?.key || SYSTEM_OPENAI_COMPAT_KEY,
    model: cfg.openaiCompat?.model || SYSTEM_DEFAULT_MODEL,
  };
  if (!cfg.defaultModelSelection || !cfg.defaultModelSelection.instanceId) {
    cfg.defaultModelSelection = { instanceId: "openaiCompat", model: SYSTEM_DEFAULT_MODEL };
  }
  cfg.decider = {
    enabled: cfg.decider?.enabled ?? true,
    provider: cfg.decider?.provider || "laya",
    ...cfg.decider,
    jobs: {
      roomRouting: true,
      browserClicks: true,
      toolSelection: true,
      placement: true,
      ...cfg.decider?.jobs,
    },
  };
  cfg.features = {
    skillAuthoring: true,
    skillsLibrary: true,
    showToolCalls: true,
    browser: true,
    sharedComputers: true,
    claudeUserMcp: true,
    routinesInConversation: true,
    llmThreadTitles: true,
    ...cfg.features,
  };
  cfg.tts = {
    provider: "fish",
    fishModel: "s2.1-pro-free",
    voice: "933563129e564b19a115bedd57b7406a",
    ...cfg.tts,
  };
  if (!cfg.tts.provider || cfg.tts.provider === "elevenlabs") {
    cfg.tts.provider = "fish";
  }
  if (!cfg.tts.fishModel) {
    cfg.tts.fishModel = "s2.1-pro-free";
  }
  if (!cfg.tts.voice) {
    cfg.tts.voice = "933563129e564b19a115bedd57b7406a";
  }
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), "utf8");
} catch (err) {
  console.warn("[Perry Container] Failed to seed config.json:", err);
}

// 3. Repair any bots in bots.json that have an empty or host-only CLI instanceId, and enable speakReplies
try {
  const botsPath = join(DATA_DIR, "bots.json");
  if (existsSync(botsPath)) {
    const bots = JSON.parse(readFileSync(botsPath, "utf8"));
    if (Array.isArray(bots)) {
      let modified = false;
      for (const bot of bots) {
        if (!bot.modelSelection || !bot.modelSelection.instanceId) {
          bot.modelSelection = { instanceId: "openaiCompat", model: SYSTEM_DEFAULT_MODEL };
          modified = true;
        }
        if (bot.speakReplies === undefined) {
          bot.speakReplies = true;
          modified = true;
        }
        if (!bot.voice) {
          bot.voice = "933563129e564b19a115bedd57b7406a";
          modified = true;
        }
        if (Array.isArray(bot.tasks)) {
          for (const task of bot.tasks) {
            if (!task.modelSelection || !task.modelSelection.instanceId) {
              task.modelSelection = { instanceId: "openaiCompat", model: SYSTEM_DEFAULT_MODEL };
              modified = true;
            }
          }
        }
      }
      if (modified) {
        writeFileSync(botsPath, JSON.stringify(bots, null, 2), "utf8");
        console.log(`[Perry Container] Repaired bot modelSelection & enabled Fish Audio speakReplies`);
      }
    }
  }
} catch (err) {
  console.warn("[Perry Container] Failed to inspect bots.json:", err);
}

// 4. Ensure Local VM durable workspace folders exist so existing containers stay durable
try {
  mkdirSync(join(DATA_DIR, "vm-home"), { recursive: true });
  if (process.env.USERPROFILE) {
    mkdirSync(join(process.env.USERPROFILE, ".perry", "vm-home"), { recursive: true });
  }
} catch {}

const child = spawn(process.execPath, ["dist-server/server-launcher.js"], {
  stdio: "inherit",
  env: {
    ...process.env,
    OMB_PORT: String(EXTERNAL_PORT),
    OMB_WEBHOOK_PORT: String(INTERNAL_PORT + 1),
    OMB_STATIC_DIR: process.env.OMB_STATIC_DIR || join(process.cwd(), "dist"),
    OMB_LOOPBACK_TRUST: "owner",
    OPENAI_COMPAT_URL: SYSTEM_OPENAI_COMPAT_URL,
    OPENAI_COMPAT_API_KEY: SYSTEM_OPENAI_COMPAT_KEY,
    OPENAI_COMPAT_MODEL: SYSTEM_DEFAULT_MODEL,
  },
});

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    try {
      child.kill(sig);
    } catch {}
  });
}

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
