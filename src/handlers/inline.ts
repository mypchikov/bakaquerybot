import { Composer } from "gramio";
import type { TelegramInlineQueryResult } from "gramio";
import { config } from "../config.ts";
import { composer } from "../plugins/index.ts";
import { searchGelbooruPosts } from "../services/gelbooru.ts";

const INLINE_CACHE_TIME = 15;
const TELEGRAM_CAPTION_LIMIT = 1024;
const CAPTION_ELLIPSIS = "...";

const truncateCaptionPart = (label: string, value: string, maxLength: number): string => {
	const normalizedValue = value.trim();
	const prefix = `${label}: `;

	if (!normalizedValue || maxLength <= prefix.length) {
		return prefix.trimEnd();
	}

	const availableLength = maxLength - prefix.length;

	if (normalizedValue.length <= availableLength) {
		return `${prefix}${normalizedValue}`;
	}

	if (availableLength <= CAPTION_ELLIPSIS.length) {
		return `${prefix}${CAPTION_ELLIPSIS.slice(0, availableLength)}`;
	}

	return `${prefix}${normalizedValue.slice(0, availableLength - CAPTION_ELLIPSIS.length)}${CAPTION_ELLIPSIS}`;
};

const buildPhotoCaption = (post: {
	tags: string;
	rating: string;
	score: number;
	source: string | null;
	postUrl: string;
}): string => {
	const fixedParts: [string, string, string] = [
		`Rating: ${post.rating}`,
		`Score: ${post.score}`,
		`Post: ${post.postUrl}`,
	];
	const fixedLength = fixedParts.reduce((total, part) => total + part.length, 0);
	const lineBreakCount = fixedParts.length + (post.source ? 2 : 1);
	const availableLength = TELEGRAM_CAPTION_LIMIT - fixedLength - lineBreakCount;
	const sourceBudget = post.source ? Math.min(availableLength / 3, 240) : 0;
	const tagsBudget = Math.max(availableLength - sourceBudget, 0);
	const captionParts = [
		truncateCaptionPart("Tags", post.tags || "unknown", tagsBudget),
		...fixedParts.slice(0, 2),
	];

	if (post.source) {
		captionParts.push(truncateCaptionPart("Source", post.source, sourceBudget));
	}

	captionParts.push(fixedParts[2]);

	return captionParts.join("\n").slice(0, TELEGRAM_CAPTION_LIMIT);
};

const createArticleResult = (
	id: string,
	title: string,
	description: string,
	messageText: string,
	thumbnailUrl?: string,
): TelegramInlineQueryResult => ({
	type: "article",
	id,
	title,
	description,
	thumbnail_url: thumbnailUrl,
	input_message_content: {
		message_text: messageText,
	},
});

const buildArticleMessageText = (post: {
	title: string;
	tags: string;
	rating: string;
	score: number;
	source: string | null;
	postUrl: string;
	fileUrl: string;
}): string => {
	const parts = [
		post.title,
		`Tags: ${post.tags || "unknown"}`,
		`Rating: ${post.rating}`,
		`Score: ${post.score}`,
	];

	if (post.source) {
		parts.push(`Source: ${post.source}`);
	}

	parts.push(`Post: ${post.postUrl}`);
	parts.push(`File: ${post.fileUrl}`);

	return parts.join("\n");
};

export const inlineComposer = new Composer()
	.extend(composer)
	.inlineQuery(
		() => true,
		async (context) => {
			const query = context.query.trim();

			if (!query) {
				return context.answer(
					[
						createArticleResult(
							"inline-help",
							"Type tags to search Gelbooru",
							"Example: remilia_scarlet wings",
							"Type your Gelbooru tags after the bot username to search images.",
						),
					],
					{
						cache_time: INLINE_CACHE_TIME,
						is_personal: true,
					},
				);
			}

			try {
				const posts = await searchGelbooruPosts(query, config.INLINE_RESULTS_LIMIT);

				if (posts.length === 0) {
					return context.answer(
						[
							createArticleResult(
								`empty:${query}`,
								"Nothing found",
								"Try fewer tags or a different query",
								`No Gelbooru results for: ${query}`,
							),
						],
						{
							cache_time: INLINE_CACHE_TIME,
							is_personal: true,
						},
					);
				}

				const results: TelegramInlineQueryResult[] = posts.map((post) => {
					if (post.inlinePhotoUrl) {
						return {
							type: "photo",
							id: String(post.id),
							photo_url: post.inlinePhotoUrl,
							thumbnail_url: post.previewUrl,
							photo_width: post.width ?? undefined,
							photo_height: post.height ?? undefined,
							title: post.title,
							description: `rating:${post.rating} score:${post.score}`,
							caption: buildPhotoCaption(post),
						};
					}

					return createArticleResult(
						`post:${post.id}`,
						post.title,
						`rating:${post.rating} score:${post.score} open post`,
						buildArticleMessageText(post),
						post.previewUrl,
					);
				});

				return context.answer(results, {
					cache_time: INLINE_CACHE_TIME,
					is_personal: true,
				});
			} catch (error) {
				console.error("Failed to answer inline query", error);

				return context.answer(
					[
						createArticleResult(
							"gelbooru-error",
							"Gelbooru request failed",
							"Try again in a few seconds",
							"Gelbooru is temporarily unavailable. Try again later.",
						),
					],
					{
						cache_time: 1,
						is_personal: true,
					},
				);
			}
		},
	);
