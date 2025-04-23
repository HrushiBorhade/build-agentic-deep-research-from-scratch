import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import "dotenv/config";

const main = async () => {
  const result = await generateText({
    model: anthropic("claude-3-5-haiku-20241022"),
    prompt: "Agentic Deep Research",
  });

  console.log("Result", result);
};
main();
