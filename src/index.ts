import { anthropic } from "@ai-sdk/anthropic";
import { generateObject, generateText, tool } from "ai";
import "dotenv/config";
import Exa from "exa-js";
import { z } from "zod";

const model = anthropic("claude-3-5-haiku-20241022");

async function generateSearchQueries(query: string, n: number) {
  const {
    object: { queries },
  } = await generateObject({
    model,
    prompt: `Generate ${n} search queries for the following query: ${query}`,
    schema: z.object({
      queries: z.array(z.string()).min(1).max(5),
    }),
  });
  return queries;
}

const exa = new Exa(process.env.EXA_API_KEY);

type SearchResult = {
  title: string;
  url: string;
  content: string;
};

const searchWeb = async (query: string) => {
  const { results } = await exa.searchAndContents(query, {
    numResults: 1,
    livecrawl: "always",
  });
  return results.map(
    (r) =>
      ({
        title: r.title,
        url: r.url,
        content: r.text,
      } as SearchResult)
  );
};

// search and process

const searchAndProcess = async (query: String) => {
  const pendingSearchResults: SearchResult[] = [];
  const finalSearchResults: SearchResult[] = [];

  await generateText({
    model,
    system: `You are a researcher. For each Query, search the web and then evaluate is the result is relevant and will help answer the following query`,
    maxSteps: 5,
    tools: {
      searchWeb: tool({
        description: "Search the web for information about a given query",
        parameters: z.object({
          query: z.string(),
        }),
        async execute({ query }) {
          const results = await searchWeb(query);
          pendingSearchResults.push(...results);
          return results;
        },
      }),
      evaluate: tool({
        description: "Evaluate the search results",
        parameters: z.object({}),
        async execute() {
          const pendingResult = pendingSearchResults.pop()!;
          const { object: evaluation } = await generateObject({
            model,
            prompt: `Evaluate whether the search results are relevant and will help answer the following query: ${query}. If the page already exists in the existing results, mark it as irrelevant.
            <search_results>
            ${JSON.stringify(pendingResult)}
            </search_results>
            `,
            output: "enum",
            enum: ["relevant", "irrelevant"],
          });
          if (evaluation === "relevant") {
            finalSearchResults.push(pendingResult);
          }
          console.log("Found:", pendingResult.url);
          console.log("Evaluation completed:", evaluation);
          return evaluation === "irrelevant"
            ? "Search results are irrelevant. Please search again with a more specific query."
            : "Search results are relevant. End research for this query.";
        },
      }),
    },
  });
  return finalSearchResults;
};

const main = async () => {
  // ------------------------- Deep Research ----------------------------------------
  const prompt =
    "What do i need to do to get hired in top startups as Software Engineer in SF?";
  const queries = await generateSearchQueries(prompt, 3);
  console.log("search queries", queries);
  for (const query of queries) {
    console.log(`Searching the web for: ${query}`);
    const searchResults = await searchAndProcess(query);
    console.log("searchResults", searchResults);
  }

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

  // const result = await generateObject({
  //   model: anthropic("claude-3-5-haiku-20241022"),
  //   prompt:
  //     "Generate 10 names for my app which is a agentic deep research tool with user experience at priority",
  //   schema: z.object({
  //     names: z.array(z.string().describe("Be creative, technical and clear")),
  //   }),
  // });

  // console.log("result", result.object.names);
};
main();
