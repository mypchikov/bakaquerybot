import env from "env-var";

export const config = {
	NODE_ENV: env
	.get("NODE_ENV")
	.default("development")
	.asEnum(["production", "test", "development"]),
	BOT_TOKEN: env.get("BOT_TOKEN").required().asString(),
	GELBOORU_USER_ID: env.get("GELBOORU_USER_ID").default("").asString(),
	GELBOORU_API_KEY: env.get("GELBOORU_API_KEY").default("").asString(),
	GELBOORU_API_URL: env
		.get("GELBOORU_API_URL")
		.default("https://gelbooru.com/index.php")
		.asString(),
	INLINE_RESULTS_LIMIT: env
		.get("INLINE_RESULTS_LIMIT")
		.default("20")
		.asIntPositive(),
};
