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
    system: SYSTEM_PROMPT,
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

const searchAndProcess = async (
  query: string,
  accumulatedSources: SearchResult[]
) => {
  const pendingSearchResults: SearchResult[] = [];
  const finalSearchResults: SearchResult[] = [];
  await generateText({
    model,
    prompt: `Search the web for information about ${query}`,
    system:
      "You are a researcher. For each query, search the web and then evaluate if the results are relevant and will help answer the following query",
    maxSteps: 5,
    tools: {
      searchWeb: tool({
        description: "Search the web for information about a given query",
        parameters: z.object({
          query: z.string().min(1),
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
 
            <existing_results>
            ${JSON.stringify(accumulatedSources.map((result) => result.url))}
            </existing_results>
 
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

type Learning = {
  learning: string;
  followUpQuestions: string[];
};

type Research = {
  query: string | undefined;
  queries: string[];
  searchResults: SearchResult[];
  learnings: Learning[];
  completedQueries: string[];
};

const accumulatedResearch: Research = {
  query: undefined,
  queries: [],
  searchResults: [],
  learnings: [],
  completedQueries: [],
};

const generateLearnings = async (query: string, searchResult: SearchResult) => {
  const { object } = await generateObject({
    model,
    prompt: `The user is researching "${query}". The following search result were deemed relevant.
    Generate a learning and a follow-up question from the following search result:
    <search_result>
    ${JSON.stringify(searchResult)}
    </search_result>
    `,
    schema: z.object({
      learning: z.string(),
      followUpQuestions: z.array(z.string()),
    }),
  });
  return object;
};

const deepResearch = async (
  prompt: string,
  depth: number = 2,
  breadth: number = 2
) => {
  if (!accumulatedResearch.query) {
    accumulatedResearch.query = prompt;
  }

  if (depth === 0) {
    return accumulatedResearch;
  }

  const queries = await generateSearchQueries(prompt, breadth);
  accumulatedResearch.queries = queries;

  for (const query of queries) {
    console.log(`Searching the web for: ${query}`);
    const searchResults = await searchAndProcess(
      query,
      accumulatedResearch.searchResults
    );
    accumulatedResearch.searchResults.push(...searchResults);
    for (const searchResult of searchResults) {
      console.log(`Processing search result: ${searchResult.url}`);
      const learnings = await generateLearnings(query, searchResult);
      accumulatedResearch.learnings.push(learnings);
      accumulatedResearch.completedQueries.push(query);

      const newQuery = `Overall research goal: ${prompt}
        Previous search queries: ${accumulatedResearch.completedQueries.join(
          ", "
        )}
 
        Follow-up questions: ${learnings.followUpQuestions.join(", ")}
        `;
      await deepResearch(newQuery, depth - 1, Math.ceil(breadth / 2));
    }
  }
  return accumulatedResearch;
};

const SYSTEM_PROMPT = `You are an expert researcher. Today is ${new Date().toISOString()}. Follow these instructions when responding:
  - You may be asked to research subjects that is after your knowledge cutoff, assume the user is right when presented with news.
  - The user is a highly experienced analyst and software engineer, no need to simplify it, be as detailed as possible and make sure your response is correct.
  - Be highly organized.
  - Suggest solutions that I didn't think about.
  - Be proactive and anticipate my needs.
  - Treat me as an expert in all subject matter.
  - Mistakes erode my trust, so be accurate and thorough.
  - Provide detailed explanations, I'm comfortable with lots of detail.
  - Value good arguments over authorities, the source is irrelevant.
  - Consider new technologies and contrarian ideas, not just the conventional wisdom.
  - You may use high levels of speculation or prediction, just flag it for me.
  - Use Markdown formatting.`;

const main = async () => {
  // ------------------------- Deep Research ----------------------------------------
  const prompt =
    "How do i get hired at Lovable.dev as a software engineer, also link blogs,tweets or youtube videos by team members or founders";
  await deepResearch(prompt, 3, 2);

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
