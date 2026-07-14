
CREATE POLICY "mes-evidence read" ON storage.objects FOR SELECT USING (bucket_id = 'mes-evidence');
CREATE POLICY "mes-evidence insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'mes-evidence');
CREATE POLICY "mes-evidence update" ON storage.objects FOR UPDATE USING (bucket_id = 'mes-evidence');
CREATE POLICY "mes-evidence delete" ON storage.objects FOR DELETE USING (bucket_id = 'mes-evidence');
