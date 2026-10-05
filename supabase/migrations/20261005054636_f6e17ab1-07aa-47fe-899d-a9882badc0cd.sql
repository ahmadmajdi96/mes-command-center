ALTER TABLE public.routing_operations
  ADD CONSTRAINT routing_operations_sequence_nonneg CHECK (sequence >= 0),
  ADD CONSTRAINT routing_operations_setup_nonneg CHECK (setup_min >= 0),
  ADD CONSTRAINT routing_operations_run_nonneg CHECK (run_min_per_unit >= 0);
ALTER TABLE public.boms ADD CONSTRAINT boms_base_qty_positive CHECK (base_qty > 0);