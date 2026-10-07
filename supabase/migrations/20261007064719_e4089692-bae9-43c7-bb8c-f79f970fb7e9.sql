CREATE POLICY "attachments read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attachments' AND private.in_my_org((storage.foldername(name))[1]));
CREATE POLICY "attachments write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND private.in_my_org((storage.foldername(name))[1]));
CREATE POLICY "attachments delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND private.in_my_org((storage.foldername(name))[1]));