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
 * Validates client-supplied messages: only user/assistant roles are kept
 * (client "system" messages are dropped), counts and lengths are capped,
 * only the last MAX_MESSAGES turns are kept, oversized input is rejected,
 * and the server system prompt is always prepended.
 */
export function sanitizeMessages(input: unknown): ValidationResult {
	if (!Array.isArray(input)) {
		return { ok: false, error: "messages must be an array" };
	}
	const cleaned: ChatMessage[] = [];
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
		if (content.length > MAX_MESSAGE_CHARS) {
			return { ok: false, error: `message exceeds ${MAX_MESSAGE_CHARS} characters` };
		}
		cleaned.push({ role, content });
	}
	if (cleaned.length === 0) {
		return { ok: false, error: "at least one message is required" };
	}
	if (input.length > MAX_MESSAGES * 5) {
		return { ok: false, error: "too many messages" };
	}
	// Keep only the most recent turns so long chats keep working
	const recent = cleaned.slice(-MAX_MESSAGES);
	return {
		ok: true,
		messages: [{ role: "system", content: SYSTEM_PROMPT }, ...recent],
	};
}
