import React, { useState } from "react";
import { FolderPlus, Sparkles } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { cn } from "@/lib/utils";

interface Props {
  serverError?: string | null;
}

export default function NewProjectForm({ serverError }: Props) {
  const [title, setTitle] = useState("");
  const [premise, setPremise] = useState("");
  const [tone, setTone] = useState("");
  const [errors, setErrors] = useState<{ title?: string; premise?: string; tone?: string }>({});

  function validate() {
    const next: typeof errors = {};
    if (!title.trim()) next.title = "Title is required";
    if (!premise.trim()) next.premise = "Premise is required";
    if (!tone.trim()) next.tone = "Tone is required";
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
    <form method="POST" action="/api/projects/create" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="title"
        label="Title"
        value={title}
        onChange={(v) => {
          setTitle(v);
          clearError("title");
        }}
        placeholder="My adventure game"
        error={errors.title}
        icon={<FolderPlus className="size-4" />}
      />

      <div>
        <label htmlFor="premise" className="mb-1 block text-sm text-blue-100/80">
          Premise
        </label>
        <textarea
          id="premise"
          name="premise"
          value={premise}
          onChange={(e) => {
            setPremise(e.target.value);
            clearError("premise");
          }}
          placeholder="What is this game about?"
          rows={3}
          className={cn(
            "w-full rounded-lg border bg-white/10 px-3 py-2 text-white placeholder-white/40 transition-colors focus:ring-2 focus:outline-none",
            errors.premise ? "border-red-400/60 focus:ring-red-400" : "border-white/20 focus:ring-purple-400",
          )}
        />
        {errors.premise && <p className="mt-1 text-xs text-red-300">{errors.premise}</p>}
      </div>

      <FormField
        id="tone"
        label="Tone"
        value={tone}
        onChange={(v) => {
          setTone(v);
          clearError("tone");
        }}
        placeholder="Whimsical, noir, ..."
        error={errors.tone}
        icon={<Sparkles className="size-4" />}
      />

      <ServerError message={serverError} />

      <SubmitButton pendingText="Creating project..." icon={<FolderPlus className="size-4" />}>
        Create project
      </SubmitButton>
    </form>
  );
}
