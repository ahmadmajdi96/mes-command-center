ALTER TABLE public.bom_items DROP CONSTRAINT bom_items_qty_check;
ALTER TABLE public.bom_items ADD CONSTRAINT bom_items_qty_check CHECK (qty > 0);
ALTER TABLE public.production_versions ADD CONSTRAINT production_versions_valid_range CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from);