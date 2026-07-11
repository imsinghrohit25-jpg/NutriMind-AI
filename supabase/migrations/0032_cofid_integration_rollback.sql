-- Rollback: 0032_cofid_integration
BEGIN;

DELETE FROM public.data_sources WHERE id = 'cofid_2021';

-- Revert food_groups PK to its pre-0032 bare-code form. Note: this is only safe to run if no
-- rows from two different sources share the same code at rollback time (true immediately after
-- a CoFID rollback, since CoFID's own rows are removed by the data import's own rollback path
-- before this migration rollback would ever run in practice).
ALTER TABLE public.food_groups DROP CONSTRAINT food_groups_pkey;
ALTER TABLE public.food_groups ADD CONSTRAINT food_groups_pkey PRIMARY KEY (code);

COMMIT;
