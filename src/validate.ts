/**
 * Input validation for /api/chat.
 */
import { ChatMessage } from "./types";

// Default system prompt (always set by the server, never by the client)
export const SYSTEM_PROMPT =
	"You are a helpful, friendly assistant. Provide concise and accurate responses.";

// Input limits to protect the Workers AI quota
export const MAX_MESSAGES = 20;
export const MAX_MESSAGE_CHARS = 4000;

type ValidationResult =
	| { ok: true; messages: ChatMessage[] }
	| { ok: false; error: string };

/**
 * Validates client-supplied messages.
 * Client "system" messages are dropped; any other non user/assistant role is
 * rejected. History is trimmed to the last MAX_MESSAGES user/assistant turns
 * before length checks, so a long chat is not rejected for its length.
 * Only the latest user message is rejected when it exceeds MAX_MESSAGE_CHARS;
 * older messages over that limit are truncated. The server system prompt is
 * always prepended and is the only system message.
 */
export function sanitizeMessages(input: unknown): ValidationResult {
	if (!Array.isArray(input)) {
		return { ok: false, error: "messages must be an array" };
	}

	const turns: ChatMessage[] = [];
	for (const msg of input) {
		if (!msg || typeof msg !== "object") {
			return { ok: false, error: "invalid message" };
		}
		const { role, content } = msg as { role?: unknown; content?: unknown };
		if (role === "system") continue; // never trust client system prompts
		if (role !== "user" && role !== "assistant") {
			return { ok: false, error: "invalid role" };
		}
		if (typeof content !== "string") {
			return { ok: false, error: "content must be a string" };
		}
		turns.push({ role, content });
	}

	if (turns.length === 0) {
		return { ok: false, error: "at least one message is required" };
	}

	// Trim first so earlier turns, including oversized ones, do not fail the request.
	const recent = turns.slice(-MAX_MESSAGES);

	let latestUser = -1;
	for (let i = recent.length - 1; i >= 0; i--) {
		if (recent[i].role === "user") {
			latestUser = i;
			break;
		}
	}
	if (
		latestUser >= 0 &&
		recent[latestUser].content.length > MAX_MESSAGE_CHARS
	) {
		return {
			ok: false,
			error: `message exceeds ${MAX_MESSAGE_CHARS} characters`,
		};
	}

	const limited = recent.map((msg) =>
		msg.content.length > MAX_MESSAGE_CHARS
			? { role: msg.role, content: msg.content.slice(0, MAX_MESSAGE_CHARS) }
			: msg,
	);

	return {
		ok: true,
		messages: [{ role: "system", content: SYSTEM_PROMPT }, ...limited],
	};
}
