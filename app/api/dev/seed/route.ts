import { readJsonObject } from "@/lib/api/body";
import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { assertDevTools } from "@/lib/dev/gate";
import { planFor } from "@/lib/dev/scenarios";
import { seedScenario } from "@/lib/dev/seedScenario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/dev/seed: build a scenario league with you in it. Dev tools only. */
export const POST = handle({
  parse: async (request) => {
    assertDevTools();
    const body = await readJsonObject(request, ["scenario"]);
    if (planFor(body.scenario) === null) {
      throw new ApiError("invalid_scenario", 400);
    }
    return body.scenario as string;
  },
  run: async ({ user, input }) => {
    const leagueId = await seedScenario(user.id, input);
    if (leagueId === null) throw new ApiError("invalid_scenario", 400);
    return ok({ leagueId }, 201);
  },
});
