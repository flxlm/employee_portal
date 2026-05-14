import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SCREEN_IDS = {
  main: "ec52792f-a5d1-41fc-8a99-28344c33eea5",
  grab_n_go: "35b35635-d420-42b8-b41b-0070a4d6a179",
} as const;

const SCREENCLOUD_URL = "https://graphql.us.screencloud.com/graphql";
const SCREENCLOUD_TOKEN =
  "0a9036f9-d962-4600-910c-3c339791d1c8:f0b9b64f9ca741d1e816cbf5a007e8ef";

export const refreshScreencloudMenu = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      menu: z.enum(["main", "grab_n_go"]),
    }),
  )
  .handler(async ({ data }) => {
    const id = SCREEN_IDS[data.menu];
    const res = await fetch(SCREENCLOUD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SCREENCLOUD_TOKEN}`,
      },
      body: JSON.stringify({
        query:
          "mutation RefreshScreens($ids: [UUID]!) { refreshScreensByScreenIds(screenIds: $ids) { __typename } }",
        variables: { ids: [id] },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Refresh failed (${res.status}) ${text}`.trim() };
    }

    const json = (await res.json()) as { errors?: Array<{ message: string }> };
    if (json.errors?.length) {
      return { ok: false, error: json.errors.map((e) => e.message).join("; ") };
    }
    return { ok: true };
  });
