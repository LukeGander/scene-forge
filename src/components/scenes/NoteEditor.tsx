import { useState } from "react";
import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";

interface Props {
  sceneId: string;
  initialNote: string;
}

interface NoteUpdateResponse {
  note?: string;
  updatedAt?: string;
  error?: string;
}

export default function NoteEditor({ sceneId, initialNote }: Props) {
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!note.trim()) {
      setError("Scene note is required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/scenes/${sceneId}/note`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const body = (await response.json()) as NoteUpdateResponse;

      if (!response.ok || body.note === undefined) {
        setError(body.error ?? "Could not save the scene note");
        return;
      }

      setNote(body.note);
      window.dispatchEvent(new CustomEvent("sceneforge:note-updated", { detail: { sceneId } }));
    } catch {
      setError("Network error — could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 space-y-2">
      <textarea
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
          if (error) setError(null);
        }}
        rows={5}
        placeholder="Describe what happens in this scene..."
        className="w-full rounded-lg border border-white/10 bg-white/10 p-3 whitespace-pre-wrap text-blue-100/90 placeholder:text-blue-100/30 focus:border-purple-400/50 focus:outline-none"
      />
      <ServerError message={error} />
      <Button
        onClick={save}
        disabled={saving}
        className="rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500"
      >
        {saving ? "Saving..." : "Save note"}
      </Button>
    </div>
  );
}
