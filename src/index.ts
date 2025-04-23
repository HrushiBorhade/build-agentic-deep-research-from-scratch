import { anthropic } from "@ai-sdk/anthropic";
import { generateObject, generateText, tool } from "ai";
import "dotenv/config";
import { z } from "zod";

const main = async () => {
  // ------------------------- Generate Text -----------------------------------------

  // const result = await generateText({
  //   model: anthropic("claude-3-5-haiku-20241022"),
  //   prompt: "what is the difference of temperature in SF and stockholm?",
  //   maxSteps:4,
  //   tools : {
  //     subtractNumbers: tool({
  //       description: "Subtract two numbers",
  //       parameters: z.object({
  //         num1: z.number(),
  //         num2: z.number()
  //       }),
  //       execute: async({num1, num2}) => {
  //         return num1 - num2;
  //       }
  //     }),
  //     getWeather: tool({
  //       description: "Get the current weather at a location",
  //       parameters: z.object({
  //         latitude: z.number(),
  //         longitude: z.number(),
  //         city: z.string(),
  //       }),
  //       execute: async ({ latitude, longitude, city }) => {
  //         const response = await fetch(
  //           `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,relativehumidity_2m&timezone=auto`,
  //         );

  //         const weatherData = await response.json();
  //         return {
  //           temperature: weatherData.current.temperature_2m,
  //           weatherCode: weatherData.current.weathercode,
  //           humidity: weatherData.current.relativehumidity_2m,
  //           city,
  //         };
  //       },
  //     }),
  //   }

  // });

  // console.log("Tool Result", result.toolResults);
  // console.log("Steps", result.steps);
  // console.log("Result", result.text)

  // -------------------------- Generate Object --------------------------------------

  const result = await generateObject({
    model: anthropic("claude-3-5-haiku-20241022"),
    prompt:
      "Generate 10 names for my app which is a agentic deep research tool with user experience at priority",
    schema: z.object({
      names: z.array(z.string().describe("Be creative, technical and clear")),
    }),
  });

  console.log("result", result.object.names);
};
main();
