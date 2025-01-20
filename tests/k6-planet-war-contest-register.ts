import http from "k6/http";
import { check, JSONObject, JSONValue, sleep } from "k6";

export const options = {
  scenarios: {
    newUser: {
      executor: "per-vu-iterations",
      vus: 20,
      iterations: 1,
    },
  },
};

const botSourceCode = open("../games/planet-war/bots/test-bot-easy.cpp");

function isPlanetWarGame(game: JSONValue): game is JSONObject {
  return game != null && typeof game === "object" && "name" in game && game.name === "Planet War";
}

export default function () {
  const backendUrl = __ENV.BACKEND_URL || 'http://localhost:3000';

  // Register a user
  let registerResponse = http.post(
    `${backendUrl}/graphql`,
    JSON.stringify({
      operationName: "Register",
      variables: {
        registrationInput: {
          username: `k6_test_user_${__VU}`,
          password: "password",
          email: `k6_test_user_${__VU}`,
        },
      },
      query:
        "mutation Register($registrationInput: RegistrationInput!) { register(registrationData: $registrationInput) { ... on RegistrationSuccess { token } ... on RegistrationError { fieldErrors { username email __typename } nonFieldErrors __typename } ... on GraphqlError { message __typename } } }",
    }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(registerResponse, { Register: (r) => !!r.json("data.register.token") }); // status is always 200
  const token = registerResponse.json("data.register.token");

  // Get games
  let getGamesResponse = http.post(
    `${backendUrl}/graphql`,
    JSON.stringify({
      operationName: "GetGames",
      variables: {},
      query:
        "query GetGames { getGames { ... on Games { games { id name } } ... on GraphqlError { message __typename } } }",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`,
      },
    },
  );
  check(getGamesResponse, { GetGames: (r) => !!r.json("data.getGames.games") });
  const games = getGamesResponse.json("data.getGames.games");
  if (!Array.isArray(games)) {
    console.error("Expected 'games' to be an array");
    return;
  }
  const gameId = games.find(isPlanetWarGame)?.id;
  if (!gameId) {
    console.error("Game 'Planet War' not found");
    return;
  }

  // Create a bot for the game "Planet War"
  let createBotResponse = http.post(
    `${backendUrl}/graphql`,
    JSON.stringify({
      operationName: "CreateBot",
      variables: {
        botInput: { gameId, name: `k6_test_bot_${__VU}` },
      },
      query:
        "mutation CreateBot($botInput: BotInput!) { createBot(bot: $botInput) {__typename ... on BotWithUploadLink { bot { id } uploadLink } ... on CreateBotError { fieldErrors { name gameId __typename } __typename } ... on GraphqlError { message __typename } } }",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`,
      },
    },
  );
  check(createBotResponse, { CreateBot: (r) => !!r.json("data.createBot.bot") });
  const botId = createBotResponse.json("data.createBot.bot.id");
  const uploadLink = createBotResponse.json("data.createBot.uploadLink");

  // Upload bot code
  let uploadBotSourceResponse = http.post(
    backendUrl + uploadLink,
    { sourceFile: http.file(botSourceCode, "test-bot-easy.cpp", "text/x-c++src") },
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
  );
  check(uploadBotSourceResponse, { "source upload": (r) => r.status == 201 });

  // Get contests
  let getContestsResponse = http.post(
    `${backendUrl}/graphql`,
    JSON.stringify({
      operationName: "GetContests",
      variables: {},
      query:
        "query GetContests { getContests { ... on Contests { contests { id game { name } } } ... on GraphqlError { message __typename } } }",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`,
      },
    },
  );
  check(getContestsResponse, { GetContests: (r) => !!r.json("data.getContests.contests") });
  const contests = getContestsResponse.json("data.getContests.contests");
  if (!Array.isArray(contests)) {
    console.error("Expected 'contests' to be an array");
    return;
  }
  const contestId = contests.find(
    (contest): contest is JSONObject =>
      contest != null &&
      typeof contest === "object" &&
      "game" in contest &&
      isPlanetWarGame(contest.game),
  )?.id;
  if (!contestId) {
    console.error("Contest for 'Planet War' not found");
    return;
  }

  // wait until the bot is compiled
  let botStatus;
  do {
    sleep(3);
    let getBotResponse = http.post(
      `${backendUrl}/graphql`,
      JSON.stringify({
        operationName: "GetBot",
        variables: { id: botId },
        query:
          "query GetBot($id: String!) { getBot(id: $id) { ... on Bot { submitStatus { stage } } ... on GraphqlError { message __typename } } }",
      }),
      {
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
        },
      },
    );
    botStatus = getBotResponse.json("data.getBot.submitStatus.stage");
  } while (botStatus !== "CHECK_SUCCESS");

  // Register to the contest
  let registerToContestResponse = http.post(
    `${backendUrl}/graphql`,
    JSON.stringify({
      operationName: "RegisterToContest",
      variables: { registration: { contestId, botId } },
      query:
        "mutation RegisterToContest($registration: ContestRegistration!) { registerToContest(registration: $registration) { ... on Contest { id } ... on RegisterToContestError { fieldErrors { contestId botId __typename } __typename } ... on GraphqlError { message __typename } } }",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`,
      },
    },
  );
  check(registerToContestResponse, {
    RegisterToContest: (r) => !!r.json("data.registerToContest.id"),
  });
  console.log(registerResponse.body);
}
