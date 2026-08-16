import { useEffect, useRef, useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServerError } from "@/components/auth/ServerError";
import { SceneCard } from "@/components/scenes/SceneCard";
import type { SceneCardFields } from "@/lib/forge-scene/types";

type GenerationSource = "mock" | "anthropic";

interface Props {
  sceneId: string;
  initialCard?: SceneCardFields | null;
  initialSource?: GenerationSource | null;
}

type State =
  | { phase: "idle" }
  | { phase: "loading"; elapsedSeconds: number }
  | { phase: "success"; card: SceneCardFields; source: GenerationSource }
  | { phase: "error"; message: string };

interface ForgeResponseBody {
  card?: SceneCardFields;
  source?: GenerationSource;
  error?: string;
}

export default function ForgeSceneButton({ sceneId, initialCard, initialSource }: Props) {
  const [state, setState] = useState<State>(
    initialCard && initialSource ? { phase: "success", card: initialCard, source: initialSource } : { phase: "idle" },
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function forge() {
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

      setState({ phase: "success", card: body.card, source: body.source });
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
        <SceneCard card={state.card} source={state.source} />
        <Button onClick={forge} variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
          <RotateCcw className="size-4" />
          Regenerate
        </Button>
      </div>
    );
  }

  if (state.phase === "loading") {
    return (
      <Button disabled className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white">
        <span className="flex items-center gap-2">
          <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          Forging scene... {state.elapsedSeconds}s
        </span>
      </Button>
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
    </div>
  );
}
