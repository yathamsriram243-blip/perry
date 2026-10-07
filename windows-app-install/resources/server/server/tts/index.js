import { voiceCredential } from "../included-services.js";
import * as chatterbox from "./chatterbox.js";
import * as elevenlabs from "./elevenlabs.js";
import * as grok from "./grok.js";
import * as fish from "./fish.js";
import * as systemVoices from "./system-voices.js";
export class NoVoiceConfigured extends Error {
    // a plain field rather than a constructor parameter property: the harness
    // runs under `node --experimental-strip-types`, which is strip-ONLY, so a
    // parameter property is rejected at load time even though it typechecks
    reason;
    constructor(reason, hint) {
        super(hint ??
            (reason === "key"
                ? "Add an ElevenLabs key in Settings on the computer to turn on voice."
                : "Pick a voice in the agent profile."));
        this.reason = reason;
    }
}
/** The ElevenLabs credential in use: the person's own key, else the one
 * included with Cloud Pro. Settings' own-key flows read cfg.tts.key instead. */
const elevenLabs = (cfg) => voiceCredential(cfg.tts?.key);
export function voiceProvider(cfg) {
    const provider = cfg.tts?.provider;
    if (provider === "xai" || provider === "fish" || provider === "system" || provider === "chatterbox")
        return provider;
    if (provider === "elevenlabs" && elevenLabs(cfg))
        return "elevenlabs";
    return "fish";
}
/** The system provider needs no credential — it is only ever offered where
 * the platform actually has it, so "configured" means "this engine can
 * speak", not "a key is on file". */
export function providerConfigured(cfg) {
    const provider = voiceProvider(cfg);
    if (provider === "xai")
        return Boolean(cfg.xai?.key);
    if (provider === "system")
        return systemVoices.systemVoicesAvailable();
    if (provider === "chatterbox")
        return Boolean(cfg.tts?.baseUrl?.trim());
    if (provider === "fish")
        return true;
    return Boolean(elevenLabs(cfg));
}
export function voiceConfigured(cfg) {
    const provider = voiceProvider(cfg);
    if (provider === "xai")
        return Boolean(cfg.xai?.key && cfg.tts?.voice);
    if (provider === "system") {
        return systemVoices.systemVoicesAvailable() && Boolean(cfg.tts?.voice);
    }
    if (provider === "chatterbox")
        return Boolean(cfg.tts?.baseUrl?.trim() && cfg.tts?.voice);
    if (provider === "fish")
        return true;
    return Boolean(elevenLabs(cfg) && cfg.tts?.voice);
}
/** A per-bot voice is a complete choice too; it should not be blocked just
 * because the app-wide fallback has not been selected yet. */
export function voiceReady(cfg, voiceId) {
    const provider = voiceProvider(cfg);
    if (provider === "xai")
        return Boolean(cfg.xai?.key && (voiceId || cfg.tts?.voice));
    if (provider === "system") {
        return systemVoices.systemVoicesAvailable() && Boolean(voiceId || cfg.tts?.voice);
    }
    if (provider === "chatterbox")
        return Boolean(cfg.tts?.baseUrl?.trim() && (voiceId || cfg.tts?.voice));
    if (provider === "fish")
        return true;
    return Boolean(elevenLabs(cfg) && (voiceId || cfg.tts?.voice));
}
/** What the settings panel needs. Never includes the key — same write-only
 * rule as every other credential. baseUrl and model are Chatterbox
 * settings, not credentials, so they come back in full; `fishModel` is the
 * Fish Audio speech model, resolved to its default when unset. `included`
 * says the voice is Cloud Pro's, not a saved key. */
export function describeVoice(cfg) {
    const provider = voiceProvider(cfg);
    const included = provider === "elevenlabs" && elevenLabs(cfg)?.included === true;
    return {
        configured: providerConfigured(cfg),
        ready: voiceConfigured(cfg),
        voice: cfg.tts?.voice || (provider === "fish" ? fish.DEFAULT_FISH_VOICE_ID : ""),
        provider,
        baseUrl: provider === "chatterbox" ? (cfg.tts?.baseUrl ?? "") : "",
        model: provider === "chatterbox" ? (cfg.tts?.model ?? "") : "",
        ...(provider === "fish" ? { fishModel: cfg.tts?.fishModel ?? fish.DEFAULT_FISH_MODEL } : {}),
        ...(included ? { included: true } : {}),
    };
}
export function verifyKey(provider, key) {
    return provider === "fish" ? fish.verifyKey(key) : elevenlabs.verifyKey(key);
}
export async function listVoices(cfg, run) {
    const provider = voiceProvider(cfg);
    if (provider === "xai")
        return cfg.xai?.key ? grok.listVoices(cfg.xai.key) : [];
    if (provider === "system")
        return systemVoices.listSystemVoices(run);
    if (provider === "chatterbox") {
        const baseUrl = cfg.tts?.baseUrl?.trim();
        return baseUrl ? chatterbox.listChatterboxVoices(baseUrl) : [];
    }
    if (provider === "fish") {
        return fish.listVoices(cfg.tts?.fishKey);
    }
    const credential = elevenLabs(cfg);
    if (!credential)
        return [];
    return elevenlabs.listVoices(credential.token, credential.api);
}
/** Synthesize one utterance. Throws NoVoiceConfigured when there is nothing
 * to speak with, which the route turns into a 409 the client can explain. */
export function speak(cfg, text, voiceId, run) {
    const provider = voiceProvider(cfg);
    if (provider === "xai") {
        const key = cfg.xai?.key;
        if (!key)
            throw new NoVoiceConfigured("key", "Add an xAI key in Settings to use Grok voice.");
        const voice = voiceId || cfg.tts?.voice;
        if (!voice)
            throw new NoVoiceConfigured("voice");
        return grok.synthesize(text, voice, key);
    }
    if (provider === "system") {
        const voice = voiceId || cfg.tts?.voice;
        // An injected runner is the cross-platform test seam for `/usr/bin/say`;
        // production calls omit it and remain strictly Darwin-gated.
        if (!systemVoices.systemVoicesAvailable() && !run)
            throw new NoVoiceConfigured("key");
        if (!voice)
            throw new NoVoiceConfigured("voice");
        return systemVoices.synthesizeSystem(text, voice, run);
    }
    if (provider === "chatterbox") {
        const baseUrl = cfg.tts?.baseUrl?.trim();
        if (!baseUrl) {
            throw new NoVoiceConfigured("key", "Add the address of your Chatterbox server in Settings on the computer to turn on voice.");
        }
        const voice = voiceId || cfg.tts?.voice;
        if (!voice)
            throw new NoVoiceConfigured("voice");
        return chatterbox.synthesizeChatterbox(text, voice, baseUrl, cfg.tts?.model);
    }
    if (provider === "fish") {
        const voice = voiceId || cfg.tts?.voice || fish.DEFAULT_FISH_VOICE_ID;
        return fish.synthesize(text, voice, cfg.tts?.fishKey, cfg.tts?.fishModel ?? fish.DEFAULT_FISH_MODEL);
    }
    const credential = elevenLabs(cfg);
    if (!credential)
        throw new NoVoiceConfigured("key");
    const voice = voiceId || cfg.tts?.voice;
    if (!voice)
        throw new NoVoiceConfigured("voice");
    return elevenlabs.synthesize(text, voice, credential.token, credential.api);
}
