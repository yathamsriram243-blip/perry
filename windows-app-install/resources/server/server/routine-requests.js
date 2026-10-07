import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { cronScheduleLabel } from "../shared/cron-label.js";
import { normalizeCronSchedule, nextCronRuns } from "../shared/routine-schedule.js";
import { newId } from "./contracts.js";
import { redactSecretsInText } from "./redact.js";
import { parseJson, schemaIssue } from "./schema.js";
import { intervalHasRestrictions, nextOccurrence, } from "./routines.js";
const WEEKDAY_NUMBER = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
};
const WEEKDAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const RFC3339_WITH_OFFSET = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/i;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const ROUTINE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_DATE_MS = 8_640_000_000_000_000;
const ACTION_COPY = {
    create: { title: "Schedule", detail: "Create routine" },
    update: { title: "Update", detail: "Update routine" },
    pause: { title: "Pause", detail: "Pause routine" },
    resume: { title: "Resume", detail: "Resume routine" },
    run_now: { title: "Run now", detail: "Run routine now" },
    delete: { title: "Delete", detail: "Delete routine" },
};
const ROUTINE_REQUEST_FINGERPRINT_VERSION = 1;
const jsonObjectSchema = z.record(z.string(), z.custom());
const toolIntervalWindowSchema = z.object({
    start: z.string().max(5),
    end: z.string().max(5),
}).strict();
const routineToolScheduleSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("cron"), expression: z.string().max(256), timeZone: z.string().max(128) }).strict(),
    z.object({ type: z.literal("once"), at: z.string().max(64) }).strict(),
    z.object({
        type: z.literal("weekly"),
        time: z.string().max(5),
        weekdays: z.array(z.string().max(9)).min(1).max(7),
    }).strict(),
    z.object({
        type: z.literal("interval"),
        everyMinutes: z.number(),
        anchorAt: z.string().max(64).optional(),
        weekdays: z.array(z.string().max(9)).min(1).max(7).nullable().optional(),
        window: toolIntervalWindowSchema.nullable().optional(),
        endsAt: z.string().max(64).nullable().optional(),
    }).strict(),
]);
const routineToolDefinitionSchema = z.object({
    name: z.string().max(80),
    instructions: z.string().max(20_000),
    schedule: routineToolScheduleSchema,
    runOn: z.enum(["maus", "cloud"]).optional(),
    durationMinutes: z.number().optional(),
    timeoutMinutes: z.number().nullable().optional(),
    continuity: z.boolean().optional(),
    overlap: z.enum(["skip", "queue"]).optional(),
}).strict();
const routineToolChangesSchema = routineToolDefinitionSchema
    .omit({ timeoutMinutes: true })
    .partial()
    .extend({ timeoutMinutes: z.number().nullable().optional() })
    .strict()
    .refine((changes) => Object.values(changes).some((value) => value !== undefined), "Choose at least one routine field to update");
/** Resolved and authorized by the harness route (existence + same section)
 * before it reaches this service; re-authorized again at confirm time. */
const targetBotSchema = z.object({
    botId: z.string().min(1).max(128),
    name: z.string().min(1).max(80),
}).strict();
const routineProposalSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("create"), routine: routineToolDefinitionSchema, forBot: targetBotSchema.optional() }).strict(),
    z.object({ action: z.literal("update"), routineId: z.string().max(128), changes: routineToolChangesSchema, forBot: targetBotSchema.optional() }).strict(),
    z.object({ action: z.literal("pause"), routineId: z.string().max(128), forBot: targetBotSchema.optional() }).strict(),
    z.object({ action: z.literal("resume"), routineId: z.string().max(128), forBot: targetBotSchema.optional() }).strict(),
    z.object({ action: z.literal("run_now"), routineId: z.string().max(128), forBot: targetBotSchema.optional() }).strict(),
    z.object({ action: z.literal("delete"), routineId: z.string().max(128), forBot: targetBotSchema.optional() }).strict(),
]);
const storedWeekdaysSchema = z.array(z.number().int().min(0).max(6)).min(1).max(7).refine((weekdays) => new Set(weekdays).size === weekdays.length, "Stored routine weekdays must be unique");
const storedIntervalWindowSchema = z.object({
    start: z.string().regex(TIME),
    end: z.string().regex(TIME),
}).strict().refine(({ start, end }) => start < end, "Stored interval window must end later on the same day");
const storedCronScheduleSchema = z.object({
    type: z.literal("cron"), expression: z.string().max(256), timeZone: z.string().max(128),
}).strict().superRefine((schedule, context) => {
    try {
        normalizeCronSchedule(schedule);
    }
    catch (error) {
        context.addIssue({ code: "custom", message: error instanceof Error ? error.message : "Invalid stored cron schedule" });
    }
});
const storedScheduleSchema = z.discriminatedUnion("type", [
    storedCronScheduleSchema,
    z.object({ type: z.literal("once"), at: z.number().int().nonnegative() }).strict(),
    z.object({
        type: z.literal("daily"),
        time: z.string().regex(TIME),
        weekdays: storedWeekdaysSchema,
    }).strict(),
    z.object({
        type: z.literal("interval"),
        everyMinutes: z.number().int().min(5).max(1_440),
        anchorAt: z.number().int().nonnegative().max(MAX_DATE_MS).optional(),
        weekdays: storedWeekdaysSchema.optional(),
        window: storedIntervalWindowSchema.optional(),
        endsAt: z.number().int().nonnegative().max(MAX_DATE_MS).optional(),
    }).strict(),
]).superRefine((schedule, context) => {
    if (schedule.type !== "interval")
        return;
    if (schedule.window && intervalWindowMinutes(schedule.window) < schedule.everyMinutes) {
        context.addIssue({
            code: "custom",
            message: "Stored interval window must be at least as long as the cadence",
            path: ["window"],
        });
    }
    if (schedule.endsAt !== undefined && schedule.anchorAt !== undefined && schedule.endsAt < schedule.anchorAt) {
        context.addIssue({
            code: "custom",
            message: "Stored interval end must not be before its anchor",
            path: ["endsAt"],
        });
    }
});
const storedScheduleChangesSchema = z.discriminatedUnion("type", [
    storedCronScheduleSchema,
    z.object({ type: z.literal("once"), at: z.number().int().nonnegative() }).strict(),
    z.object({
        type: z.literal("daily"),
        time: z.string().regex(TIME),
        weekdays: storedWeekdaysSchema,
    }).strict(),
    z.object({
        type: z.literal("interval"),
        everyMinutes: z.number().int().min(5).max(1_440),
        anchorAt: z.number().int().nonnegative().max(MAX_DATE_MS).optional(),
        weekdays: storedWeekdaysSchema.nullable().optional(),
        window: storedIntervalWindowSchema.nullable().optional(),
        endsAt: z.number().int().nonnegative().max(MAX_DATE_MS).nullable().optional(),
    }).strict(),
]).superRefine((schedule, context) => {
    if (schedule.type !== "interval")
        return;
    if (schedule.window && intervalWindowMinutes(schedule.window) < schedule.everyMinutes) {
        context.addIssue({
            code: "custom",
            message: "Stored interval window must be at least as long as the cadence",
            path: ["window"],
        });
    }
    if (schedule.endsAt !== undefined &&
        schedule.endsAt !== null &&
        schedule.anchorAt !== undefined &&
        schedule.endsAt < schedule.anchorAt) {
        context.addIssue({
            code: "custom",
            message: "Stored interval end must not be before its anchor",
            path: ["endsAt"],
        });
    }
});
const storedDefinitionSchema = z.object({
    name: z.string().trim().min(1).max(80),
    instructions: z.string().trim().min(1).max(20_000),
    schedule: storedScheduleSchema,
    runOn: z.enum(["maus", "cloud"]),
    durationMinutes: z.number().int().min(5).max(240),
    timeoutMinutes: z.number().int().min(5).max(240).optional(),
    continuity: z.boolean().optional(),
    overlap: z.enum(["skip", "queue"]).optional(),
}).strict();
const storedChangesSchema = storedDefinitionSchema
    .omit({ schedule: true, timeoutMinutes: true })
    .partial()
    .extend({
    schedule: storedScheduleChangesSchema.optional(),
    timeoutMinutes: z.number().int().min(5).max(240).nullable().optional(),
})
    .strict()
    .refine((changes) => Object.values(changes).some((value) => value !== undefined), "Stored routine update must change at least one field");
const storedManageBase = {
    routineId: z.string().regex(ROUTINE_ID),
    expectedUpdatedAt: z.number().int().nonnegative(),
    forBot: targetBotSchema.optional(),
};
const storedOperationSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("create"), routine: storedDefinitionSchema, forBot: targetBotSchema.optional() }).strict(),
    z.object({ action: z.literal("update"), ...storedManageBase, changes: storedChangesSchema }).strict(),
    z.object({ action: z.literal("pause"), ...storedManageBase }).strict(),
    z.object({ action: z.literal("resume"), ...storedManageBase }).strict(),
    z.object({ action: z.literal("run_now"), ...storedManageBase }).strict(),
    z.object({ action: z.literal("delete"), ...storedManageBase }).strict(),
]);
const routineRequestCardDataSchema = z.object({
    version: z.literal(1),
    requestId: z.string().min(1).max(128),
    botId: z.string().min(1).max(128),
    threadId: z.string().min(1).max(128),
    createdAt: z.number().int().nonnegative(),
    operation: storedOperationSchema,
    appliedAt: z.number().int().nonnegative().optional(),
    resultId: z.string().min(1).max(128).optional(),
}).strict();
export class RoutineRequestError extends Error {
    status;
    /** True when no retry of this card can ever succeed — the routine moved
     * under the proposal — so the card must settle as expired rather than
     * staying actionable. */
    terminal;
    constructor(message, status = 400, options) {
        super(message);
        this.name = "RoutineRequestError";
        this.status = status;
        this.terminal = options?.terminal === true;
    }
}
function text(value, field, max) {
    const trimmed = value.trim();
    if (!trimmed)
        throw new RoutineRequestError(`${field} is required`);
    if (trimmed.length > max)
        throw new RoutineRequestError(`${field} must be ${max.toLocaleString("en-US")} characters or fewer`);
    // This payload is hidden under the visible card fields, so the store's
    // shallow card redaction cannot reach it. Scrub before it is persisted.
    const redacted = redactSecretsInText(trimmed);
    if (redacted.length > max) {
        throw new RoutineRequestError(`${field} must remain ${max.toLocaleString("en-US")} characters or fewer after credentials are removed`);
    }
    return redacted;
}
function runOn(value) {
    return value ?? "maus";
}
function duration(value) {
    const normalized = value ?? 30;
    if (!Number.isInteger(normalized) || normalized < 5 || normalized > 240) {
        throw new RoutineRequestError("durationMinutes must be a whole number from 5 to 240");
    }
    return normalized;
}
function timeout(value) {
    if (value == null)
        return value;
    if (!Number.isInteger(value) || value < 5 || value > 240) {
        throw new RoutineRequestError("timeoutMinutes must be a whole number from 5 to 240");
    }
    return value;
}
function intervalWindowMinutes(window) {
    const [startHour, startMinute] = window.start.split(":").map(Number);
    const [endHour, endMinute] = window.end.split(":").map(Number);
    return endHour * 60 + endMinute - (startHour * 60 + startMinute);
}
function intervalWeekdays(values) {
    const weekdays = values.map((day) => {
        const number = WEEKDAY_NUMBER[day.toLowerCase()];
        if (number === undefined)
            throw new RoutineRequestError(`Unsupported weekday: ${day}`);
        return number;
    });
    return [...new Set(weekdays)].sort();
}
function intervalWindow(value, everyMinutes) {
    if (!TIME.test(value.start) || !TIME.test(value.end)) {
        throw new RoutineRequestError("Interval windows must use 24-hour HH:MM");
    }
    if (value.start >= value.end) {
        throw new RoutineRequestError("Interval windows must end later on the same day");
    }
    if (intervalWindowMinutes(value) < everyMinutes) {
        throw new RoutineRequestError("The interval window must be at least as long as everyMinutes");
    }
    return { start: value.start, end: value.end };
}
function rfc3339Instant(value, offsetMessage) {
    const parts = RFC3339_WITH_OFFSET.exec(value);
    if (!parts)
        throw new RoutineRequestError(offsetMessage);
    const year = Number(parts[1]);
    const month = Number(parts[2]);
    const day = Number(parts[3]);
    const hour = Number(parts[4]);
    const minute = Number(parts[5]);
    const second = Number(parts[6]);
    const offsetHour = Number(parts[7] ?? 0);
    const offsetMinute = Number(parts[8] ?? 0);
    const daysInMonth = month >= 1 && month <= 12
        ? new Date(Date.UTC(year, month, 0)).getUTCDate()
        : 0;
    if (day < 1 ||
        day > daysInMonth ||
        hour > 23 ||
        minute > 59 ||
        second > 59 ||
        offsetHour > 23 ||
        offsetMinute > 59) {
        throw new RoutineRequestError("Choose a valid RFC3339 date and time");
    }
    const at = Date.parse(value);
    if (!Number.isFinite(at))
        throw new RoutineRequestError("Choose a valid RFC3339 date and time");
    return at;
}
function normalizeSchedule(schedule, now) {
    if (schedule.type === "cron") {
        try {
            return normalizeCronSchedule(schedule, now);
        }
        catch (error) {
            throw new RoutineRequestError(error instanceof Error ? error.message : "Invalid cron schedule");
        }
    }
    if (schedule.type === "once") {
        const at = rfc3339Instant(schedule.at, "One-time schedules need an RFC3339 date-time with an explicit timezone offset");
        if (at <= now)
            throw new RoutineRequestError("The scheduled date and time must be in the future");
        return { type: "once", at };
    }
    if (schedule.type === "interval") {
        if (!Number.isInteger(schedule.everyMinutes) || schedule.everyMinutes < 5 || schedule.everyMinutes > 1_440) {
            throw new RoutineRequestError("everyMinutes must be a whole number from 5 to 1440");
        }
        let anchorAt;
        if (schedule.anchorAt !== undefined) {
            anchorAt = rfc3339Instant(schedule.anchorAt, "Interval starts need an RFC3339 date-time with an explicit timezone offset");
            if (!Number.isSafeInteger(anchorAt) || anchorAt < 0 || anchorAt > MAX_DATE_MS) {
                throw new RoutineRequestError("Choose a valid interval start time");
            }
        }
        let endsAt;
        if (schedule.endsAt !== undefined && schedule.endsAt !== null) {
            endsAt = rfc3339Instant(schedule.endsAt, "Interval ends need an RFC3339 date-time with an explicit timezone offset");
            if (!Number.isSafeInteger(endsAt) || endsAt < 0 || endsAt > MAX_DATE_MS) {
                throw new RoutineRequestError("Choose a valid interval end time");
            }
            if (endsAt < (anchorAt ?? now)) {
                throw new RoutineRequestError("The interval end must not be before its start");
            }
        }
        return {
            type: "interval",
            everyMinutes: schedule.everyMinutes,
            ...(anchorAt === undefined ? {} : { anchorAt }),
            ...(schedule.weekdays == null ? {} : { weekdays: intervalWeekdays(schedule.weekdays) }),
            ...(schedule.window == null ? {} : { window: intervalWindow(schedule.window, schedule.everyMinutes) }),
            ...(endsAt === undefined ? {} : { endsAt }),
        };
    }
    if (!TIME.test(schedule.time)) {
        throw new RoutineRequestError("Weekly schedule time must use 24-hour HH:MM");
    }
    if (schedule.weekdays.length === 0)
        throw new RoutineRequestError("Choose at least one weekday");
    const weekdays = schedule.weekdays.map((day) => {
        // SAFETY: every key in WEEKDAY_NUMBER is lower-case; membership is
        // checked immediately below before the numeric value is retained.
        const number = WEEKDAY_NUMBER[day.toLowerCase()];
        if (number === undefined)
            throw new RoutineRequestError(`Unsupported weekday: ${day}`);
        return number;
    });
    return { type: "daily", time: schedule.time, weekdays: [...new Set(weekdays)].sort() };
}
function normalizeScheduleChanges(schedule, now) {
    const normalized = normalizeSchedule(schedule, now);
    if (schedule.type !== "interval" || normalized.type !== "interval")
        return normalized;
    return {
        ...normalized,
        ...(schedule.weekdays === null ? { weekdays: null } : {}),
        ...(schedule.window === null ? { window: null } : {}),
        ...(schedule.endsAt === null ? { endsAt: null } : {}),
    };
}
function normalizeDefinition(input, now) {
    const timeoutMinutes = timeout(input.timeoutMinutes);
    return {
        name: text(input.name, "name", 80),
        instructions: text(input.instructions, "instructions", 20_000),
        schedule: normalizeSchedule(input.schedule, now),
        runOn: runOn(input.runOn),
        durationMinutes: duration(input.durationMinutes),
        ...(timeoutMinutes == null ? {} : { timeoutMinutes }),
        ...(input.continuity === true ? { continuity: true } : {}),
        ...(input.overlap === "queue" ? { overlap: "queue" } : {}),
    };
}
function normalizeChanges(input, now) {
    const changes = {};
    if (input.name !== undefined)
        changes.name = text(input.name, "name", 80);
    if (input.instructions !== undefined)
        changes.instructions = text(input.instructions, "instructions", 20_000);
    if (input.schedule !== undefined)
        changes.schedule = normalizeScheduleChanges(input.schedule, now);
    if (input.runOn !== undefined)
        changes.runOn = runOn(input.runOn);
    if (input.durationMinutes !== undefined)
        changes.durationMinutes = duration(input.durationMinutes);
    if (input.timeoutMinutes !== undefined)
        changes.timeoutMinutes = timeout(input.timeoutMinutes);
    if (input.continuity !== undefined)
        changes.continuity = input.continuity === true;
    if (input.overlap !== undefined)
        changes.overlap = input.overlap;
    return changes;
}
function routineId(value) {
    if (!ROUTINE_ID.test(value))
        throw new RoutineRequestError("Choose a valid routine id");
    return value;
}
function ownedRoutine(manager, id, botId) {
    return manager.listRoutines().find((routine) => routine.id === id && routine.botId === botId) ?? null;
}
function noFutureResumeMessage(schedule) {
    if (schedule.type === "interval") {
        return "That interval routine has no future runs. Choose a later end time or remove the end restriction before resuming.";
    }
    if (schedule.type === "once") {
        return "That one-time routine's scheduled time has passed. Update it to a new future time before resuming.";
    }
    return "That routine has no future runs. Update its schedule before resuming.";
}
function normalizedOperation(manager, botId, validated, now) {
    if (validated.action === "create") {
        const operation = {
            action: "create",
            routine: normalizeDefinition(validated.routine, now),
        };
        if (validated.forBot)
            operation.forBot = validated.forBot;
        return operation;
    }
    const id = routineId(validated.routineId);
    // A targeted action manages the named bot's routine: ownership and every
    // run's permissions stay with that bot, exactly as a routine created
    // through the for_bot_id path keeps them.
    const ownerBotId = validated.forBot?.botId ?? botId;
    const current = ownedRoutine(manager, id, ownerBotId);
    if (!current)
        throw new RoutineRequestError("That routine does not exist", 404);
    if (validated.action === "update") {
        return {
            action: "update",
            routineId: id,
            expectedUpdatedAt: current.updatedAt,
            changes: normalizeChanges(validated.changes, now),
            ...(validated.forBot ? { forBot: validated.forBot } : {}),
        };
    }
    if (validated.action === "resume" && nextOccurrence(current.schedule, now) === null) {
        throw new RoutineRequestError(noFutureResumeMessage(current.schedule), 409);
    }
    return {
        action: validated.action,
        routineId: id,
        expectedUpdatedAt: current.updatedAt,
        ...(validated.forBot ? { forBot: validated.forBot } : {}),
    };
}
export function asSchedule(schedule, now) {
    if (schedule.type === "cron")
        return { ...schedule };
    if (schedule.type === "once")
        return { type: "once", at: schedule.at };
    if (schedule.type === "interval") {
        return {
            type: "interval",
            everyMinutes: schedule.everyMinutes,
            anchorAt: schedule.anchorAt ?? now,
            ...(schedule.weekdays === undefined ? {} : { weekdays: [...schedule.weekdays] }),
            ...(schedule.window === undefined ? {} : { window: { ...schedule.window } }),
            ...(schedule.endsAt === undefined ? {} : { endsAt: schedule.endsAt }),
        };
    }
    return { type: "daily", time: schedule.time, weekdays: [...schedule.weekdays] };
}
function schedulePatch(schedule, now, current) {
    if (schedule.type !== "interval")
        return asSchedule(schedule, now);
    return {
        type: "interval",
        everyMinutes: schedule.everyMinutes,
        anchorAt: schedule.anchorAt ?? (current.type === "interval" ? current.anchorAt : now),
        ...(Object.hasOwn(schedule, "weekdays")
            ? { weekdays: schedule.weekdays === null ? null : [...schedule.weekdays] }
            : {}),
        ...(Object.hasOwn(schedule, "window")
            ? { window: schedule.window === null ? null : { ...schedule.window } }
            : {}),
        ...(Object.hasOwn(schedule, "endsAt") ? { endsAt: schedule.endsAt } : {}),
    };
}
function effectiveSchedule(current, incoming) {
    if (incoming.type === "cron")
        return { ...incoming };
    if (incoming.type !== "interval") {
        return incoming.type === "once"
            ? { type: "once", at: incoming.at }
            : { type: "daily", time: incoming.time, weekdays: [...incoming.weekdays] };
    }
    const previous = current.type === "interval" ? current : undefined;
    const merged = {
        type: "interval",
        everyMinutes: incoming.everyMinutes,
        ...(incoming.anchorAt !== undefined
            ? { anchorAt: incoming.anchorAt }
            : previous?.anchorAt !== undefined
                ? { anchorAt: previous.anchorAt }
                : {}),
    };
    const weekdays = incoming.weekdays === undefined ? previous?.weekdays : incoming.weekdays;
    if (weekdays !== undefined && weekdays !== null)
        merged.weekdays = [...weekdays];
    const window = incoming.window === undefined ? previous?.window : incoming.window;
    if (window !== undefined && window !== null)
        merged.window = { ...window };
    const endsAt = incoming.endsAt === undefined ? previous?.endsAt : incoming.endsAt;
    if (endsAt !== undefined && endsAt !== null)
        merged.endsAt = endsAt;
    return merged;
}
function nextForOperation(operation, manager, now) {
    if (operation.action === "create") {
        if (operation.routine.schedule.type === "interval" && operation.routine.schedule.anchorAt === undefined)
            return null;
        return nextOccurrence(asSchedule(operation.routine.schedule, now), now);
    }
    const current = manager.listRoutines().find((routine) => routine.id === operation.routineId);
    if (!current)
        return null;
    if (operation.action === "pause" || operation.action === "delete")
        return null;
    if (operation.action === "run_now")
        return now;
    if (operation.action === "resume")
        return nextOccurrence(current.schedule, now);
    if (!("changes" in operation))
        return null;
    if (!current.enabled)
        return null;
    const definition = effectiveDefinition(operation, manager);
    if (!definition)
        return null;
    if (definition.schedule.type === "interval" && definition.schedule.anchorAt === undefined)
        return null;
    const schedule = asSchedule(definition.schedule, now);
    return nextOccurrence(schedule, now);
}
function formatInstant(at, timeZone) {
    try {
        return new Intl.DateTimeFormat("en-US", {
            timeZone,
            dateStyle: "medium",
            timeStyle: "short",
        }).format(new Date(at));
    }
    catch {
        return new Date(at).toISOString();
    }
}
export function scheduleText(schedule, timeZone) {
    if (schedule.type === "cron")
        return `${cronScheduleLabel(schedule)} · Cron: ${schedule.expression}`;
    if (schedule.type === "once")
        return `${formatInstant(schedule.at, timeZone)} (${timeZone})`;
    if (schedule.type === "interval") {
        const restricted = intervalHasRestrictions(schedule);
        const cadence = schedule.anchorAt === undefined
            ? restricted
                ? `Every ${schedule.everyMinutes} minutes, cadence starting at confirmation; first run is the next allowed time`
                : `Every ${schedule.everyMinutes} minutes, starting one interval after confirmation`
            : `Every ${schedule.everyMinutes} minutes, anchored at ${formatInstant(schedule.anchorAt, timeZone)} (${timeZone})`;
        const restrictions = [
            schedule.weekdays?.length
                ? `on ${schedule.weekdays.map((day) => WEEKDAY_LABEL[day]).join(", ")} (${timeZone})`
                : null,
            schedule.window ? `during ${schedule.window.start}–${schedule.window.end} (${timeZone})` : null,
            schedule.endsAt !== undefined ? `until ${formatInstant(schedule.endsAt, timeZone)} (${timeZone})` : null,
        ].filter((part) => part !== null);
        return restrictions.length ? `${cadence} · ${restrictions.join(" · ")}` : cadence;
    }
    const days = schedule.weekdays.map((day) => WEEKDAY_LABEL[day]).join(", ");
    return `${days} at ${schedule.time} (${timeZone})`;
}
/** One plain sentence describing how often a routine will actually run, so
 * the approval card states the consequence rather than just the schedule. */
export function consequenceLine(schedule, continuity = false) {
    // A continuity routine still gets a fresh session per run; what carries
    // over is the previous run's report, so say that rather than contradict
    // the Continuity line above it.
    const session = continuity ? "each run starts a fresh session with the previous run's report" : "each run starts a fresh session";
    if (schedule.type === "cron")
        return `Will run at matching calendar times in ${schedule.timeZone}; ${session}.`;
    if (schedule.type === "once")
        return "Will run once; that run starts a fresh session.";
    if (schedule.type === "interval") {
        if (intervalHasRestrictions(schedule)) {
            return `Will run every ${schedule.everyMinutes} minutes when its day, time, and end restrictions allow; ${session}.`;
        }
        const runsPerDay = Math.round(1440 / schedule.everyMinutes);
        const cadence = runsPerDay <= 1 ? "about once a day" : `about ${runsPerDay} times a day`;
        return `Will run ${cadence}; ${session}.`;
    }
    const days = schedule.weekdays.length;
    const cadence = days === 7 ? "every day" : days === 1 ? "one day a week" : `${days} days a week`;
    return `Will run ${cadence}; ${session}.`;
}
function effectiveDefinition(operation, manager) {
    if (operation.action === "create")
        return operation.routine;
    const existing = manager.listRoutines().find((routine) => routine.id === operation.routineId);
    if (!existing)
        return null;
    const base = {
        name: existing.name,
        instructions: existing.prompt,
        schedule: existing.schedule.type === "interval"
            ? {
                ...existing.schedule,
                ...(existing.schedule.weekdays ? { weekdays: [...existing.schedule.weekdays] } : {}),
                ...(existing.schedule.window ? { window: { ...existing.schedule.window } } : {}),
            }
            : existing.schedule.type === "daily"
                ? { ...existing.schedule, weekdays: [...existing.schedule.weekdays] }
                : { ...existing.schedule },
        runOn: existing.runOn,
        durationMinutes: existing.durationMinutes,
        ...(existing.timeoutMinutes === undefined ? {} : { timeoutMinutes: existing.timeoutMinutes }),
        ...(existing.continuity ? { continuity: true } : {}),
        ...(existing.overlap ? { overlap: existing.overlap } : {}),
    };
    if (operation.action !== "update")
        return base;
    const { schedule, timeoutMinutes, ...changes } = operation.changes;
    const merged = {
        ...base,
        ...changes,
        ...(schedule === undefined ? {} : { schedule: effectiveSchedule(base.schedule, schedule) }),
    };
    if (timeoutMinutes === null)
        delete merged.timeoutMinutes;
    else if (timeoutMinutes !== undefined)
        merged.timeoutMinutes = timeoutMinutes;
    return merged;
}
function cardCopy(operation, manager, timeZone, now) {
    const definition = effectiveDefinition(operation, manager);
    const actionCopy = ACTION_COPY[operation.action];
    const actionLabel = actionCopy.title;
    const name = redactSecretsInText(definition?.name ?? "routine");
    const forBot = operation.forBot;
    const forSuffix = forBot ? ` for @${redactSecretsInText(forBot.name)}` : "";
    const title = `${actionLabel} “${name}”${forSuffix}?`;
    if (!definition) {
        return {
            title,
            summary: title,
            detail: `Action: ${actionCopy.detail}\nName: ${name}`,
            nextRunAt: null,
            tool: "manage_routine",
        };
    }
    const nextRunAt = nextForOperation(operation, manager, now);
    const scheduleTimeZone = definition.schedule.type === "cron" ? definition.schedule.timeZone : timeZone;
    const when = operation.action === "run_now" ? "Now" : scheduleText(definition.schedule, timeZone);
    const destination = definition.runOn === "cloud" ? "Bot’s current model on its cloud computer" : "Bot’s current model and configured computer";
    const current = operation.action === "create"
        ? null
        : manager.listRoutines().find((routine) => routine.id === operation.routineId) ?? null;
    const remainsPaused = operation.action === "update" && current?.enabled === false;
    const deferredInterval = definition.schedule.type === "interval" && definition.schedule.anchorAt === undefined;
    const deferredRestrictedInterval = deferredInterval &&
        definition.schedule.type === "interval" &&
        intervalHasRestrictions(definition.schedule);
    const nextDescription = remainsPaused
        ? "None — this routine remains paused"
        : deferredInterval
            ? deferredRestrictedInterval
                ? `Next allowed time after confirmation (${timeZone})`
                : "One interval after confirmation"
            : nextRunAt !== null
                ? formatInstant(nextRunAt, scheduleTimeZone)
                : operation.action === "pause"
                    ? "None — this routine will be paused"
                    : operation.action === "delete"
                        ? "None — this routine will be deleted"
                        : "None";
    const status = remainsPaused ? " · Remains paused" : "";
    // Existing routines may predate nested-card redaction. The approval still
    // shows every instruction, but credential-shaped values never travel back
    // through the bot's MCP response or into the transcript.
    const visibleInstructions = redactSecretsInText(definition.instructions);
    const runLimit = definition.timeoutMinutes === undefined
        ? "no run limit"
        : `${definition.timeoutMinutes} min limit`;
    return {
        title,
        summary: `${actionLabel} “${name}”${forSuffix} · ${when} · ${destination} · ${runLimit}${status}`,
        detail: [
            `Action: ${actionCopy.detail}`,
            `Name: ${name}`,
            ...(forBot ? [`For: @${redactSecretsInText(forBot.name)} — each run uses that bot's engine and permissions`] : []),
            `Schedule: ${when}`,
            `Next run: ${nextDescription}`,
            ...(definition.schedule.type === "cron" && nextRunAt !== null && operation.action !== "run_now"
                ? [`Next 3 runs (${scheduleTimeZone}): ${nextCronRuns(definition.schedule, now, 3).map((at) => formatInstant(at, scheduleTimeZone)).join(" · ")}`]
                : []),
            `Runs on: ${destination}`,
            `Run limit: ${definition.timeoutMinutes === undefined ? "No limit" : `${definition.timeoutMinutes} minutes`}`,
            `Continuity: ${definition.continuity ? "Carries the previous run's report into the next run" : "Each run starts fresh"}`,
            `While busy: ${definition.overlap === "queue" ? "Queue one scheduled run; skip further occurrences until it starts" : "Skip overlapping scheduled occurrences"}`,
            // Last before the instructions: the one sentence that says what
            // confirming actually does, in the reader's terms.
            ...(operation.action === "create" || operation.action === "update"
                ? [consequenceLine(definition.schedule, Boolean(definition.continuity))]
                : []),
            "",
            "Instructions:",
            visibleInstructions,
        ].join("\n"),
        nextRunAt,
        tool: operation.action === "create" ? "schedule_routine" : "manage_routine",
    };
}
function inputFromDefinition(definition, botId, now) {
    return {
        name: definition.name,
        prompt: definition.instructions,
        botId,
        runOn: definition.runOn,
        enabled: true,
        schedule: asSchedule(definition.schedule, now),
        durationMinutes: definition.durationMinutes,
        ...(definition.timeoutMinutes === undefined ? {} : { timeoutMinutes: definition.timeoutMinutes }),
        ...(definition.continuity ? { continuity: true } : {}),
        ...(definition.overlap === "queue" ? { overlap: "queue" } : {}),
    };
}
function updateFromChanges(changes, now, currentSchedule) {
    const patch = {};
    if (changes.name !== undefined)
        patch.name = changes.name;
    if (changes.instructions !== undefined)
        patch.prompt = changes.instructions;
    if (changes.schedule !== undefined)
        patch.schedule = schedulePatch(changes.schedule, now, currentSchedule);
    if (changes.runOn !== undefined)
        patch.runOn = changes.runOn;
    if (changes.durationMinutes !== undefined)
        patch.durationMinutes = changes.durationMinutes;
    if (changes.timeoutMinutes !== undefined)
        patch.timeoutMinutes = changes.timeoutMinutes;
    if (changes.continuity !== undefined)
        patch.continuity = changes.continuity;
    if (changes.overlap !== undefined)
        patch.overlap = changes.overlap;
    return patch;
}
function canonicalValue(value) {
    if (Array.isArray(value))
        return value.map(canonicalValue);
    const parsedObject = jsonObjectSchema.safeParse(value);
    if (!parsedObject.success)
        return value;
    const sorted = {};
    for (const key of Object.keys(parsedObject.data).sort()) {
        const child = parsedObject.data[key];
        if (child !== undefined)
            sorted[key] = canonicalValue(child);
    }
    return sorted;
}
/** Bind exact-once recovery to the immutable card owner as well as its
 * operation. Recursive key sorting keeps old receipts valid if a future
 * schema refactor changes object construction order. */
export function routineRequestFingerprint(payload, messageId) {
    const document = parseJson(JSON.stringify({
        fingerprintVersion: ROUTINE_REQUEST_FINGERPRINT_VERSION,
        cardVersion: payload.version,
        requestId: payload.requestId,
        messageId,
        botId: payload.botId,
        threadId: payload.threadId,
        operation: payload.operation,
    }));
    return createHash("sha256").update(JSON.stringify(canonicalValue(document))).digest("hex");
}
function verifyManageSnapshot(operation, manager, botId) {
    const current = ownedRoutine(manager, operation.routineId, botId);
    if (!current)
        throw new RoutineRequestError("That routine no longer exists", 404, { terminal: true });
    if (current.updatedAt !== operation.expectedUpdatedAt) {
        throw new RoutineRequestError("That routine changed after this confirmation card was prepared. Ask the bot to review it and propose the action again.", 409, { terminal: true });
    }
    return current;
}
function requestCommit(payload, messageId) {
    return {
        requestId: payload.requestId,
        messageId,
        botId: payload.botId,
        threadId: payload.threadId,
        action: payload.operation.action,
        fingerprintVersion: ROUTINE_REQUEST_FINGERPRINT_VERSION,
        fingerprint: routineRequestFingerprint(payload, messageId),
    };
}
function revalidateOperation(operation, manager, botId, now) {
    if (operation.action === "create") {
        const definition = operation.routine;
        const owner = operation.forBot?.botId ?? botId;
        const schedule = asSchedule(definition.schedule, now);
        const duplicate = manager.listRoutines().find((routine) => {
            if (!routine.enabled || routine.target !== "bot" || routine.botId !== owner
                || routine.runOn !== definition.runOn || routine.prompt !== definition.instructions
                || routine.durationMinutes !== definition.durationMinutes
                || routine.timeoutMinutes !== definition.timeoutMinutes
                || Boolean(routine.continuity) !== Boolean(definition.continuity)
                || (routine.overlap ?? "skip") !== (definition.overlap ?? "skip")
                || (routine.attachments?.length ?? 0) > 0)
                return false;
            // An omitted start means "every N minutes", not a new phase each time
            // the model retries. Explicit starts and all other constraints stay exact.
            const candidate = schedule.type === "interval" && routine.schedule.type === "interval"
                && definition.schedule.type === "interval" && definition.schedule.anchorAt === undefined
                ? { ...schedule, anchorAt: routine.schedule.anchorAt }
                : schedule;
            return isDeepStrictEqual(candidate, routine.schedule);
        });
        if (duplicate) {
            // The tool cannot choose a result destination. Return the existing ID,
            // without moving its reports or treating a renamed request as new work.
            throw new RoutineRequestError(`An enabled routine with the same instructions and execution settings already exists (${duplicate.id}). Use list_routines to review it, then update or run that routine instead.`, 409, { terminal: true });
        }
    }
    const current = operation.action === "create"
        ? null
        : verifyManageSnapshot(operation, manager, operation.forBot?.botId ?? botId);
    const schedule = operation.action === "create"
        ? operation.routine.schedule
        : operation.action === "update"
            ? operation.changes.schedule
            : undefined;
    if (schedule?.type === "cron") {
        try {
            normalizeCronSchedule(schedule, now);
        }
        catch (error) {
            throw new RoutineRequestError(error instanceof Error ? error.message : "Invalid cron schedule", 409);
        }
    }
    if (schedule?.type === "once" && schedule.at <= now) {
        throw new RoutineRequestError("That one-time schedule is now in the past. Ask the bot to propose a new time.", 409, { terminal: true });
    }
    if (schedule?.type === "interval") {
        const base = operation.action === "create"
            ? operation.routine.schedule
            : current
                ? effectiveSchedule(current.schedule.type === "interval"
                    ? {
                        ...current.schedule,
                        ...(current.schedule.weekdays ? { weekdays: [...current.schedule.weekdays] } : {}),
                        ...(current.schedule.window ? { window: { ...current.schedule.window } } : {}),
                    }
                    : current.schedule.type === "daily"
                        ? { ...current.schedule, weekdays: [...current.schedule.weekdays] }
                        : { ...current.schedule }, schedule)
                : null;
        const concrete = base ? asSchedule(base, now) : null;
        if (concrete) {
            const valid = storedScheduleSchema.safeParse(concrete);
            if (!valid.success) {
                throw new RoutineRequestError(schemaIssue(valid.error, "Invalid interval schedule"));
            }
        }
        if (concrete && nextOccurrence(concrete, now) === null) {
            throw new RoutineRequestError("That interval no longer has a future run. Choose a later end time or remove the end restriction.", 409);
        }
    }
    if (operation.action === "resume") {
        if (!current)
            throw new RoutineRequestError("That routine no longer exists", 404);
        if (nextOccurrence(current.schedule, now) === null) {
            throw new RoutineRequestError(noFutureResumeMessage(current.schedule), 409);
        }
    }
}
export class RoutineRequestService {
    store;
    routines;
    now;
    timeZone;
    cloudReady;
    canPersist;
    validateTarget;
    autoApply;
    constructor(options) {
        this.store = options.store;
        this.routines = options.routines;
        this.now = options.now ?? Date.now;
        this.timeZone = options.timeZone ?? (() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
        this.cloudReady = options.cloudReady;
        this.canPersist = options.canPersist;
        this.validateTarget = options.validateTarget;
        this.autoApply = options.autoApply;
    }
    async propose(args) {
        return this.prepare(args);
    }
    async submit(args) {
        const proposal = await this.prepare(args, true);
        return { ...proposal, state: proposal.result ? "applied" : "pending" };
    }
    async prepare(args, submitted = false) {
        const botId = text(args.botId, "botId", 128);
        const threadId = text(args.threadId, "threadId", 128);
        const at = this.now();
        const parsedProposal = routineProposalSchema.safeParse(args.proposal);
        if (!parsedProposal.success) {
            throw new RoutineRequestError(schemaIssue(parsedProposal.error, "Invalid routine proposal"));
        }
        const operation = normalizedOperation(this.routines, botId, parsedProposal.data, at);
        if (operation.forBot && this.validateTarget) {
            const refusal = this.validateTarget(botId, operation.forBot);
            if (refusal)
                throw new RoutineRequestError(refusal, 403);
        }
        await this.requireCloudReadiness(operation, botId);
        // The readiness probe is asynchronous. Another request can edit or
        // delete the routine while it is in flight, so re-check the captured
        // revision before rendering and persisting the confirmation snapshot.
        const cardAt = this.now();
        revalidateOperation(operation, this.routines, botId, cardAt);
        const requestId = newId();
        const payload = {
            version: 1,
            requestId,
            botId,
            threadId,
            createdAt: cardAt,
            operation,
        };
        const definition = effectiveDefinition(operation, this.routines);
        const timeZone = definition?.schedule.type === "cron" ? definition.schedule.timeZone : this.timeZone();
        const copy = cardCopy(operation, this.routines, timeZone, cardAt);
        const messageInput = {
            role: "bot",
            kind: "options",
            card: {
                title: copy.title,
                subtitle: copy.detail,
                options: ["Confirm", "Cancel"],
                requestId,
                tool: copy.tool,
                routineRequest: payload,
            },
        };
        if (args.from)
            messageInput.from = args.from;
        // This check and append are deliberately adjacent and synchronous. JS
        // cannot interleave another completed proposal between the capacity /
        // ownership decision and the durable transcript write.
        const persistence = this.canPersist?.(botId, threadId);
        if (persistence && !persistence.ok) {
            throw new RoutineRequestError(persistence.error, persistence.status);
        }
        if (args.canCommit && !args.canCommit()) {
            throw new RoutineRequestError("The requesting turn ended before this proposal could be saved", 401);
        }
        // Resolve the current source-thread grant after the asynchronous probe.
        const automatic = submitted && this.autoApply?.(botId, threadId) === true;
        if (automatic) {
            messageInput.card.options = [];
            messageInput.card.dismissed = true;
        }
        const message = this.store.appendMessage(threadId, messageInput);
        const proposal = {
            requestId,
            messageId: message.id,
            title: copy.title,
            summary: copy.summary,
            detail: copy.detail,
            nextRunAt: copy.nextRunAt,
            timeZone,
        };
        if (!automatic)
            return proposal;
        // Persist a hidden receipt first, then use the existing validated,
        // idempotent commit path without exposing a pending confirmation.
        let result;
        try {
            result = this.resolve({ botId, threadId, requestId, behavior: "allow" });
        }
        catch (error) {
            result = { claimed: true, state: "invalid", error: error instanceof Error ? error.message : String(error), status: error instanceof RoutineRequestError ? error.status : 400 };
        }
        if (result.state === "applied")
            return { ...proposal, result };
        // The scheduler commit can succeed even if settling its transcript
        // fails. Report that exact result; a retry only finishes the receipt.
        const receipt = this.routines.routineRequestReceipt(requestId);
        if (receipt && receipt.botId === botId && receipt.threadId === threadId && receipt.messageId === message.id &&
            receipt.fingerprintVersion === ROUTINE_REQUEST_FINGERPRINT_VERSION && receipt.fingerprint === routineRequestFingerprint(payload, message.id)) {
            return { ...proposal, result: {
                    claimed: true, state: "applied", action: receipt.action, resultId: receipt.resultId,
                    settlementPending: true, message: "Routine change applied. Recording the operation receipt could not finish; the change will not be applied again.",
                } };
        }
        throw new RoutineRequestError(result.state === "invalid" ? result.error : "The routine change could not be applied", result.state === "invalid" ? result.status : 409);
    }
    async requireCloudReadiness(operation, proposerBotId) {
        if (!this.cloudReady || operation.action === "pause" || operation.action === "delete")
            return;
        const definition = effectiveDefinition(operation, this.routines);
        if (definition?.runOn !== "cloud")
            return;
        let readiness;
        try {
            const targetBotId = operation.action === "create"
                ? operation.forBot?.botId ?? proposerBotId
                : this.routines.listRoutines().find(routine => routine.id === operation.routineId)?.botId ?? proposerBotId;
            readiness = await this.cloudReady(targetBotId);
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            throw new RoutineRequestError(`Could not verify cloud readiness: ${detail}`, 503);
        }
        if (readiness.ready)
            return;
        throw new RoutineRequestError(readiness.reason?.trim() || "Cloud execution is not configured yet. Set up a cloud computer first.", 409);
    }
    /**
     * Claims a routine card even after it was settled. That distinction is
     * important: duplicate clicks must never fall through to a provider that
     * did not create the request id.
     */
    resolve(args) {
        const message = this.store
            .messagesFor(args.threadId)
            .find((candidate) => candidate.card?.requestId === args.requestId && candidate.card.routineRequest);
        const card = message?.card;
        const rawPayload = card?.routineRequest;
        if (!message || !card || !rawPayload)
            return { claimed: false, state: "not_found" };
        if (args.behavior !== "allow" && args.behavior !== "deny") {
            return {
                claimed: true,
                state: "invalid",
                error: "Routine confirmations must be confirmed or cancelled",
                status: 400,
            };
        }
        const parsedPayload = routineRequestCardDataSchema.safeParse(rawPayload);
        if (!parsedPayload.success) {
            if (card.answered)
                return { claimed: true, state: "already_settled", behavior: card.answered };
            const recovered = this.settleCommittedReceipt(args, message.id, card);
            if (recovered)
                return recovered;
            // Cancelling is always safe and must remain possible even if an older
            // persisted payload no longer passes today's schema. Otherwise that
            // durable card would own the composer forever with no escape hatch.
            if (args.behavior === "deny") {
                this.store.patchMessage(args.threadId, message.id, { card: { ...card, answered: "deny", held: undefined } });
                return { claimed: true, state: "denied" };
            }
            const detail = schemaIssue(parsedPayload.error, "This routine request is invalid");
            this.store.patchMessage(args.threadId, message.id, {
                card: { ...card, held: redactSecretsInText(detail).slice(0, 500) },
            });
            return { claimed: true, state: "invalid", error: detail, status: 400 };
        }
        const payload = parsedPayload.data;
        if (payload.requestId !== args.requestId) {
            const recovered = this.settleCommittedReceipt(args, message.id, card);
            if (recovered)
                return recovered;
            if (args.behavior === "deny") {
                this.store.patchMessage(args.threadId, message.id, { card: { ...card, answered: "deny", held: undefined } });
                return { claimed: true, state: "denied" };
            }
            return { claimed: true, state: "invalid", error: "This routine request id does not match its confirmation card", status: 400 };
        }
        if (payload.botId !== args.botId || payload.threadId !== args.threadId) {
            const recovered = this.settleCommittedReceipt(args, message.id, card);
            if (recovered)
                return recovered;
            if (args.behavior === "deny") {
                this.store.patchMessage(args.threadId, message.id, { card: { ...card, answered: "deny", held: undefined } });
                return { claimed: true, state: "denied" };
            }
            return { claimed: true, state: "invalid", error: "This routine request belongs to another conversation", status: 403 };
        }
        if (card.answered) {
            this.forgetSettledReceipt(payload, message.id);
            return { claimed: true, state: "already_settled", behavior: card.answered };
        }
        try {
            const fingerprint = routineRequestFingerprint(payload, message.id);
            const receipt = this.routines.routineRequestReceipt(payload.requestId);
            if (receipt) {
                if (receipt.botId !== payload.botId ||
                    receipt.threadId !== payload.threadId ||
                    receipt.messageId !== message.id ||
                    receipt.action !== payload.operation.action ||
                    receipt.fingerprintVersion !== ROUTINE_REQUEST_FINGERPRINT_VERSION ||
                    receipt.fingerprint !== fingerprint) {
                    throw new RoutineRequestError("This routine request does not match its durable commit receipt", 409);
                }
                return this.settleApplied(args.threadId, message.id, card, payload, receipt.resultId, receipt.appliedAt);
            }
            // An expired card is settled terminal state, not a decision waiting on
            // a slower click: the proposal it carried can never be confirmed as
            // prepared, even when the routine moves back under it. The committed
            // receipt above still recovers a write that already happened; nothing
            // past this point can.
            if (card.expired) {
                return {
                    claimed: true,
                    state: "invalid",
                    error: "This routine request expired before it was confirmed. Ask for a fresh proposal.",
                    status: 409,
                };
            }
            if (args.behavior === "deny") {
                this.store.patchMessage(args.threadId, message.id, { card: { ...card, answered: "deny", held: undefined } });
                return { claimed: true, state: "denied" };
            }
            revalidateOperation(payload.operation, this.routines, payload.botId, this.now());
            if (payload.operation.forBot && this.validateTarget) {
                const refusal = this.validateTarget(payload.botId, payload.operation.forBot);
                if (refusal)
                    throw new RoutineRequestError(refusal, 404, { terminal: true });
            }
            const resultId = this.apply(payload, message.id, fingerprint);
            return this.settleApplied(args.threadId, message.id, card, payload, resultId);
        }
        catch (error) {
            const status = error instanceof RoutineRequestError ? error.status : 400;
            const detail = error instanceof Error ? error.message : String(error);
            // A terminal failure (the routine moved under the proposal) can never
            // be confirmed as prepared: settle the card as expired with its
            // options removed so it stops looking actionable.
            const expired = error instanceof RoutineRequestError && error.terminal;
            this.store.patchMessage(args.threadId, message.id, {
                card: { ...card, ...(expired ? { expired: true, options: [] } : {}), held: redactSecretsInText(detail).slice(0, 500) },
            });
            return {
                claimed: true,
                state: "invalid",
                error: detail,
                status,
            };
        }
    }
    settleApplied(threadId, messageId, card, payload, resultId, appliedAt = this.now()) {
        const applied = {
            ...payload,
            appliedAt,
            resultId,
        };
        const settled = this.store.patchMessage(threadId, messageId, {
            card: { ...card, answered: "allow", held: undefined, routineRequest: applied },
        });
        if (!settled)
            throw new RoutineRequestError("This routine confirmation card is no longer available", 409);
        this.forgetSettledReceipt(payload, messageId);
        return { claimed: true, state: "applied", action: payload.operation.action, resultId };
    }
    forgetSettledReceipt(payload, messageId) {
        this.forgetReceipt(requestCommit(payload, messageId));
    }
    settleCommittedReceipt(args, messageId, card) {
        const receipt = this.routines.routineRequestReceipt(args.requestId);
        if (!receipt)
            return null;
        if (receipt.botId !== args.botId || receipt.threadId !== args.threadId || receipt.messageId !== messageId) {
            return {
                claimed: true,
                state: "invalid",
                error: "This committed routine request belongs to another conversation",
                status: 403,
            };
        }
        const settled = this.store.patchMessage(args.threadId, messageId, {
            card: { ...card, answered: "allow", held: undefined },
        });
        if (!settled) {
            return {
                claimed: true,
                state: "invalid",
                error: "This routine confirmation card is no longer available",
                status: 409,
            };
        }
        this.forgetReceipt(receipt);
        return {
            claimed: true,
            state: "applied",
            action: receipt.action,
            resultId: receipt.resultId,
        };
    }
    forgetReceipt(request) {
        try {
            this.routines.forgetRoutineRequestReceipt(request);
        }
        catch {
            // The transcript is already durably settled. Retaining a redundant
            // receipt after a cleanup write failure is safe and a later duplicate
            // response will retry this cleanup.
        }
    }
    apply(payload, messageId, fingerprint) {
        const operation = payload.operation;
        const confirmationAt = this.now();
        switch (operation.action) {
            case "create":
                return this.routines.create(inputFromDefinition(operation.routine, operation.forBot?.botId ?? payload.botId, confirmationAt), {
                    requestId: payload.requestId,
                    messageId,
                    botId: payload.botId,
                    threadId: payload.threadId,
                    action: "create",
                    fingerprintVersion: ROUTINE_REQUEST_FINGERPRINT_VERSION,
                    fingerprint,
                }).id;
            case "update": {
                const current = verifyManageSnapshot(operation, this.routines, operation.forBot?.botId ?? payload.botId);
                const updated = this.routines.update(operation.routineId, updateFromChanges(operation.changes, confirmationAt, current.schedule), {
                    requestId: payload.requestId,
                    messageId,
                    botId: payload.botId,
                    threadId: payload.threadId,
                    action: "update",
                    fingerprintVersion: ROUTINE_REQUEST_FINGERPRINT_VERSION,
                    fingerprint,
                });
                if (!updated)
                    throw new RoutineRequestError("That routine no longer exists", 404);
                return updated.id;
            }
            case "pause":
            case "resume": {
                verifyManageSnapshot(operation, this.routines, operation.forBot?.botId ?? payload.botId);
                const updated = this.routines.update(operation.routineId, { enabled: operation.action === "resume" }, {
                    requestId: payload.requestId,
                    messageId,
                    botId: payload.botId,
                    threadId: payload.threadId,
                    action: operation.action,
                    fingerprintVersion: ROUTINE_REQUEST_FINGERPRINT_VERSION,
                    fingerprint,
                });
                if (!updated)
                    throw new RoutineRequestError("That routine no longer exists", 404);
                return updated.id;
            }
            case "run_now": {
                verifyManageSnapshot(operation, this.routines, operation.forBot?.botId ?? payload.botId);
                const run = this.routines.runNow(operation.routineId, {
                    requestId: payload.requestId,
                    messageId,
                    botId: payload.botId,
                    threadId: payload.threadId,
                    action: "run_now",
                    fingerprintVersion: ROUTINE_REQUEST_FINGERPRINT_VERSION,
                    fingerprint,
                });
                if (!run)
                    throw new RoutineRequestError("That routine no longer exists", 404);
                return run.id;
            }
            case "delete":
                verifyManageSnapshot(operation, this.routines, operation.forBot?.botId ?? payload.botId);
                if (!this.routines.remove(operation.routineId, {
                    requestId: payload.requestId,
                    messageId,
                    botId: payload.botId,
                    threadId: payload.threadId,
                    action: "delete",
                    fingerprintVersion: ROUTINE_REQUEST_FINGERPRINT_VERSION,
                    fingerprint,
                })) {
                    throw new RoutineRequestError("That routine no longer exists", 404);
                }
                return operation.routineId;
            default:
                throw new RoutineRequestError("Unsupported persisted routine action");
        }
    }
}
