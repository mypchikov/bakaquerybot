import { config } from "../config.ts";

export interface GelbooruPost {
	id: number;
	title: string;
	tags: string;
	rating: string;
	score: number;
	inlinePhotoUrl: string | null;
	previewUrl: string;
	sampleUrl: string | null;
	fileUrl: string;
	width: number | null;
	height: number | null;
	source: string | null;
	postUrl: string;
}

interface GelbooruApiPost {
	id?: number | string;
	title?: string;
	tags?: string;
	rating?: string;
	score?: number | string;
	preview_url?: string;
	sample_url?: string;
	file_url?: string;
	width?: number | string;
	height?: number | string;
	source?: string;
}

interface GelbooruApiResponse {
	post?: GelbooruApiPost[] | GelbooruApiPost;
}

const toAbsoluteUrl = (url: string | undefined): string | null => {
	if (!url) {
		return null;
	}

	if (url.startsWith("http://") || url.startsWith("https://")) {
		return url;
	}

	if (url.startsWith("//")) {
		return `https:${url}`;
	}

	return `https://gelbooru.com${url.startsWith("/") ? url : `/${url}`}`;
};

const getUrlPathname = (url: string): string | null => {
	try {
		return new URL(url).pathname.toLowerCase();
	} catch {
		return null;
	}
};

const isTelegramInlinePhotoUrl = (url: string | null): url is string => {
	if (!url) {
		return false;
	}

	const pathname = getUrlPathname(url);
	return Boolean(pathname && (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")));
};

const pickInlinePhotoUrl = (post: {
	sample_url?: string;
	preview_url?: string;
	file_url?: string;
}): string | null => {
	const sampleUrl = toAbsoluteUrl(post.sample_url);
	const previewUrl = toAbsoluteUrl(post.preview_url);
	const fileUrl = toAbsoluteUrl(post.file_url);

	if (isTelegramInlinePhotoUrl(sampleUrl)) {
		return sampleUrl;
	}

	if (isTelegramInlinePhotoUrl(previewUrl)) {
		return previewUrl;
	}

	if (isTelegramInlinePhotoUrl(fileUrl)) {
		return fileUrl;
	}

	return null;
};

const toNumber = (value: number | string | undefined): number | null => {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}

	if (typeof value !== "string" || value.trim() === "") {
		return null;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
};

const normalizePosts = (response: GelbooruApiResponse | GelbooruApiPost[]): GelbooruApiPost[] => {
	if (Array.isArray(response)) {
		return response;
	}

	if (Array.isArray(response.post)) {
		return response.post;
	}

	if (response.post) {
		return [response.post];
	}

	return [];
};

export const searchGelbooruPosts = async (
	query: string,
	limit = config.INLINE_RESULTS_LIMIT,
): Promise<GelbooruPost[]> => {
	const tags = query
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.join(" ");

	if (!tags) {
		return [];
	}

	const url = new URL(config.GELBOORU_API_URL);
	url.searchParams.set("page", "dapi");
	url.searchParams.set("s", "post");
	url.searchParams.set("q", "index");
	url.searchParams.set("json", "1");
	url.searchParams.set("limit", String(Math.min(limit, 50)));
	url.searchParams.set("tags", tags);

	if (config.GELBOORU_USER_ID && config.GELBOORU_API_KEY) {
		url.searchParams.set("user_id", config.GELBOORU_USER_ID);
		url.searchParams.set("api_key", config.GELBOORU_API_KEY);
	}

	const response = await fetch(url, {
		headers: {
			Accept: "application/json",
			"User-Agent": "bakaquerybot/1.0",
		},
	});

	if (!response.ok) {
		if (response.status === 401) {
			throw new Error("Gelbooru rejected the request with 401. Set GELBOORU_USER_ID and GELBOORU_API_KEY.");
		}

		throw new Error(`Gelbooru request failed with status ${response.status}`);
	}

	const payload = (await response.json()) as GelbooruApiResponse | GelbooruApiPost[];

	return normalizePosts(payload)
		.map((post) => {
			const id = toNumber(post.id);
			const fileUrl = toAbsoluteUrl(post.file_url);
			const previewUrl = toAbsoluteUrl(post.preview_url);
			const inlinePhotoUrl = pickInlinePhotoUrl(post);

			if (!id || !fileUrl || !previewUrl) {
				return null;
			}

			return {
				id,
				title: post.title?.trim() || `Gelbooru #${id}`,
				tags: post.tags?.trim() || "",
				rating: post.rating?.trim() || "unknown",
				score: toNumber(post.score) ?? 0,
				inlinePhotoUrl,
				previewUrl,
				sampleUrl: toAbsoluteUrl(post.sample_url),
				fileUrl,
				width: toNumber(post.width),
				height: toNumber(post.height),
				source: post.source?.trim() || null,
				postUrl: `https://gelbooru.com/index.php?page=post&s=view&id=${id}`,
			} satisfies GelbooruPost;
		})
		.filter((post): post is GelbooruPost => post !== null);
};
