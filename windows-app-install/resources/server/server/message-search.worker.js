import { DatabaseSync } from "node:sqlite";
import { parentPort, workerData } from "node:worker_threads";
import { searchMessagesInDatabase } from "./message-search-query.js";
// Each request reads the latest committed WAL state. Closing after the scan
// avoids keeping an old database inode open across a workspace restore.
parentPort.on("message", (request) => {
    let db;
    try {
        db = new DatabaseSync(workerData.file, { readOnly: true });
        const hits = searchMessagesInDatabase(db, request.query, request.limit, request.threadId);
        parentPort.postMessage({ id: request.id, hits });
    }
    catch {
        // Database errors can contain private paths or query text. The server
        // returns a generic retryable error, never a synchronous fallback scan.
        parentPort.postMessage({ id: request.id, failed: true });
    }
    finally {
        db?.close();
    }
});
