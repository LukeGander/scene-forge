import { useEffect, useRef, useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServerError } from "@/components/auth/ServerError";
import { SceneCard } from "@/components/scenes/SceneCard";
import DeleteSceneButton from "@/components/scenes/DeleteSceneButton";
import type { SceneCardFields, SceneCardRecord } from "@/lib/forge-scene/types";

type GenerationSource = "mock" | "anthropic";

interface Props {
  sceneId: string;
  projectId: string;
  sceneTitle: string;
  initialRecord?: SceneCardRecord | null;
  initialSource?: GenerationSource | null;
  initialIsStale?: boolean;
}

type State =
  | { phase: "idle" }
  | { phase: "loading"; elapsedSeconds: number }
  | { phase: "success"; record: SceneCardRecord; source: GenerationSource; version: number; isStale: boolean }
  | { phase: "error"; message: string };

interface ForgeResponseBody {
  card?: SceneCardFields;
  source?: GenerationSource;
  error?: string;
}

export default function ForgeSceneButton({
  sceneId,
  projectId,
  sceneTitle,
  initialRecord,
  initialSource,
  initialIsStale,
}: Props) {
  const [state, setState] = useState<State>(
    initialRecord && initialSource
      ? { phase: "success", record: initialRecord, source: initialSource, version: 0, isStale: initialIsStale ?? false }
      : { phase: "idle" },
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    function handleNoteUpdated(event: Event) {
      if ((event as CustomEvent<{ sceneId: string }>).detail.sceneId !== sceneId) return;
      setState((prev) => (prev.phase === "success" ? { ...prev, isStale: true } : prev));
    }
    window.addEventListener("sceneforge:note-updated", handleNoteUpdated);
    return () => {
      window.removeEventListener("sceneforge:note-updated", handleNoteUpdated);
    };
  }, [sceneId]);

  async function forge() {
    const previousNotes = state.phase === "success" ? state.record.notes : "";
    const nextVersion = (state.phase === "success" ? state.version : 0) + 1;
    const startedAt = Date.now();
    setState({ phase: "loading", elapsedSeconds: 0 });
    timerRef.current = setInterval(() => {
      setState((prev) =>
        prev.phase === "loading"
          ? { phase: "loading", elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000) }
          : prev,
      );
    }, 1000);

    try {
      const response = await fetch(`/api/scenes/${sceneId}/forge`, { method: "POST" });
      const body = (await response.json()) as ForgeResponseBody;

      if (!response.ok || !body.card || !body.source) {
        setState({ phase: "error", message: body.error ?? "Scene card generation failed" });
        return;
      }

      setState({
        phase: "success",
        record: { ...body.card, status: "draft", notes: previousNotes },
        source: body.source,
        version: nextVersion,
        isStale: false,
      });
    } catch {
      setState({ phase: "error", message: "Network error — could not reach the server" });
    } finally {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  if (state.phase === "success") {
    return (
      <div className="space-y-4">
        <SceneCard
          key={state.version}
          sceneId={sceneId}
          record={state.record}
          source={state.source}
          isStale={state.isStale}
          onSaved={(record) => {
            setState({
              phase: "success",
              record,
              source: state.source,
              version: state.version + 1,
              isStale: state.isStale,
            });
          }}
        />
        <div className="flex items-center gap-2">
          <Button
            onClick={forge}
            variant="outline"
            className="border-white/20 bg-white/10 text-white hover:bg-white/20"
          >
            <RotateCcw className="size-4" />
            Regenerate
          </Button>
          <DeleteSceneButton sceneId={sceneId} projectId={projectId} sceneTitle={sceneTitle} />
        </div>
      </div>
    );
  }

  if (state.phase === "loading") {
    return (
      <div className="space-y-3">
        <Button disabled className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white">
          <span className="flex items-center gap-2">
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Forging scene... {state.elapsedSeconds}s
          </span>
        </Button>
        <DeleteSceneButton sceneId={sceneId} projectId={projectId} sceneTitle={sceneTitle} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {state.phase === "error" && <ServerError message={state.message} />}
      <Button
        onClick={forge}
        className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500"
      >
        <Sparkles className="size-4" />
        {state.phase === "error" ? "Try again" : "Forge Scene"}
      </Button>
      <DeleteSceneButton sceneId={sceneId} projectId={projectId} sceneTitle={sceneTitle} />
    </div>
  );
}
