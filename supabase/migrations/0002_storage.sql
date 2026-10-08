-- Storage bucket for question media (images, audio, video).
-- Public read so <img>/<audio>/<video> tags can load without signed URLs.

insert into storage.buckets (id, name, public)
values ('quiz-media', 'quiz-media', true)
on conflict (id) do nothing;

drop policy if exists "quiz-media upload for authenticated" on storage.objects;
create policy "quiz-media upload for authenticated"
  on storage.objects
  for insert
  with check (bucket_id = 'quiz-media' and auth.role() = 'authenticated');

drop policy if exists "quiz-media update for authenticated" on storage.objects;
create policy "quiz-media update for authenticated"
  on storage.objects
  for update
  using (bucket_id = 'quiz-media' and auth.role() = 'authenticated')
  with check (bucket_id = 'quiz-media' and auth.role() = 'authenticated');

drop policy if exists "quiz-media delete for authenticated" on storage.objects;
create policy "quiz-media delete for authenticated"
  on storage.objects
  for delete
  using (bucket_id = 'quiz-media' and auth.role() = 'authenticated');

drop policy if exists "quiz-media public read" on storage.objects;
create policy "quiz-media public read"
  on storage.objects
  for select
  using (bucket_id = 'quiz-media');
