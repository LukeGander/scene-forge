-- named creator_notes, not notes, to avoid confusion with the pre-existing scenes.note column
alter table public.scene_cards
  add column creator_notes text not null default '';

update public.scene_cards
set design_risks = (
  select coalesce(jsonb_agg(jsonb_build_object('risk', risk_text, 'acknowledged', false)), '[]'::jsonb)
  from jsonb_array_elements_text(design_risks) as risk_text
)
where jsonb_typeof(design_risks) = 'array';
