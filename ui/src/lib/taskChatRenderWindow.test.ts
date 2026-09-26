import { describe, expect, it } from "vitest";
import { selectRenderedComments, TASK_CHAT_RENDER_WINDOW } from "./taskChatRenderWindow";

const comments = Array.from({ length: 100 }, (_, index) => ({ id: `c${index}` }));

describe("selectRenderedComments", () => {
  it("keeps only the newest comments and counts the loaded ones left out", () => {
    const { rendered, hiddenCount } = selectRenderedComments(comments, TASK_CHAT_RENDER_WINDOW);
    expect(rendered).toHaveLength(TASK_CHAT_RENDER_WINDOW);
    expect(rendered[0].id).toBe(`c${100 - TASK_CHAT_RENDER_WINDOW}`);
    expect(rendered.at(-1)?.id).toBe("c99");
    expect(hiddenCount).toBe(100 - TASK_CHAT_RENDER_WINDOW);
  });

  it("passes a short thread through unchanged", () => {
    const short = comments.slice(0, 10);
    const { rendered, hiddenCount } = selectRenderedComments(short, TASK_CHAT_RENDER_WINDOW);
    expect(rendered).toBe(short);
    expect(hiddenCount).toBe(0);
  });

  it("widens the window back to a linked comment that is older than it", () => {
    const { rendered, hiddenCount } = selectRenderedComments(comments, 30, "c12");
    expect(rendered[0].id).toBe("c12");
    expect(hiddenCount).toBe(12);
    expect(selectRenderedComments(comments, 30, "c95").rendered[0].id).toBe("c70");
    expect(selectRenderedComments(comments, 30, "missing").rendered[0].id).toBe("c70");
  });
});
