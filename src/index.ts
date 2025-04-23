import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import "dotenv/config";
import { z } from "zod";

const main = async () => {
  const result = await generateText({
    model: anthropic("claude-3-5-haiku-20241022"),
    prompt: "what is 9.88 - 9.67?",
    maxSteps:2,
    tools : {
      subtractNumbers: {
        description: "Subtract two numbers",
        parameters: z.object({
          num1: z.number(),
          num2: z.number()
        }),
        execute: async({num1, num2}) => {
          return num1 - num2;
        }
      }
    }

  });

  console.log("Tool Result", result.toolResults);
  console.log("Steps", result.steps);
  console.log("Result", result.text)
};
main();
