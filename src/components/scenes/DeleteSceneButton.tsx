import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServerError } from "@/components/auth/ServerError";

interface Props {
  sceneId: string;
  projectId: string;
  sceneTitle: string;
}

type State = { phase: "idle" } | { phase: "confirming" } | { phase: "deleting" } | { phase: "error"; message: string };

export default function DeleteSceneButton({ sceneId, projectId, sceneTitle }: Props) {
  const [state, setState] = useState<State>({ phase: "idle" });

  async function deleteScene() {
    setState({ phase: "deleting" });
    try {
      const response = await fetch(`/api/scenes/${sceneId}`, { method: "DELETE" });

      if (!response.ok) {
        let message = "Could not delete scene";
        try {
          const body = (await response.json()) as { error?: string };
          message = body.error ?? message;
        } catch {
          // No JSON body (e.g. a plain non-ok response) — keep the generic message.
        }
        setState({ phase: "error", message });
        return;
      }

      window.location.href = `/projects/${projectId}`;
    } catch {
      setState({ phase: "error", message: "Network error — could not reach the server" });
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-red-500/30 bg-red-950/10 p-6">
      <h2 className="text-sm font-semibold tracking-wide text-red-300 uppercase">Danger Zone</h2>

      {state.phase === "error" && <ServerError message={state.message} />}

      {state.phase === "idle" ? (
        <Button
          variant="destructive"
          onClick={() => {
            setState({ phase: "confirming" });
          }}
        >
          <Trash2 className="size-4" />
          Delete Scene
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-red-200">
            Delete &quot;{sceneTitle}&quot;? Its generated card (if any) will be deleted too. This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button variant="destructive" disabled={state.phase === "deleting"} onClick={deleteScene}>
              {state.phase === "deleting" ? "Deleting..." : "Yes, delete"}
            </Button>
            <Button
              variant="outline"
              disabled={state.phase === "deleting"}
              onClick={() => {
                setState({ phase: "idle" });
              }}
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
