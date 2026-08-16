import React, { useState } from "react";
import { FileText, NotebookPen } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  serverError?: string | null;
}

export default function NewSceneForm({ projectId, serverError }: Props) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ title?: string; note?: string }>({});

  function validate() {
    const next: typeof errors = {};
    if (!title.trim()) next.title = "Title is required";
    if (!note.trim()) next.note = "Scene note is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  return (
    <form method="POST" action="/api/scenes/create" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <input type="hidden" name="projectId" value={projectId} />

      <FormField
        id="title"
        label="Scene title"
        value={title}
        onChange={(v) => {
          setTitle(v);
          clearError("title");
        }}
        placeholder="The locked archive"
        error={errors.title}
        icon={<FileText className="size-4" />}
      />

      <div>
        <label htmlFor="note" className="mb-1 block text-sm text-blue-100/80">
          Scene note
        </label>
        <textarea
          id="note"
          name="note"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            clearError("note");
          }}
          placeholder="Describe what happens in this scene..."
          rows={5}
          className={cn(
            "w-full rounded-lg border bg-white/10 px-3 py-2 text-white placeholder-white/40 transition-colors focus:ring-2 focus:outline-none",
            errors.note ? "border-red-400/60 focus:ring-red-400" : "border-white/20 focus:ring-purple-400",
          )}
        />
        {errors.note && <p className="mt-1 text-xs text-red-300">{errors.note}</p>}
      </div>

      <ServerError message={serverError} />

      <SubmitButton pendingText="Saving scene..." icon={<NotebookPen className="size-4" />}>
        Save scene note
      </SubmitButton>
    </form>
  );
}
